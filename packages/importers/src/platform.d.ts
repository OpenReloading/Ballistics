// The parts of the web platform this package uses, which every runtime it targets has and the ES library of
// this package lacks: only what the package calls. The file stays in this package's compile: it is not
// emitted, and test/tsconfig.json leaves it out because its `var`s would conflict with Node's. The type URL
// is named by zod's declarations.
// oxlint-disable-next-line typescript/no-empty-interface -- zod's declarations need the name only
interface URL {}

// oxlint-disable-next-line no-redeclare -- an interface and a `var` of one name are one declaration
interface TextDecoder {
  decode(input: Uint8Array): string
}
declare var TextDecoder: new (
  label: string,
  options: { fatal: boolean; ignoreBOM: boolean },
) => TextDecoder

// oxlint-disable-next-line typescript/no-empty-interface, no-redeclare -- an interface and a `var` of one name are one declaration
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

// oxlint-disable-next-line no-redeclare -- an interface and a `var` of one name are one declaration
interface Blob {
  stream(): ByteStream
}
declare var Blob: new (parts: Uint8Array[]) => Blob

// oxlint-disable-next-line no-redeclare -- an interface and a `var` of one name are one declaration
interface Response {
  text(): Promise<string>
}
declare var Response: new (body: Uint8Array) => Response
