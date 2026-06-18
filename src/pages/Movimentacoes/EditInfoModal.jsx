import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { supabase } from "../../lib/supabase.js"
import { useToast } from "../../contexts/ToastContext.jsx"
import { fmtDateTime } from "../../utils/format.js"

export function EditInfoModal({ movId, onClose }) {
  const { showToast } = useToast()
  const [logs, setLogs] = useState(null)

  useEffect(() => {
    const load = async () => {
      const [{ data: editLogs, error }, { data: profilesList }] = await Promise.all([
        supabase
          .from('movement_edits')
          .select('*')
          .eq('movement_id', movId)
          .order('edited_at', { ascending: false }),
        supabase.from('profiles').select('id, full_name'),
      ])
      if (error) {
        showToast('Erro ao carregar histórico.', 'danger')
        return
      }
      const profileMap = Object.fromEntries((profilesList || []).map((p) => [p.id, p]))
      setLogs(
        (editLogs || []).map((log) => ({
          ...log,
          editor_name: profileMap[log.edited_by]?.full_name || '—',
        })),
      )
    }
    load()
  }, [movId])

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <h3>Histórico de Edições</h3>
          <button className="modal-close" type="button" onClick={onClose}><X size={16} /></button>
        </div>
        {!logs ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>Carregando...</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhuma edição registrada.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {logs.map((log) => (
              <div key={log.id} style={{ background: 'var(--bg-main)', borderRadius: 8, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <strong style={{ fontSize: 13 }}>{log.editor_name}</strong>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {fmtDateTime(log.edited_at)}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                  {log.edit_reason}
                </p>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="btn-primary" style={{ background: '#e2e8f0', color: '#475569' }} onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  )
}
