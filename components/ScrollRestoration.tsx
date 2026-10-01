'use client'

import { useEffect } from 'react'

export default function ScrollRestoration() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      history.scrollRestoration = 'auto'
    }
  }, [])

  return null
}
