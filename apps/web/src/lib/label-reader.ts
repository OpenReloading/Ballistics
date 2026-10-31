/**
 * Reads a box label's QR code from a photo or a camera frame in the browser (`jsqr`, loaded on
 * first use). Nothing is uploaded or stored.
 */
import type { RgbaImage } from './image.ts'

/** The long side, in px, a photo or frame is read at: a label that fills a fair part of it has modules of several px. */
const readSide = 1280

/** The text of the QR code in `image`, or undefined. Labels print dark on light: no inverted search. */
export async function readCode(image: RgbaImage) {
  const { default: jsQR } = await import('jsqr')
  return jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' })?.data
}

/** A part of a picture (x, y, w, h in picture px) and the size it is read at. */
export type Try = { x: number; y: number; w: number; h: number; width: number; height: number }

/**
 * The parts of a `width` x `height` picture read in turn: the whole with its long side at most
 * `side`, then once its middle half at the same size, which reads a small label at twice the scale.
 */
export function photoTries(width: number, height: number, side = readSide): Try[] {
  const at = (x: number, y: number, w: number, h: number): Try => {
    const k = Math.min(1, side / Math.max(w, h))
    return { x, y, w, h, width: Math.round(w * k), height: Math.round(h * k) }
  }
  return [at(0, 0, width, height), at(width / 4, height / 4, width / 2, height / 2)]
}

/** The pixels of `t` of a picture `source`, drawn on a canvas. */
export function pixelsOf(source: CanvasImageSource, t: Try): RgbaImage {
  const canvas = document.createElement('canvas')
  canvas.width = t.width
  canvas.height = t.height
  const g = canvas.getContext('2d', { willReadFrequently: true })
  if (!g) throw new Error('No canvas to read the photo.')
  g.drawImage(source, t.x, t.y, t.w, t.h, 0, 0, t.width, t.height)
  return g.getImageData(0, 0, t.width, t.height)
}

/** The QR text of a photo file, its orientation applied as the browser shows it, or undefined. */
export async function readPhoto(file: Blob) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() =>
    createImageBitmap(file),
  )
  try {
    for (const t of photoTries(bitmap.width, bitmap.height)) {
      const text = await readCode(pixelsOf(bitmap, t))
      if (text) return text
    }
    return
  } finally {
    bitmap.close()
  }
}
