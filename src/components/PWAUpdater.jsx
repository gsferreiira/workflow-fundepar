// src/components/PWAUpdater.jsx
// Registra o service worker e mostra um toast quando há nova versão disponível,
// permitindo ao usuário recarregar sob demanda.
import { useEffect } from 'react'
import { useToast } from '../contexts/ToastContext.jsx'

export function PWAUpdater() {
  const { showToast } = useToast()

  useEffect(() => {
    // Importação dinâmica evita erro no dev (onde o SW não é registrado).
    let updateSW
    let cancelled = false
    let pendingReload = null

    import('virtual:pwa-register')
      .then(({ registerSW }) => {
        if (cancelled) return
        updateSW = registerSW({
          onNeedRefresh() {
            // Nova versão deployada. Avisa o usuário.
            showToast(
              'Nova versão disponível. Recarregue para atualizar.',
              'success',
            )
            // Recarrega automaticamente após 4s caso o usuário não interaja.
            pendingReload = setTimeout(() => {
              pendingReload = null
              if (typeof updateSW === 'function') updateSW(true)
            }, 4000)
          },
          onOfflineReady() {
            showToast('App pronto para uso offline.', 'success')
          },
        })
      })
      .catch(() => {
        // virtual:pwa-register não existe em dev — silencioso.
      })

    return () => {
      cancelled = true
      // Cancela o setTimeout pendente caso o componente seja desmontado
      // antes do reload automático disparar.
      if (pendingReload) {
        clearTimeout(pendingReload)
        pendingReload = null
      }
    }
  }, [showToast])

  return null
}
