/** Its own module, so the powder record page links the route without loading its code. */
export const tunePowderHref = (powder: string) =>
  `/powders/tune?${new URLSearchParams([['powder', powder]])}`
