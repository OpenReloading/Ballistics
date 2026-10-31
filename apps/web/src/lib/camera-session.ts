/**
 * Holds the camera stream of a dialog. `stop` ends the session: a stream that a request of an
 * ended session answers with is stopped at once, so a dialog that closed or went while the browser
 * asked for the camera leaves no camera running.
 */
export function cameraSession() {
  let session = 0
  let stream: MediaStream | undefined
  const stopTracks = (s: MediaStream | undefined) => {
    for (const track of s?.getTracks() ?? []) track.stop()
  }
  return {
    /** The stream kept, if any. */
    current: () => stream,
    stop() {
      session++
      stopTracks(stream)
      stream = undefined
    },
    /** The stream `request` answers with, or undefined when the session ended meanwhile. */
    async start(request: () => Promise<MediaStream>) {
      const mine = session
      const s = await request()
      if (mine !== session) {
        stopTracks(s)
        return
      }
      // a second start while the browser asked started a second stream
      stopTracks(stream)
      stream = s
      return s
    },
  }
}
