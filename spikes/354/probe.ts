// biome-ignore-all lint/correctness/noUndeclaredDependencies: spike, run with the e2e workspace's Playwright
// biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: spike probe, one observer per measure in one init script
import type { Page } from '@playwright/test'

/** Installs the page probe: run starts and ends from the status text, long tasks, layout shifts, input delays. */
export const probe = (page: Page) =>
  page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>
    const p = {
      runs: [] as { start: number; end?: number }[],
      cancelled: 0,
      tasks: [] as { start: number; duration: number }[],
      shiftInputs: 0,
      shiftPage: 0,
      events: [] as { name: string; start: number; delay: number; duration: number }[],
      state: 'idle',
    }
    w.probe = p
    const inInputs = (sources: { node?: Node }[]) =>
      sources.some((s) =>
        (s.node instanceof Element ? s.node : s.node?.parentElement)?.closest('.workspace-inputs'),
      )
    const status = () => document.querySelector('.result')?.textContent ?? ''
    new MutationObserver(() => {
      const s = status()
      if (s.includes('Simulating')) {
        if (p.state !== 'running') {
          p.runs.push({ start: performance.now() })
          p.state = 'running'
        }
      } else if (p.state === 'running') {
        const last = p.runs.at(-1)
        if (/Simulation done/.test(s) && last) last.end = performance.now()
        else p.cancelled++
        p.state = 'idle'
      }
    }).observe(document.documentElement, { subtree: true, childList: true, characterData: true })
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) p.tasks.push({ start: e.startTime, duration: e.duration })
    }).observe({ type: 'longtask', buffered: true })
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as unknown as {
        value: number
        hadRecentInput: boolean
        sources: { node?: Node }[]
      }[]) {
        p.shiftPage += e.value
        if (inInputs(e.sources)) p.shiftInputs += e.value
      }
    }).observe({ type: 'layout-shift', buffered: true })
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as unknown as {
        name: string
        startTime: number
        processingStart: number
        duration: number
      }[])
        p.events.push({
          name: e.name,
          start: e.startTime,
          delay: e.processingStart - e.startTime,
          duration: e.duration,
        })
    }).observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit)
  })

export type Probe = {
  runs: { start: number; end?: number }[]
  cancelled: number
  tasks: { start: number; duration: number }[]
  shiftInputs: number
  shiftPage: number
  events: { name: string; start: number; delay: number; duration: number }[]
  state: string
}

export const readProbe = (page: Page) =>
  page.evaluate(() => (window as unknown as { probe: Probe }).probe)

export const resetShift = (page: Page) =>
  page.evaluate(() => {
    const p = (window as unknown as { probe: Probe }).probe
    p.shiftInputs = 0
    p.shiftPage = 0
  })

/** Waits for layout shift entries, which arrive after the frame that moved. */
export const settle = (page: Page, ms = 500) =>
  page.evaluate((ms) => new Promise((r) => requestAnimationFrame(() => setTimeout(r, ms))), ms)

export const quantile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)] ?? Number.NaN
}
