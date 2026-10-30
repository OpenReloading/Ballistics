import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, request } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, expect, it, onTestFinished } from 'vitest'
import { find, serve } from '../src/pages-serve.ts'

const dir = mkdtempSync(path.join(tmpdir(), 'pages-serve-'))
const root = path.join(dir, 'pages') + path.sep
mkdirSync(path.join(dir, 'pages', 'docs'), { recursive: true })
mkdirSync(path.join(dir, 'pages-evil'))
mkdirSync(path.join(root, 'empty'))
writeFileSync(path.join(root, 'index.html'), '')
writeFileSync(path.join(root, 'docs', 'index.html'), '')
writeFileSync(path.join(dir, 'pages-evil', 'secret.html'), '')
afterAll(() => rmSync(dir, { recursive: true }))

it('finds files and directories under the base path', () => {
  expect(find('/Ballistics', root, '/Ballistics')).toEqual({
    file: path.join(root, 'index.html'),
    directory: true,
  })
  expect(find('/Ballistics/docs/index.html', root, '/Ballistics')).toEqual({
    file: path.join(root, 'docs', 'index.html'),
  })
  expect(find('/Other/index.html', root, '/Ballistics')).toBeUndefined()
})

it('finds nothing for a malformed escape, a NUL byte or a path outside the root', () => {
  expect(find('/%E0%A4%A', root, '')).toBeUndefined()
  expect(find('/index.html%00', root, '')).toBeUndefined()
  expect(find('/..%2Fpages-evil%2Fsecret.html', root, '')).toBeUndefined()
  expect(find('/%2E%2E/pages-evil/secret.html', root, '')).toBeUndefined()
  expect(find('/index.html/x', root, '')).toBeUndefined()
})

it('answers 400 for a request target that is no path and 404 without a 404.html, and keeps serving', async () => {
  // no 404.html in this root: its read fails
  const server = createServer(serve(root, '')).listen(0)
  onTestFinished(() => {
    server.close()
  })
  await new Promise((done) => server.once('listening', done))
  const { port } = server.address() as AddressInfo
  const status = (target: string) =>
    new Promise<number | undefined>((done, fail) =>
      request({ port, path: target }, (res) => {
        res.resume()
        res.on('end', () => done(res.statusCode))
      })
        .on('error', fail)
        .end(),
    )
  expect(await status('//')).toBe(400)
  expect(await status('http://')).toBe(400)
  expect(await status('/missing.html')).toBe(404)
  expect(await status('/index.html')).toBe(200)
})

it('moves a directory without its slash to it and keeps the query', async () => {
  const server = createServer(serve(root, '')).listen(0)
  onTestFinished(() => {
    server.close()
  })
  await new Promise((done) => server.once('listening', done))
  const { port } = server.address() as AddressInfo
  const location = await new Promise<string | undefined>((done, fail) =>
    request({ port, path: '/docs?cartridge=308-win&units=si' }, (res) => {
      res.resume()
      res.on('end', () => done(res.headers.location))
    })
      .on('error', fail)
      .end(),
  )
  expect(location).toBe('/docs/?cartridge=308-win&units=si')
})

it('finds nothing for a path that only starts with the base path or a directory without index.html', () => {
  expect(find('/Ballisticsdocs/index.html', root, '/Ballistics')).toBeUndefined()
  expect(find('/Ballistics/empty', root, '/Ballistics')).toBeUndefined()
  expect(find('/Ballistics/empty/', root, '/Ballistics')).toBeUndefined()
})

it('sends the content type of each file extension', async () => {
  const types: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.txt': 'text/plain; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.webmanifest': 'application/manifest+json',
    '.bin': 'application/octet-stream',
  }
  for (const ext of Object.keys(types)) writeFileSync(path.join(root, `file${ext}`), '')
  const server = createServer(serve(root, '')).listen(0)
  onTestFinished(() => {
    server.close()
  })
  await new Promise((done) => server.once('listening', done))
  const { port } = server.address() as AddressInfo
  for (const [ext, type] of Object.entries(types)) {
    const sent = await new Promise<string | undefined>((done, fail) =>
      request({ port, path: `/file${ext}` }, (res) => {
        res.resume()
        res.on('end', () => done(res.headers['content-type']))
      })
        .on('error', fail)
        .end(),
    )
    expect(sent, ext).toBe(type)
  }
})

it('ends the answer where the 404 page fails after its head is sent, and keeps serving', async () => {
  // a 404.html that is a directory opens, then fails on its first read
  const broken = path.join(dir, 'broken') + path.sep
  mkdirSync(path.join(broken, '404.html'), { recursive: true })
  writeFileSync(path.join(broken, 'index.html'), '')
  const server = createServer(serve(broken, '')).listen(0)
  onTestFinished(() => {
    server.close()
  })
  await new Promise((done) => server.once('listening', done))
  const { port } = server.address() as AddressInfo
  const answer = (target: string) =>
    new Promise<string>((done) =>
      request({ port, path: target }, (res) => {
        res.on('data', () => {})
        res.on('end', () => done(`end ${res.statusCode}`))
        res.on('error', () => done(`broken ${res.statusCode}`))
      })
        .on('error', () => done('no answer'))
        .end(),
    )
  expect(await answer('/missing.html')).toMatch(/^(broken 404|no answer)$/)
  expect(await answer('/index.html')).toBe('end 200')
})
