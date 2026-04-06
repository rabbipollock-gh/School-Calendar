import { useState, useCallback, useEffect, useRef } from 'react'
import { getAcademicMonths } from '../utils/academicMonths.js'

export function useKeyboardNav(onOpenModal, academicYear) {
  const [focusedDate, setFocusedDate] = useState(null)
  const gridRef = useRef(null)

  const move = useCallback((direction) => {
    setFocusedDate((current) => {
      if (!current) {
        const months = getAcademicMonths(academicYear)
        const first = months[0]
        return `${first.year}-${String(first.month + 1).padStart(2, '0')}-01`
      }
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
