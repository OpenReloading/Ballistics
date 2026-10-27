import type { ChildProcess } from 'node:child_process'

/**
 * Resolves when a development server exits on its own with code 0 or after `stopped()` (a signal
 * was passed on to it); rejects on any other exit, such as a port already in use.
 */
export function devExit(child: ChildProcess, stopped: () => boolean): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    child
      .on('error', reject)
      .on('exit', (code, signal) =>
        code === 0 || stopped()
          ? resolve()
          : reject(new Error(`the development server exited with ${signal ?? `code ${code}`}`)),
      )
  })
}
