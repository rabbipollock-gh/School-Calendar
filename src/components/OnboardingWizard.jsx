import React, { useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useCalendar } from '../context/CalendarContext.jsx'
import { THEME_MAP } from '../utils/themeUtils.js'

const TOTAL_STEPS = 7
const SITE = 'calendar.yayoe.org'

const THEME_GROUPS = ['Classic', 'Bold', 'Modern', 'Warm', 'Dark']
const THEMES = Object.values(THEME_MAP).filter(t => t.id !== 'custom')

// preview=true → renders as a modal overlay; dispatch/completeOnboarding are NOT called
export default function OnboardingWizard({ preview = false, onClose }) {
  const { profile, session, completeOnboarding } = useAuth()
  const { state, dispatch } = useCalendar()

  const [step, setStep] = useState(1)
  const [previewToast, setPreviewToast] = useState(false)

  // Step 2 — Contact Info
  const [address, setAddress] = useState(preview ? state.schoolInfo?.address || '' : '')
  const [phone, setPhone] = useState(preview ? state.schoolInfo?.phone || '' : '')
  const [fax, setFax] = useState(preview ? state.schoolInfo?.fax || '' : '')
  const [email, setEmail] = useState(preview ? state.schoolInfo?.email || '' : '')
  const [website, setWebsite] = useState(preview ? state.schoolInfo?.website || '' : '')

  // Step 3 — Appearance
  const [theme, setTheme] = useState(state.settings?.theme || 'navy-gold')
  const [logo, setLogo] = useState(state.schoolInfo?.logo || null)
  const logoInputRef = useRef(null)

  // Steps 4–5 — Hours & Other Info
  const [hours, setHours] = useState(preview ? state.schoolInfo?.hours || '' : '')
  const [otherInfo, setOtherInfo] = useState(preview ? state.schoolInfo?.otherInfo || '' : '')

  // Step 6 — Academic Year
  const [academicYear, setAcademicYear] = useState(state.settings?.academicYear || '2026-2027')
  const [hebrewYear, setHebrewYear] = useState(state.settings?.hebrewYear || '5787')

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setLogo(ev.target.result)
    reader.readAsDataURL(file)
  }

  function saveData() {
    dispatch({
      type: 'UPDATE_SCHOOL_INFO',
      info: {
        name: profile?.school_name || state.schoolInfo?.name || '',
        address, phone, fax, email, website, hours, otherInfo, logo,
      },
    })
    dispatch({ type: 'UPDATE_SETTINGS', settings: { academicYear, hebrewYear, theme } })
  }

  function saveAndFinish() {
    if (preview) {
      setPreviewToast(true)
      setTimeout(() => setPreviewToast(false), 3000)
      return
    }
    saveData()
    completeOnboarding(session.user.id)
  }

  function skip() {
    if (preview) {
      onClose?.()
      return
    }
    saveData()
    completeOnboarding(session.user.id)
  }

  const displayName = preview
    ? (state.schoolInfo?.name || 'Your School')
    : (profile?.school_name || '—')

  const displayCode = preview
    ? window.location.hash.slice(1) || 'your-school'
    : (profile?.school_code || '...')

  const content = (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden relative">
      {/* Progress bar */}
      <div className="h-1 bg-gray-100">
        <div
          className="h-1 bg-[#2E86AB] transition-all duration-300"
          style={{ width: `${((step - 1) / (TOTAL_STEPS - 1)) * 100}%` }}
        />
      </div>

      {/* Header */}
      <div className="bg-[#1e3a5f] px-6 py-4 flex items-center justify-between">
        <div>
          {preview && <span className="text-amber-300 text-xs font-medium block">Preview Mode</span>}
          <p className="text-white/50 text-xs">Step {step} of {TOTAL_STEPS}</p>
          <h2 className="text-white font-bold text-base">{STEP_TITLES[step]}</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-lg">
            {STEP_ICONS[step]}
          </div>
          {preview && (
            <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white text-sm transition">×</button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-6 py-6 min-h-[260px] flex flex-col gap-4">

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Here's your account summary. Save this somewhere safe.</p>
            <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-sm">
              <Row label="School" value={displayName} />
              <Row label="Login email" value={session?.user?.email || '(preview)'} />
              <Row label="Calendar URL" value={`${SITE}/#${displayCode}`} mono />
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Bookmark <span className="font-mono text-[#1e3a5f]">{SITE}/#{displayCode}</span> — that's your calendar's permanent address on any device.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-xs text-gray-400">This info appears on your printed calendars.</p>
            <Field label="Address">
              <input value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main St, City, State ZIP" className={cls} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Phone">
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 000-0000" className={cls} />
              </Field>
              <Field label="Fax">
                <input value={fax} onChange={e => setFax(e.target.value)} placeholder="(555) 000-0001" className={cls} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Email">
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="office@school.org" className={cls} />
              </Field>
              <Field label="Website">
                <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="www.school.org" className={cls} />
              </Field>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 max-h-[340px] overflow-y-auto pr-1">
            <p className="text-xs text-gray-400">Choose a color theme and optionally upload your school logo.</p>

            {/* Theme picker */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">Color Theme</p>
              {THEME_GROUPS.map(group => {
                const groupThemes = THEMES.filter(t => t.group === group)
                if (!groupThemes.length) return null
                return (
                  <div key={group} className="mb-3">
                    <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">{group}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {groupThemes.map(t => (
                        <button
                          key={t.id}
                          onClick={() => setTheme(t.id)}
                          title={t.name}
                          className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border-2 text-xs font-medium transition ${
                            theme === t.id
                              ? 'border-[#1e3a5f] bg-blue-50 text-[#1e3a5f]'
                              : 'border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          <span className="flex gap-0.5">
                            <span className="w-3 h-3 rounded-full inline-block" style={{ background: t.primary }} />
                            <span className="w-3 h-3 rounded-full inline-block" style={{ background: t.accent }} />
                          </span>
                          {t.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Logo upload */}
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 mb-2">School Logo <span className="font-normal text-gray-400">(optional)</span></p>
              <div className="flex items-center gap-3">
                {logo ? (
                  <img src={logo} alt="Logo" className="h-14 w-14 object-cover rounded-full border-2 border-gray-200 shadow-sm" />
                ) : (
                  <div className="h-14 w-14 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-xl">✡</div>
                )}
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition"
                  >
                    {logo ? 'Change Logo' : 'Upload Logo'}
                  </button>
                  {logo && (
                    <button onClick={() => setLogo(null)} className="text-xs text-red-500 hover:text-red-700 transition">Remove</button>
                  )}
                </div>
                <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="sr-only" />
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <p className="text-xs text-gray-400">School hours printed on the calendar sidebar.</p>
            <textarea
              value={hours}
              onChange={e => setHours(e.target.value)}
              placeholder={"Boys: 8:30 AM – 4:00 PM\nGirls: 8:30 AM – 3:30 PM\nFriday: 8:30 AM – 1:30 PM"}
              rows={5}
              className={cls + ' resize-none'}
            />
          </div>
        )}

        {step === 5 && (
          <div className="space-y-3">
            <p className="text-xs text-gray-400">Any additional information to include on your calendar — early dismissal schedule, after-school programs, notes for parents, etc.</p>
            <textarea
              value={otherInfo}
              onChange={e => setOtherInfo(e.target.value)}
              placeholder="e.g. Early dismissal every Friday at 1:30 PM. After-school program runs Mon–Thu until 5:30 PM."
              rows={6}
              className={cls + ' resize-none'}
            />
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4">
            <p className="text-xs text-gray-400">Which academic year are you building this calendar for?</p>
            <Field label="Academic Year">
              <select value={academicYear} onChange={e => setAcademicYear(e.target.value)} className={cls}>
                {[2025,2026,2027,2028,2029,2030].map(y => (
                  <option key={y} value={`${y}-${y+1}`}>{y}–{y+1}</option>
                ))}
              </select>
            </Field>
            <Field label="Hebrew Year">
              <input value={hebrewYear} onChange={e => setHebrewYear(e.target.value)} placeholder="5787" className={cls} />
            </Field>
          </div>
        )}

        {step === 7 && (
          <div className="flex flex-col items-center justify-center flex-1 text-center gap-3 py-4">
            <div className="text-5xl">✅</div>
            <h3 className="text-lg font-bold text-gray-800">You're all set!</h3>
            <p className="text-sm text-gray-500">Your calendar is ready. You can update any of this info later in Settings.</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 pb-6 flex items-center gap-3">
        {step > 1 && step < TOTAL_STEPS && (
          <button onClick={() => setStep(s => s - 1)} className="text-sm text-gray-400 hover:text-gray-600 transition px-2">
            ← Back
          </button>
        )}

        <div className="flex-1" />

        {step < TOTAL_STEPS && step > 1 && (
          <button onClick={skip} className="text-sm text-gray-400 hover:text-gray-600 transition">
            Skip for now →
          </button>
        )}

        {step < TOTAL_STEPS ? (
          <button
            onClick={() => setStep(s => s + 1)}
            className="bg-[#1e3a5f] hover:bg-[#2a4d7a] text-white px-5 py-2 rounded-xl font-semibold text-sm transition"
          >
            {step === 1 ? 'Start Setup →' : 'Next →'}
          </button>
        ) : (
          <button
            onClick={saveAndFinish}
            className="bg-[#2E86AB] hover:bg-[#267a9c] text-white px-6 py-2 rounded-xl font-semibold text-sm transition"
          >
            {preview ? 'Finish (Preview Only)' : 'Launch My Calendar →'}
          </button>
        )}
      </div>

      {/* Preview toast */}
      {previewToast && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-amber-600 text-white text-sm px-4 py-2 rounded-full shadow-lg pointer-events-none">
          Preview only — no changes saved
        </div>
      )}
    </div>
  )

  if (preview) {
    return (
      <div
        className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4"
        onClick={e => { if (e.target === e.currentTarget) onClose?.() }}
      >
        {content}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1e3a5f] flex items-center justify-center p-6">
      {content}
    </div>
  )
}

const STEP_TITLES = {
  1: 'Welcome!',
  2: 'School Contact Info',
  3: 'Appearance',
  4: 'School Hours',
  5: 'Other Information',
  6: 'Academic Year',
  7: "You're All Set!",
}
const STEP_ICONS = { 1: '🎉', 2: '📍', 3: '🎨', 4: '🕐', 5: '📝', 6: '📅', 7: '✅' }

function Row({ label, value, mono }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className={`text-gray-800 text-right break-all ${mono ? 'font-mono text-xs text-[#1e3a5f]' : 'font-medium'}`}>{value}</span>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

const cls = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#1e3a5f] bg-white'
