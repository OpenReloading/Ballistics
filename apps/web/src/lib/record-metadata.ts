import type { Metadata, ResolvingMetadata } from 'next'

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
