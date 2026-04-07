import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useCalendar } from '../context/CalendarContext.jsx'

const TOTAL_STEPS = 6
const SITE = 'calendar.yayoe.org'

export default function OnboardingWizard() {
  const { profile, session, completeOnboarding } = useAuth()
  const { dispatch } = useCalendar()

  const [step, setStep] = useState(1)
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [fax, setFax] = useState('')
  const [website, setWebsite] = useState('')
  const [hours, setHours] = useState('')
  const [otherInfo, setOtherInfo] = useState('')
  const [academicYear, setAcademicYear] = useState('2026-2027')
  const [hebrewYear, setHebrewYear] = useState('5787')

  function saveAndFinish() {
    dispatch({
      type: 'UPDATE_SCHOOL_INFO',
      info: { name: profile?.school_name || '', address, phone, fax, website, hours, otherInfo },
    })
    dispatch({ type: 'UPDATE_SETTINGS', settings: { academicYear, hebrewYear } })
    completeOnboarding(session.user.id)
  }

  function skip() {
    dispatch({
      type: 'UPDATE_SCHOOL_INFO',
      info: { name: profile?.school_name || '', address, phone, fax, website, hours, otherInfo },
    })
    dispatch({ type: 'UPDATE_SETTINGS', settings: { academicYear, hebrewYear } })
    completeOnboarding(session.user.id)
  }

  return (
    <div className="min-h-screen bg-[#1e3a5f] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
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
            <p className="text-white/50 text-xs">Step {step} of {TOTAL_STEPS}</p>
            <h2 className="text-white font-bold text-base">{STEP_TITLES[step]}</h2>
          </div>
          <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-lg">
            {STEP_ICONS[step]}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-6 min-h-[260px] flex flex-col gap-4">

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Here's your account summary. Save this somewhere safe.</p>
              <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-sm">
                <Row label="School" value={profile?.school_name || '—'} />
                <Row label="Login email" value={session?.user?.email || '—'} />
                <Row label="Calendar URL" value={`${SITE}/#${profile?.school_code || '...'}`} mono />
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Bookmark <span className="font-mono text-[#1e3a5f]">{SITE}/#{profile?.school_code}</span> — that's your calendar's permanent address on any device.
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
              <Field label="Website">
                <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="www.yourschool.org" className={cls} />
              </Field>
            </div>
          )}

          {step === 3 && (
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

          {step === 4 && (
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

          {step === 5 && (
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

          {step === 6 && (
            <div className="flex flex-col items-center justify-center flex-1 text-center gap-3 py-4">
              <div className="text-5xl">✅</div>
              <h3 className="text-lg font-bold text-gray-800">You're all set!</h3>
              <p className="text-sm text-gray-500">Your calendar is ready. You can update any of this info later in Settings.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex items-center gap-3">
          {step > 1 && step < 6 && (
            <button onClick={() => setStep(s => s - 1)} className="text-sm text-gray-400 hover:text-gray-600 transition px-2">
              ← Back
            </button>
          )}

          <div className="flex-1" />

          {step < 6 && step > 1 && (
            <button onClick={skip} className="text-sm text-gray-400 hover:text-gray-600 transition">
              Skip for now →
            </button>
          )}

          {step < 6 ? (
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
              Launch My Calendar →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const STEP_TITLES = {
  1: 'Welcome!',
  2: 'School Contact Info',
  3: 'School Hours',
  4: 'Other Information',
  5: 'Academic Year',
  6: "You're All Set!",
}
const STEP_ICONS = { 1: '🎉', 2: '📍', 3: '🕐', 4: '📝', 5: '📅', 6: '✅' }

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
