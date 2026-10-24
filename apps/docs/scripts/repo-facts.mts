/** The facts the navbar's repository widget shows. Each is absent when GitHub did not give it. */
export interface RepoFacts {
  tag?: string
  stars?: number
  forks?: number
}

/** The widget's own request, the build's `fetch` unless a test passes one. */
type Fetch = (url: string, init: RequestInit) => Promise<Response>

/**
 * Stars, forks and the latest release tag (else the newest tag) of a GitHub repository, read at
 * build time so the site makes no request to GitHub from the browser. Any failure (offline, rate
 * limit, timeout) leaves that fact out and never fails the build. `token` lifts the anonymous
 * rate limit.
 */
export async function repoFacts(
  repo: string,
  token = process.env.GITHUB_TOKEN,
  request: Fetch = fetch,
): Promise<RepoFacts> {
  // biome-ignore lint/suspicious/noExplicitAny: the few fields read below are checked by type
  const get = async (path: string): Promise<any> => {
    const response = await request(`https://api.github.com/repos/${repo}${path}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) throw new Error(`${path}: ${response.status}`)
    return response.json()
  }
  const latestTag = async (): Promise<unknown> => {
    try {
      return (await get('/releases/latest')).tag_name
    } catch {
      return (await get('/tags'))[0]?.name
    }
  }
  const [info, tag] = await Promise.all([
    get('').catch(() => undefined),
    latestTag().catch(() => undefined),
  ])
  const facts: RepoFacts = {}
  if (typeof tag === 'string') facts.tag = tag
  if (typeof info?.stargazers_count === 'number') facts.stars = info.stargazers_count
  if (typeof info?.forks_count === 'number') facts.forks = info.forks_count
  return facts
}
