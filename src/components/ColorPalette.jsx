import React, { useEffect, useRef } from 'react'

const PALETTE = [
  // Reds / oranges
  '#EF4444', '#F97316', '#F4A261', '#FBBF24',
  // Yellows / greens
  '#FFF0A0', '#A8E6CF', '#6EE7B7', '#34D399',
  // Blues
  '#93C5FD', '#60A5FA', '#3B82F6', '#1D4ED8',
  // Purples
  '#C3B1E1', '#A78BFA', '#7C3AED', '#6B21A8',
  // Pinks
  '#FCA5A5', '#F472B6', '#EC4899', '#DB2777',
  // Neutrals
  '#D1D5DB', '#9CA3AF', '#6B7280', '#374151',
]

export default function ColorPalette({ value, onChange, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute z-50 mt-1 p-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-600"
      style={{ width: 160 }}
    >
      <div className="grid grid-cols-6 gap-1.5">
        {PALETTE.map(color => (
          <button
            key={color}
            onClick={() => { onChange(color); onClose() }}
            className="w-5 h-5 rounded-md transition-transform hover:scale-125 focus:outline-none"
            style={{
              background: color,
              boxShadow: value?.toLowerCase() === color.toLowerCase()
                ? '0 0 0 2px white, 0 0 0 3.5px #3B82F6'
                : undefined,
            }}
            title={color}
          />
        ))}
      </div>
    </div>
  )
}
