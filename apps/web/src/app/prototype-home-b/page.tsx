import '../prototype-home.css'
import { Home } from '../../components/home.tsx'
import { NewsPanel } from '../../components/prototype-news.tsx'
import { ContinueStrip } from '../../components/prototype-strip.tsx'
import { newestNews } from '../../lib/prototype-news.ts'

/** Variant B as a page of its own, to weigh the strip and the news without the variant switch. */
export default function Page() {
  return (
    <>
      <ContinueStrip />
      <Home counts={{}} />
      <NewsPanel items={newestNews()} />
    </>
  )
}
