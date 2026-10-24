import { describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.ts'
import type { Catalogue } from '../src/catalogue/types.ts'
import { inlineRunner } from '../src/compute/tasks.ts'
import { buildOpenApi } from '../src/openapi.ts'
import { API_VERSION } from '../src/version.ts'
import { undescribed } from './setup.ts'

const d = await buildOpenApi()

describe('buildOpenApi', () => {
  it('lists every public route under /v1 and nothing else', () => {
    const routes = Object.entries(d.paths).flatMap(([p, m]) =>
      Object.keys(m).map((method) => `${method.toUpperCase()} ${p}`),
    )
    expect(routes.sort()).toEqual(
      [
        'GET /v1/bullets',
        'GET /v1/bullets/{id}',
        'GET /v1/cartridges',
        'GET /v1/cartridges/{id}',
        'GET /v1/disciplines',
        'GET /v1/disciplines/{id}',
        'GET /v1/exterior/stability',
        'GET /v1/federations',
        'GET /v1/federations/{id}',
        'GET /v1/manufacturers',
        'GET /v1/manufacturers/{id}',
        'GET /v1/powders',
        'GET /v1/powders/{id}',
        'GET /v1/target-faces',
        'GET /v1/target-faces/{id}',
        'GET /v1/target-mappings',
        'GET /v1/target-mappings/{id}',
        'POST /v1/exterior/trajectory',
        'POST /v1/exterior/truing',
        'POST /v1/exterior/range-strings/fit',
        'POST /v1/exterior/range-strings/plan',
        'POST /v1/interior',
        'POST /v1/interior/charge-target',
        'POST /v1/interior/load-file',
      ].sort(),
    )
    expect(d.paths['/v1/interior']?.post?.requestBody).toBeDefined()
    expect(d.info.version).toBe(API_VERSION)
  })

  it('documents the statuses each route answers, errors with the shared body', () => {
    const statuses = (path: string, method: string) =>
      Object.keys(d.paths[path]?.[method]?.responses ?? {})
    expect(statuses('/v1/target-faces', 'get')).toEqual(['200', '500'])
    expect(statuses('/v1/cartridges', 'get')).toEqual(['200', '400', '500'])
    expect(statuses('/v1/bullets/{id}', 'get')).toEqual(['200', '400', '404', '414', '500'])
    expect(statuses('/v1/exterior/stability', 'get')).toEqual(['200', '400', '404', '422', '500'])
    for (const path of ['/v1/interior', '/v1/interior/load-file', '/v1/interior/charge-target'])
      expect(statuses(path, 'post')).toEqual([
        '200',
        '400',
        '404',
        '413',
        '415',
        '422',
        '500',
        '503',
      ])
    const ops = Object.values(d.paths).flatMap((m) => Object.values(m))
    for (const op of ops)
      for (const [status, r] of Object.entries(op.responses)) {
        expect(r.description).toBeTruthy()
        if (status !== '200')
          expect(r.content?.['application/json'].schema).toEqual({
            $ref: '#/components/schemas/Error',
          })
      }
    expect(d.components.schemas.Error.required).toEqual(['statusCode', 'error', 'message'])
    // the read routes' bodies come from the record schemas
    const record = d.paths['/v1/powders/{id}']?.get?.responses[200]?.content?.['application/json']
    expect(record?.schema).toMatchObject({ type: 'object', additionalProperties: false })
    expect(JSON.stringify(d)).not.toContain('$defs')
  })
})

describe('the document and its reference viewer', () => {
  it('serves the document and the viewer under /v1, from the package, without other origins', async () => {
    const app = buildApp({ catalogue: {} as Catalogue, compute: inlineRunner, openApi: d })
    const json = await app.inject({ url: '/v1/openapi.json' })
    expect(json.statusCode).toBe(200)
    expect(json.json()).toEqual(d)
    const page = await app.inject({ url: '/v1/reference/' })
    expect(page.statusCode).toBe(200)
    expect(page.headers['content-type']).toContain('text/html')
    expect(page.body).toContain('../openapi.json')
    expect(page.body).not.toMatch(/(src|href)="https?:/)
    const script = await app.inject({ url: '/v1/reference/js/scalar.js' })
    expect(script.statusCode).toBe(200)
    expect(script.headers['content-type']).toContain('javascript')
    await app.close()
  })
})

describe('the description of every route', () => {
  it('has a summary, a description and a tag of the document', () => {
    const tags = d.tags.map((t) => t.name)
    for (const [path, methods] of Object.entries(d.paths))
      for (const [method, op] of Object.entries(methods)) {
        const name = `${method} ${path}`
        expect(op.summary, name).toBeTruthy()
        expect(op.description, name).toBeTruthy()
        expect(tags, name).toContain(op.tags?.[0])
        expect(op.responses[200]?.content?.['application/json'].schema, name).not.toEqual({
          type: 'object',
        })
      }
  })

  it('describes every parameter, numbers typed as numbers', () => {
    const ops = Object.values(d.paths).flatMap((m) => Object.values(m))
    for (const op of ops)
      for (const p of op.parameters ?? []) {
        expect(p.description, p.name).toBeTruthy()
        if (p.schema.type === 'string') expect(p.schema.pattern ?? '', p.name).not.toMatch(/\\d/)
      }
    const twist = d.paths['/v1/exterior/stability']?.get?.parameters?.find(
      (p) => p.name === 'twist',
    )
    expect(twist?.schema).toMatchObject({ type: 'number', minimum: 0.01, maximum: 10 })
  })

  it('describes every field of the load-file body', () => {
    const body = d.paths['/v1/interior/load-file']?.post?.requestBody
    expect(undescribed(body?.content['application/json'].schema)).toEqual([])
  })

  it('carries an example of every request body', () => {
    for (const [path, methods] of Object.entries(d.paths))
      for (const op of Object.values(methods))
        if (op.requestBody)
          expect(op.requestBody.content['application/json'].example, path).toBeDefined()
  })
})
