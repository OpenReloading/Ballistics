// The clock the interior task samples with, which every target runtime has and the ES library lacks.
declare var performance: { now(): number }
