// ** import types
import { Suspense, lazy } from 'react'
import type { ComponentProps } from 'react'

// ** import core packages

const LazyOrb = lazy(() => import('./orb').then((m) => ({ default: m.Orb })))

type OrbProps = ComponentProps<typeof LazyOrb>

export function ClientOrb(props: OrbProps) {
  if (typeof window === 'undefined') {
    return null
  }

  return (
    <Suspense fallback={<div className={props.className} />}>
      <LazyOrb {...props} />
    </Suspense>
  )
}
