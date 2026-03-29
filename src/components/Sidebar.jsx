import React, { useState } from 'react'
import { useCalendar } from '../context/CalendarContext.jsx'

export default function Sidebar({ isOpen, onOpenCategories }) {
  const { state } = useCalendar()
  const { categories, schoolInfo, settings } = state

  return (
    <aside
      id="app-sidebar"
      className={`
        hidden lg:flex flex-col w-56 shrink-0 bg-white dark:bg-gray-800
        border-l border-gray-100 dark:border-gray-700 overflow-y-auto
      `}
    >
      {/* School Info */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-700">
        {schoolInfo.logo && (
          <img src={schoolInfo.logo} alt="Logo" className="h-14 w-14 object-cover rounded-full border-2 border-gray-200 shadow-sm mx-auto mb-2 block" />
        )}
        <h2 className="font-bold text-[#1e3a5f] dark:text-blue-300 text-sm leading-snug">{schoolInfo.name}</h2>
        {schoolInfo.address && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{schoolInfo.address}</p>}
        {schoolInfo.phone && <p className="text-xs text-gray-500 dark:text-gray-400">📞 {schoolInfo.phone}</p>}
        {schoolInfo.fax && <p className="text-xs text-gray-500 dark:text-gray-400">📠 {schoolInfo.fax}</p>}
      </div>

      {/* School Hours */}
      {schoolInfo.hours && (
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">School Hours</h3>
          <pre className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">{schoolInfo.hours}</pre>
        </div>
      )}

      {/* Category Legend */}
      <div className="p-4 flex-1">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Legend</h3>
          <button onClick={onOpenCategories} className="text-[10px] text-blue-500 hover:text-blue-700 transition">Edit</button>
        </div>
        <div className="space-y-1.5">
          {categories.filter(c => c.visible).map(cat => (
            <div key={cat.id} className="flex items-center gap-2">
              <div className="w-4 h-4 rounded shrink-0" style={{ background: cat.color }} />
              <span className="text-xs text-gray-700 dark:text-gray-300 leading-snug">{cat.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Academic Year */}
      <div className="px-4 pb-4 text-center">
        <p className="text-[10px] text-gray-400 dark:text-gray-500">Academic Year {settings.academicYear}</p>
        <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-0.5">5787 • YAYOE</p>
      </div>
    </aside>
  )
}
