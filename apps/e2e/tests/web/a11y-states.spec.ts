import { readdirSync } from 'node:fs'
import path from 'node:path'
import { expect, type Locator, type Page, test } from '@playwright/test'
import { height, problems, schemes, tall, widths } from './a11y.ts'
import { barButton } from './bar.ts'
import { pickFiles, withoutOpenPicker } from './import.ts'
import { gotoHydrated } from './nav.ts'
import { openFit } from './powder-tune-run.ts'
import { storeUnits } from './units.ts'
import { putRecords } from './user-store.ts'
import { applyExampleLoad, loadForm } from './workbench.ts'
import { runExample } from './workbench-run.ts'

// The states a visitor reaches after a click: a record page of each `[id]` route, the workbench
// after a run and every dialog or drawer. a11y-sweep.spec.ts has the pages as they load.

test.beforeEach(({ page }) => storeUnits(page))

const appDir = path.join(__dirname, '../../../web/src/app')

/** One fixed record per `[id]` route; each is in the export's sample (`prerender-sample.ts`). */
const records: Record<string, string> = {
  cartridges: '308-win',
  bullets: 'demo-bullet-168',
  powders: 'demo-powder-dp40',
  cases: 'demo-case-308-brass',
  primers: 'demo-primer-large-rifle',
  targets: 'issf-25m-precision-50m-pistol',
  disciplines: 'dsb-25m-pistole-revolver',
  federations: 'dsb',
}

test('every route with an [id] segment has its record in the sweep', () => {
  const dynamic = readdirSync(appDir, { recursive: true, encoding: 'utf8' })
    .filter((file) => path.basename(file) === 'page.tsx' && file.includes('['))
    .map((file) => path.dirname(file).split(path.sep)[0])
  expect(new Set(Object.keys(records))).toEqual(new Set(dynamic))
})

/** The dialog or drawer once it has stopped moving: it fades or slides in, and axe reads colours at rest. */
async function settled(dialog: Locator) {
  await expect(dialog).toBeVisible()
  // a modal fades in, a drawer slides
  await expect(dialog).toHaveCSS('opacity', '1')
  await dialog.evaluate((el) =>
    Promise.all(
      el
        .getAnimations({ subtree: true })
        // a loader spins for ever, and a cancelled animation rejects its promise
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  )
  return dialog
}

/** A button of the sidebar from 75em, of the navigation drawer below it. */
async function fromNav(page: Page, name: string) {
  const burger = page.getByRole('button', { name: 'Navigation', exact: true })
  const sidebar = page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('button', { name, exact: true })
  await expect(burger.or(sidebar).first()).toBeVisible()
  if (await burger.isVisible()) {
    await burger.click()
    return page
      .getByRole('dialog', { name: 'Navigation' })
      .getByRole('button', { name, exact: true })
  }
  return sidebar
}

async function openSettings(page: Page, tab: string) {
  await gotoHydrated(page, '/powders')
  await (await fromNav(page, 'Settings')).click()
  const dialog = page.getByRole('dialog', { name: 'Settings' })
  await dialog.getByRole('tab', { name: tab }).click()
  await expect(dialog.getByRole('tabpanel', { name: tab })).toBeVisible()
  return settled(dialog)
}

/** The phone layout shows the inputs or the results: the results of a run are on their own tab. */
async function showResults(page: Page) {
  const tab = page.getByRole('tab', { name: 'Results', exact: true })
  await expect(tab.or(page.getByRole('region', { name: 'Results' })).first()).toBeVisible()
  if (await tab.isVisible()) await tab.click()
}

type State = {
  name: string
  /** A page that scrolls as a whole, in a window as tall as it is. */
  scrolls?: true
  /** Gets the page into the state; `check` sweeps it, once per view the state has. */
  open: (page: Page, check: (view: string, include?: string) => Promise<void>) => Promise<void>
}

const dialogOf = (name: string) => (page: Page) => settled(page.getByRole('dialog', { name }))

const states: State[] = [
  ...Object.entries(records).map(([dir, id]) => ({
    name: `/${dir}/${id}`,
    scrolls: true as const,
    open: async (page: Page, check: (view: string) => Promise<void>) => {
      await gotoHydrated(page, `/${dir}/${id}`)
      // the record page renders from its data files once they are read
      await expect(page.locator('#record-sources')).toBeVisible()
      await check('page')
    },
  })),
  ...[
    ['German list', '/cartridges/', 'tab'],
    ['German record', '/cartridges/308-win/', 'sources'],
  ].map(([name, route, ready]) => ({
    name: `${name} ${route}`,
    scrolls: true as const,
    open: async (page: Page, check: (view: string) => Promise<void>) => {
      await page.addInitScript(() => localStorage.setItem('language', 'de'))
      await gotoHydrated(page, route ?? '')
      await expect(page.locator('html')).toHaveAttribute('lang', 'de')
      await expect(
        ready === 'tab'
          ? page.getByRole('tab', { name: 'Treibladungspulver' })
          : page.locator('#record-sources'),
      ).toBeVisible()
      await check('page')
    },
  })),
  {
    name: 'workbench after the example run',
    open: async (page, check) => {
      await runExample(page)
      await showResults(page)
      await expect(page.locator('.interior-chart .echart [role="img"]')).toBeVisible()
      await check('chart')
      for (const tab of ['Ladder table', 'Notes']) {
        // below 62em the tabs that do not fit are in the More menu
        const direct = page.getByRole('tab', { name: tab, exact: true })
        const more = page.getByRole('button', { name: 'More', exact: true })
        await expect(direct.or(more).first()).toBeVisible()
        if (await direct.isVisible()) await direct.click()
        else {
          await more.click()
          await page.getByRole('menuitem', { name: tab }).click()
        }
        // axe reads the panel shown and the menu gone, not a fading menu over the old panel
        await expect(page.getByRole('tabpanel', { name: tab })).toBeVisible()
        await expect(page.getByRole('menu')).toBeHidden()
        await check(tab)
      }
    },
  },
  ...['General', 'Units', 'Workbench'].map((tab) => ({
    name: `Settings, ${tab}`,
    open: async (page: Page, check: (view: string, include?: string) => Promise<void>) => {
      await openSettings(page, tab)
      await check(tab, '[role="dialog"]')
    },
  })),
  {
    name: 'Keyboard shortcuts',
    open: async (page, check) => {
      await gotoHydrated(page, '/powders')
      await page.keyboard.press('?')
      await dialogOf('Keyboard shortcuts')(page)
      await check('dialog', '[role="dialog"]')
    },
  },
  {
    name: 'Chart data',
    open: async (page, check) => {
      await runExample(page)
      await showResults(page)
      await page.getByRole('button', { name: 'Chart data' }).click()
      await dialogOf('Chart data')(page)
      await check('dialog', '[role="dialog"]')
    },
  },
  {
    name: 'Powder tuning Chart data',
    scrolls: true,
    open: async (page, check) => {
      // the fit may take up to 60 s after a run, a save and a navigation
      test.setTimeout(120_000)
      await openFit(page)
      const data = page.locator('.values-details')
      await data.getByText('Chart data', { exact: true }).click()
      await expect(data.getByRole('table', { name: /^Velocity and band/ })).toBeVisible()
      await check('page')
    },
  },
  {
    name: '/ with saved loads',
    scrolls: true,
    open: async (page, check) => {
      await gotoHydrated(page, '/')
      await putRecords(page, [
        {
          kind: 'load',
          id: '00000000-0000-4000-8000-000000000001',
          name: 'Saved test load',
          saved: '2026-10-20T10:00:00.000Z',
          data: { origin: 'user' },
        },
      ])
      await gotoHydrated(page, '/')
      await expect(page.getByRole('link', { name: 'Saved test load' })).toBeVisible()
      await check('page')
    },
  },
  {
    name: 'Saved loads',
    open: async (page, check) => {
      // a native picker cannot be driven: a save goes to the browser's records, as the app's own
      await page.addInitScript(() => {
        ;(window as unknown as Record<string, unknown>).showSaveFilePicker = async () =>
          (await navigator.storage.getDirectory()).getFileHandle('export.json', { create: true })
      })
      await runExample(page)
      await (await barButton(page, 'Save')).click()
      await (await barButton(page, 'Open')).click()
      await page.getByRole('menuitem', { name: /^Saved loads/ }).click()
      const drawer = await dialogOf('Saved loads')(page)
      // the saved load is listed once the store has it
      await expect(drawer.locator('.saved-loads li')).toHaveCount(1)
      await check('drawer', '[role="dialog"]')
    },
  },
  {
    name: 'Bullet from a photograph',
    open: async (page, check) => {
      await gotoHydrated(page, '/bullets/designer')
      // below 75em the toolbar is in the "Page actions" panel
      const actions = page.getByRole('button', { name: 'Page actions' })
      const photo = page.getByRole('button', { name: 'From a photo' })
      await expect(async () => {
        if (!(await photo.isVisible())) await actions.click({ timeout: 1000 })
        await photo.click({ timeout: 1000 })
      }).toPass({ timeout: 10_000 })
      const dialog = await dialogOf('Bullet from a photograph')(page)
      await dialog.getByRole('button', { name: 'Try a sample' }).click()
      await expect(dialog.getByRole('row', { name: /^Length/ })).toContainText(/31\.\d+ ± /, {
        timeout: 30_000,
      })
      await check('dialog', '[role="dialog"]')
    },
  },
  {
    name: 'Import entry',
    open: async (page, check) => {
      await withoutOpenPicker(page)
      await gotoHydrated(page, '/bullets/designer')
      // a table that folds, and a text without a table that is refused
      await pickFiles(page, [
        {
          name: 'bullets.csv',
          buffer: Buffer.from('Name,Diameter (mm),Weight (gr)\nAlpha,7.82,150'),
        },
        { name: 'notes.txt', buffer: Buffer.from('Notes, from the range\nwindy day') },
      ])
      const dialog = await dialogOf('Tables to read')(page)
      await expect(dialog.getByTestId('import-verdict')).toHaveText([
        /^Table of bullets/,
        'Refused',
      ])
      await check('dialog', '[role="dialog"]')
    },
  },
  {
    name: 'Page actions',
    open: async (page, check) => {
      await gotoHydrated(page, '/workbench')
      // from 75em the bar shows its actions without the panel
      const toggle = page.getByRole('button', { name: 'Page actions' }).locator('visible=true')
      if (await toggle.count()) await toggle.click()
      await check('panel', '.page-bar')
    },
  },
  {
    name: 'Choose a bullet',
    open: async (page, check) => {
      await gotoHydrated(page, '/workbench?cartridge=308-win')
      await loadForm(page).getByRole('button', { name: 'Browse bullets' }).click()
      const dialog = await dialogOf('Choose a bullet')(page)
      await expect(dialog.getByRole('option')).toHaveCount(2)
      // the narrow layout keeps the filters behind their button
      const filters = dialog.getByRole('button', { name: /^Filters/ })
      if (await filters.isVisible()) await filters.click()
      await settled(dialog)
      await check('dialog', '[role="dialog"]')
    },
  },
  {
    name: 'Database list filter',
    open: async (page, check) => {
      await gotoHydrated(page, '/disciplines')
      await page
        .locator('.directory-filters')
        .getByRole('button', { name: 'Distance', exact: true })
        .click()
      await expect(page.getByRole('checkbox', { name: /^25 yd/ })).toBeVisible()
      await check('popover', '.mantine-Popover-dropdown')
    },
  },
  {
    name: 'Database list with ticked rows',
    scrolls: true,
    open: async (page, check) => {
      await gotoHydrated(page, '/bullets')
      const boxes = page.getByRole('checkbox', { name: /^Select Demo Bullets / })
      await expect(boxes).toHaveCount(2)
      await boxes.first().click()
      await boxes.last().click()
      await expect(page.getByRole('button', { name: 'Clear selection' })).toBeVisible()
      await check('page')
    },
  },
  {
    name: 'Session summary with the example',
    scrolls: true,
    open: async (page, check) => {
      await gotoHydrated(page, '/session')
      await page.getByRole('button', { name: 'Load example' }).click()
      await expect(page.getByRole('status').filter({ hasText: 'Read' })).toHaveText(
        'Read 3 strings, 30 shots.',
      )
      await check('page')
    },
  },
  {
    name: 'Shot groups with shots',
    open: async (page, check) => {
      await gotoHydrated(page, '/groups')
      const add = page.getByRole('button', { name: 'Add shot' }).locator('visible=true')
      // the compact layout folds the group panels behind their strip
      const strip = page.locator('.sheet-strip').locator('visible=true')
      if (!(await add.count()) && (await strip.count())) await strip.click()
      for (const n of [1, 2, 3]) {
        await add.click()
        await expect(page.locator('[data-shot]')).toHaveCount(n)
      }
      await check('sheet')
    },
  },
  {
    name: 'Site search',
    open: async (page, check) => {
      await gotoHydrated(page, '/powders')
      await page.keyboard.press('Control+k')
      const field = page.getByRole('textbox', {
        name: 'Search pages, cartridges, bullets, powders and commands',
      })
      await expect(field).toBeFocused()
      await settled(page.getByRole('dialog').filter({ has: field }))
      await check('dialog', '[role="dialog"]')
    },
  },
]

for (const width of widths)
  for (const colorScheme of schemes)
    for (const state of states)
      test(`${state.name} has no axe finding at ${width} px, ${colorScheme}`, async ({ page }) => {
        await page.setViewportSize({ width, height: state.scrolls ? tall : height })
        await page.emulateMedia({ colorScheme })
        const found: string[] = []
        await state.open(page, async (view, include) => {
          found.push(...(await problems(page, `${state.name}, ${view}`, include)))
        })
        expect(found).toEqual([])
      })

for (const width of [320, 390]) {
  test(`the Page actions panel is inside the window at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await gotoHydrated(page, '/workbench')
    await page.getByRole('button', { name: 'Page actions' }).click()
    const panel = page.locator('.page-bar-actions')
    await expect(panel).toBeVisible()
    await expect.poll(async () => (await panel.boundingBox())?.x).toBeGreaterThanOrEqual(0)
    await expect
      .poll(async () => {
        const box = await panel.boundingBox()
        return (box?.x ?? 0) + (box?.width ?? 0)
      })
      .toBeLessThanOrEqual(width)
  })
}

// WCAG 1.4.4: at 200 % text the panel keeps inside the window and its rows wrap
test('the Page actions panel is inside the window at 320 px with 200 % text', async ({ page }) => {
  await page.setViewportSize({ width: 320, height })
  await gotoHydrated(page, '/workbench')
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%'
  })
  await page.getByRole('button', { name: 'Page actions' }).click()
  const panel = page.locator('.page-bar-actions')
  await expect(panel).toBeVisible()
  await expect.poll(async () => (await panel.boundingBox())?.x).toBeGreaterThanOrEqual(0)
  await expect
    .poll(async () => {
      const box = await panel.boundingBox()
      return (box?.x ?? 0) + (box?.width ?? 0)
    })
    .toBeLessThanOrEqual(320)
  // no row reaches past the panel's edge
  await expect.poll(() => panel.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
})

// WCAG 2.5.8: the note buttons of a case length variants matrix (a cartridge whose values have notes)
for (const width of widths) {
  test(`the note buttons of the variants matrix are 24 px high at ${width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: tall })
    await gotoHydrated(page, '/cartridges/12')
    const notes = page.locator('.variant-matrix th .field-note')
    await expect(notes.first()).toBeVisible()
    for (const note of await notes.all())
      expect((await note.boundingBox())?.height).toBeGreaterThanOrEqual(24)
  })
}

// WCAG 2.5.8: the symbol buttons of the dimensions tables, one per row, with and without notes
for (const width of widths) {
  test(`the symbols of the dimensions tables are 24 px high at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: tall })
    for (const id of ['12', '308-win']) {
      await gotoHydrated(page, `/cartridges/${id}`)
      const symbols = page.locator('.cartridge-values tbody th [tabindex]')
      await expect(symbols.first()).toBeVisible()
      for (const symbol of await symbols.all())
        expect((await symbol.boundingBox())?.height).toBeGreaterThanOrEqual(24)
    }
  })
}

test('the selected segment of a segmented control has a border in forced colours', async ({
  page,
}) => {
  await page.emulateMedia({ forcedColors: 'active' })
  await gotoHydrated(page, '/workbench')
  await applyExampleLoad(page)
  const indicator = loadForm(page).locator('.mantine-SegmentedControl-indicator').first()
  await expect(indicator).toBeVisible()
  // forced colours remove the fill: the border is all that marks the segment
  await expect(indicator).toHaveCSS('border-top-width', '2px')
})
