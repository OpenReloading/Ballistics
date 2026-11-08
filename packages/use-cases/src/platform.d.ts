// The clock the interior task samples with, which every runtime this package targets has and its ES library lacks.
// The file stays in this package's compile: it is not emitted, and test/tsconfig.json, which has Node's types, leaves it out.
declare var performance: { now(): number }
