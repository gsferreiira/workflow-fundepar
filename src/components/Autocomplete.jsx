import { useState, useRef, useEffect } from 'react'

/**
 * Autocomplete reutilizável.
 *
 * Props:
 *   items: [{ id, name }]
 *   value: id selecionado (string | '')
 *   label: nome exibido (controlado pelo pai, opcional)
 *   onChange: (id, name) => void
 *   placeholder, required, disabled
 */
export function Autocomplete({
  items = [],
  value = '',
  label = '',
  onChange,
  placeholder = '',
  required = false,
  disabled = false,
  emptyMessage = 'Nenhum resultado.',
  id,
}) {
  const [text, setText] = useState(label)
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)

  // Sincroniza com label externo quando mudar
  useEffect(() => {
    setText(label || '')
  }, [label])

  // Fecha ao clicar fora
  useEffect(() => {
    const onDocClick = (e) => {
      if (!wrapperRef.current) return
      if (!wrapperRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const q = text.toLowerCase().trim()
  const filtered = !q ? items : items.filter((it) => (it.name || '').toLowerCase().includes(q))

  const handleSelect = (item) => {
    setText(item.name || '')
    setOpen(false)
    onChange?.(item.id, item.name)
  }

  const handleInputChange = (e) => {
    const v = e.target.value
    setText(v)
    setOpen(true)
    // Se o usuário digitar algo que não bate com NENHUM item (case-insensitive
    // e tolerante a espaços extras), limpa o id. Antes a comparação era
    // case-sensitive, então "Sala 1" vs "sala 1" zerava a seleção indevidamente.
    const norm = v.trim().toLowerCase()
    if (!items.some((it) => (it.name || '').trim().toLowerCase() === norm)) {
      onChange?.('', v)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && filtered.length > 0) {
      e.preventDefault()
      handleSelect(filtered[0])
    }
  }

  return (
    <div className="autocomplete-wrapper" id={id} ref={wrapperRef}>
      <input
        type="hidden"
        value={value}
        readOnly
      />
      <input
        type="text"
        className="form-control"
        value={text}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={handleInputChange}
        onKeyDown={handleKey}
      />
      <div className={`autocomplete-list ${open ? 'open' : ''}`}>
        {filtered.length === 0 ? (
          <div className="autocomplete-empty">{emptyMessage}</div>
        ) : (
          filtered.map((it) => (
            <div
              key={it.id}
              className="autocomplete-item"
              data-label={it.name}
              onPointerDown={(e) => {
                e.preventDefault()
                handleSelect(it)
              }}
            >
              {it.name}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
