import { createFileRoute } from '@tanstack/react-router'
import { Home, RecordCount } from '../../../web/src/components/home.tsx'
import { HomeNews } from '../../../web/src/components/home-news.tsx'
import { catalogueIndex, news } from '../data.ts'

export const Route = createFileRoute('/')({
  loader: async () => {
    const index = await catalogueIndex()
    // the lists app/page.tsx counts, by their route
    const counts = {
      '/cartridges': index.cartridges.length,
      '/bullets': index.bullets.length,
      '/powders': index.powders.length,
      '/cases': index.cases.length,
      '/primers': index.primers.length,
      '/targets': index.targetFaces.length,
      '/disciplines': index.disciplines.length,
      '/federations': index.federations.length,
    }
    return { counts, news: await news() }
  },
  component: HomePage,
})

function HomePage() {
  const { counts, news } = Route.useLoaderData()
  return (
    <>
      <Home
        counts={Object.fromEntries(
          Object.entries(counts).map(([path, count]) => [path, <RecordCount count={count} />]),
        )}
      />
      <HomeNews items={news} />
    </>
  )
}
