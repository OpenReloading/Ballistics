import { describe, expect, it } from 'vitest'
import { cameraSession } from '../src/lib/camera-session.ts'

const fakeStream = () => {
  const track = {
    stopped: false,
    stop() {
      track.stopped = true
    },
  }
  return { track, stream: { getTracks: () => [track] } as unknown as MediaStream }
}

/** A request the test answers when it wants. */
const pending = () => {
  let answer = (_: MediaStream) => {}
  const request = () =>
    new Promise<MediaStream>((resolve) => {
      answer = resolve
    })
  return { request, answer: (s: MediaStream) => answer(s) }
}

describe('cameraSession', () => {
  it('keeps the stream of a live session and stops it on stop', async () => {
    const camera = cameraSession()
    const { track, stream } = fakeStream()
    expect(await camera.start(async () => stream)).toBe(stream)
    expect(camera.current()).toBe(stream)
    camera.stop()
    expect(track.stopped).toBe(true)
    expect(camera.current()).toBeUndefined()
  })

  it('stops a stream that answers after the session ended', async () => {
    const camera = cameraSession()
    const { request, answer } = pending()
    const started = camera.start(request)
    camera.stop()
    const { track, stream } = fakeStream()
    answer(stream)
    expect(await started).toBeUndefined()
    expect(track.stopped).toBe(true)
    expect(camera.current()).toBeUndefined()
  })

  it('keeps a stale request out of the next session', async () => {
    const camera = cameraSession()
    const old = pending()
    const stale = camera.start(old.request)
    camera.stop()
    const next = fakeStream()
    expect(await camera.start(async () => next.stream)).toBe(next.stream)
    const late = fakeStream()
    old.answer(late.stream)
    expect(await stale).toBeUndefined()
    expect(late.track.stopped).toBe(true)
    expect(next.track.stopped).toBe(false)
    expect(camera.current()).toBe(next.stream)
  })

  it('stops the first stream when a second start answers in the same session', async () => {
    const camera = cameraSession()
    const first = fakeStream()
    const second = fakeStream()
    await camera.start(async () => first.stream)
    await camera.start(async () => second.stream)
    expect(first.track.stopped).toBe(true)
    expect(camera.current()).toBe(second.stream)
  })
})
