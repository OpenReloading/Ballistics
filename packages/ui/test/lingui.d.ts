import type en from '../src/locales/en.json'

// ui's ids type its own message calls here only: an app type-checks against ui's declarations, which hold no message
// call, and registers its own ids
declare module '@lingui/core' {
  interface Register {
    messageIds: keyof typeof en.messages
  }
}
