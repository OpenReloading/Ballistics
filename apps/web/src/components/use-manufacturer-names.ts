'use client'

import { useEffect, useState } from 'react'
import {
  fetchManufacturerNames,
  type ManufacturerNames,
  noManufacturerNames,
} from '../lib/manufacturers.ts'

/** Manufacturer names by id, empty until `GET /manufacturers` answers (once per page load). */
export function useManufacturerNames(): ManufacturerNames {
  const [names, setNames] = useState(noManufacturerNames)
  useEffect(() => {
    let live = true
    fetchManufacturerNames().then(
      (n) => live && setNames(n),
      // without names the labels show the product names alone
      () => {},
    )
    return () => {
      live = false
    }
  }, [])
  return names
}
