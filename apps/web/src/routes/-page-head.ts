import { titleTemplate } from '../lib/title-template.ts'

/** The `<title>` and description of a page, as its Next page's metadata states them. */
export const pageHead = (title: string, description: string) => ({
  meta: [
    { title: titleTemplate.replace('%s', title) },
    { name: 'description', content: description },
  ],
})
