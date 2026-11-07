// zod's declarations, which the schema types reach, name the WHATWG `URL`, which the ES library of this package
// lacks. The file stays in this package's compile: it is not emitted, and test/tsconfig.json, which has Node's
// types, leaves it out.
// oxlint-disable-next-line typescript/no-empty-interface -- zod's declarations need the name only
interface URL {}
