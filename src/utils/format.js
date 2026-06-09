// Normaliza número de patrimônio para o formato 000.000.000.000
export const normalizeAssetNumber = (value) => {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length === 12) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}.${digits.slice(9, 12)}`
  }
  return String(value || '').trim()
}

// Remove acentos e converte para minúsculas (busca normalizada)
export const normalizeText = (value) =>
  String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Formata número de patrimônio como 000.000.000.000
export const formatAssetNumber = (raw) => {
  if (!raw) return ''
  const digits = String(raw).replace(/\D/g, '')
  if (digits.length === 12) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}.${digits.slice(9, 12)}`
  }
  return String(raw)
}

// Máscara progressiva para campos de patrimônio
export const maskAssetNumber = (e) => {
  const input = e.target || e
  const digits = input.value.replace(/\D/g, '').slice(0, 12)
  if (digits.length <= 3) input.value = digits
  else if (digits.length <= 6) input.value = `${digits.slice(0, 3)}.${digits.slice(3)}`
  else if (digits.length <= 9)
    input.value = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  else
    input.value = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}.${digits.slice(9)}`
}

// Versão para handlers React controlados — retorna string ao invés de mutar
export const applyAssetMask = (value) => {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 12)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9)
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}.${digits.slice(9)}`
}

// Debounce simples
export const debounce = (fn, delay = 200) => {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('pt-BR') : '')
export const fmtTime = (d) =>
  d
    ? new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : ''
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('pt-BR') : '')

const pad2 = (value) => String(value).padStart(2, '0')

export const toDateTimeLocalValue = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return [
    date.getFullYear(),
    pad2(date.getMonth() + 1),
    pad2(date.getDate()),
  ].join('-') + `T${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

export const dateTimeLocalValueToIso = (value) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
