import Link from 'next/link'
import { msg } from '../i18n/translate.ts'
import type { NewsItem } from '../lib/news.ts'
import { Panel } from './panel.tsx'

/** The home page's What's new list: a server component, so it adds no client JavaScript. */
export function HomeNews({ items }: { items: NewsItem[] }) {
  return (
    <Panel id="home-news" title={msg("What's new")} translated>
      <ul className="home-news">
        {items.map((n) => (
          <li key={`${n.date}-${n.slug}`}>
            <time dateTime={n.date}>{n.date}</time>
            <div>
              <Link href={n.link}>{n.title}</Link>
              <p>{n.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
