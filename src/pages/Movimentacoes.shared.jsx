import { useState } from "react"

export const PAGE_SIZE = 25
export const EQUIPMENT_STATUS_OPTIONS = [
  { value: 'novo', label: 'Novo' },
  { value: 'bom', label: 'Bom' },
  { value: 'regular', label: 'Regular' },
  { value: 'inservível', label: 'Inservível' },
  { value: 'com defeito', label: 'Com Defeito' },
]

export function ReceiverSelect({ profiles, profileId, text, onProfileChange, onTextChange }) {
  const [showManual, setShowManual] = useState(!profileId && !!text)
  return (
    <>
      <select
        className="form-control"
        value={showManual ? '__manual__' : (profileId || '')}
        onChange={(e) => {
          const val = e.target.value
          if (val === '__manual__') {
            setShowManual(true)
            onProfileChange('', text)
          } else {
            setShowManual(false)
            const p = profiles.find((x) => x.id === val)
            onProfileChange(val, p?.full_name || '')
          }
        }}
      >
        <option value="">— Nenhum —</option>
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
        ))}
        <option value="__manual__">Outro (digitar nome)...</option>
      </select>
      {showManual && (
        <input
          type="text"
          className="form-control"
          style={{ marginTop: 6 }}
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="Nome de quem recebeu"
        />
      )}
    </>
  )
}
