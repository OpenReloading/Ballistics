// The WHATWG `URL`, which every runtime has and the ES library of this package lacks: zod's declarations name the
// type, and `provenance.ts` constructs one. Only what the package uses, so the type merges with the DOM and Node
// declarations; test/tsconfig.json has Node's and leaves this file out.
// oxlint-disable-next-line typescript/no-empty-interface, no-redeclare -- empty so it merges with the DOM and Node `URL`; an interface and a `var` of one name are one declaration
interface URL {}
declare var URL: new (url: string) => URL
