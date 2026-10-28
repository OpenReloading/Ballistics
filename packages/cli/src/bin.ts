#!/usr/bin/env node
import { run } from './main.ts'

process.exitCode = await run(process.argv.slice(2), process.env, {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
  tty: process.stdout.isTTY === true,
})
