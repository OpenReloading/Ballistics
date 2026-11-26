import type { ReactNode } from 'react'

import type { RepoFacts as Facts } from '../../scripts/repo-facts.mts'

// Icons: GitHub Octicons v19.33.0 (https://github.com/primer/octicons), MIT License, Copyright (c) 2026 GitHub Inc.
const github = (
  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path d="M6.766 11.328c-2.063-.25-3.516-1.734-3.516-3.656 0-.781.281-1.625.75-2.188-.203-.515-.172-1.609.063-2.062.625-.078 1.468.25 1.968.703.594-.187 1.219-.281 1.985-.281.765 0 1.39.094 1.953.265.484-.437 1.344-.765 1.969-.687.218.422.25 1.515.046 2.047.5.593.766 1.39.766 2.203 0 1.922-1.453 3.375-3.547 3.64.531.344.89 1.094.89 1.954v1.625c0 .468.391.734.86.547C13.781 14.359 16 11.53 16 8.03 16 3.61 12.406 0 7.984 0 3.563 0 0 3.61 0 8.031a7.88 7.88 0 0 0 5.172 7.422c.422.156.828-.125.828-.547v-1.25c-.219.094-.5.156-.75.156-1.031 0-1.64-.562-2.078-1.609-.172-.422-.36-.672-.719-.719-.187-.015-.25-.093-.25-.187 0-.188.313-.328.625-.328.453 0 .844.281 1.25.86.313.452.64.655 1.031.655s.641-.14 1-.5c.266-.265.47-.5.657-.656" />
  </svg>
)
const tag = (
  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path d="M1 7.775V2.75C1 1.784 1.784 1 2.75 1h5.025c.464 0 .91.184 1.238.513l6.25 6.25a1.75 1.75 0 0 1 0 2.474l-5.026 5.026a1.75 1.75 0 0 1-2.474 0l-6.25-6.25A1.752 1.752 0 0 1 1 7.775Zm1.5 0c0 .066.026.13.073.177l6.25 6.25a.25.25 0 0 0 .354 0l5.025-5.025a.25.25 0 0 0 0-.354l-6.25-6.25a.25.25 0 0 0-.177-.073H2.75a.25.25 0 0 0-.25.25ZM6 5a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" />
  </svg>
)
const star = (
  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Zm0 2.445L6.615 5.5a.75.75 0 0 1-.564.41l-3.097.45 2.24 2.184a.75.75 0 0 1 .216.664l-.528 3.084 2.769-1.456a.75.75 0 0 1 .698 0l2.77 1.456-.53-3.084a.75.75 0 0 1 .216-.664l2.24-2.183-3.096-.45a.75.75 0 0 1-.564-.41L8 2.694Z" />
  </svg>
)
const fork = (
  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 1 1.5 0v.878a2.25 2.25 0 0 1-2.25 2.25h-1.5v2.128a2.251 2.251 0 1 1-1.5 0V8.5h-1.5A2.25 2.25 0 0 1 3.5 6.25v-.878a2.25 2.25 0 1 1 1.5 0ZM5 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Zm6.75.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm-3 8.75a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z" />
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

/** Like Material for MkDocs' source widget, all one link; static markup, so the facts are as fresh as the last build, and without them the link shows icon and name only. */
export default function RepoWidget({ repo, facts = {}, mobile }: Props): ReactNode {
  const link = (
    <a
      className={`repo-widget ${mobile ? 'menu__link' : 'navbar__item'}`}
      href={`https://github.com/${repo}`}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className="repo-widget__icon">{github}</span>
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
