import React, { useEffect, useRef, useState } from 'react'

// 8 curated palette families — each group of colors works together harmoniously
const PALETTE_FAMILIES = [
  {
    name: 'Warm Reds',
    colors: ['#FF6B6B', '#EF4444', '#DC2626', '#991B1B', '#F97316', '#EA580C'],
  },
  {
    name: 'Amber Golds',
    colors: ['#FDE68A', '#FCD34D', '#FBBF24', '#D97706', '#D4AF37', '#92400E'],
  },
  {
    name: 'Fresh Greens',
    colors: ['#BBF7D0', '#86EFAC', '#34D399', '#10B981', '#059669', '#065F46'],
  },
  {
    name: 'Cool Blues',
    colors: ['#BFDBFE', '#93C5FD', '#60A5FA', '#3B82F6', '#2563EB', '#1D4ED8'],
  },
  {
    name: 'Indigo & Navy',
    colors: ['#C7D2FE', '#A5B4FC', '#818CF8', '#6366F1', '#1e3a5f', '#0f2744'],
  },
  {
    name: 'Soft Purples',
    colors: ['#E9D5FF', '#C4B5FD', '#A78BFA', '#8B5CF6', '#7C3AED', '#4B0082'],
  },
  {
    name: 'Rose & Pink',
    colors: ['#FFE4E6', '#FCA5A5', '#F472B6', '#EC4899', '#DB2777', '#9D174D'],
  },
  {
    name: 'Neutrals',
    colors: ['#F1F5F9', '#CBD5E1', '#94A3B8', '#64748B', '#374151', '#1E293B'],
  },
]

// Returns relative luminance for WCAG contrast ratio
function relativeLuminance(hex) {
  const [r, g, b] = hex.replace('#','').match(/.{2}/g)
    .map(c => { const v = parseInt(c,16)/255; return v <= 0.04045 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4) })
  return 0.2126*r + 0.7152*g + 0.0722*b
}

function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hex1)
  const l2 = relativeLuminance(hex2)
  const bright = Math.max(l1, l2)
  const dark = Math.min(l1, l2)
  return (bright + 0.05) / (dark + 0.05)
}

export default function ColorPalette({ value, onChange, onClose }) {
  const ref = useRef(null)
  const [hexInput, setHexInput] = useState(value || '')
  const [customColor, setCustomColor] = useState(value || '#3B82F6')

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const handleSelect = (color) => {
    onChange(color)
    setHexInput(color)
    setCustomColor(color)
    onClose()
  }

  const handleHexSubmit = () => {
    const clean = hexInput.startsWith('#') ? hexInput : '#' + hexInput
    if (/^#[0-9a-fA-F]{6}$/.test(clean)) {
      handleSelect(clean)
    }
  }

  const ratio = value ? contrastRatio(value, '#ffffff') : null
  const contrastOk = ratio && ratio >= 3.0
  const contrastExcellent = ratio && ratio >= 4.5

  return (
    <div
      ref={ref}
      className="absolute z-50 mt-1 p-3 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-600"
      style={{ width: 256 }}
    >
      {/* Current color + contrast badge */}
      {value && (
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-8 h-8 rounded-lg border border-gray-200 shrink-0" style={{ background: value }} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-mono text-gray-600 dark:text-gray-300">{value}</p>
            <p className={`text-[10px] font-semibold ${contrastExcellent ? 'text-green-600' : contrastOk ? 'text-amber-600' : 'text-red-500'}`}>
              {contrastExcellent ? '✓ Excellent contrast' : contrastOk ? '⚠ OK contrast' : '✗ Low contrast on white'}
            </p>
          </div>
        </div>
      )}

      {/* Palette families */}
      <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
        {PALETTE_FAMILIES.map(family => (
          <div key={family.name}>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">{family.name}</p>
            <div className="flex gap-1 flex-wrap">
              {family.colors.map(color => (
                <button
                  key={color}
                  onClick={() => handleSelect(color)}
                  className="w-7 h-7 rounded-lg transition-transform hover:scale-125 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-400"
                  style={{
                    background: color,
                    boxShadow: value?.toLowerCase() === color.toLowerCase()
                      ? '0 0 0 2px white, 0 0 0 4px #3B82F6'
                      : '0 1px 3px rgba(0,0,0,0.15)',
                  }}
                  title={color}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="my-2.5 border-t border-gray-100 dark:border-gray-700" />

      {/* Color wheel + hex input */}
      <div className="space-y-2">
        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Custom</p>
        <div className="flex gap-2 items-center">
          <input
            type="color"
            value={customColor}
            onChange={e => { setCustomColor(e.target.value); setHexInput(e.target.value) }}
            onBlur={() => handleSelect(customColor)}
            className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5 shrink-0"
          />
          <input
            type="text"
            value={hexInput}
            onChange={e => setHexInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleHexSubmit()}
            onBlur={handleHexSubmit}
            placeholder="#3B82F6"
            className="flex-1 text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 font-mono bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 outline-none focus:ring-1 focus:ring-blue-400"
          />
          <button
            onClick={handleHexSubmit}
            className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-2.5 py-1.5 rounded-lg font-semibold transition"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
}
