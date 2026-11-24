import { titleTemplate } from '../lib/title-template.ts'

/** The head of a Start page: the title and description of its Next page. */
export const listHead = (title: string, description: string) => ({
  meta: [
    { title: titleTemplate.replace('%s', () => title) },
    { name: 'description', content: description },
  ],
})
