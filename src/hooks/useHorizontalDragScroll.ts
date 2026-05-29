'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
  type PointerEvent,
  type UIEvent,
} from 'react'

interface DragState {
  pointerId: number
  startX: number
  startScrollLeft: number
  targetScrollLeft: number
  distance: number
  captured: boolean
  stylesApplied: boolean
  frameId: number | null
  originalScrollBehavior: string
  originalScrollSnapType: string
  originalUserSelect: string
}

interface UseHorizontalDragScrollOptions {
  threshold?: number
}

const DEFAULT_DRAG_THRESHOLD = 6

export function useHorizontalDragScroll<T extends HTMLElement>(
  scrollRef: { current: T | null },
  options: UseHorizontalDragScrollOptions = {},
) {
  const threshold = options.threshold ?? DEFAULT_DRAG_THRESHOLD
  const dragStateRef = useRef<DragState | null>(null)
  const suppressClickRef = useRef(false)
  const scrollIdleTimerRef = useRef<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => () => {
    if (scrollIdleTimerRef.current !== null) {
      window.clearTimeout(scrollIdleTimerRef.current)
    }
  }, [])

  const applyDragStyles = useCallback((container: T) => {
    container.classList.add('is-horizontal-dragging')
    container.style.scrollBehavior = 'auto'
    container.style.scrollSnapType = 'none'
    container.style.userSelect = 'none'
  }, [])

  const restoreDragStyles = useCallback((container: T, dragState: DragState) => {
    container.classList.remove('is-horizontal-dragging')
    container.style.scrollBehavior = dragState.originalScrollBehavior
    container.style.scrollSnapType = dragState.originalScrollSnapType
    container.style.userSelect = dragState.originalUserSelect
  }, [])

  const releasePointerCapture = useCallback((element: T, pointerId: number) => {
    if (!element.hasPointerCapture(pointerId)) return

    try {
      element.releasePointerCapture(pointerId)
    } catch {
      // Some browsers can throw if capture was already released.
    }
  }, [])

  const handlePointerDown = useCallback((event: PointerEvent<T>) => {
    const container = scrollRef.current
    if (!container || event.pointerType !== 'mouse' || event.button !== 0) return
    if (container.scrollWidth <= container.clientWidth) return

    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: container.scrollLeft,
      targetScrollLeft: container.scrollLeft,
      distance: 0,
      captured: false,
      stylesApplied: false,
      frameId: null,
      originalScrollBehavior: container.style.scrollBehavior,
      originalScrollSnapType: container.style.scrollSnapType,
      originalUserSelect: container.style.userSelect,
    }
    suppressClickRef.current = false
  }, [scrollRef])

  const handlePointerMove = useCallback((event: PointerEvent<T>) => {
    const container = scrollRef.current
    const dragState = dragStateRef.current
    if (!container || !dragState || dragState.pointerId !== event.pointerId) return

    const deltaX = event.clientX - dragState.startX
    dragState.distance = Math.abs(deltaX)
    if (dragState.distance < threshold) return

    event.preventDefault()

    if (!dragState.captured) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
        dragState.captured = true
      } catch {
        dragState.captured = false
      }
      if (!dragState.stylesApplied) {
        applyDragStyles(container)
        dragState.stylesApplied = true
      }
      setIsDragging(true)
    }

    dragState.targetScrollLeft = dragState.startScrollLeft - deltaX
    if (dragState.frameId !== null) return

    dragState.frameId = window.requestAnimationFrame(() => {
      const currentDragState = dragStateRef.current
      if (!currentDragState || currentDragState.pointerId !== event.pointerId) return

      container.scrollLeft = currentDragState.targetScrollLeft
      currentDragState.frameId = null
    })
  }, [applyDragStyles, scrollRef, threshold])

  const finishDrag = useCallback((event: PointerEvent<T>, cancelled = false) => {
    const dragState = dragStateRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) return

    if (dragState.frameId !== null) {
      window.cancelAnimationFrame(dragState.frameId)
    }

    const container = scrollRef.current
    if (container) {
      container.scrollLeft = dragState.targetScrollLeft
    }

    if (container && dragState.stylesApplied) {
      restoreDragStyles(container, dragState)
    }

    if (dragState.captured) {
      releasePointerCapture(event.currentTarget, event.pointerId)
    }

    const wasDrag = dragState.distance >= threshold
    dragStateRef.current = null
    setIsDragging(false)

    if (wasDrag || cancelled) {
      suppressClickRef.current = true
    }
  }, [releasePointerCapture, restoreDragStyles, scrollRef, threshold])

  const handlePointerLeave = useCallback((event: PointerEvent<T>) => {
    const dragState = dragStateRef.current
    if (!dragState || dragState.captured) return

    if (dragState.pointerId === event.pointerId) {
      if (dragState.frameId !== null) window.cancelAnimationFrame(dragState.frameId)
      const container = scrollRef.current
      if (container && dragState.stylesApplied) {
        restoreDragStyles(container, dragState)
      }
      dragStateRef.current = null
      setIsDragging(false)
    }
  }, [restoreDragStyles, scrollRef])

  const handleClickCapture = useCallback((event: MouseEvent<T>) => {
    if (!suppressClickRef.current) return

    event.preventDefault()
    event.stopPropagation()
    suppressClickRef.current = false
  }, [])

  const handleDragStart = useCallback((event: DragEvent<T>) => {
    if (dragStateRef.current) event.preventDefault()
  }, [])

  const handleScroll = useCallback((event: UIEvent<T>) => {
    const container = event.currentTarget
    container.classList.add('is-horizontal-scrolling')

    if (scrollIdleTimerRef.current !== null) {
      window.clearTimeout(scrollIdleTimerRef.current)
    }

    scrollIdleTimerRef.current = window.setTimeout(() => {
      container.classList.remove('is-horizontal-scrolling')
      scrollIdleTimerRef.current = null
    }, 120)
  }, [])

  return {
    isDragging,
    dragScrollProps: {
      onScroll: handleScroll,
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: finishDrag,
      onPointerCancel: (event: PointerEvent<T>) => finishDrag(event, true),
      onPointerLeave: handlePointerLeave,
      onClickCapture: handleClickCapture,
      onDragStart: handleDragStart,
    },
  }
}
