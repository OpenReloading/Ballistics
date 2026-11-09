// The WHATWG `URL` as far as the package uses it, which every runtime has and its ES library lacks (zod's declarations name it, `provenance.ts` constructs one); its `var` conflicts with the DOM's and Node's `URL` (TS2403) instead of merging, so the file stays in this package's own compile, is not emitted, and test/tsconfig.json, which has Node's types, leaves it out; test/url-declaration.test.ts holds both
// oxlint-disable-next-line typescript/no-empty-interface, no-redeclare -- zod's declarations need the name only; an interface and a `var` of one name are one declaration
interface URL {}
declare var URL: new (url: string) => URL
