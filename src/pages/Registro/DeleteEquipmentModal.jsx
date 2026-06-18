import { useState } from "react"
import { X, Loader2 } from "lucide-react"
import { supabase } from "../../lib/supabase.js"
import { useToast } from "../../contexts/ToastContext.jsx"
import { useAudit } from "../../hooks/useAudit.js"
import { formatAssetNumber } from "../../utils/format.js"

export function DeleteEquipmentModal({ item, onClose, onDeleted }) {
  const { showToast } = useToast()
  const audit = useAudit()
  const [busy, setBusy] = useState(false)
  const [typed, setTyped] = useState('')

  const equipName = item.equipment?.name || '—'
  const assetLabel = item.asset_number ? formatAssetNumber(item.asset_number) : null
  const canDelete = typed.trim().toUpperCase() === 'EXCLUIR'

  const handleDelete = async () => {
    if (!canDelete) return
    setBusy(true)

    let q = supabase.from('equipment_locations').delete()
    if (item.asset_number) {
      q = q.eq('asset_number', item.asset_number)
    } else {
      q = q.eq('equipment_id', item.equipment_id)
      if (item.serial_number) q = q.eq('serial_number', item.serial_number)
      else q = q.is('serial_number', null)
    }

    const { error } = await q
    setBusy(false)
    if (error) { showToast('Erro ao excluir: ' + error.message, 'danger'); return }

    audit.log('delete', 'equipment_locations', item.asset_number || item.equipment_id, {
      equipment_name: equipName,
      asset_number: item.asset_number || null,
      serial_number: item.serial_number || null,
      room: item.room?.name || null,
    })

    showToast(`${equipName} excluído do registro.`, 'success')
    onDeleted()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <div>
            <h3>Excluir equipamento</h3>
            <div style={{ fontSize: 13, color: '#dc2626', fontWeight: 600, marginTop: 2 }}>Ação irreversível</div>
          </div>
          <button className="modal-close" type="button" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ padding: '4px 0 16px' }}>
          <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.2)', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{equipName}</div>
            {assetLabel && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>PAT {assetLabel}</div>}
            {item.serial_number && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Série: {item.serial_number}</div>}
            {item.room && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>{item.room.name}</div>}
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.55 }}>
            O registro de localização deste patrimônio será removido permanentemente do sistema.
            O histórico de movimentações será mantido.
          </p>

          <div className="form-group">
            <label style={{ fontSize: 13 }}>Digite <strong>EXCLUIR</strong> para confirmar</label>
            <input
              type="text"
              className="form-control"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="EXCLUIR"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter' && canDelete) handleDelete() }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            type="button"
            className="btn-primary"
            style={{ background: '#e2e8f0', color: '#475569' }}
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary"
            style={{ background: '#dc2626', opacity: canDelete ? 1 : .5 }}
            onClick={handleDelete}
            disabled={busy || !canDelete}
          >
            {busy ? <Loader2 size={14} className="spin" /> : 'Excluir permanentemente'}
          </button>
        </div>
      </div>
    </div>
  )
}
