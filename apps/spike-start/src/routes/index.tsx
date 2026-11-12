import { useLingui } from '@lingui/react'
import { PageBar } from '@open-reloading/ui'
import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const { i18n } = useLingui()
  return (
    <>
      <PageBar title={i18n._({ id: 'home.title', message: 'Ballistics' })} />
      <p>{i18n._({ id: 'home.lead', message: 'Simulations, not load data.' })}</p>
      <Link to="/$kind/$id/" params={{ kind: 'cartridges', id: '308-win' }}>
        308 Win.
      </Link>
    </>
  )
}
