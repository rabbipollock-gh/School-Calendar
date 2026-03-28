import { useState, useCallback, useEffect, useRef } from 'react'

// Months in the academic year: Aug 2026 – Jun 2027
export const ACADEMIC_MONTHS = [
  { year: 2026, month: 7 },  // August (0-indexed)
  { year: 2026, month: 8 },  // September
  { year: 2026, month: 9 },  // October
  { year: 2026, month: 10 }, // November
  { year: 2026, month: 11 }, // December
  { year: 2027, month: 0 },  // January
  { year: 2027, month: 1 },  // February
  { year: 2027, month: 2 },  // March
  { year: 2027, month: 3 },  // April
  { year: 2027, month: 4 },  // May
  { year: 2027, month: 5 },  // June
]

export function useKeyboardNav(onOpenModal) {
  const [focusedDate, setFocusedDate] = useState(null)
  const gridRef = useRef(null)

  const move = useCallback((direction) => {
    setFocusedDate((current) => {
      if (!current) return '2026-08-26' // default start date
      const d = new Date(current + 'T00:00:00')
      switch (direction) {
        case 'left':  d.setDate(d.getDate() - 1); break
        case 'right': d.setDate(d.getDate() + 1); break
        case 'up':    d.setDate(d.getDate() - 7); break
        case 'down':  d.setDate(d.getDate() + 7); break
        default: return current
      }
      return d.toISOString().slice(0, 10)
    })
  }, [])

  useEffect(() => {
    const handler = (e) => {
      // Only when grid is focused (not modal/input)
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return
      const activeModal = document.querySelector('[role="dialog"]')
      if (activeModal) return

      switch (e.key) {
        case 'ArrowLeft':  e.preventDefault(); move('left');  break
        case 'ArrowRight': e.preventDefault(); move('right'); break
        case 'ArrowUp':    e.preventDefault(); move('up');    break
        case 'ArrowDown':  e.preventDefault(); move('down');  break
        case 'Enter':
          if (focusedDate) { e.preventDefault(); onOpenModal?.(focusedDate) }
          break
        case 'Escape':
          setFocusedDate(null)
          break
        default: break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [move, focusedDate, onOpenModal])

  return { focusedDate, setFocusedDate, gridRef }
}
