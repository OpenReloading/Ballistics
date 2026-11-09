// zod's declarations, which the schema types reach, name the WHATWG `URL`, which the ES library of this package lacks; the file stays in this package's compile, is not emitted, and test/tsconfig.json, which has Node's types, leaves it out
// oxlint-disable-next-line typescript/no-empty-interface -- zod's declarations need the name only
interface URL {}
