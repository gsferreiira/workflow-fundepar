import { Fragment, useState } from 'react'
import { Lock, Save, Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useNavPermissions } from '../contexts/NavPermissionsContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { NAV_PAGES } from '../config/navPages.js'

const ROLES = [
  { key: 'admin',   label: 'Administrador' },
  { key: 'tecnico', label: 'Técnico' },
  { key: 'usuario', label: 'Usuário' },
]

// Páginas que entram na matrix (exclui separadores, perfil e a própria página de permissões)
const MATRIX_PAGES = NAV_PAGES.filter((p) => !p.separator && !p.alwaysVisible && !p.locked)

export function Permissoes() {
  const { user } = useAuth()
  const { permissions, save } = useNavPermissions()
  const { showToast } = useToast()
  const [local, setLocal] = useState(() => structuredClone(permissions))
  const [busy, setBusy] = useState(false)

  const toggle = (pageKey, roleKey) => {
    setLocal((prev) => {
      const current = prev[pageKey] ?? []
      const has = current.includes(roleKey)
      // Admin sempre tem acesso — não pode ser desmarcado
      if (roleKey === 'admin') return prev
      return {
        ...prev,
        [pageKey]: has ? current.filter((r) => r !== roleKey) : [...current, roleKey],
      }
    })
  }

  const handleSave = async () => {
    setBusy(true)
    const ok = await save(local, user.id)
    setBusy(false)
    if (ok) showToast('Permissões salvas com sucesso!', 'success')
    else showToast('Erro ao salvar permissões.', 'danger')
  }

  // Agrupa as páginas por seção para exibir separadores visuais na tabela
  const sections = []
  let currentSection = { label: null, pages: [] }
  NAV_PAGES.forEach((item) => {
    if (item.separator) {
      if (currentSection.pages.length > 0) sections.push(currentSection)
      currentSection = { label: item.separator, pages: [] }
    } else if (!item.alwaysVisible && !item.locked) {
      currentSection.pages.push(item)
    }
  })
  if (currentSection.pages.length > 0) sections.push(currentSection)

  return (
    <>
      <div className="view-header">
        <div>
          <h2>Permissões de Acesso</h2>
          <p>Defina quais telas cada tipo de usuário pode visualizar no menu.</p>
        </div>
        <button className="btn-primary" onClick={handleSave} disabled={busy}>
          {busy ? <Loader2 size={14} className="spin" /> : <><Save size={14} /> Salvar</>}
        </button>
      </div>

      <div className="table-card fade-in">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '45%' }}>Tela</th>
              {ROLES.map((r) => (
                <th key={r.key} style={{ textAlign: 'center' }}>
                  {r.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => (
              <Fragment key={section.label ?? section.pages[0]?.key}>
                {section.label && (
                  <tr key={`sep-${section.label}`}>
                    <td
                      colSpan={4}
                      style={{
                        background: 'var(--bg-main)',
                        color: 'var(--text-secondary)',
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '.5px',
                        padding: '10px 16px 6px',
                      }}
                    >
                      {section.label}
                    </td>
                  </tr>
                )}
                {section.pages.map((page) => (
                  <tr key={page.key}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <page.icon size={15} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                        <strong style={{ fontSize: 14 }}>{page.label}</strong>
                      </div>
                    </td>
                    {ROLES.map((r) => {
                      const checked = local[page.key]?.includes(r.key) ?? false
                      const isAdmin = r.key === 'admin'
                      return (
                        <td key={r.key} style={{ textAlign: 'center' }}>
                          {isAdmin ? (
                            <span title="Administradores sempre têm acesso">
                              <Lock
                                size={14}
                                style={{ color: 'var(--accent-color)', opacity: 0.6 }}
                              />
                            </span>
                          ) : (
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggle(page.key, r.key)}
                              style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--accent-color)' }}
                            />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}

            {/* Linha especial: Permissões (sempre admin, travada) */}
            <tr>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Lock size={15} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                  <strong style={{ fontSize: 14 }}>Permissões</strong>
                  <span
                    style={{
                      fontSize: 10,
                      background: 'rgba(99,102,241,.1)',
                      color: '#6366f1',
                      padding: '1px 6px',
                      borderRadius: 20,
                      fontWeight: 600,
                    }}
                  >
                    restrito
                  </span>
                </div>
              </td>
              {ROLES.map((r) => (
                <td key={r.key} style={{ textAlign: 'center' }}>
                  <span title="Esta página é sempre exclusiva para administradores">
                    <Lock
                      size={14}
                      style={{
                        color: r.key === 'admin' ? 'var(--accent-color)' : 'var(--border-color)',
                        opacity: r.key === 'admin' ? 0.6 : 1,
                      }}
                    />
                  </span>
                </td>
              ))}
            </tr>

            {/* Linha informativa: Meu Perfil (sempre visível) */}
            <tr>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Meu Perfil</span>
                  <span
                    style={{
                      fontSize: 10,
                      background: 'rgba(5,150,105,.1)',
                      color: '#059669',
                      padding: '1px 6px',
                      borderRadius: 20,
                      fontWeight: 600,
                    }}
                  >
                    sempre visível
                  </span>
                </div>
              </td>
              {ROLES.map((r) => (
                <td key={r.key} style={{ textAlign: 'center' }}>
                  <span
                    style={{ fontSize: 18, color: '#059669' }}
                    title="Meu Perfil é visível para todos os usuários"
                  >
                    ✓
                  </span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div
        style={{
          marginTop: 12,
          padding: '10px 16px',
          background: 'rgba(245,158,11,.08)',
          border: '1px solid rgba(245,158,11,.25)',
          borderRadius: 8,
          fontSize: 12,
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Lock size={13} style={{ color: '#d97706', flexShrink: 0 }} />
        Administradores sempre têm acesso a todas as telas. A página de Permissões é sempre exclusiva para administradores.
      </div>
    </>
  )
}
