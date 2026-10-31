'use client'

import { Button, FileButton, Group, Stack, TextInput } from '@mantine/core'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import type { Say } from '../i18n/translate.ts'
import { labelledLoad, readLabel } from '../lib/box-label.ts'
import { errorText } from '../lib/error-text.ts'
import { photoTries, pixelsOf, readCode, readPhoto } from '../lib/label-reader.ts'
import type { LoadRecord } from '../lib/load-tabs.ts'
import { storedRecords } from '../lib/user-store.ts'
import { AppModal } from './app-modal.tsx'
import { MessageSlot, type Severity } from './states.tsx'

/** Milliseconds between the camera frames read: 4 a second. */
const frameInterval = 250
/** The long side, in px, a camera frame is read at. */
const frameSide = 800

/**
 * Opens a saved load from its box label: a photo (taken or chosen, read in this browser and never
 * kept), the live camera, started only by its button, or the text printed under the code. A load
 * opens only in the browser and edition that saved it.
 */
export function ScanLabelDialog({
  opened,
  onClose,
  onOpen,
}: {
  opened: boolean
  onClose: () => void
  onOpen: (record: LoadRecord) => void
}) {
  const { t } = useTranslation()
  const [shown, setShown] = useState<{ severity: Severity; say: Say }>()
  const show = (severity?: Severity, say?: Say) => setShown(severity && say && { severity, say })
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [camera, setCamera] = useState<MediaStream>()
  const stream = useRef<MediaStream | undefined>(undefined)
  const isOpen = useRef(opened)
  isOpen.current = opened
  const resetFile = useRef<() => void>(null)

  const stopCamera = useCallback(() => {
    for (const track of stream.current?.getTracks() ?? []) track.stop()
    stream.current = undefined
    setCamera(undefined)
  }, [])
  // every track stops when the dialog closes or goes
  useEffect(() => {
    if (!opened) stopCamera()
    return stopCamera
  }, [opened, stopCamera])

  /** Opens the load the label text names, or says why not; the dialog stays open then. */
  async function openText(scanned: string | undefined, none: Say) {
    const id = scanned === undefined ? undefined : readLabel(scanned)
    if (!id) return show('warning', none)
    const stored = await storedRecords().catch(() => undefined)
    if (!stored)
      return show('error', (t) => t('The saved loads could not be read from this browser.'))
    const found = labelledLoad(id, stored)
    if (found === 'invalid') show('error', (t) => t('This load is saved here but cannot be read.'))
    else if (found === 'missing')
      show('warning', (t) =>
        t(
          'This load is not saved in this browser and edition. Saved loads stay where they were saved: export it there and import the file here.',
        ),
      )
    else {
      show()
      stopCamera()
      onOpen(found)
      onClose()
    }
  }

  async function readFile(file: File | null) {
    resetFile.current?.()
    if (!file) return
    stopCamera()
    show()
    setBusy(true)
    try {
      await openText(await readPhoto(file), (t) =>
        t(
          'No box label code found in this photo. Hold the camera closer, so the code fills more of the frame.',
        ),
      )
    } catch (e) {
      show('error', (t) => t('The photo could not be read: {error}', { error: errorText(e) }))
    } finally {
      setBusy(false)
    }
  }

  async function startCamera() {
    show()
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      // closed while the browser asked for the camera
      if (!isOpen.current) {
        for (const track of s.getTracks()) track.stop()
        return
      }
      stream.current = s
      setCamera(s)
    } catch {
      show('warning', (t) =>
        t('The camera could not be started. Take a photo or type the label text instead.'),
      )
    }
  }

  const video = useRef<HTMLVideoElement>(null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: `openText` reads the store when a code is found
  useEffect(() => {
    const v = video.current
    if (!camera || !v) return
    v.srcObject = camera
    void v.play().catch(() => {})
    let reading = false
    const timer = setInterval(async () => {
      if (reading || v.readyState < v.HAVE_CURRENT_DATA || !v.videoWidth) return
      reading = true
      try {
        const [whole] = photoTries(v.videoWidth, v.videoHeight, frameSide)
        const code = whole && (await readCode(pixelsOf(v, whole)))
        // a code that is not a box label keeps the camera reading
        if (code && readLabel(code) && stream.current === camera) {
          stopCamera()
          await openText(code, () => '')
        }
      } catch (e) {
        stopCamera()
        show('error', (t) => t('The camera could not be read: {error}', { error: errorText(e) }))
      } finally {
        reading = false
      }
    }, frameInterval)
    return () => clearInterval(timer)
  }, [camera, stopCamera])

  return (
    <AppModal opened={opened} onClose={onClose} title={t('Scan box label')} size="md">
      <Stack gap="sm">
        <Group gap="xs">
          {/* no capture attribute: the phone offers the camera and the library */}
          <FileButton onChange={readFile} accept="image/*" resetRef={resetFile}>
            {(props) => (
              <Button variant="default" loading={busy} {...props}>
                {t('Take or choose a photo')}
              </Button>
            )}
          </FileButton>
          <Button variant="default" onClick={camera ? stopCamera : startCamera}>
            {camera ? t('Stop camera') : t('Start camera')}
          </Button>
        </Group>
        {camera && (
          <video
            ref={video}
            style={{ width: '100%', maxHeight: '50vh', background: '#000' }}
            aria-label={t('Camera view')}
            muted
            playsInline
          />
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void openText(text, (t) =>
              t(
                "No box label code found in this text. Type the line printed under the code, or the load's id.",
              ),
            )
          }}
        >
          <Group gap="xs" align="end">
            <TextInput
              label={t('Label text')}
              placeholder="OR1:L:…"
              value={text}
              onChange={(e) => setText(e.currentTarget.value)}
              style={{ flex: 1 }}
              data-autofocus
            />
            <Button type="submit">{t('Open')}</Button>
          </Group>
        </form>
        <MessageSlot
          label={t('Scan messages')}
          messages={shown ? [{ severity: shown.severity, text: shown.say(t) }] : []}
        />
      </Stack>
    </AppModal>
  )
}
