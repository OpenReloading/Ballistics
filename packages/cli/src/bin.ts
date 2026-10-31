#!/usr/bin/env node
import { report, run } from './main.ts'

const argv = process.argv.slice(2)
const io = {
  stdout: (text: string) => process.stdout.write(text),
  stderr: (text: string) => process.stderr.write(text),
  tty: process.stdout.isTTY === true,
}

// a reader that stops early (head, a pager) closes the pipe: that ends the run, it is no failure
process.stdout.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EPIPE') process.exit(0)
  process.exit(report(error, argv, io))
})

process.exitCode = await run(argv, process.env, io)
