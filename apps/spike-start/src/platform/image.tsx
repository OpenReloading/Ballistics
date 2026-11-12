// Stands in for `next/image` with `unoptimized` (as next.config.ts sets it): a plain img; Vite imports an image as its URL.
import type { ImgHTMLAttributes } from 'react'

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src: string | { src: string }
  priority?: boolean
  unoptimized?: boolean
  quality?: number
}

export default function Image({
  src,
  alt,
  priority: _p,
  unoptimized: _u,
  quality: _q,
  ...rest
}: Props) {
  return <img src={typeof src === 'string' ? src : src.src} alt={alt} {...rest} />
}
