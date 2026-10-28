---
title: Translating the interface
sidebar_position: 4
---

# Translating the interface

The web app's language is a setting (Settings, General, Language). There is one set of pages and URLs. English is the text in the source; each other language is one catalogue file that the browser loads when the language is chosen. A text a catalogue lacks is shown in English.

## Write a text

- Use `useTranslation()` from `src/i18n/language.ts` in a component: `const { t, tn } = useTranslation()`.
- `t('Close settings')` translates one text. Placeholders are `{name}`: `t('Value {n}', { n: 12.5 })`. A number value is written with the decimal mark of the language and no digit grouping.
- `tn(count, '{count} record', '{count} records')` picks the plural form of the language shown. `{count}` is filled in.
- Data that is shown later (page labels, table headings) is marked where it is defined with `msg('Cartridges')`, which returns the text itself, and translated where it is shown with `t(label)`.
- Pass literals only. A text built at run time does not compile, because the extraction reads the source. Build a sentence from placeholders, not by joining pieces: word order differs between languages.
- Text in JSX goes through an expression: `{t('Close')}`.
- Record names as published, exported file field names and the text inside the packages are not translated.
- A function that writes text takes the translator as its last parameter (`t`, and `tn` for counts). Text that a file or a link writes passes `english.t` from `src/i18n/translate.ts`. A printed page (report, load sheets, range card, target sheet) follows the language shown: it takes `t` like the screen, and its date is `printDay(new Date(), language)`.
- A field spec's label and help are `msg` values; `specText(t, text)` translates them and `fieldError(spec, value, shown, t)` writes the error.
- A refusal, reason code or warning that came from the packages or the API stays English where it is held. Translate it where it is shown with `translateMessage(text, t)` (`src/lib/core-messages.ts`) and add it to `src/lib/core-message-table.json` (the warning codes are in `core-message-table.ts`), keyed by its code or, for a refusal without a code, by its sentence with placeholders, and its German text to the catalogue. `apps/web/test/core-messages.test.ts` fails for a message of `packages/core/src` or `packages/api/src` the table lacks.
- Rows that must stay on one line (the workbench's input rows and readouts) take the German words as they are: a long term is shortened in the catalogue or the label takes a smaller size under `:lang(de)`. `tests/web/workbench-no-scroll.spec.ts` runs the workbench in German at 1280 x 650.

## Numbers, dates and country names

These follow the language shown and need no catalogue text. Under German a decimal is written with a comma (`2,5`), a date and a country name come from `Intl`. English is unchanged.

What the app stores and exports never changes: field values, URLs, share links, saved loads, your data files, CSV, JSON, downloads and the table copied as CSV keep the point (`2.5`).

- Write a number on screen with `formatNumber`, `fixedNumber`, `plainNumber` or `localizeNumber` (a canonical text) from `src/i18n/number.ts`. Never `toFixed`, `String(n)` or a number in a template string. A number inside a `t` placeholder is already written with the language's mark.
- A number inside text that a server build wrote takes `<Decimal text>` or a `numeric` field row; a date `dayText` and a country `countryName`.
- A file or the clipboard writes the canonical form: pass `'en'` to `formatNumber`, or `canonicalNumberText` for text that came from the screen.
- Read typed or pasted text only with `parseNumber(input, { min, max, integer }, language)`. Do not run text the app generated through it.

### What a typed number means

Surrounding spaces and the minus sign U+2212 are tolerated. An empty text is empty. The rest must be an optional sign, digits with `.` or `,`, and an optional exponent (`e5`, `E-3`). A unit, a letter, a space inside the number, an apostrophe, `0x10` and `Infinity` are invalid. A leading (`,5`) or trailing (`1,`) mark is read.

- Both marks present: the last one is the decimal mark and the other must group digits in threes (`1.234,5` in German, `1,234.5` in English). Anything else is invalid.
- One mark, the language's own (the comma in German, the point in English): a decimal mark, always. `2.800` in English and `2,800` in German are 2.8.
- One mark, the other one: a decimal mark (`1,5` in English is 1.5, `2.5` in German is 2,5), with one exception. When exactly three digits follow and the whole part has one to three digits and does not start with 0 (`1,234` in English, `1.234` in German) it may be a thousands group. The reading that lies inside the field's range and whole-number rule is taken when only one does. When both fit, the text is ambiguous: it is refused with a message that asks for `1,234` as a decimal or `1234` as a whole number. When neither fits, the decimal reading stands and the range error follows.
- A mark that repeats groups in threes only when it is not the language's own (`1.234.567` is 1234567 in German and invalid in English; `1,234,567` the other way round).

## Find what is untranslated

```sh
npm run i18n -w @open-reloading/web -- missing de   # English messages without a German text
npm run i18n -w @open-reloading/web -- messages     # every message in the sources
```

`missing` also lists catalogue keys that no message matches (a text that was reworded in the source) and then exits with 1. The test `apps/web/test/i18n-catalogue.test.ts` fails on such a key.

## Add a language

1. Add the language to `languages` and `loaders` in `apps/web/src/i18n/language.ts`: its code (a BCP 47 language tag such as `fr`) and its own name (`Français`). `loaders` is typed over `languages`, so the build fails until both are there.
2. Create `apps/web/src/i18n/<code>.json`: the English text as key and its translation as value, or for a plural the key `one|other` (the two English forms, as in the `tn` call) and an object of the plural forms of the language by CLDR category (`one` and `other` in English and German; `Intl.PluralRules('<code>').resolvedOptions().pluralCategories` lists a language's categories). A translation keeps the placeholders of its key.
3. Run `missing <code>` until it lists nothing you want to translate.
4. `npm test -w @open-reloading/web` checks every catalogue: no key without a message, equal placeholders, only categories of the language.

The German catalogue follows the term table `apps/web/src/i18n/german-terms.json`. A verified term is used as the table gives it. A disputed term takes one of its candidates until the owner decides. Another language has no table yet: add one with the same shape if the language needs one.
