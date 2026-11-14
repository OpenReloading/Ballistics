// The clock the interior task samples with, which every target runtime has and the ES library lacks.
declare var performance: { now(): number }
// oxlint-disable-next-line typescript/no-empty-interface -- zod's declarations name it, every target runtime has it
interface URL {}
// Web Crypto and the text encoder the catalogue hashes with, which every target runtime has and the ES library lacks.
declare var crypto: {
  subtle: { digest(algorithm: 'SHA-256', data: Uint8Array): Promise<ArrayBuffer> }
}
declare class TextEncoder {
  encode(input: string): Uint8Array
}
