import { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react'
import {
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Info,
  HelpCircle,
  X,
} from 'lucide-react'

const ToastContext = createContext(null)

export const useToast = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [confirmState, setConfirmState] = useState(null)
  // Counter por instância (em ref) em vez de variável module-level — evita
  // colisão de IDs entre múltiplos providers e em HMR.
  const uidRef = useRef(0)

  const showToast = useCallback((message, type = 'success') => {
    const id = ++uidRef.current
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3500)
  }, [])

  const confirm = useCallback((opts = {}) => {
    return new Promise((resolve) => {
      setConfirmState({ ...opts, resolve })
    })
  }, [])

  const finishConfirm = (result) => {
    if (confirmState?.resolve) confirmState.resolve(result)
    setConfirmState(null)
  }

  const iconFor = (type) => {
    if (type === 'success') return <CheckCircle size={18} />
    if (type === 'danger') return <AlertCircle size={18} />
    if (type === 'warning') return <AlertTriangle size={18} />
    return <Info size={18} />
  }

  return (
    <ToastContext.Provider value={{ showToast, confirm }}>
      {children}
      <div id="toast-container" className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {iconFor(t.type)} {t.message}
          </div>
        ))}
      </div>
      {confirmState && (
        <ConfirmModal state={confirmState} onFinish={finishConfirm} />
      )}
    </ToastContext.Provider>
  )
}

function ConfirmModal({ state, onFinish }) {
  const {
    title = 'Confirmar ação',
    message = 'Tem certeza?',
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    danger = false,
  } = state

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onFinish(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onFinish])

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onFinish(false)}>
      <div className="modal-content" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                background: danger ? 'rgba(239,68,68,.1)' : 'rgba(245,158,11,.1)',
                color: danger ? 'var(--danger-color)' : 'var(--warning-color)',
                padding: 10,
                borderRadius: 10,
                flexShrink: 0,
              }}
            >
              {danger ? <AlertTriangle size={20} /> : <HelpCircle size={20} />}
            </div>
            <h3 style={{ margin: 0 }}>{title}</h3>
          </div>
          <button className="modal-close" type="button" onClick={() => onFinish(false)}>
            <X size={16} />
          </button>
        </div>
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: 14,
            lineHeight: 1.5,
            margin: '8px 0 24px',
          }}
        >
          {message}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            type="button"
            className="btn-primary"
            onClick={() => onFinish(false)}
            style={{ background: '#e2e8f0', color: '#475569' }}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={danger ? 'btn-danger' : 'btn-primary'}
            onClick={() => onFinish(true)}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
