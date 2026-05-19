import { useEffect, useRef, useState } from 'react'

export function usePullToRefresh(onRefresh, { threshold = 80 } = {}) {
  const [state, setState] = useState('idle') // 'idle' | 'pulling' | 'release' | 'refreshing'
  const startY = useRef(null)
  const currentDist = useRef(0)
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  useEffect(() => {
    const el = document.querySelector('.main-content')
    if (!el) return

    const touchStart = (e) => {
      if (el.scrollTop > 2) return
      startY.current = e.touches[0].clientY
      currentDist.current = 0
    }

    const touchMove = (e) => {
      if (startY.current === null) return
      const d = e.touches[0].clientY - startY.current
      if (d <= 0) { startY.current = null; setState('idle'); return }
      // Apply resistance so it's harder to pull past threshold
      const clamped = Math.min(d * 0.5, threshold * 1.3)
      currentDist.current = clamped
      setState(clamped >= threshold ? 'release' : 'pulling')
    }

    const touchEnd = async () => {
      if (startY.current === null) return
      const d = currentDist.current
      startY.current = null
      currentDist.current = 0
      if (d >= threshold) {
        setState('refreshing')
        try { await onRefreshRef.current?.() } catch {}
        setState('idle')
      } else {
        setState('idle')
      }
    }

    el.addEventListener('touchstart', touchStart, { passive: true })
    el.addEventListener('touchmove', touchMove, { passive: true })
    el.addEventListener('touchend', touchEnd)
    return () => {
      el.removeEventListener('touchstart', touchStart)
      el.removeEventListener('touchmove', touchMove)
      el.removeEventListener('touchend', touchEnd)
    }
  }, [threshold])

  return { state }
}
