import Link from 'next/link'
import { type ReactNode, Suspense } from 'react'
import { NavIcon } from '../components/nav-icons.tsx'
import { PageBar } from '../components/page-bar.tsx'
import { Panel } from '../components/panel.tsx'
import { LinkButton } from '../components/record-actions.tsx'
import {
  listAllBullets,
  listAllCartridges,
  listAllPowders,
  listAllTargetFaces,
  listDisciplines,
} from '../lib/api.ts'
import { countText } from '../lib/lists.ts'
import { sections } from '../lib/sections.ts'
import { controlSize } from '../lib/theme.ts'

/** A list's record count, nothing while the API is unavailable (at run time `apiGet` throws). */
async function Count({ list }: { list: () => Promise<{ status: string; data?: unknown[] }> }) {
  const r = await list().catch(() => undefined)
  return r?.status === 'ok' && r.data ? countText(r.data.length, r.data.length, 'records') : null
}

// the records the API lists at build time. The firearms are the viewer's own
const inData: Record<string, ReactNode> = {
  '/cartridges': <Count list={listAllCartridges} />,
  '/bullets': <Count list={listAllBullets} />,
  '/powders': <Count list={listAllPowders} />,
  '/targets': <Count list={listAllTargetFaces} />,
  '/disciplines': <Count list={listDisciplines} />,
  '/firearms': 'In this browser',
}

/** A card's head: the page's icon left of its linked title. */
function CardTitle({ href, label }: { href: string; label: string }) {
  return (
    <h3>
      <NavIcon name={href} size={22} />
      <Link href={href}>{label}</Link>
    </h3>
  )
}

export default function Home() {
  const [tools, data] = sections
  return (
    <>
      <PageBar title="OpenReloading Ballistics" titleHidden />
      <div className="home-lead">
        <p className="lead">
          A ballistics database with interior and exterior ballistics simulations
        </p>
      </div>
      <Panel id="home-tools" title={tools.title}>
        <ul className="home-cards">
          {tools.pages.map((p) => (
            <li key={p.href}>
              <CardTitle href={p.href} label={p.label} />
              <p>{p.description}</p>
              <LinkButton
                href={p.href}
                size={controlSize.row.button}
                primary={p.href === '/workbench'}
                className="screen-only"
              >
                {`Open ${p.label.toLowerCase()}`}
              </LinkButton>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel id="home-data" title={data.title}>
        <ul className="home-cards">
          {data.pages.map((p) => (
            <li key={p.href}>
              <CardTitle href={p.href} label={p.label} />
              <p>{p.description}</p>
              <p className="home-count">
                <Suspense>{inData[p.href]}</Suspense>
              </p>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  )
}
