/**
 * The tuning route opened for the powder `powder` (a reference): it lists the saved loads that use
 * it. A module of its own, so the powder record page links the route without loading its code.
 */
export const tunePowderHref = (powder: string) =>
  `/powders/tune?${new URLSearchParams([['powder', powder]])}`
