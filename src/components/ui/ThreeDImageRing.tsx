'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from 'react'
import { animate, motion, useInView, useMotionValue, useReducedMotion } from 'framer-motion'

export interface ThreeDImageRingProps {
  images: string[]
  onImageClick?: (index: number) => void
  width?: number
  perspective?: number
  imageDistance?: number
  initialRotation?: number
  animationDuration?: number
  staggerDelay?: number
  hoverOpacity?: number
  containerClassName?: string
  ringClassName?: string
  imageClassName?: string
  backgroundColor?: string
  draggable?: boolean
  mobileBreakpoint?: number
  mobileScaleFactor?: number
  inertiaPower?: number
  inertiaTimeConstant?: number
  inertiaVelocityMultiplier?: number
  posterGap?: number
  onActiveIndexChange?: (index: number) => void
  autoRotate?: boolean
  autoRotateDelay?: number
  autoRotateInterval?: number
  autoRotateDuration?: number
  resetWhenOutOfView?: boolean
  pauseAutoRotate?: boolean
}

interface PointerGesture {
  pointerId: number
  lastX: number
  distance: number
  velocity: number
  captured: boolean
}

const DRAG_THRESHOLD = 7

export function ThreeDImageRing({
  images = [],
  onImageClick,
  width = 300,
  perspective = 2000,
  imageDistance = 500,
  initialRotation = 0,
  animationDuration = 0.45,
  staggerDelay = 0.035,
  hoverOpacity = 0.46,
  containerClassName = '',
  ringClassName = '',
  imageClassName = '',
  backgroundColor,
  draggable = true,
  mobileBreakpoint = 768,
  mobileScaleFactor = 0.68,
  inertiaPower = 0.8,
  inertiaTimeConstant = 300,
  inertiaVelocityMultiplier = 18,
  posterGap = 24,
  onActiveIndexChange,
  autoRotate = false,
  autoRotateDelay = 5000,
  autoRotateInterval = 5000,
  autoRotateDuration = 0.9,
  resetWhenOutOfView = false,
  pauseAutoRotate = false,
}: ThreeDImageRingProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const gestureRef = useRef<PointerGesture | null>(null)
  const suppressClickRef = useRef(false)
  const activeAnimationRef = useRef<{ stop: () => void } | null>(null)
  const lastActiveIndex = useRef(-1)
  const rotationY = useMotionValue(initialRotation)
  const prefersReducedMotion = useReducedMotion()
  const isRingInView = useInView(containerRef, { amount: 0.25 })

  const [containerWidth, setContainerWidth] = useState(0)
  const [frontIndex, setFrontIndex] = useState(0)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isPointerActive, setIsPointerActive] = useState(false)
  const [hasKeyboardFocus, setHasKeyboardFocus] = useState(false)
  const [isPageVisible, setIsPageVisible] = useState(true)
  const [interactionVersion, setInteractionVersion] = useState(0)

  const angle = images.length > 0 ? 360 / images.length : 0
  const isCompact = containerWidth > 0 && containerWidth < mobileBreakpoint
  const responsiveScale = useMemo(() => {
    if (!containerWidth) return 1
    if (isCompact) {
      return Math.max(mobileScaleFactor, Math.min(0.82, containerWidth / mobileBreakpoint))
    }
    return Math.max(0.86, Math.min(1, containerWidth / 1200))
  }, [containerWidth, isCompact, mobileBreakpoint, mobileScaleFactor])

  const posterWidth = Math.round(width * responsiveScale)
  const posterHeight = Math.round(posterWidth * 1.5)
  const responsiveGap = isCompact ? Math.max(14, posterGap * 0.7) : posterGap
  const requiredRadius = images.length > 1
    ? (posterWidth + responsiveGap) / (2 * Math.sin(Math.PI / images.length))
    : 0
  const radius = Math.round(Math.max(imageDistance * responsiveScale, requiredRadius))

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateWidth = () => setContainerWidth(container.clientWidth)
    updateWidth()

    const observer = new ResizeObserver(updateWidth)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const updateVisibility = () => setIsPageVisible(document.visibilityState === 'visible')
    updateVisibility()
    document.addEventListener('visibilitychange', updateVisibility)
    return () => document.removeEventListener('visibilitychange', updateVisibility)
  }, [])

  useEffect(() => {
    const unsubscribe = rotationY.on('change', (rotation) => {
      if (!images.length) return

      const normalizedRotation = ((rotation % 360) + 360) % 360
      const activeIndex = Math.round(normalizedRotation / angle) % images.length
      if (activeIndex !== lastActiveIndex.current) {
        lastActiveIndex.current = activeIndex
        setFrontIndex(activeIndex)
        onActiveIndexChange?.(activeIndex)
      }
    })

    return () => unsubscribe()
  }, [angle, images.length, onActiveIndexChange, rotationY])

  useEffect(() => {
    lastActiveIndex.current = -1
    setFrontIndex(0)
    onActiveIndexChange?.(0)
  }, [images.length, onActiveIndexChange])

  useEffect(() => () => activeAnimationRef.current?.stop(), [])

  const stopRotationAnimation = useCallback(() => {
    activeAnimationRef.current?.stop()
    activeAnimationRef.current = null
  }, [])

  useEffect(() => {
    if (!resetWhenOutOfView || isRingInView) return

    stopRotationAnimation()
    rotationY.set(initialRotation)
  }, [initialRotation, isRingInView, resetWhenOutOfView, rotationY, stopRotationAnimation])

  const settleRotation = useCallback((velocity = 0) => {
    if (!angle) return

    const current = rotationY.get()
    const projection = current + velocity * inertiaVelocityMultiplier * inertiaPower
    const target = Math.round(projection / angle) * angle

    stopRotationAnimation()
    if (Math.abs(current - target) < 0.01) {
      rotationY.set(target)
      return
    }

    if (prefersReducedMotion) {
      rotationY.set(target)
      return
    }

    activeAnimationRef.current = animate(current, target, {
      type: 'spring',
      stiffness: Math.max(110, 240 - inertiaTimeConstant / 2),
      damping: 26,
      mass: 0.68,
      onUpdate: (latest) => rotationY.set(latest),
    })
  }, [
    angle,
    inertiaPower,
    inertiaTimeConstant,
    inertiaVelocityMultiplier,
    prefersReducedMotion,
    rotationY,
    stopRotationAnimation,
  ])

  useEffect(() => {
    if (
      !autoRotate
      || !isRingInView
      || prefersReducedMotion
      || !isPageVisible
      || isDragging
      || isPointerActive
      || hasKeyboardFocus
      || pauseAutoRotate
      || images.length < 2
      || !angle
    ) {
      if (
        isRingInView
        && !prefersReducedMotion
        && isPageVisible
        && !isDragging
        && !isPointerActive
        && (!autoRotate || hasKeyboardFocus || pauseAutoRotate)
      ) {
        settleRotation()
      }
      return
    }

    let intervalId: number | undefined
    const rotateToNextPoster = () => {
      const current = rotationY.get()
      // Positive rotation mirrors dragging the posters from right to left.
      const target = Math.round(current / angle) * angle + angle

      stopRotationAnimation()
      activeAnimationRef.current = animate(current, target, {
        duration: autoRotateDuration,
        ease: 'easeInOut',
        onUpdate: (latest) => rotationY.set(latest),
      })
    }

    const timeoutId = window.setTimeout(() => {
      rotateToNextPoster()
      intervalId = window.setInterval(rotateToNextPoster, autoRotateInterval)
    }, autoRotateDelay)

    return () => {
      window.clearTimeout(timeoutId)
      if (intervalId !== undefined) window.clearInterval(intervalId)
      stopRotationAnimation()
    }
  }, [
    angle,
    autoRotate,
    autoRotateDelay,
    autoRotateDuration,
    autoRotateInterval,
    hasKeyboardFocus,
    images.length,
    interactionVersion,
    isDragging,
    isPageVisible,
    isPointerActive,
    isRingInView,
    pauseAutoRotate,
    prefersReducedMotion,
    rotationY,
    settleRotation,
    stopRotationAnimation,
  ])

  const handlePointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!draggable || (event.pointerType === 'mouse' && event.button !== 0)) return

    stopRotationAnimation()
    setIsPointerActive(true)
    suppressClickRef.current = false
    gestureRef.current = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      distance: 0,
      velocity: 0,
      captured: false,
    }
  }, [draggable, stopRotationAnimation])

  const handlePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return

    const deltaX = event.clientX - gesture.lastX
    if (!deltaX) return

    gesture.lastX = event.clientX
    gesture.distance += Math.abs(deltaX)
    if (gesture.distance < DRAG_THRESHOLD) return

    if (!gesture.captured) {
      event.currentTarget.setPointerCapture(event.pointerId)
      gesture.captured = true
      setHoveredIndex(null)
      setIsDragging(true)
    }

    const sensitivity = isCompact ? 0.34 : 0.27
    const rotationDelta = -deltaX * sensitivity
    gesture.velocity = rotationDelta
    rotationY.set(rotationY.get() + rotationDelta)
  }, [isCompact, rotationY])

  const finishPointerGesture = useCallback((
    event: PointerEvent<HTMLDivElement>,
    cancelled = false,
  ) => {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return

    if (gesture.captured && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    gestureRef.current = null
    setIsDragging(false)
    setIsPointerActive(false)

    const wasDrag = gesture.distance >= DRAG_THRESHOLD
    if (!wasDrag && !cancelled) {
      // Preserve the native click target so tapping the front poster opens its detail page.
      settleRotation()
      return
    }

    suppressClickRef.current = true
    settleRotation(cancelled ? 0 : gesture.velocity)
  }, [settleRotation])

  const handlePointerLeave = useCallback(() => {
    setInteractionVersion((version) => version + 1)
    if (!isDragging) setHoveredIndex(null)
  }, [isDragging])

  const handlePosterClick = useCallback((index: number) => {
    if (suppressClickRef.current) return
    onImageClick?.(index)
  }, [onImageClick])

  if (!images.length) return null

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full select-none overflow-hidden ${containerClassName}`}
      style={{
        backgroundColor,
        touchAction: draggable ? 'pan-y' : 'auto',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => finishPointerGesture(event)}
      onPointerCancel={(event) => finishPointerGesture(event, true)}
      onPointerLeave={handlePointerLeave}
      onFocus={() => {
        stopRotationAnimation()
        setHasKeyboardFocus(true)
      }}
      onBlur={() => {
        setHasKeyboardFocus(false)
        setInteractionVersion((version) => version + 1)
      }}
    >
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          perspective: `${perspective}px`,
          width: `${posterWidth}px`,
          height: `${posterHeight}px`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <motion.div
          className={`absolute h-full w-full ${ringClassName}`}
          style={{
            transformStyle: 'preserve-3d',
            rotateY: rotationY,
            cursor: draggable ? (isDragging ? 'grabbing' : 'grab') : 'default',
            willChange: 'transform',
          }}
        >
          {images.map((imageUrl, index) => {
            const isHovered = hoveredIndex === index && !isDragging
            const isDimmed = hoveredIndex !== null && !isHovered && !isDragging

            return (
              <motion.div
                key={`${imageUrl}-${index}`}
                data-ring-index={index}
                className={`absolute h-full w-full overflow-hidden rounded-xl border border-white/10 bg-gray-900 shadow-2xl outline-none focus-visible:ring-2 focus-visible:ring-pink-400 ${imageClassName}`}
                style={{
                  transformStyle: 'preserve-3d',
                  backgroundImage: `url(${imageUrl})`,
                  backgroundSize: 'cover',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center',
                  backfaceVisibility: 'hidden',
                  rotateY: index * -angle,
                  z: -radius,
                  transformOrigin: `50% 50% ${radius}px`,
                  cursor: draggable ? 'grab' : 'default',
                  pointerEvents: 'none',
                  willChange: 'transform, opacity',
                }}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 32 }}
                animate={{
                  opacity: isDimmed ? hoverOpacity : 1,
                  scale: isHovered ? 1.035 : 1,
                  y: 0,
                }}
                transition={{
                  opacity: { duration: 0.16 },
                  scale: { duration: 0.18, ease: 'easeOut' },
                  y: {
                    duration: prefersReducedMotion ? 0 : animationDuration,
                    delay: prefersReducedMotion ? 0 : index * staggerDelay,
                    ease: 'easeOut',
                  },
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-white/[0.04]" />
              </motion.div>
            )
          })}
        </motion.div>

      </div>

      {onImageClick && (
        <button
          type="button"
          aria-label={`Open poster ${frontIndex + 1}`}
          className="absolute left-1/2 top-1/2 z-20 cursor-pointer rounded-xl bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-pink-400"
          style={{
            width: `${posterWidth}px`,
            height: `${posterHeight}px`,
            transform: 'translate(-50%, -50%)',
          }}
          onPointerEnter={() => !isDragging && setHoveredIndex(frontIndex)}
          onPointerLeave={() => !isDragging && setHoveredIndex(null)}
          onClick={() => handlePosterClick(frontIndex)}
        >
          <span className="sr-only">Open selected title</span>
        </button>
      )}
    </div>
  )
}

export default ThreeDImageRing
