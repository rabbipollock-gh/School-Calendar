import React, { useState } from 'react'
import { useCalendar } from '../context/CalendarContext.jsx'
import { nanoid } from '../utils/nanoid.js'

export default function CategoryManager({ onClose }) {
  const { state, dispatch, readOnly } = useCalendar()
  const { categories } = state

  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#A0C4FF')
  const [newIcon, setNewIcon] = useState('')

  const handleAdd = () => {
    if (!newName.trim() || readOnly) return
    dispatch({
      type: 'ADD_CATEGORY',
      category: { id: 'cat-' + nanoid(), name: newName.trim(), color: newColor, icon: newIcon || '📌', visible: true, deletable: true },
    })
    setNewName('')
    setNewColor('#A0C4FF')
    setNewIcon('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-[#1e3a5f] flex items-center justify-between shrink-0">
          <h2 className="text-white font-bold text-lg">Category Manager</h2>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl">×</button>
        </div>

        {/* Category list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {categories.map(cat => (
            <div key={cat.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition group">
              {/* Color swatch / picker */}
              <label className="cursor-pointer" title="Click to change color">
                <input
                  type="color"
                  value={cat.color}
                  onChange={e => !readOnly && dispatch({ type: 'EDIT_CATEGORY', categoryId: cat.id, changes: { color: e.target.value } })}
                  className="sr-only"
                  disabled={readOnly}
                />
                <div
                  className="w-8 h-8 rounded-lg border-2 border-white dark:border-gray-600 shadow transition hover:scale-110"
                  style={{ background: cat.color }}
                  title={cat.color}
                />
              </label>

              {/* Icon */}
              <span className="text-lg w-7 text-center">{cat.icon}</span>

              {/* Name */}
              <div className="flex-1 min-w-0">
                {!readOnly ? (
                  <input
                    type="text"
                    value={cat.name}
                    onChange={e => dispatch({ type: 'EDIT_CATEGORY', categoryId: cat.id, changes: { name: e.target.value } })}
                    className="w-full text-sm font-medium text-gray-800 dark:text-gray-100 bg-transparent border-b border-transparent focus:border-blue-400 outline-none"
                  />
                ) : (
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{cat.name}</p>
                )}
                <p className="text-xs text-gray-400">{cat.deletable ? 'Custom' : 'Default'}{!cat.deletable ? ' (cannot delete)' : ''}</p>
              </div>

              {/* Visibility toggle */}
              <button
                onClick={() => !readOnly && dispatch({ type: 'EDIT_CATEGORY', categoryId: cat.id, changes: { visible: !cat.visible } })}
                className={`text-sm px-2 py-1 rounded-lg transition ${cat.visible ? 'text-green-600 bg-green-50 dark:bg-green-900/30' : 'text-gray-400 bg-gray-100 dark:bg-gray-700'}`}
                title={cat.visible ? 'Hide category' : 'Show category'}
              >
                {cat.visible ? '👁' : '🙈'}
              </button>

              {/* Delete (custom only) */}
              {cat.deletable && !readOnly && (
                <button
                  onClick={() => dispatch({ type: 'DELETE_CATEGORY', categoryId: cat.id })}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition text-lg"
                  title="Delete category"
                >×</button>
              )}
              {!cat.deletable && (
                <span className="text-gray-300 text-xs" title="Default category — cannot delete">🔒</span>
              )}
            </div>
          ))}
        </div>

        {/* Add new category */}
        {!readOnly && (
          <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 shrink-0">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Add Custom Category</p>
            <div className="flex items-center gap-2">
              <label className="cursor-pointer">
                <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} className="sr-only" />
                <div className="w-9 h-9 rounded-lg border-2 border-white shadow" style={{ background: newColor }} />
              </label>
              <input
                type="text"
                value={newIcon}
                onChange={e => setNewIcon(e.target.value)}
                placeholder="📌"
                className="w-12 text-center text-lg border border-gray-200 dark:border-gray-600 rounded-lg py-1 bg-white dark:bg-gray-800 dark:text-white outline-none"
                maxLength={2}
              />
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder="Category name..."
                className="flex-1 text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-400"
              />
              <button
                onClick={handleAdd}
                disabled={!newName.trim()}
                className="bg-[#1e3a5f] hover:bg-[#2a4d7a] disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
