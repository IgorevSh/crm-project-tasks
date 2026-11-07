import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types/database'

type AuthState = {
  session: Session | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

function toError(value: unknown): Error {
  if (value instanceof Error) return value
  if (value && typeof value === 'object' && 'message' in value) {
    const message = String((value as { message: unknown }).message)
    const code =
      'code' in value && (value as { code?: unknown }).code != null
        ? ` [${String((value as { code: unknown }).code)}]`
        : ''
    const details =
      'details' in value && (value as { details?: unknown }).details
        ? ` — ${String((value as { details: unknown }).details)}`
        : ''
    const hint =
      'hint' in value && (value as { hint?: unknown }).hint
        ? ` (${String((value as { hint: unknown }).hint)})`
        : ''
    return new Error(`${message}${code}${details}${hint}`)
  }
  return new Error(typeof value === 'string' ? value : 'Неизвестная ошибка')
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role_id, created_at, roles!role_id(code)')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw toError(error)
  if (!data) return null

  const roleRelation = data.roles as { code: string } | { code: string }[] | null
  const roleCode = Array.isArray(roleRelation)
    ? roleRelation[0]?.code
    : roleRelation?.code

  return {
    id: data.id,
    email: data.email,
    full_name: data.full_name,
    role_id: data.role_id,
    created_at: data.created_at,
    role: roleCode ?? '',
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null)
      return
    }
    const data = await fetchProfile(userId)
    setProfile(data)
  }, [])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      setSession(data.session)
      try {
        await loadProfile(data.session?.user.id)
      } catch (e) {
        console.error(e)
        if (mounted) setProfile(null)
      } finally {
        if (mounted) setLoading(false)
      }
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      void loadProfile(next?.user.id).catch((e) => {
        console.error(e)
        setProfile(null)
      })
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw toError(error)
    if (!data.user) throw new Error('Нет пользователя')

    setSession(data.session)

    try {
      const nextProfile = await fetchProfile(data.user.id)
      setProfile(nextProfile)
      if (!nextProfile) {
        throw new Error('Профиль не найден')
      }
      if (!nextProfile.role) {
        throw new Error('Роль не найдена')
      }
    } catch (e) {
      await supabase.auth.signOut()
      setSession(null)
      setProfile(null)
      throw toError(e)
    }
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setProfile(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    await loadProfile(session?.user.id)
  }, [loadProfile, session?.user.id])

  const value = useMemo(
    () => ({ session, profile, loading, signIn, signOut, refreshProfile }),
    [session, profile, loading, signIn, signOut, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth вне AuthProvider')
  return ctx
}
