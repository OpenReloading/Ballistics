/** `readonly K[]` when the list `L` holds every key of `K`, else a type naming the keys it leaves out, which the list does not satisfy. */
export type Complete<K, L extends readonly K[]> = [Exclude<K, L[number]>] extends [never]
  ? readonly K[]
  : { missing: Exclude<K, L[number]> }
