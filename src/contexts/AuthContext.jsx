import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase, createTempClient } from '../lib/supabase.js'

const AuthContext = createContext(null)
const AUTH_INIT_TIMEOUT_MS = 8000

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

  const fallbackUser = useCallback((authUser) => ({
    ...authUser,
    full_name: authUser.user_metadata?.full_name || authUser.email,
    role: 'usuario',
  }), [])

  const fetchProfile = useCallback(async (authUser) => {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .is('deleted_at', null)
      .single()

    if (error) {
      console.error('Erro ao buscar perfil:', error.message)
      const fallback = fallbackUser(authUser)
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
  }, [fallbackUser])

  const withTimeout = useCallback((promise, label) => {
    let timeoutId
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error(`${label} demorou mais que o esperado.`)),
        AUTH_INIT_TIMEOUT_MS,
      )
    })

    return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId))
  }, [])

  const fetchProfileInBackground = useCallback((authUser) => {
    setUser(fallbackUser(authUser))

    setTimeout(() => {
      withTimeout(fetchProfile(authUser), 'A busca do perfil').catch((error) => {
        console.error('Erro ao carregar perfil em segundo plano:', error.message)
      })
    }, 0)
  }, [fallbackUser, fetchProfile, withTimeout])

  useEffect(() => {
    let mounted = true
    const init = async () => {
      try {
        const {
          data: { session },
          error,
        } = await withTimeout(supabase.auth.getSession(), 'A verificacao da sessao')

        if (error) throw error
        if (session && mounted) {
          await withTimeout(fetchProfile(session.user), 'A busca do perfil')
        }
      } catch (error) {
        console.error('Erro ao inicializar autenticacao:', error.message)
        if (mounted) setUser(null)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    init()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        fetchProfileInBackground(session.user)
      } else if (event === 'PASSWORD_RECOVERY' && session) {
        fetchProfileInBackground(session.user)
        window.location.hash = '#/perfil'
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
      } else if (event === 'TOKEN_REFRESHED' && session) {
        // Mantém o estado coerente com token novo, sem refazer fetch desnecessário
      } else if (event === 'USER_UPDATED' && session) {
        fetchProfileInBackground(session.user)
      }
    })

    return () => {
      mounted = false
      subscription?.unsubscribe()
    }
  }, [fetchProfile, fetchProfileInBackground, withTimeout])

  const signIn = async (email, password) => {
    try {
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        'O login',
      )
      if (error) {
        showToast('Erro no login: ' + error.message, 'danger')
        return null
      }
      if (data.user) fetchProfileInBackground(data.user)
      return data.user
    } catch (error) {
      showToast('Erro no login: ' + error.message, 'danger')
      return null
    }
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
