import Link from 'next/link'
import type { NewsItem } from '../lib/prototype-news.ts'
import { Panel } from './panel.tsx'

/** The "What's new" list: a server component, so it adds no client JavaScript. */
export function NewsPanel({ items }: { items: NewsItem[] }) {
  return (
    <Panel id="home-news" title="What's new">
      <ul className="home-news">
        {items.map((n) => (
          <li key={n.slug}>
            <time dateTime={n.date}>{n.date}</time>
            <div>
              <Link href={n.href}>{n.title}</Link>
              <p>{n.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
