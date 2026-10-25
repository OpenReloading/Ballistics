'use client'

import { useComputedColorScheme } from '@mantine/core'
import { LineChart as Lines } from 'echarts/charts'
import {
  GridComponent,
  MarkLineComponent,
  MarkPointComponent,
  TooltipComponent,
} from 'echarts/components'
import { type ECharts, type EChartsCoreOption, init, use } from 'echarts/core'
import { LabelLayout } from 'echarts/features'
import { SVGRenderer } from 'echarts/renderers'
import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react'

// only the parts the charts use, so the chunk stays small (tree-shaken imports)
use([
  Lines,
  GridComponent,
  MarkLineComponent,
  MarkPointComponent,
  TooltipComponent,
  LabelLayout,
  SVGRenderer,
])

/** The distance between the first two ticks; NaN when there are fewer than two. */
export const tickStep = (ticks: number[]) => (ticks[1] ?? Number.NaN) - (ticks[0] ?? Number.NaN)

/**
 * The chart colours: each key's CSS custom property of the page (`globals.css`), read after the
 * colour scheme attribute is set and again on a scheme change; undefined before the first read.
 * `names` is a module constant.
 */
export function useChartTokens<K extends string>(names: Record<K, string>) {
  const scheme = useComputedColorScheme('light')
  const [tokens, setTokens] = useState<Record<K, string>>()
  // biome-ignore lint/correctness/useExhaustiveDependencies: read again on a scheme change
  useEffect(() => {
    const css = getComputedStyle(document.documentElement)
    setTokens(
      Object.fromEntries(
        Object.entries<string>(names).map(([k, n]) => [k, css.getPropertyValue(n).trim()]),
      ) as Record<K, string>,
    )
  }, [scheme])
  return tokens
}

/** The chart's print width, px: the A4 column (210 mm less 15 mm margins) at 96 px per inch. */
const printWidth = 680

/** The content width of the nearest ancestor of `node` with a box, px; 0 when none has one. */
function columnWidth(node: HTMLElement) {
  for (let e = node.parentElement; e; e = e.parentElement) {
    if (e.clientWidth === 0) continue
    const s = getComputedStyle(e)
    return e.clientWidth - Number.parseFloat(s.paddingLeft) - Number.parseFloat(s.paddingRight)
  }
  return 0
}

/**
 * An ECharts chart on the SVG renderer: a named image with a description, `option` set as a
 * whole on each change, resized with its box. Arrow keys, Home and End move the tooltip along
 * series `focus`; `readout` gives the text a screen reader hears for that data index.
 */
export function EChart({
  option,
  height,
  title,
  description,
  focus = 0,
  readout,
  onRender,
}: {
  option: EChartsCoreOption
  /** Px; without it the box's CSS height, which the chart follows. */
  height?: number
  title: string
  description: string
  /** Index of the series the keyboard walks. */
  focus?: number
  readout?: (dataIndex: number) => string
  /** Called after each draw, for an overlay that reads the chart's scales. */
  onRender?: (chart: ECharts) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const chart = useRef<ECharts | null>(null)
  const index = useRef(-1)
  const keys = useRef<HTMLInputElement>(null)
  const id = useId()

  const latest = useRef(option)
  latest.current = option
  /** The option the chart last drew: the mount draws it once, not again in the option effect. */
  const drawn = useRef<typeof option | undefined>(undefined)
  const size = useRef(height)
  size.current = height
  const rendered = useRef(onRender)
  rendered.current = onRender

  // one chart per mount. A hidden tab measures 0 wide: the chart draws at the width of the column
  // it shows in, so the report has its copy and the chart never overflows its box; with no column
  // laid out it waits for its box
  useEffect(() => {
    const node = box.current
    if (!node) return
    /** The height to draw at: the prop, else the box's; a hidden box draws at 320 px. */
    const tall = () => size.current ?? (node.clientHeight || 320)
    let c: ECharts | undefined
    // a view box lets print scale the drawing into a narrower column
    const view = (e: ECharts) =>
      node.querySelector('svg')?.setAttribute('viewBox', `0 0 ${e.getWidth()} ${e.getHeight()}`)
    const start = (width: number) => {
      const made = init(node, undefined, { renderer: 'svg', width, height: tall() })
      made.on('finished', () => {
        view(made)
        rendered.current?.(made)
      })
      made.setOption(latest.current, { notMerge: true })
      drawn.current = latest.current
      chart.current = made
      c = made
    }
    const width = node.clientWidth || columnWidth(node)
    if (width > 0) start(width)
    const seen = new ResizeObserver(() => {
      if (node.clientWidth === 0) return
      if (c) c.resize({ width: node.clientWidth, height: tall() })
      else start(node.clientWidth)
    })
    seen.observe(node)
    // print lays the page out again without a resize: draw at the print width before the snapshot,
    // at the box's width after it
    const redraw = (width: number) => {
      if (!c) return
      c.resize({ width, height: tall() })
      // the snapshot follows at once: paint now, not on the chart's next frame
      c.getZr().refreshImmediately()
      view(c)
    }
    const before = () => {
      if (node.clientWidth > printWidth) redraw(printWidth)
    }
    const after = () => {
      if (node.clientWidth > 0) redraw(node.clientWidth)
    }
    addEventListener('beforeprint', before)
    addEventListener('afterprint', after)
    return () => {
      removeEventListener('beforeprint', before)
      removeEventListener('afterprint', after)
      seen.disconnect()
      c?.dispose()
      chart.current = null
    }
  }, [])

  useEffect(() => {
    const node = box.current
    if (node && node.clientWidth > 0 && height !== undefined)
      chart.current?.resize({ width: node.clientWidth, height })
  }, [height])

  useEffect(() => {
    if (!chart.current || drawn.current === option) return
    chart.current.setOption(option, { notMerge: true })
    drawn.current = option
  }, [option])

  /** Shows the tooltip and the slider's value text at data index `to`. */
  const moveTo = (to: number) => {
    index.current = to
    chart.current?.dispatchAction({ type: 'showTip', seriesIndex: focus, dataIndex: to })
    if (!keys.current) return
    keys.current.value = String(to)
    keys.current.setAttribute('aria-valuetext', readout?.(to) ?? '')
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    const c = chart.current
    const series = (c?.getOption().series as { data?: unknown[] }[] | undefined)?.[focus]
    const n = series?.data?.length ?? 0
    if (!c || n === 0) return
    const step = Math.max(1, Math.round(n / 50))
    const moves: Record<string, number> = {
      ArrowRight: Math.min(n - 1, index.current + step),
      ArrowLeft: Math.max(0, index.current - step),
      Home: 0,
      End: n - 1,
    }
    const target = moves[e.key]
    if (target === undefined) return
    e.preventDefault()
    moveTo(target)
  }

  const points = (option.series as { data?: unknown[] }[] | undefined)?.[focus]?.data?.length ?? 0
  return (
    <div className="echart">
      <div
        ref={box}
        role="img"
        aria-label={title}
        aria-describedby={`${id}-d`}
        style={{ height }}
      />
      {/* the keyboard's hold on the chart: a slider over the data points, hidden, its focus drawn on the chart */}
      <input
        ref={keys}
        type="range"
        className="visually-hidden echart-keys"
        aria-label={`${title}, readout`}
        aria-describedby={`${id}-d`}
        aria-keyshortcuts="ArrowLeft ArrowRight Home End"
        min={0}
        max={Math.max(0, points - 1)}
        defaultValue={0}
        onKeyDown={onKey}
        // a change that is no handled key (assistive technology, other keys)
        onChange={(e) => moveTo(Number(e.currentTarget.value))}
        onBlur={() => {
          chart.current?.dispatchAction({ type: 'hideTip' })
          index.current = -1
          keys.current?.removeAttribute('aria-valuetext')
          if (keys.current) keys.current.value = '0'
        }}
      />
      <p id={`${id}-d`} className="visually-hidden">
        {description} Arrow keys move the readout along the curve.
      </p>
    </div>
  )
}
