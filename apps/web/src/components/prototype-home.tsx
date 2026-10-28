'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { type ReactNode, Suspense } from 'react'
import { sections } from '../lib/sections.ts'
import { Home } from './home.tsx'
import { NavIcon } from './nav-icons.tsx'
import { PageBar } from './page-bar.tsx'
import { Panel } from './panel.tsx'
import { ContinueStrip } from './prototype-strip.tsx'
import { LinkButton } from './record-actions.tsx'

/** Variant A: the page as shipped. */
const A = () => <Home counts={{}} />

/** Variant B: A with the Continue strip above and What's new below. */
const B = ({ news, collapse }: { news: ReactNode; collapse: boolean }) => (
  <>
    <ContinueStrip collapse={collapse} />
    <Home counts={{}} />
    {news}
  </>
)

/** Variant C: a workbench-first page; the other tools become links, the Library cards come last. */
function C({ news, collapse }: { news: ReactNode; collapse: boolean }) {
  const [tools, library] = sections
  return (
    <>
      <PageBar title="OpenReloading Ballistics" titleHidden />
      <div className="home-hero">
        <p className="lead">
          A ballistics database with interior and exterior ballistics simulations
        </p>
        <LinkButton href="/workbench" size="lg" primary>
          Open load workbench
        </LinkButton>
        <ul>
          {tools?.pages
            .filter((p) => p.href !== '/workbench')
            .map((p) => (
              <li key={p.href}>
                <NavIcon name={p.icon} size={18} /> <Link href={p.href}>{p.label}</Link>
              </li>
            ))}
        </ul>
      </div>
      <ContinueStrip collapse={collapse} />
      {news}
      <Panel id="home-library" title="Library">
        <ul className="home-cards">
          {library?.pages.map((p) => (
            <li key={p.href}>
              <h3>
                <NavIcon name={p.icon} size={22} />
                <Link href={p.href}>{p.label}</Link>
              </h3>
              <p>{p.description}</p>
              <ul className="home-tabs">
                {p.tabs?.map((tab) => (
                  <li key={tab.href}>
                    <Link href={tab.href}>{tab.label}</Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  )
}

function Chosen({ news }: { news: ReactNode }) {
  const q = useSearchParams()
  const collapse = q.get('collapse') === '1'
  const v = q.get('v')
  return v === 'C' ? (
    <C news={news} collapse={collapse} />
  ) : v === 'B' ? (
    <B news={news} collapse={collapse} />
  ) : (
    <A />
  )
}

/** The three variants on one route, chosen by `?v=A|B|C` (A by default); `?collapse=1` lets the strip give its height back when empty. */
export function PrototypeHome({ news }: { news: ReactNode }) {
  return (
    <Suspense>
      <Chosen news={news} />
    </Suspense>
  )
}
