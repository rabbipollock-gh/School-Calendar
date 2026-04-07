import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'
import { slugify } from '../utils/schoolCode.js'

const SITE = 'calendar.yayoe.org'

export default function AuthGate() {
  const { signIn, signUp, completeOnboarding, session } = useAuth()
  const [tab, setTab] = useState('login') // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [awaitingEmail, setAwaitingEmail] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [registeredCode, setRegisteredCode] = useState('')
  const [forgotMode, setForgotMode] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)

  const reset = () => { setError(''); setLoading(false) }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await signIn(email, password)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const needsConfirmation = await signUp(email, password, schoolName)
      if (needsConfirmation) {
        setAwaitingEmail(true)
      } else {
        setRegisteredCode(slugify(schoolName))
        setRegistered(true)
      }
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname,
      })
      if (error) throw error
      setForgotSent(true)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  if (forgotSent) {
    return (
      <Screen>
        <div className="px-6 py-8 text-center space-y-4">
          <div className="text-5xl">📧</div>
          <h2 className="text-lg font-bold text-gray-800">Check your email</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            We sent a password reset link to <strong>{email}</strong>.
          </p>
          <button
            onClick={() => { setForgotMode(false); setForgotSent(false); reset() }}
            className="text-sm text-[#1e3a5f] font-semibold underline underline-offset-2"
          >
            Back to login
          </button>
        </div>
      </Screen>
    )
  }

  if (forgotMode) {
    return (
      <Screen>
        <form onSubmit={handleForgotPassword} className="px-6 py-6 space-y-4">
          <div>
            <h2 className="text-base font-bold text-gray-800 mb-1">Reset your password</h2>
            <p className="text-xs text-gray-400">Enter your email and we'll send a reset link.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@school.org"
              required
              className={inputCls}
              autoFocus
            />
          </div>
          {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1e3a5f] hover:bg-[#2a4d7a] disabled:opacity-50 text-white py-2.5 rounded-xl font-semibold text-sm transition"
          >
            {loading ? '...' : 'Send Reset Link'}
          </button>
          <button
            type="button"
            onClick={() => { setForgotMode(false); reset() }}
            className="w-full text-sm text-gray-400 hover:text-gray-600 transition"
          >
            ← Back to login
          </button>
        </form>
      </Screen>
    )
  }

  if (registered) {
    return (
      <Screen>
        <div className="px-6 py-7 space-y-5">
          <div className="text-center">
            <div className="text-4xl mb-2">🎉</div>
            <h2 className="text-lg font-bold text-gray-800">Your account is ready!</h2>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Login email</span>
              <span className="font-medium text-gray-800 truncate ml-2">{email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 shrink-0">Calendar URL</span>
              <span className="font-mono text-[#1e3a5f] text-xs ml-2 break-all text-right">{SITE}/#{registeredCode}</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 text-center">Save this URL — it's how you'll access your calendar from any device.</p>
          <div className="space-y-2">
            <button
              onClick={() => { /* OnboardingWizard takes over via isNewUser in App.jsx */ }}
              className="w-full bg-[#1e3a5f] hover:bg-[#2a4d7a] text-white py-2.5 rounded-xl font-semibold text-sm transition"
            >
              Set Up My School →
            </button>
            <button
              onClick={() => session && completeOnboarding(session.user.id)}
              className="w-full text-sm text-gray-400 hover:text-gray-600 py-1.5 transition"
            >
              Skip — go straight to my calendar
            </button>
          </div>
        </div>
      </Screen>
    )
  }

  if (awaitingEmail) {
    return (
      <Screen>
        <div className="px-6 py-8 text-center space-y-4">
          <div className="text-5xl">📬</div>
          <h2 className="text-lg font-bold text-gray-800">Check your email</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            We sent a confirmation link to <strong>{email}</strong>.<br />
            Click it to activate your account, then come back and log in.
          </p>
          <button
            onClick={() => { setAwaitingEmail(false); setTab('login'); reset() }}
            className="text-sm text-[#1e3a5f] font-semibold underline underline-offset-2"
          >
            Back to login
          </button>
        </div>
      </Screen>
    )
  }

  return (
    <Screen>
      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        {[['login', 'Log In'], ['register', 'Register']].map(([id, label]) => (
          <button
            key={id}
            onClick={() => { setTab(id); reset() }}
            className={`flex-1 py-3 text-sm font-semibold transition ${
              tab === id
                ? 'text-[#1e3a5f] border-b-2 border-[#1e3a5f]'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <form
        onSubmit={tab === 'login' ? handleLogin : handleRegister}
        className="px-6 py-6 space-y-4"
      >
        {tab === 'register' && (
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">School Name</label>
            <input
              type="text"
              value={schoolName}
              onChange={e => setSchoolName(e.target.value)}
              placeholder="e.g. Hillel Academy"
              required
              className={inputCls}
              autoFocus
            />
            {schoolName && (
              <p className="text-[11px] text-gray-400 mt-1">
                Your calendar URL: <span className="font-mono text-[#1e3a5f]">#{slugify(schoolName)}</span>
              </p>
            )}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="admin@school.org"
            required
            className={inputCls}
            autoFocus={tab === 'login'}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={tab === 'register' ? 'At least 6 characters' : ''}
            minLength={6}
            required
            className={inputCls}
          />
        </div>

        {error && (
          <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#1e3a5f] hover:bg-[#2a4d7a] disabled:opacity-50 text-white py-2.5 rounded-xl font-semibold text-sm transition"
        >
          {loading ? '...' : tab === 'login' ? 'Log In' : 'Create Account'}
        </button>

        {tab === 'login' && (
          <div className="space-y-2 text-center">
            <p className="text-xs text-gray-400">
              No account?{' '}
              <button type="button" onClick={() => { setTab('register'); reset() }} className="text-[#1e3a5f] font-semibold">
                Register your school
              </button>
            </p>
            <p className="text-xs text-gray-400">
              <button type="button" onClick={() => { setForgotMode(true); reset() }} className="text-gray-400 hover:text-[#1e3a5f] underline underline-offset-2">
                Forgot password?
              </button>
            </p>
          </div>
        )}
      </form>
    </Screen>
  )
}

function Screen({ children }) {
  return (
    <div className="min-h-screen bg-[#1e3a5f] flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#1e3a5f] px-6 py-5 text-center">
          <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-3">
            <span className="text-3xl">✡</span>
          </div>
          <h1 className="text-white font-bold text-xl">YAYOE Calendar Builder</h1>
          <p className="text-white/60 text-sm mt-1">Academic Calendar for Jewish Schools</p>
        </div>
        {children}
      </div>
    </div>
  )
}

const inputCls = 'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#1e3a5f] bg-white'
