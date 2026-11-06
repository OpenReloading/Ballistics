// The parts of the web platform this package uses, which every runtime it targets has and the ES library of
// this package lacks: only what the package calls, so the types merge with the DOM and Node declarations;
// test/tsconfig.json has Node's and leaves this file out. URL is named by zod's declarations.
// oxlint-disable-next-line typescript/no-empty-interface, no-redeclare -- an interface and a `var` of one name are one declaration, merging with the DOM and Node ones
interface URL {}
declare var URL: new (url: string) => URL

// oxlint-disable-next-line no-redeclare -- an interface and a `var` of one name are one declaration, merging with the DOM and Node ones
interface TextDecoder {
  decode(input: Uint8Array): string
}
declare var TextDecoder: new (
  label: string,
  options: { fatal: boolean; ignoreBOM: boolean },
) => TextDecoder

// oxlint-disable-next-line typescript/no-empty-interface, no-redeclare -- an interface and a `var` of one name are one declaration, merging with the DOM and Node ones
interface DecompressionStream {}
declare var DecompressionStream: new (format: 'deflate-raw') => DecompressionStream

/** The reader of a byte stream: `read` until done, `cancel` to stop early. */
interface ByteStreamReader {
  read(): Promise<{ done: true; value?: undefined } | { done: false; value: Uint8Array }>
  cancel(): Promise<void>
}
/** A byte stream, piped through a decompression and read. */
interface ByteStream {
  pipeThrough(transform: DecompressionStream): ByteStream
  getReader(): ByteStreamReader
}

// oxlint-disable-next-line no-redeclare -- an interface and a `var` of one name are one declaration, merging with the DOM and Node ones
interface Blob {
  stream(): ByteStream
}
declare var Blob: new (parts: Uint8Array[]) => Blob

// oxlint-disable-next-line no-redeclare -- an interface and a `var` of one name are one declaration, merging with the DOM and Node ones
interface Response {
  text(): Promise<string>
}
declare var Response: new (body: Uint8Array) => Response
