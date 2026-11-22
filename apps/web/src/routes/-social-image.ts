import { basePath } from '../lib/edition.ts'

// the social image needs an absolute URL: only the deployment knows its origin
const origin = process.env.PAGES_URL
export const socialCard = origin ? 'summary_large_image' : 'summary'
const tags = {
  image: `${origin}${basePath}/opengraph-image.png`,
  'image:width': '1280',
  'image:height': '640',
  'image:alt': 'RangeFoundry Workbench',
}

/** The image tags of every page, the Open Graph ones repeated for Twitter as the Next export has them. */
export const socialImage = origin
  ? [
      { name: 'twitter:card', content: socialCard },
      ...Object.entries(tags).map(([tag, content]) => ({ property: `og:${tag}`, content })),
      ...Object.entries(tags).map(([tag, content]) => ({ name: `twitter:${tag}`, content })),
    ]
  : []
