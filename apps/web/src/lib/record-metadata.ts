import type { Metadata, ResolvingMetadata } from 'next'

/** The root layout's title template: a page's `<title>` takes it, its Open Graph and Twitter titles do not. */
export const titleTemplate = '%s · OpenReloading Ballistics'

/**
 * The head tags of a record page: its own title and description, repeated in the Open Graph and
 * Twitter tags a link preview reads. A page's `openGraph` and `twitter` replace the layout's, so
 * those are spread from `parent` to keep the site image and the card type.
 */
export async function recordMetadata(
  parent: ResolvingMetadata,
  title: string,
  description: string,
): Promise<Metadata> {
  const { openGraph, twitter } = await parent
  return {
    title,
    description,
    openGraph: { ...openGraph, title, description },
    // a card with the site image is the large one, as the layout's tags read
    twitter: {
      ...twitter,
      ...((twitter?.images ?? openGraph?.images) && { card: 'summary_large_image' as const }),
      title,
      description,
    },
  }
}

/** The title and description of a cartridge record page, shared by its page and the prerender check. */
export function cartridgeHeadText(name: string) {
  return {
    title: `${name} dimensions and pressures`,
    description: `CIP dimensions and maximum pressures of ${name}, with sources.`,
  }
}
