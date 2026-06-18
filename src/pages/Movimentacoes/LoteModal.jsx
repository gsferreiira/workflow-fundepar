import { Plus, X, Loader2, Trash2, ScanLine } from "lucide-react"
import { Scanner } from "../../components/Scanner.jsx"
import { applyAssetMask } from "../../utils/format.js"
import { EQUIPMENT_STATUS_OPTIONS, ReceiverSelect } from "../Movimentacoes.shared.jsx"

export function LoteModal({
  equipment, rooms, profilesList, loteItems, setLoteItems, loteUid, setLoteUid,
  destId, setDestId, destName, setDestName,
  receivedBy, setReceivedBy, receivedByProfileId, setReceivedByProfileId,
  itemStatus, setItemStatus,
  comentario, setComentario, busy, onScan, onSubmit, onClose,
}) {
  const addItem = () => {
    const uid = loteUid + 1
    setLoteUid(uid)
    setLoteItems((prev) => [...prev, { uid, assetNumber: '', equipmentId: '', equipmentName: '', serialNumber: '' }])
  }

  const removeItem = (uid) => {
    setLoteItems((prev) => prev.filter((i) => i.uid !== uid))
  }

  const updateItem = (uid, field, value) => {
    setLoteItems((prev) => prev.map((i) => (i.uid === uid ? { ...i, [field]: value } : i)))
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 680 }}>
        <div className="modal-header">
          <div>
            <h3>Movimentação em Lote</h3>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {loteItems.length} item{loteItems.length !== 1 ? 's' : ''}
            </div>
          </div>
          <button className="modal-close" type="button" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label>Destino <span style={{ color: 'var(--danger-color)' }}>*</span></label>
            <select
              className="form-control"
              value={destId}
              onChange={(e) => {
                setDestId(e.target.value)
                setDestName(e.target.selectedOptions[0]?.textContent || '')
              }}
              required
            >
              <option value="">Selecione...</option>
              {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
            </select>
          </div>
          <div className="form-2col">
            <div className="form-group">
              <label>Recebedor</label>
              <ReceiverSelect
                profiles={profilesList}
                profileId={receivedByProfileId}
                text={receivedBy}
                onProfileChange={(id, name) => { setReceivedByProfileId(id); setReceivedBy(name) }}
                onTextChange={(t) => setReceivedBy(t)}
              />
            </div>
            <div className="form-group">
              <label>Status dos itens</label>
              <select className="form-control" value={itemStatus} onChange={(e) => setItemStatus(e.target.value)}>
                <option value="">Não alterar</option>
                {EQUIPMENT_STATUS_OPTIONS.map((status) => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Comentário</label>
            <textarea className="form-control" rows={2} value={comentario}
              onChange={(e) => setComentario(e.target.value)} placeholder="Opcional" />
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16, marginTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <strong style={{ fontSize: 13 }}>Patrimônios</strong>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn-primary" style={{ background: 'var(--warning-color)', padding: '5px 12px', fontSize: 12 }} onClick={onScan}>
                  <ScanLine size={13} /> Scanner
                </button>
                <button type="button" className="btn-primary" style={{ padding: '5px 12px', fontSize: 12 }} onClick={addItem}>
                  <Plus size={13} /> Adicionar
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto', paddingRight: 4 }}>
              {loteItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-secondary)', fontSize: 13 }}>
                  Use o botão "Adicionar" ou o scanner para incluir patrimônios.
                </div>
              ) : (
                loteItems.map((item) => (
                  <div key={item.uid} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <div style={{ flex: 2, minWidth: 0 }}>
                      <input type="text" className="form-control" value={item.assetNumber}
                        onChange={(e) => updateItem(item.uid, 'assetNumber', applyAssetMask(e.target.value))}
                        placeholder="Nº Patrimônio *" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <input type="text" className="form-control" value={item.serialNumber}
                        onChange={(e) => updateItem(item.uid, 'serialNumber', e.target.value)}
                        placeholder="Nº Série" />
                    </div>
                    <button type="button" onClick={() => removeItem(item.uid)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger-color)', padding: '8px 4px', flexShrink: 0 }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
            <button type="button" className="btn-primary" style={{ background: '#e2e8f0', color: '#475569' }} onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={busy || loteItems.length === 0}>
              {busy ? <Loader2 size={14} className="spin" /> : `Registrar ${loteItems.length} movimentaç${loteItems.length !== 1 ? 'ões' : 'ão'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
