# e2e: clicks, hovers and timing

Read before changing a spec or a helper in `apps/e2e/tests/web/`.

- A click with a `timeout` can land after it: the page handles it late, the call throws anyway. Inside `toPass` or before a fallback, check what the earlier click did before clicking again. `openItem` in `apps/e2e/tests/web/workbench.ts` returns once the start card is gone; `openTab` in `workbench-output.spec.ts` opens More only while the tab's panel is hidden. A repeated Example load asks "Discard the unsaved changes and start a new record?", and that dialog's overlay blocks the next click.
- Open a page with `gotoHydrated` (`apps/e2e/tests/web/nav.ts`), not a plain `page.goto`, before a hover or a click that React must handle: an event before hydration is lost.
- Prove a timing fix with a reproduction that fails every time: a capture-phase listener that busy-waits past the timeout (`workbench-example-click.spec.ts`). CPU throttling (`Emulation.setCPUThrottlingRate`) reproduces such races only some of the time, and with several workers it also runs out the 5-second waits of slow steps such as `runExample`; throttle after the slow setup.
- Pick an option of a Mantine Select with a click on it (`getByRole('option', { name })`) and read the field with a retrying assertion (`toHaveValue`), not with click, ArrowDown, Enter and one `inputValue()`. Two ways those keys can leave the field empty:
  - Shown only with the timer held back by hand (empty every time; in the ordinary runs that were logged the timer came first): opening the Select starts a 0 ms timer that sets the highlighted option to the chosen one, none in a Select without a value (`updateSelectedOptionIndex` in Mantine's `use-combobox`). When it runs after ArrowDown, Enter has no option to pick.
  - Read in the code, not run: a controlled Select writes its text in an effect after the key event, so a single read can come before it.
