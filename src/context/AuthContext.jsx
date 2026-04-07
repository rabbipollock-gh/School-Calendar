import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { slugify } from '../utils/schoolCode.js'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  // undefined = still checking; null = no session; object = active session
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [isNewUser, setIsNewUser] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null)
      if (session) loadProfile(session.user.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null)
      if (session) loadProfile(session.user.id)
      else setProfile(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (data) {
      setProfile(data)
      if (window.location.hash.slice(1) !== data.school_code) {
        window.location.hash = data.school_code
      }
    }
  }

  function completeOnboarding(userId) {
    setIsNewUser(false)
    localStorage.setItem('yayoe-onboarding-' + userId, 'done')
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
    window.location.hash = ''
    window.location.reload()
  }

  async function signUp(email, password, schoolName) {
    const schoolCode = slugify(schoolName)
    if (!schoolCode) throw new Error('Please enter a valid school name.')

    // Check if school code is already taken
    const { data: existing } = await supabase
      .from('profiles').select('id').eq('school_code', schoolCode).maybeSingle()
    if (existing) throw new Error(`"${schoolCode}" is already taken — try a different school name.`)

    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error

    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        school_name: schoolName.trim(),
        school_code: schoolCode,
      })
      if (profileError) throw profileError
      setIsNewUser(true)
    }

    // Returns true if email confirmation is needed
    return !data.session
  }

  const loading = session === undefined

  return (
    <AuthContext.Provider value={{ session, profile, loading, isNewUser, signIn, signOut, signUp, completeOnboarding }}>
      {children}
    </AuthContext.Provider>
  )
}
