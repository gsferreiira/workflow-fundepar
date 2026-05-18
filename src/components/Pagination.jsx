import { ChevronLeft, ChevronRight } from 'lucide-react'

export function Pagination({ page, total, pageSize, onPrev, onNext, compact = false }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (totalPages <= 1 && !compact) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  if (compact) {
    return (
      <div className="pagination-bar">
        <span className="pagination-info">
          Página {page} de {totalPages}
        </span>
        <button
          className="pagination-btn"
          disabled={page <= 1}
          onClick={onPrev}
          aria-label="Anterior"
        >
          <ChevronLeft size={14} />
        </button>
        <button
          className="pagination-btn"
          disabled={page >= totalPages}
          onClick={onNext}
          aria-label="Próxima"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="pagination fade-in">
      <span className="pagination-info">
        {from}–{to} de {total}
      </span>
      <div className="pagination-controls">
        <button className="pagination-btn" disabled={page <= 1} onClick={onPrev}>
          <ChevronLeft size={15} /> Anterior
        </button>
        <span className="pagination-pages">
          Página {page} de {totalPages}
        </span>
        <button className="pagination-btn" disabled={page >= totalPages} onClick={onNext}>
          Próxima <ChevronRight size={15} />
        </button>
      </div>
    </div>
  )
}
