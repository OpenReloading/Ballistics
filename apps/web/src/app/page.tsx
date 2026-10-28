import type { ReactNode } from 'react'
import { Home, RecordCount } from '../components/home.tsx'
import { HomeNews } from '../components/home-news.tsx'
import {
  listAllBullets,
  listAllCartridges,
  listAllCases,
  listAllPowders,
  listAllPrimers,
  listAllTargetFaces,
  listDisciplines,
} from '../lib/api.ts'
import { newestNews } from '../lib/news.ts'

/** A list's record count. */
async function Count({
  list,
}: {
  list: () => Promise<{ status: string; data?: unknown[] | undefined }>
}) {
  const r = await list()
  return r.status === 'ok' && r.data ? <RecordCount count={r.data.length} /> : null
}

// the records the API lists at build time. The firearms are the viewer's own
const inData: Record<string, ReactNode> = {
  '/cartridges': <Count list={listAllCartridges} />,
  '/bullets': <Count list={listAllBullets} />,
  '/powders': <Count list={listAllPowders} />,
  '/cases': <Count list={listAllCases} />,
  '/primers': <Count list={listAllPrimers} />,
  '/targets': <Count list={listAllTargetFaces} />,
  '/disciplines': <Count list={listDisciplines} />,
}

export default function HomePage() {
  return (
    <>
      <Home counts={inData} />
      <HomeNews items={newestNews()} />
    </>
  )
}
