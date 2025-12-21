// ** import types
import type { ComponentProps } from 'react'

// ** import core packages
import { lazy, Suspense } from 'react'

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
