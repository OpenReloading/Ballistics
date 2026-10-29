import AxeBuilder from '@axe-core/playwright'
import { expect, type Locator, type Page, test } from '@playwright/test'
import { storeUnits } from './units.ts'
import { applyExampleLoad, loadForm } from './workbench.ts'
import { runExample } from './workbench-run.ts'

test.beforeEach(({ page }) => storeUnits(page))

/** The box of an element, rounded to a tenth of a pixel. */
const box = async (e: Locator) => {
  const b = await e.evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { top: r.top, left: r.left, width: r.width, height: r.height }
  })
  return Object.fromEntries(Object.entries(b).map(([k, v]) => [k, Math.round(v * 10) / 10]))
}

/** Runs a 5-step charge ladder, opens the Ladder table tab and gives the ladder target section. */
async function ladderTarget(page: Page) {
  await runExample(page)
  const form = loadForm(page)
  await form.getByLabel(/^Ladder steps/).fill('5')
  await form.getByLabel(/^Step size/).fill('0.15')
  await form.getByLabel(/^Step size/).press('Control+Enter')
  await expect(page.getByRole('group', { name: 'Charge ladder' }).getByRole('radio')).toHaveCount(
    5,
    { timeout: 15_000 },
  )
  await page.getByRole('tab', { name: 'Ladder table' }).click()
  const section = page.getByRole('region', { name: 'Ladder target', exact: true })
  await expect(section).toBeVisible()
  return section
}

const slotOf = (section: Locator) => section.getByRole('group', { name: 'Ladder target messages' })

/**
 * The boxes of what the message slot must not move (the fields, the print button, the slot and what
 * follows), read in one go and taken from the section's top: filling a field may scroll the tab's
 * panel, and the lot rows above load later. What follows counts by where it starts, its height
 * follows those rows.
 */
const positions = (section: Locator) =>
  section.evaluate((el) => {
    const round = (n: number) => Math.round(n * 10) / 10
    const top = el.getBoundingClientRect().top
    const of = (e: Element | null, whole: boolean) => {
      const r = (e as Element).getBoundingClientRect()
      return {
        top: round(r.top - top),
        left: round(r.left),
        ...(whole ? { width: round(r.width), height: round(r.height) } : {}),
      }
    }
    return {
      fields: of(el.querySelector('.ladder-target-fields'), true),
      print: of(el.querySelector('.ladder-target-fields button'), true),
      slot: of(el.querySelector('.message-slot'), true),
      next: of(el.nextElementSibling, false),
    }
  })

test('the ladder target messages move nothing: none, a warning and an error keep the controls in place', async ({
  page,
}) => {
  test.setTimeout(60_000)
  const section = await ladderTarget(page)
  const slot = slotOf(section)
  const before = await positions(section)
  await expect(slot.locator('.message')).toHaveCount(0)

  // a mark too big for a sheet: a warning with its word, in the slot
  const distance = section.getByLabel(/^Shooting distance/)
  const original = await distance.inputValue()
  await distance.fill('20000')
  await expect(slot.locator('.message')).toContainText('Warning: A mark of')
  expect(await positions(section)).toEqual(before)

  // an invalid field: an error, announced at once, the field marked invalid
  await distance.fill('')
  await expect(slot.locator('.message[data-severity="error"]')).toContainText(
    /^Error: .*Shooting distance/,
  )
  await expect(distance).toHaveAttribute('aria-invalid', 'true')
  // the error stays the field's description for screen readers, though it is drawn in the slot
  await expect(distance).toHaveAccessibleDescription(/Enter a number/)
  expect(await positions(section)).toEqual(before)

  // typing a key at a time, through valid, too big and empty values
  for (const typed of ['2', '20', '200', '2000', '20000', '2000', '200', '20', '2', '', original]) {
    await distance.fill(typed)
    expect(await positions(section)).toEqual(before)
  }
  await expect(slot.locator('.message')).toHaveCount(0)
})

test('the slot keeps its size with 1, 3 and 10 messages and its list is reached by keyboard', async ({
  page,
}) => {
  test.setTimeout(60_000)
  const section = await ladderTarget(page)
  const slot = slotOf(section)
  const before = await positions(section)
  await section.getByLabel(/^Shooting distance/).fill('20000')
  await expect(slot.locator('.message')).toHaveCount(1)
  for (const count of [1, 3, 10]) {
    // more messages than the ladder can raise, cloned from the one shown
    await slot.evaluate((el, n) => {
      const [first, ...rest] = el.querySelectorAll('.message')
      for (const e of rest) e.remove()
      for (let k = 1; k < n; k++) {
        const copy = (first as HTMLElement).cloneNode(true) as HTMLElement
        copy.querySelector('.mantine-Alert-message')?.append(` (${k + 1})`)
        el.append(copy)
      }
      el.scrollTop = 0
    }, count)
    await expect(slot.locator('.message')).toHaveCount(count)
    expect(await positions(section)).toEqual(before)
    // a slot takes focus only where it scrolls; End then scrolls it to the last message, with an
    // animation
    if (count === 1) {
      await expect(slot).not.toHaveAttribute('tabindex')
      continue
    }
    await expect(slot).toHaveAttribute('tabindex', '0')
    await slot.focus()
    await expect(slot).toBeFocused()
    await page.keyboard.press('End')
    await expect
      .poll(() =>
        slot.evaluate((el) => {
          const last = (el.lastElementChild as Element).getBoundingClientRect()
          return last.bottom <= el.getBoundingClientRect().bottom + 1
        }),
      )
      .toBe(true)
  }
})

test('each severity paints its own fill and text, axe clean in light and dark', async ({
  page,
}) => {
  test.setTimeout(60_000)
  const section = await ladderTarget(page)
  const slot = slotOf(section)
  await section.getByLabel(/^Shooting distance/).fill('20000')
  await expect(slot.locator('.message')).toHaveCount(1)
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    for (const [severity, token] of [
      ['info', 'info'],
      ['warning', 'warn'],
      ['error', 'error'],
    ] as const) {
      // the one message shown takes each severity in turn (info is not raised anywhere yet)
      const painted = await slot.locator('.message').evaluate(
        (el, [severity, token]) => {
          el.setAttribute('data-severity', severity as string)
          const colour = (variable: string) => {
            const probe = document.createElement('i')
            probe.style.color = `var(${variable})`
            el.append(probe)
            const value = getComputedStyle(probe).color
            probe.remove()
            return value
          }
          const text = el.querySelector('.mantine-Alert-message') as Element
          return {
            fill: [getComputedStyle(el).backgroundColor, colour(`--${token}-bg`)],
            text: [getComputedStyle(text).color, colour(`--${token}-fg`)],
          }
        },
        [severity, token],
      )
      expect(painted.fill[0], `${severity} fill in ${colorScheme}`).toBe(painted.fill[1])
      expect(painted.text[0], `${severity} text in ${colorScheme}`).toBe(painted.text[1])
      const axe = await new AxeBuilder({ page }).include('.ladder-target-controls').analyze()
      expect(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([])
    }
    // the error from an invalid field
    await section.getByLabel(/^Shooting distance/).fill('')
    await expect(slot.locator('.message')).toContainText(/Enter a number/)
    const axe = await new AxeBuilder({ page }).include('.ladder-target-controls').analyze()
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([])
    await section.getByLabel(/^Shooting distance/).fill('20000')
  }
})

test('the notice line keeps its box through a result with warnings, an error and no warnings', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await page.goto('/workbench')
  await applyExampleLoad(page)
  const line = page.locator('.run-line')
  const slot = page.locator('.warnings-slot')
  const charge = loadForm(page).getByLabel(/^Charge mass/)
  const seen = async () => ({
    line: await box(line),
    // what follows the line starts where it did
    below: (await box(line.locator('xpath=following-sibling::*[1]'))).top,
    slot: { ...(await box(slot)), top: 0, height: 0 },
  })
  const idle = await seen()
  // 2.4 g: a result without warnings; 2.8 g: a result over its limit with a warning; 60 g: the
  // model refuses the load, an error in the line and in the results
  for (const [grams, outcome] of [
    ['2.4', /^Simulation done\. Step 0, 2\.40 g/],
    ['2.8', /^Simulation done\. Step 0, 2\.80 g/],
    ['60', /^The model refused the load\./],
    ['2.4', /^Simulation done\. Step 0, 2\.40 g/],
  ] as const) {
    await charge.fill(grams)
    await charge.press('Control+Enter')
    await expect(line.locator('.status, .status + *').getByText(outcome).first()).toBeAttached({
      timeout: 15_000,
    })
    // the error says in words what is wrong, not the model's reason code alone
    if (grams === '60')
      await expect(page.locator('.results-error')).toContainText(
        'The charge does not fit the chamber',
      )
    const warnings = page.locator('.run-line .warnings-slot').getByRole('button')
    await expect(warnings).toHaveCount(grams === '2.8' ? 1 : 0)
    await expect.poll(seen).toEqual(idle)
  }
})

test('the warnings list keeps its height, scrolls and takes focus only once it scrolls', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await page.goto('/workbench')
  await applyExampleLoad(page)
  const charge = loadForm(page).getByLabel(/^Charge mass/)
  await charge.fill('2.8')
  await charge.press('Control+Enter')
  await page.locator('.warnings-slot').getByRole('button').click()
  const list = page.getByRole('list', { name: 'Warnings' })
  await expect(list).toBeVisible()
  // one warning fits: no tab stop
  await expect(list).not.toHaveAttribute('tabindex')
  const height = () => list.evaluate((el) => el.getBoundingClientRect().height)
  const one = await height()
  // many (cloned from the one shown): the list stops at the window's share and scrolls
  await list.evaluate((el) => {
    for (let k = 0; k < 40; k++) el.append((el.firstElementChild as Element).cloneNode(true))
  })
  await expect(list).toHaveAttribute('tabindex', '0')
  expect(await height()).toBeGreaterThan(one)
  expect(await height()).toBeLessThanOrEqual((await page.evaluate(() => innerHeight)) * 0.4 + 1)
  expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true)
})

test('a ladder step size error in the Powder card moves no card and adds no scroll', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 1280, height: 650 })
  await page.goto('/workbench')
  await applyExampleLoad(page)
  const form = loadForm(page)
  await form.getByLabel(/^Ladder steps/).fill('5')
  const step = form.getByLabel(/^Step size/)
  const panels = () =>
    page.locator('.workbench .panel').evaluateAll((els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect()
        return [Math.round(r.top), Math.round(r.height)]
      }),
    )
  const before = await panels()
  await step.fill('')
  await step.press('Control+Enter')
  await expect(form.getByText('Enter a number for Step size.')).toBeVisible()
  expect(await panels()).toEqual(before)
  expect(
    await page.locator('.workspace-inputs').evaluate((e) => e.scrollHeight - e.clientHeight),
  ).toBe(0)
})
