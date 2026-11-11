---
title: Constructs the Markdown pages use
description: Formatting this file must not change what it means.
---

## A list that goes on after a paragraph

1. First step.
2. Second step.

Code: `apps/web/src/lib/target-face.ts`, `matchFaces`.

3. A list that starts at 3 and needs the blank line above it.
4. Its next item.

## A list directly after a paragraph, then a repeated blank line

Steps:
- First.
- Second.


Text after two blank lines.

## Code spans after text

| Kind | Field | Type, unit | Notes |
|---|---|---|---|
| `firearmBarrel` (phase 2) | `id`, `manufacturer`, `name`, `chamber` | as variant | an aftermarket barrel is a catalogue part; the only part that carries ballistic data |
| | `length`, `twist`, `twistHand`, `grooves`, diameters | as variant `barrel` | plus `profile` text, `mass` g |

Text with *emphasis*, __strong__ text, `code` after a word and a [link](https://example.org/).

## Nesting and blocks

- An item
  - a nested item
    1. a numbered one

> A quote with `code`.

:::note
An admonition.
:::

<details><summary>More</summary>

Hidden text.

</details>

```js
console.log(1) // 1
```

$$
S = \sum_j a_j
$$
