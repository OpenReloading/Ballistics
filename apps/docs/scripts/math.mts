import type { VFile } from 'vfile'

/** KaTeX options of the docs pages: input that is not valid LaTeX and any render error throw instead of rendering in red. */
export const katexOptions = { strict: 'error', throwOnError: true } as const

/** A rehype plugin, after rehype-katex, that fails the page on a formula KaTeX could not render; rehype-katex reports it as a message and renders it anyway. */
export const failOnMathErrors = () => (_tree: unknown, file: VFile) => {
  const lineOf = (message: VFile['messages'][number]) =>
    // A $$ block's code has no position; remark-math puts it on the enclosing pre.
    message.line ?? message.ancestors?.filter((node) => node.position).at(-1)?.position?.start.line
  const errors = file.messages
    .filter((message) => message.source === 'rehype-katex')
    .map((message) => `line ${lineOf(message)}: ${String(message.cause)}`)
  if (errors.length > 0) file.fail(`KaTeX could not render:\n${errors.join('\n')}`)
}
