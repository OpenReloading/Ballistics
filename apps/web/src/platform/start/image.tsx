import type { ImgHTMLAttributes } from 'react'

/** `next/image` in the Start build, unoptimized as next.config.ts sets it; Vite imports an image as its URL. */
export default function Image({
  alt,
  ...img
}: ImgHTMLAttributes<HTMLImageElement> & { src: string; alt: string }) {
  // oxlint-disable-next-line nextjs/no-img-element -- the Start build has no next/image
  return <img alt={alt} loading="lazy" decoding="async" {...img} />
}
