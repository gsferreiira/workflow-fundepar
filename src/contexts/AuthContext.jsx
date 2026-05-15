import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase, createTempClient } from '../lib/supabase.js'

const AuthContext = createContext(null)

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toastFn, setToastFn] = useState(null)

  const showToast = (msg, type) => {
    if (toastFn) toastFn(msg, type)
    else console.log(`[toast:${type}]`, msg)
  }

  // Permite registrar a função de toast vinda do ToastProvider
  const registerToast = useCallback((fn) => {
    setToastFn(() => fn)
  }, [])

  const fetchProfile = useCallback(async (authUser) => {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .is('deleted_at', null)
      .single()

    if (error) {
      console.error('Erro ao buscar perfil:', error.message)
      const fallback = {
        ...authUser,
        full_name: authUser.email,
        role: 'usuario',
      }
      setUser(fallback)
      return fallback
    }

    const merged = { ...authUser, ...profile }
    setUser(merged)

    // Sincroniza email no perfil
    if (!profile.email) {
      const { error: syncError } = await supabase
        .from('profiles')
        .update({ email: authUser.email })
        .eq('id', authUser.id)
      if (syncError) console.warn('Falha ao sincronizar email do perfil:', syncError.message)
    }
    return merged
  }, [])

  useEffect(() => {
    let mounted = true
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session && mounted) {
        await fetchProfile(session.user)
      }
      if (mounted) setLoading(false)
    }
    init()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        await fetchProfile(session.user)
      } else if (event === 'PASSWORD_RECOVERY' && session) {
        await fetchProfile(session.user)
        window.location.hash = '#/perfil'
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
      } else if (event === 'TOKEN_REFRESHED' && session) {
        // Mantém o estado coerente com token novo, sem refazer fetch desnecessário
      } else if (event === 'USER_UPDATED' && session) {
        await fetchProfile(session.user)
      }
    })

    return () => {
      mounted = false
      subscription?.unsubscribe()
    }
  }, [fetchProfile])

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      showToast('Erro no login: ' + error.message, 'danger')
      return null
    }
    return data.user
  }

  const signUp = async (full_name, email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name } },
    })

    if (error) {
      showToast(error.message, 'danger')
      return null
    }

    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      showToast('Este e-mail já está cadastrado. Faça login ou recupere sua senha.', 'warning')
      return null
    }

    showToast(
      'Cadastro realizado! Se o e-mail for válido, confirme na sua caixa de entrada.',
      'success',
    )
    return data.user
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    showToast('Logout realizado com sucesso!', 'success')
  }

  const adminCreateUser = async (full_name, email, role = 'usuario') => {
    const randomPassword = (() => {
      const bytes = new Uint8Array(18)
      crypto.getRandomValues(bytes)
      return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('') + 'A!'
    })()

    const tempClient = createTempClient()
    const { data, error } = await tempClient.auth.signUp({
      email,
      password: randomPassword,
      options: { data: { full_name } },
    })
    if (error) {
      showToast('Erro ao criar usuário: ' + error.message, 'danger')
      return null
    }

    const { error: profileError } = await supabase.from('profiles').upsert(
      { id: data.user.id, full_name, email, role },
      { onConflict: 'id' },
    )
    if (profileError) {
      showToast('Usuário criado, mas erro no perfil: ' + profileError.message, 'warning')
    }

    const redirectTo = window.location.origin + window.location.pathname
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    if (resetError) console.warn('Falha ao enviar email de redefinição:', resetError.message)

    return data.user
  }

  const adminResetPassword = async (email) => {
    const redirectTo = window.location.origin + window.location.pathname
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    if (error) {
      showToast('Erro ao enviar email de redefinição: ' + error.message, 'danger')
      return false
    }
    return true
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signOut,
        fetchProfile,
        adminCreateUser,
        adminResetPassword,
        registerToast,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
