'use client'

import Link from '@/platform/link.tsx'
import { loadEnglish } from '../i18n/lingui.ts'
import type { NewsItem } from '../lib/news.ts'
import englishMessages from '../locales/en/components/home-news.json' with { type: 'json' }
import { Panel } from './panel.tsx'

loadEnglish(englishMessages)

/** The home page's What's new list: a client component, so the browser has the English of its title. */
export function HomeNews({ items }: { items: NewsItem[] }) {
  return (
    <Panel
      id="home-news"
      title={/*i18n*/ { id: 'homeNews.title', message: "What's new" }}
      translated
    >
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
