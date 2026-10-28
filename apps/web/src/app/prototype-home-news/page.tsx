import '../prototype-home.css'
import { Home } from '../../components/home.tsx'
import { NewsPanel } from '../../components/prototype-news.tsx'
import { newestNews } from '../../lib/prototype-news.ts'

/** The shipped home with the news below it, to weigh the news alone. */
export default function Page() {
  return (
    <>
      <Home counts={{}} />
      <NewsPanel items={newestNews()} />
    </>
  )
}
