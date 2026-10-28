import '../prototype-home.css'
import { PrototypeHome } from '../../components/prototype-home.tsx'
import { NewsPanel } from '../../components/prototype-news.tsx'
import { newestNews } from '../../lib/prototype-news.ts'

export default function Page() {
  return <PrototypeHome news={<NewsPanel items={newestNews()} />} />
}
