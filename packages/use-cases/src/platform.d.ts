// The clock the interior task samples with, which every target runtime has and the ES library lacks.
declare var performance: { now(): number }
// oxlint-disable-next-line typescript/no-empty-interface -- zod's declarations name it, every target runtime has it
interface URL {}
