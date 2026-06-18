import { useState } from "react"
import { X, Loader2, ScanLine } from "lucide-react"
import { supabase } from "../../lib/supabase.js"
import { useToast } from "../../contexts/ToastContext.jsx"
import { Scanner } from "../../components/Scanner.jsx"
import { applyAssetMask, formatAssetNumber, normalizeAssetNumber } from "../../utils/format.js"

export function AssetLookupModal({ onClose, onNew }) {
  const { showToast } = useToast()
  const [asset, setAsset] = useState('')
  const [busy, setBusy] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)

  const checkAsset = async (assetNumber) => {
    if (!assetNumber) {
      showToast('Informe o número de patrimônio.', 'warning')
      return
    }

    setBusy(true)
    const { data, error } = await supabase
      .from('equipment_locations')
      .select('asset_number')
      .eq('asset_number', assetNumber)
      .maybeSingle()
    setBusy(false)

    if (error) {
      showToast('Erro ao consultar patrimônio: ' + error.message, 'danger')
      return
    }
    if (data) {
      showToast(`PAT ${formatAssetNumber(assetNumber)} já possui registro.`, 'warning')
      onClose()
      return
    }
    onNew(assetNumber)
  }

  const submit = async (e) => {
    e.preventDefault()
    await checkAsset(normalizeAssetNumber(asset))
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <div>
            <h3>Registrar equipamento</h3>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
              Informe apenas o patrimônio para iniciar.
            </div>
          </div>
          <button className="modal-close" type="button" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="form-group">
            <label>Nº Patrimônio <span style={{ color: 'var(--danger-color)' }}>*</span></label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                className="form-control"
                value={asset}
                onChange={(e) => setAsset(applyAssetMask(e.target.value))}
                placeholder="000.000.000.000"
                autoFocus
                style={{ flex: 1 }}
              />
              <button type="button" className="btn-scanner" onClick={() => setScannerOpen(true)}>
                <ScanLine size={14} /> Scanner
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button type="button" className="btn-primary" style={{ background: '#e2e8f0', color: '#475569' }} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? <Loader2 size={14} className="spin" /> : 'Continuar'}
            </button>
          </div>
        </form>
      </div>
      <Scanner
        open={scannerOpen}
        mode="lote"
        onClose={() => setScannerOpen(false)}
        onLoteItem={(assetNumber) => {
          const normalized = normalizeAssetNumber(assetNumber)
          setScannerOpen(false)
          setAsset(applyAssetMask(normalized))
          checkAsset(normalized)
          return true
        }}
        onConcluirLote={() => setScannerOpen(false)}
      />
    </div>
  )
}
