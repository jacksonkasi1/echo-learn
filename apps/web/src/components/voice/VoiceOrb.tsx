'use client'

// ** import lib
import { useMemo } from 'react'
import { motion } from 'motion/react'

// ** import types
import type { CSSProperties } from 'react'
import type { Transition } from 'motion/react'

// ** import utils
import { cn } from '@/lib/utils'

/**
 * Agent state for the orb visualization
 */
export type OrbAgentState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | null

/**
 * Props for VoiceOrb component
 */
interface VoiceOrbProps {
  /** Current agent state */
  agentState?: OrbAgentState
  /** Primary color for the orb */
  primaryColor?: string
  /** Secondary color for the orb gradient */
  secondaryColor?: string
  /** Size of the orb in pixels */
  size?: number
  /** Additional class names */
  className?: string
  /** Click handler */
  onClick?: () => void
}

/**
 * Animation configuration type
 */
interface AnimationConfig {
  scale: Array<number>
  opacity: Array<number>
  transition: Transition
}

/**
 * Animation configurations for different states
 */
const stateAnimations: Record<string, AnimationConfig> = {
  idle: {
    scale: [1, 1.02, 1],
    opacity: [0.8, 0.9, 0.8],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: 'easeInOut' as const,
    },
  },
  listening: {
    scale: [1, 1.05, 1],
    opacity: [0.9, 1, 0.9],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut' as const,
    },
  },
  thinking: {
    scale: [1, 1.03, 0.97, 1],
    opacity: [0.85, 0.95, 0.85, 0.95],
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: 'easeInOut' as const,
    },
  },
  speaking: {
    scale: [1, 1.08, 0.95, 1.05, 1],
    opacity: [1, 0.95, 1, 0.95, 1],
    transition: {
      duration: 0.8,
      repeat: Infinity,
      ease: 'easeInOut' as const,
    },
  },
}

/**
 * Glow configurations for different states
 */
const stateGlows: Record<string, string> = {
  idle: '0 0 30px rgba(99, 102, 241, 0.3)',
  listening: '0 0 40px rgba(34, 197, 94, 0.5)',
  thinking: '0 0 35px rgba(234, 179, 8, 0.4)',
  speaking: '0 0 50px rgba(99, 102, 241, 0.6)',
}

/**
 * VoiceOrb Component
 *
 * A visual indicator for voice conversation state.
 * Displays different animations based on whether the agent is:
 * - idle: subtle breathing animation
 * - listening: pulsing green glow
 * - thinking: amber pulsing
 * - speaking: active blue animation
 */
export function VoiceOrb({
  agentState = 'idle',
  primaryColor = '#6366F1',
  secondaryColor = '#8B5CF6',
  size = 120,
  className,
  onClick,
}: VoiceOrbProps) {
  // Get current animation based on state
  const animation = useMemo(() => {
    const state = agentState ?? 'idle'
    return stateAnimations[state] ?? stateAnimations.idle
  }, [agentState])

  // Get current glow based on state
  const glow = useMemo(() => {
    const state = agentState ?? 'idle'
    return stateGlows[state] ?? stateGlows.idle
  }, [agentState])

  // Style for the orb
  const orbStyle: CSSProperties = useMemo(
    () => ({
      width: size,
      height: size,
      background: `radial-gradient(circle at 30% 30%, ${primaryColor}, ${secondaryColor})`,
      boxShadow: glow,
    }),
    [size, primaryColor, secondaryColor, glow],
  )

  // Style for the inner ring
  const innerRingStyle: CSSProperties = useMemo(
    () => ({
      width: size * 0.85,
      height: size * 0.85,
    }),
    [size],
  )

  // Style for the outer ring
  const outerRingStyle: CSSProperties = useMemo(
    () => ({
      width: size * 1.15,
      height: size * 1.15,
    }),
    [size],
  )

  return (
    <div
      className={cn(
        'relative flex items-center justify-center',
        onClick && 'cursor-pointer',
        className,
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
    >
      {/* Outer glow ring */}
      <motion.div
        className="absolute rounded-full opacity-30"
        style={{
          ...outerRingStyle,
          background: `radial-gradient(circle, ${primaryColor}40, transparent 70%)`,
        }}
        animate={{
          scale: agentState === 'speaking' ? [1, 1.2, 1] : [1, 1.1, 1],
          opacity:
            agentState === 'speaking' ? [0.3, 0.5, 0.3] : [0.2, 0.3, 0.2],
        }}
        transition={{
          duration: agentState === 'speaking' ? 0.6 : 2,
          repeat: Infinity,
          ease: 'easeInOut' as const,
        }}
      />

      {/* Inner ring */}
      <motion.div
        className="absolute rounded-full border border-white/20"
        style={innerRingStyle}
        animate={{
          scale: agentState === 'listening' ? [1, 1.02, 1] : 1,
          opacity: [0.5, 0.7, 0.5],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut' as const,
        }}
      />

      {/* Main orb */}
      <motion.div
        className="rounded-full"
        style={orbStyle}
        animate={{
          scale: animation.scale,
          opacity: animation.opacity,
        }}
        transition={animation.transition}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      />

      {/* Center highlight */}
      <motion.div
        className="absolute rounded-full bg-white/30"
        style={{
          width: size * 0.3,
          height: size * 0.3,
          top: size * 0.15,
          left: size * 0.2,
          filter: 'blur(8px)',
        }}
        animate={{
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut' as const,
        }}
      />

      {/* State indicator dot */}
      {agentState != null && agentState !== 'idle' && (
        <motion.div
          className={cn(
            'absolute bottom-0 right-0 rounded-full',
            agentState === 'listening' && 'bg-green-500',
            agentState === 'thinking' && 'bg-yellow-500',
            agentState === 'speaking' && 'bg-indigo-500',
          )}
          style={{
            width: size * 0.15,
            height: size * 0.15,
          }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [1, 0.8, 1],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            ease: 'easeInOut' as const,
          }}
        />
      )}
    </div>
  )
}

/**
 * Get display text for agent state
 */
export function getStateDisplayText(state: OrbAgentState): string {
  switch (state) {
    case 'listening':
      return 'Listening...'
    case 'thinking':
      return 'Thinking...'
    case 'speaking':
      return 'Speaking...'
    case 'idle':
    default:
      return 'Ready'
  }
}
