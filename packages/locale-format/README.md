# @open-reloading/locale-format

Writes numbers, values with their units and dates in a language on `Intl`, and holds the display unit tables: the units each quantity can be shown in and the unit presets. Every function takes the language as an argument. Its only dependency is `@open-reloading/units`. Private to this repository: it is not published.

Supported languages: those that write Latin digits with "." or "," as the decimal mark (today `en` and `de`). `decimalMark`, `inchText`, `canonicalNumberText` and reading a shown number back rely on that: Persian or Arabic-Indic digits would break them. A third language first settles whether to pin Latin digits or to type the language list.

```js
import { dayText, formatNumber, presetUnits, withUnit } from '@open-reloading/locale-format'

formatNumber(1234.5678, 2, 'de') // '1234,57'
withUnit('velocity', presetUnits('us'), 822.96, 'en') // '2700 ft/s'
dayText('2026-05-01', 'de') // '1. Mai 2026'
```

License: MIT
