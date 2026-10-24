import { loadBundle } from '../bundle.ts'
import { writeCatalogue } from './node.ts'

// the build step: writes the index and the record file next to this module in `dist/`
writeCatalogue(loadBundle(), import.meta.dirname)
