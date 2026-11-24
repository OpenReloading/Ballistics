import { createFileRoute } from '@tanstack/react-router'
import { Home, RecordCount } from '../components/home.tsx'
import { HomeNews } from '../components/home-news.tsx'
import { newestOf } from '../lib/news-items.ts'
import { readData } from './-data.ts'

// the build's news, by file name
const news = newestOf(
  Object.fromEntries(
    Object.entries(
      import.meta.glob<string>('../../news/*.md', {
        query: '?raw',
        import: 'default',
        eager: true,
      }),
    ).map(([file, text]) => [file.slice(file.lastIndexOf('/') + 1), text]),
  ),
)

export const Route = createFileRoute('/')({
  // the records each list holds in this build, by its route (scripts/prerender-list.mts)
  loader: async () => ((await readData('catalogue/counts')) ?? {}) as Record<string, number>,
  component: HomePage,
})

function HomePage() {
  const counts = Route.useLoaderData()
  return (
    <>
      <Home
        counts={Object.fromEntries(
          Object.entries(counts).map(([route, count]) => [
            route,
            <RecordCount key={route} count={count} />,
          ]),
        )}
      />
      <HomeNews items={news} />
    </>
  )
}
