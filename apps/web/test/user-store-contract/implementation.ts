import type * as rawStore from '../../src/platform/user-store.ts'

/** The functions of `platform/user-store.ts`, which every implementation of the store exports. */
type UserStore = typeof rawStore

export type UserStoreImplementation = {
  store: UserStore
  /** A store module whose one request for persistent storage per page load has not been made. */
  fresh: () => Promise<UserStore>
  /** Leaves the store empty, as another tab deleting its database does. */
  reset: () => Promise<void>
}
