/** Where the server listens: `HOST` (default `127.0.0.1`, this machine only) and `PORT` (default 3000). */
export function listenOptions(env: NodeJS.ProcessEnv): { host: string; port: number } {
  return { host: env.HOST ?? '127.0.0.1', port: Number(env.PORT ?? 3000) }
}
