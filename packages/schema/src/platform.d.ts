// The parts of the web platform the user data file and share link codec call, which every runtime this package targets has and its ES library lacks; the file stays in this package's compile, is not emitted, and test/tsconfig.json, which has Node's types, leaves it out
// oxlint-disable-next-line no-redeclare -- an interface and a `var` of one name are one declaration
interface TextEncoder {
  encode(input: string): Uint8Array<ArrayBuffer>
}
declare var TextEncoder: new () => TextEncoder

// oxlint-disable-next-line no-redeclare -- an interface and a `var` of one name are one declaration
interface TextDecoder {
  decode(input: Uint8Array): string
}
declare var TextDecoder: new () => TextDecoder

// oxlint-disable-next-line typescript/no-empty-interface, no-redeclare -- an interface and a `var` of one name are one declaration
interface CompressionStream {}
declare var CompressionStream: new (format: 'deflate-raw') => CompressionStream

// oxlint-disable-next-line typescript/no-empty-interface, no-redeclare -- an interface and a `var` of one name are one declaration
interface DecompressionStream {}
declare var DecompressionStream: new (format: 'deflate-raw') => DecompressionStream

/** A byte stream, piped through a compression or decompression. */
interface ByteStream {
  pipeThrough(transform: CompressionStream | DecompressionStream): ByteStream
}

// oxlint-disable-next-line no-redeclare -- an interface and a `var` of one name are one declaration
interface Blob {
  stream(): ByteStream
}
declare var Blob: new (parts: Uint8Array<ArrayBuffer>[]) => Blob

// oxlint-disable-next-line no-redeclare -- an interface and a `var` of one name are one declaration
interface Response {
  arrayBuffer(): Promise<ArrayBuffer>
}
declare var Response: new (body: ByteStream) => Response

declare function btoa(data: string): string
declare function atob(data: string): string
