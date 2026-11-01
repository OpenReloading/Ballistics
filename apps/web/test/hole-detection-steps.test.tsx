import { MantineProvider } from '@mantine/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { DetectPanel, ReviewStep, RunButton } from '../src/components/hole-detection.tsx'
import { msg } from '../src/i18n/translate.ts'

const html = (node: React.ReactNode) =>
  renderToStaticMarkup(<MantineProvider>{node}</MantineProvider>)
const none = () => {}
/** Whether the run button of `out` is disabled. */
const runDisabled = (out: string) =>
  / disabled=""/.test(/<button[^>]*data-detect-run[^>]*>/.exec(out)?.[0] ?? '')

const run = (blocked: ReturnType<typeof msg> | undefined, auto = false) =>
  html(
    <RunButton
      label={msg('Detect holes')}
      auto={auto}
      progress={undefined}
      photo
      blocked={blocked}
      onCancel={none}
      onStart={none}
      onRun={none}
    />,
  )

it('a guided run without a scale is disabled and says why under its button', () => {
  const out = run(msg('Set the scale first (step 2).'))
  expect(runDisabled(out)).toBe(true)
  expect(out).toContain('data-detect-blocked')
  expect(out).toContain('Set the scale first (step 2).')
  const id = /aria-describedby="([^"]+)"/.exec(out)?.[1]
  expect(out).toContain(`id="${id}"`)
})

it('a guided run that can start, and the one-click start, show no reason', () => {
  for (const out of [run(undefined), run(msg('Set the scale first (step 2).'), true)]) {
    expect(runDisabled(out)).toBe(false)
    expect(out).not.toContain('data-detect-blocked')
  }
})

it('Review accepts the sure proposals by that name and keeps Accept maybes, disabled at 0', () => {
  const review = (proposals: number, maybe: number) =>
    html(
      <ReviewStep
        proposals={proposals}
        maybe={maybe}
        flagged={0}
        onAccept={none}
        onAcceptMaybe={none}
        onClear={none}
      />,
    )
  const out = review(58, 0)
  expect(out).toContain('Accept sure (58)')
  expect(out).not.toContain('Accept all')
  expect(out).toMatch(/<button[^>]*disabled[^>]*>(?:(?!<\/button>).)*Accept maybes \(0\)/)
  expect(review(58, 154)).not.toMatch(
    /<button[^>]*disabled[^>]*>(?:(?!<\/button>).)*Accept maybes \(154\)/,
  )
})

it('each step button names its step in its title, the cut label too', () => {
  const out = html(
    <DetectPanel step={2} setStep={none} start={null} notes={null} body={<p>body</p>} />,
  )
  for (const [i, name] of ['Rotate', 'Scale', 'Example', 'Detect', 'Review'].entries()) {
    expect(out).toContain(`title="${name}"`)
    expect(out).toContain(`${i + 1} ${name}`)
  }
  expect(out).toMatch(/aria-current="step"[^>]*>3 Example/)
})
