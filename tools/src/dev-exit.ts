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

/**
 * Registers SIGINT and SIGTERM handlers that mark the run as stopped and pass the signal on to the
 * process group `group()` returns, none while it returns `undefined` (before the server started).
 * A group that already exited is ignored, so cleanup still runs. Returns `stopped()`, which `devExit` takes, and the function that removes the handlers.
 */
export function stopOnSignal(
  group: () => number | undefined,
  kill: (pid: number, signal: NodeJS.Signals) => unknown = process.kill,
): { stopped: () => boolean; dispose: () => void } {
  let stopped = false
  const handlers = (['SIGINT', 'SIGTERM'] as const).map((signal) => {
    const handler = () => {
      stopped = true
      const pid = group()
      if (pid === undefined) return
      try {
        kill(-pid, signal)
      } catch (error) {
        // The group exited between the signal and the cleanup that follows it.
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
      }
    }
    process.on(signal, handler)
    return [signal, handler] as const
  })
  return {
    stopped: () => stopped,
    dispose: () => {
      for (const [signal, handler] of handlers) process.off(signal, handler)
    },
  }
}
