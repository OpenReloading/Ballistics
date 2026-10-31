#!/usr/bin/env node
import { run } from './main.ts'

// a reader that stops early (head, a pager) closes the pipe: that ends the run, it is no failure
process.stdout.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code !== 'EPIPE') process.stderr.write(`error: ${error.message}\n`)
  process.exit(error.code === 'EPIPE' ? 0 : 3)
})

process.exitCode = await run(process.argv.slice(2), process.env, {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
  tty: process.stdout.isTTY === true,
})
