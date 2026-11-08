import type en from '../src/locales/en.json'

// ui's ids type its own message calls; an app registers the union of its ids and ui's instead, in its own code
declare module '@lingui/core' {
  interface Register {
    messageIds: keyof typeof en.messages
  }
}
