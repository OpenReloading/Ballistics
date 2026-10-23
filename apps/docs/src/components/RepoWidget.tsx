import type { ReactNode } from 'react'

import type { RepoFacts as Facts } from '../../scripts/repo-facts.mts'

const git = (
  <svg viewBox="0 0 448 512" aria-hidden="true" focusable="false">
    <path d="M439.55 236.05 244 40.45a28.87 28.87 0 0 0-40.81 0l-40.66 40.63 51.52 51.52c27.06-9.14 52.68 16.77 43.39 43.68l49.66 49.66c34.23-11.8 61.18 31 35.47 56.69-26.49 26.49-70.21-2.87-56-37.34L240.22 199v121.85c25.3 12.54 22.26 41.85 9.08 55a34.34 34.34 0 0 1-48.55 0c-17.57-17.6-11.07-46.91 11.25-56v-123c-20.8-8.51-24.6-30.74-18.64-45L142.57 101 8.45 235.14a28.86 28.86 0 0 0 0 40.81l195.61 195.6a28.86 28.86 0 0 0 40.8 0l194.69-194.69a28.86 28.86 0 0 0 0-40.81z" />
  </svg>
)
const tag = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M21.41 11.58 12.41 2.58A2 2 0 0 0 11 2H4a2 2 0 0 0-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58s1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41s-.23-1.06-.59-1.42ZM5.5 7A1.5 1.5 0 1 1 7 5.5 1.5 1.5 0 0 1 5.5 7Z" />
  </svg>
)
const star = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="m12 17.27 6.18 3.73-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
  </svg>
)
const fork = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M6 2a3 3 0 0 0-1 5.83V9a3 3 0 0 0 3 3h3v3.17a3 3 0 1 0 2 0V12h3a3 3 0 0 0 3-3V7.83a3 3 0 1 0-2 0V9a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V7.83A3 3 0 0 0 6 2Z" />
  </svg>
)

/** 1234 as "1.2k", 12 as "12". */
const count = (n: number): string =>
  n < 1000 ? `${n}` : `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`

interface Props {
  /** "owner/name" on GitHub. */
  repo: string
  /** Release tag, stars and forks read at build time (`scripts/repo-facts.mts`); absent ones are not shown. */
  facts?: Facts
  /** Inside the collapsed navbar's menu: a list item with the menu's link style. */
  mobile?: boolean
}

/**
 * Navbar item like Material for MkDocs' source widget: git icon, repository name, and under it
 * the latest release tag, stars and forks, all one link. Static markup: the facts are as fresh as
 * the last build, and without them the link shows icon and name only.
 */
export default function RepoWidget({ repo, facts = {}, mobile }: Props): ReactNode {
  const link = (
    <a
      className={`repo-widget ${mobile ? 'menu__link' : 'navbar__item'}`}
      href={`https://github.com/${repo}`}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className="repo-widget__icon">{git}</span>
      <span className="repo-widget__text">
        <span className="repo-widget__name">{repo}</span>
        {(facts.tag || facts.stars !== undefined || facts.forks !== undefined) && (
          <ul className="repo-widget__facts">
            {facts.tag && (
              <li title="Latest release">
                {tag}
                <span className="repo-widget__label">Latest release </span>
                {facts.tag}
              </li>
            )}
            {facts.stars !== undefined && (
              <li title="Stars">
                {star}
                <span className="repo-widget__label">Stars </span>
                {count(facts.stars)}
              </li>
            )}
            {facts.forks !== undefined && (
              <li title="Forks">
                {fork}
                <span className="repo-widget__label">Forks </span>
                {count(facts.forks)}
              </li>
            )}
          </ul>
        )}
      </span>
    </a>
  )
  return mobile ? <li className="menu__list-item">{link}</li> : link
}
