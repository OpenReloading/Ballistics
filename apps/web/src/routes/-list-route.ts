import { titleTemplate } from '../lib/title-template.ts'

/** The head of a list page: its title and description. */
export const listHead = (title: string, description: string) => ({
  meta: [
    { title: titleTemplate.replace('%s', () => title) },
    { name: 'description', content: description },
  ],
})
