// The WHATWG `URL`, which every runtime has and the ES library of this package lacks: zod's declarations name the
// type, and `provenance.ts` constructs one. Only what the package uses. Its `var` conflicts with the DOM's and
// Node's `URL` (TS2403) instead of merging with them, so the file stays in this package's own compile: the build
// does not emit it, and test/tsconfig.json, which has Node's types, leaves it out. test/url-declaration.test.ts
// holds both.
// oxlint-disable-next-line typescript/no-empty-interface, no-redeclare -- zod's declarations need the name only; an interface and a `var` of one name are one declaration
interface URL {}
declare var URL: new (url: string) => URL
