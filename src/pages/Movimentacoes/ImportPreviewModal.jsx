import { useState } from "react"
import { X, Loader2, AlertTriangle, CheckCircle2, AlertCircle } from "lucide-react"
import { formatAssetNumber } from "../../utils/format.js"

export function ImportPreviewModal({ rows, onClose, onConfirm }) {
  const [busy, setBusy] = useState(false)
  const validCount = rows.filter((r) => r.status !== 'error').length
  const errorCount = rows.filter((r) => r.status === 'error').length

  const handleConfirm = async () => {
    setBusy(true)
    await onConfirm()
    setBusy(false)
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 700 }}>
        <div className="modal-header">
          <div>
            <h3>Prévia da Importação</h3>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
              {validCount} válida{validCount !== 1 ? 's' : ''} · {errorCount} com erro
            </div>
          </div>
          <button className="modal-close" type="button" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
          <table className="data-table" style={{ minWidth: 0 }}>
            <thead>
              <tr>
                <th>Status</th>
                <th>Equipamento</th>
                <th>Origem</th>
                <th>Destino</th>
                <th>Nº Patrimônio</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td>
                    {row.status === 'ok' && <CheckCircle2 size={15} style={{ color: '#059669' }} />}
                    {row.status === 'warn' && (
                      <div title={row.warnings.join('; ')}>
                        <AlertTriangle size={15} style={{ color: '#d97706' }} />
                      </div>
                    )}
                    {row.status === 'error' && (
                      <div title={row.errors.join('; ')}>
                        <AlertCircle size={15} style={{ color: '#dc2626' }} />
                      </div>
                    )}
                  </td>
                  <td style={{ color: row.status === 'error' ? '#dc2626' : undefined }}>
                    {row.equipmentName || '—'}
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{row.originName || '—'}</td>
                  <td>{row.destName || '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {formatAssetNumber(row.assetNumber) || '—'}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {row.movedAtDisplay || '(agora)'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
          <button className="btn-primary" style={{ background: '#e2e8f0', color: '#475569' }} onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleConfirm} disabled={busy || validCount === 0}>
            {busy ? <Loader2 size={14} className="spin" /> : `Confirmar ${validCount} linha${validCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
