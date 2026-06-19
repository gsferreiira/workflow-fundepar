import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { supabase, createTempClient } from '../lib/supabase.js'
import { useToast } from './ToastContext.jsx'

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
  const [recoverySession, setRecoverySession] = useState(null)
  // true só depois que o perfil REAL (com role/coordinator_room corretos) carrega —
  // false enquanto `user` é o fallback otimista setado no SIGNED_IN. Hooks que
  // dependem da role (ex.: badge de notificações do coordenador) devem esperar
  // isto ficar true antes de calcular algo, senão calculam com a role errada
  // ('usuario') por uma fração de segundo e mostram um valor errado/instável.
  const [profileReady, setProfileReady] = useState(false)
  // ToastProvider é ancestral em App.jsx — pegamos showToast direto.
  // Antes existia um registerToast() que nunca era chamado, por isso os toasts
  // de "senha inválida" e demais erros de auth caíam silenciosamente no console.
  const { showToast } = useToast()
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const fallbackUser = useCallback((authUser) => ({
    ...authUser,
    full_name: authUser.user_metadata?.full_name || authUser.email,
    role: 'usuario',
  }), [])

  // Traduz as mensagens de erro mais comuns do Supabase Auth para pt-BR.
  const translateAuthError = (message = '') => {
    const m = String(message).toLowerCase()
    if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.'
    if (m.includes('email not confirmed')) return 'E-mail ainda não confirmado. Verifique sua caixa de entrada.'
    if (m.includes('user not found')) return 'Usuário não encontrado.'
    if (m.includes('email rate limit')) return 'Muitas tentativas. Tente novamente em alguns minutos.'
    if (m.includes('rate limit')) return 'Muitas requisições. Aguarde alguns instantes.'
    if (m.includes('password should be at least')) return 'A senha precisa ter no mínimo 6 caracteres.'
    if (m.includes('signups not allowed')) return 'Cadastros desabilitados. Contate um administrador.'
    if (m.includes('user already registered')) return 'Este e-mail já está cadastrado.'
    if (m.includes('network')) return 'Falha de conexão. Verifique sua internet.'
    return message
  }

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
      // Não regride usuário já autenticado para fallback em erros transientes
      if (mountedRef.current) {
        setUser((prev) => prev ?? fallback)
        setProfileReady(true)
      }
      return fallback
    }

    const merged = { ...authUser, ...profile }

    if (profile.role === 'coordenador') {
      const { data: roomList } = await supabase
        .from('rooms')
        .select('id, name, sigla')
        .eq('coordinator_id', profile.id)
        .is('deleted_at', null)
        .limit(1)
      const room = roomList?.[0] ?? null
      if (room) merged.coordinator_room = room
    }

    if (mountedRef.current) {
      setUser(merged)
      setProfileReady(true)
    }

    // Atualiza o último acesso (.then() é obrigatório — Supabase JS v2 é lazy)
    supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', authUser.id).then()

    // Sincroniza email no perfil
    if (!profile.email && mountedRef.current) {
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
    // Só aplica fallback se ainda não há usuário carregado (evita sobrescrever role real)
    setUser((prev) => prev ?? fallbackUser(authUser))
    setProfileReady(false)

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
          // Token de recuperação de senha: não loga — exibe tela de definição de senha
          const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
          if (hashParams.get('type') === 'recovery') {
            setRecoverySession(session)
          } else {
            await withTimeout(fetchProfile(session.user), 'A busca do perfil')
          }
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
        // Não loga ainda — guarda a sessão e exibe form de definição de senha no Login
        setRecoverySession(session)
        setUser(null)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfileReady(false)
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

  // Mantém last_seen_at atualizado enquanto o usuário está ativo
  useEffect(() => {
    if (!user?.id) return
    const ping = () => {
      if (document.visibilityState !== 'visible') return
      supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', user.id).then()
    }
    document.addEventListener('visibilitychange', ping)
    const timer = setInterval(ping, 5 * 60 * 1000)
    return () => {
      document.removeEventListener('visibilitychange', ping)
      clearInterval(timer)
    }
  }, [user?.id])

  const signIn = async (email, password) => {
    try {
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        'O login',
      )
      if (error) {
        showToast(translateAuthError(error.message), 'danger')
        return null
      }
      return data.user
    } catch (error) {
      showToast(translateAuthError(error.message), 'danger')
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
      showToast(translateAuthError(error.message), 'danger')
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

  const adminCreateUser = async (full_name, email, role = 'usuario', roomId = null) => {
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
      { id: data.user.id, full_name, email, role, room_id: roomId || null },
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

  const confirmFirstPassword = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) return error
    // USER_UPDATED dispara → fetchProfileInBackground → user setado → redirect normal
    setRecoverySession(null)
    return null
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
        profileReady,
        recoverySession,
        signIn,
        signUp,
        signOut,
        fetchProfile,
        confirmFirstPassword,
        adminCreateUser,
        adminResetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
