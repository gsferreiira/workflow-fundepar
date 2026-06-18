import { normalizeText } from "../utils/format.js"

export const PAGE_SIZE = 25

export const STATUS_MAP = {
  novo: { bg: 'rgba(16,185,129,.12)', color: '#059669' },
  bom: { bg: 'rgba(59,130,246,.12)', color: '#2563eb' },
  regular: { bg: 'rgba(245,158,11,.12)', color: '#d97706' },
  inservível: { bg: 'rgba(239,68,68,.12)', color: '#dc2626' },
  'com defeito': { bg: 'rgba(168,85,247,.12)', color: '#7e22ce' },
}

export const STATUS_OPTIONS = [
  { value: 'novo', label: 'Novo' },
  { value: 'bom', label: 'Bom' },
  { value: 'regular', label: 'Regular' },
  { value: 'inservível', label: 'Inservível' },
  { value: 'com defeito', label: 'Com Defeito' },
]

export const isPrinterEquipment = (equipment) =>
  normalizeText(equipment?.categoria).includes('impressora')

export function StatusBadge({ status }) {
  const s = (status || '').toLowerCase()
  const c = STATUS_MAP[s] || { bg: 'rgba(0,0,0,.06)', color: 'var(--text-secondary)' }
  const label = STATUS_OPTIONS.find((option) => option.value === s)?.label
  return (
    <span
      style={{
        background: c.bg,
        color: c.color,
        padding: '2px 8px',
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {status ? label || status.charAt(0).toUpperCase() + status.slice(1) : '—'}
    </span>
  )
}
