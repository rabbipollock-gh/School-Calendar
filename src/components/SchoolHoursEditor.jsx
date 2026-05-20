import React, { useState, useRef, useEffect } from 'react'
import { nanoid } from '../utils/nanoid.js'

const PILL_COLORS = {
  navy:   '#142a5c',
  green:  '#1a8a6a',
  blue:   '#1f6dbf',
  gold:   '#d98b1a',
  purple: '#7c4ca8',
}

const INPUT_STYLE = {
  background: '#0a1226',
  border: '1px solid #1c2848',
  borderRadius: 6,
  padding: '7px 9px',
  fontSize: 13,
  color: '#e8ecf4',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

export default function SchoolHoursEditor({ value, onChange, readOnly }) {
  const [openPicker, setOpenPicker] = useState(null)
  const [focusNewId, setFocusNewId] = useState(null)
  const newLabelRefs = useRef({})
  const dragIdx = useRef(null)
  const dragOverIdx = useRef(null)

  const rows     = value?.rows ?? []
  const footnote = value?.footnote ?? ''

  useEffect(() => {
    if (focusNewId && newLabelRefs.current[focusNewId]) {
      newLabelRefs.current[focusNewId].focus()
      setFocusNewId(null)
    }
  }, [focusNewId, rows.length])

  const emit = (newRows, newFootnote = footnote) => onChange({ rows: newRows, footnote: newFootnote })

  const updateRow = (id, field, val) => emit(rows.map(r => r.id === id ? { ...r, [field]: val } : r))

  const deleteRow = (id) => emit(rows.filter(r => r.id !== id))

  const addRow = () => {
    if (readOnly) return
    const id = nanoid()
    emit([...rows, { id, color: 'navy', label: '', time: '', note: '' }])
    setFocusNewId(id)
  }

  const handleDragStart = (e, idx) => {
    dragIdx.current = idx
    e.dataTransfer.effectAllowed = 'move'
  }
  const handleDragOver = (e, idx) => {
    e.preventDefault()
    dragOverIdx.current = idx
  }
  const handleDrop = () => {
    if (dragIdx.current === null || dragOverIdx.current === null || dragIdx.current === dragOverIdx.current) {
      dragIdx.current = null; dragOverIdx.current = null; return
    }
    const next = [...rows]
    const [moved] = next.splice(dragIdx.current, 1)
    next.splice(dragOverIdx.current, 0, moved)
    dragIdx.current = null; dragOverIdx.current = null
    emit(next)
  }
  const handleDragEnd = () => { dragIdx.current = null; dragOverIdx.current = null }

  // Close color picker when clicking outside
  const containerRef = useRef(null)
  useEffect(() => {
    if (!openPicker) return
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpenPicker(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openPicker])

  const eyebrowStyle = { fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: '#8ea0c5', textTransform: 'uppercase', margin: '0 0 4px' }
  const helpStyle    = { fontSize: 12, color: '#6b7ba0', margin: '0 0 8px' }
  const headerCell   = { fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4a5778' }
  const containerStyle = { background: '#0a1226', border: '1px solid #1c2848', borderRadius: 10, padding: 12 }
  const gridStyle      = { display: 'grid', gridTemplateColumns: '16px 24px 1fr 1fr 1fr 24px', columnGap: 8, alignItems: 'center' }

  return (
    <div ref={containerRef}>
      <style>{`
        .sh-input::placeholder { color: #4a5778; }
        .sh-input:focus { border-color: #4a78d3 !important; }
        .sh-del-btn:hover { color: #d6584b !important; }
        .sh-add-btn:hover { border-color: #4a78d3 !important; color: #cfd5e6 !important; }
      `}</style>

      <p style={eyebrowStyle}>SCHOOL HOURS</p>
      <p style={helpStyle}>
        Add a row per schedule. The{' '}
        <code style={{ background: '#1c2848', color: '#cfd5e6', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>Note</code>
        {' '}column shows as small gray text after the time. Reorder by dragging the grip.
      </p>

      <div style={containerStyle}>
        {rows.length > 0 && (
          <div style={{ ...gridStyle, marginBottom: 6 }}>
            <span />
            <span style={headerCell}>Color</span>
            <span style={headerCell}>Label</span>
            <span style={headerCell}>Time</span>
            <span style={headerCell}>Note</span>
            <span />
          </div>
        )}

        {rows.map((row, idx) => (
          <div key={row.id}>
            {idx > 0 && <div style={{ borderTop: '1px dashed #1c2848', margin: '6px 0' }} />}
            <div
              style={gridStyle}
              draggable={!readOnly}
              onDragStart={e => handleDragStart(e, idx)}
              onDragOver={e => handleDragOver(e, idx)}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
            >
              {/* Grip */}
              <span style={{ color: '#4a5778', cursor: readOnly ? 'default' : 'grab', fontSize: 13, userSelect: 'none', lineHeight: 1 }}>⠿</span>

              {/* Color swatch + picker */}
              <div style={{ position: 'relative' }}>
                <div
                  onClick={() => !readOnly && setOpenPicker(openPicker === row.id ? null : row.id)}
                  style={{
                    width: 22, height: 22,
                    background: PILL_COLORS[row.color] || PILL_COLORS.navy,
                    borderRadius: 6,
                    border: '1px solid rgba(255,255,255,0.1)',
                    cursor: readOnly ? 'default' : 'pointer',
                  }}
                />
                {openPicker === row.id && (
                  <div style={{
                    position: 'absolute', top: 28, left: 0,
                    background: '#1c2848', border: '1px solid #2c3d6a',
                    borderRadius: 8, padding: 8,
                    display: 'flex', gap: 6, zIndex: 50,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                  }}>
                    {Object.entries(PILL_COLORS).map(([name, hex]) => (
                      <div
                        key={name}
                        title={name}
                        onClick={e => {
                          e.stopPropagation()
                          updateRow(row.id, 'color', name)
                          setOpenPicker(null)
                        }}
                        style={{
                          width: 22, height: 22,
                          background: hex,
                          borderRadius: 6,
                          border: row.color === name ? '2px solid #fff' : '1px solid rgba(255,255,255,0.15)',
                          cursor: 'pointer',
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Label */}
              <input
                ref={el => { newLabelRefs.current[row.id] = el }}
                type="text"
                value={row.label}
                onChange={e => updateRow(row.id, 'label', e.target.value)}
                readOnly={readOnly}
                className="sh-input"
                style={INPUT_STYLE}
              />

              {/* Time */}
              <input
                type="text"
                value={row.time}
                onChange={e => updateRow(row.id, 'time', e.target.value)}
                readOnly={readOnly}
                className="sh-input"
                style={INPUT_STYLE}
              />

              {/* Note */}
              <input
                type="text"
                value={row.note}
                onChange={e => updateRow(row.id, 'note', e.target.value)}
                placeholder="optional"
                readOnly={readOnly}
                className="sh-input"
                style={INPUT_STYLE}
              />

              {/* Delete */}
              <button
                onClick={() => !readOnly && deleteRow(row.id)}
                disabled={readOnly}
                className="sh-del-btn"
                style={{ color: '#4a5778', background: 'none', border: 'none', cursor: readOnly ? 'default' : 'pointer', fontSize: 14, padding: 0, lineHeight: 1, transition: 'color 0.15s' }}
              >
                ✕
              </button>
            </div>
          </div>
        ))}

        {!readOnly && (
          <button
            onClick={addRow}
            className="sh-add-btn"
            style={{
              width: '100%',
              padding: '9px 12px',
              border: '1px dashed #2c3d6a',
              borderRadius: 8,
              background: 'transparent',
              color: '#8ea0c5',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              marginTop: rows.length > 0 ? 8 : 0,
              transition: 'border-color 0.15s, color 0.15s',
            }}
          >
            + Add hours row
          </button>
        )}
      </div>

      {/* Footnote */}
      <div style={{ marginTop: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: '#8ea0c5', display: 'block', marginBottom: 4 }}>
          Footnote{' '}
          <span style={{ color: '#6b7ba0', fontWeight: 400 }}>(rendered bold in PDF)</span>
        </label>
        <input
          type="text"
          value={footnote}
          onChange={e => emit(rows, e.target.value)}
          readOnly={readOnly}
          placeholder="e.g. No Preschool on Kodesh Only Days"
          className="sh-input"
          style={{ ...INPUT_STYLE, borderRadius: 8, padding: '10px 12px', fontSize: 14 }}
        />
        <p style={{ fontSize: 11, color: '#6b7ba0', marginTop: 4 }}>
          Shown below the hours list with a star ★ and divider line. Leave blank to hide.
        </p>
      </div>
    </div>
  )
}
