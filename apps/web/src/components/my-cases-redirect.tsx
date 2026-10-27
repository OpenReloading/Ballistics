'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Loading } from './states.tsx'

/**
 * The route `/my-cases` of earlier links: a stored group (`?record=`) opens in the case group
 * editor, else the Cases list shows the groups as Mine rows. A redirect of the router, as the Pages
 * edition has no server redirects.
 */
export function MyCasesRedirect() {
  const router = useRouter()
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('record')
    router.replace(id ? `/cases/editor?${new URLSearchParams({ record: id })}` : '/cases?src=user')
  }, [router])
  return <Loading what="the cases" />
}
