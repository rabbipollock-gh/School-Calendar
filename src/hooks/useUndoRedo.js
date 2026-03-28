import { useState, useCallback, useEffect } from 'react'

const MAX_STACK = 20

export function useUndoRedo(initialState) {
  const [history, setHistory] = useState({
    past: [],
    present: initialState,
    future: [],
  })

  const canUndo = history.past.length > 0
  const canRedo = history.future.length > 0

  const set = useCallback((newPresent) => {
    setHistory((h) => ({
      past: [...h.past.slice(-MAX_STACK + 1), h.present],
      present: newPresent,
      future: [],
    }))
  }, [])

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.past.length === 0) return h
      const previous = h.past[h.past.length - 1]
      return {
        past: h.past.slice(0, -1),
        present: previous,
        future: [h.present, ...h.future],
      }
    })
  }, [])

  const redo = useCallback(() => {
    setHistory((h) => {
      if (h.future.length === 0) return h
      const next = h.future[0]
      return {
        past: [...h.past, h.present],
        present: next,
        future: h.future.slice(1),
      }
    })
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC')
      const mod = isMac ? e.metaKey : e.ctrlKey
      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
      if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo])

  return { state: history.present, set, undo, redo, canUndo, canRedo }
}
