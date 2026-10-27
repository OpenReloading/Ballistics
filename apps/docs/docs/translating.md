---
title: Translating the interface
sidebar_position: 4
---

# Translating the interface

The web app's language is a setting (Settings, General, Language). There is one set of pages and URLs. English is the text in the source; each other language is one catalogue file that the browser loads when the language is chosen. A text a catalogue lacks is shown in English.

## Write a text

- Use `useTranslation()` from `src/i18n/language.ts` in a component: `const { t, tn } = useTranslation()`.
- `t('Close settings')` translates one text. Placeholders are `{name}`: `t('Value {n}', { n: 12.5 })`. A number value is written with the decimal separator of the language and no digit grouping.
- `tn(count, '{count} record', '{count} records')` picks the plural form of the language shown. `{count}` is filled in.
- Data that is shown later (page labels, table headings) is marked where it is defined with `msg('Cartridges')`, which returns the text itself, and translated where it is shown with `t(label)`.
- Pass literals only. A text built at run time does not compile, because the extraction reads the source. Build a sentence from placeholders, not by joining pieces: word order differs between languages.
- Text in JSX goes through an expression: `{t('Close')}`.
- Record names as published, exported file field names and the text inside the packages are not translated.

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
