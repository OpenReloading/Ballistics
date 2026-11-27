import type { ImgHTMLAttributes } from 'react'

/** An image loaded lazily; Vite imports an image file as its URL. */
export default function Image({
  alt,
  ...img
}: ImgHTMLAttributes<HTMLImageElement> & { src: string; alt: string }) {
  return <img alt={alt} loading="lazy" decoding="async" {...img} />
}
