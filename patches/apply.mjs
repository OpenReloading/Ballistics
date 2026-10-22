// Patches of installed packages, applied after `npm ci` and `npm install` (root `postinstall`).
// Plain find and replace instead of patch-package: its dependencies (braces, no fixed version) fail
// `npm audit --audit-level=high`. A file that holds neither the old nor the new text (a Mantine
// upgrade) stops the install: check whether upstream fixed the problem, then drop or adapt the edit.
// A package that is not installed (the API image has no Mantine) is skipped.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * With the page inside `AppShell.Main`, a streamed page is client-rendered once AppShell
 * gives its context a new value after mounting (its `useId` and `useResizing` set state in
 * effects), which leaves a hidden server copy of the page (`div#S:0`) in the document. AppShell
 * builds the value of its context anew on every render; the patch memoizes it on the inputs that
 * make it differ: the primitives and the props `getStyles` reads. `list-streaming.spec.ts` fails
 * without it. Upstream: mantinedev/mantine#9303 (issue), mantinedev/mantine#9304 (fix).
 */
const original = `{
\t\t\tgetStyles,
\t\t\twithBorder,
\t\t\tzIndex,
\t\t\tdisabled,
\t\t\toffsetScrollbars,
\t\t\tmode,
\t\t\tresize,
\t\t\trootRef,
\t\t\tresizeOffsets
\t\t}`
const memo = (hook) =>
  `${hook}(() => (${original.replaceAll('\t\t\t', '\t\t').replace('\t\t}', '\t}')}), [withBorder, zIndex, disabled, offsetScrollbars, mode, resize, resizeOffsets.header, resizeOffsets.footer, classNames, className, style, styles, unstyled, vars, attributes])`

const edits = [
  {
    file: 'node_modules/@mantine/core/esm/components/AppShell/AppShell.mjs',
    pairs: [
      ['import { useRef } from "react";', 'import { useMemo, useRef } from "react";'],
      [
        `\treturn /* @__PURE__ */ jsxs(AppShellProvider, {\n\t\tvalue: ${original},`,
        `\tconst providerValue = ${memo('useMemo')};\n\treturn /* @__PURE__ */ jsxs(AppShellProvider, {\n\t\tvalue: providerValue,`,
      ],
    ],
  },
  {
    file: 'node_modules/@mantine/core/cjs/components/AppShell/AppShell.cjs',
    pairs: [
      [
        `\treturn /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(require_AppShell_context.AppShellProvider, {\n\t\tvalue: ${original},`,
        `\tconst providerValue = ${memo('(0, react.useMemo)')};\n\treturn /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(require_AppShell_context.AppShellProvider, {\n\t\tvalue: providerValue,`,
      ],
    ],
  },
]

// `--check` (the web app's prebuild and predev): fail when an installed file lacks the patch, as
// after a rebase onto a commit that added it without a new `npm ci`
const check = process.argv.includes('--check')
let failed = false
for (const { file, pairs } of edits) {
  const path = join(root, file)
  if (!existsSync(path)) continue
  if (check) {
    const installed = readFileSync(path, 'utf8')
    if (pairs.some(([, to]) => !installed.includes(to))) {
      console.error(`patches/apply.mjs: ${file} is not patched; run \`npm ci\``)
      failed = true
    }
    continue
  }
  let text = readFileSync(path, 'utf8')
  const before = text
  for (const [from, to] of pairs) {
    if (text.includes(to)) continue
    if (!text.includes(from)) {
      console.error(`patches/apply.mjs: ${file} holds neither the old nor the patched text`)
      failed = true
      continue
    }
    text = text.replace(from, () => to)
  }
  if (text !== before) {
    writeFileSync(path, text)
    console.log(`patched ${file}`)
  }
}
if (failed) process.exit(1)
