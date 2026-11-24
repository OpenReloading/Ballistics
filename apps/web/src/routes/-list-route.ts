import { z } from 'zod'
import { titleTemplate } from '../lib/title-template.ts'

/** The head of a list page: the title and description of its Next page. */
export const listHead = (title: string, description: string) => ({
  meta: [
    { title: titleTemplate.replace('%s', () => title) },
    { name: 'description', content: description },
  ],
})

// the lists read their query from the address after mounting (`readDirectory`), so every key passes as written
export const listSearch = z.looseObject({})
