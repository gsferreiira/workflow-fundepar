import { SearchX, PackageOpen, FolderOpen, Users, LayoutList } from 'lucide-react'

const PRESET_ICONS = {
  search: SearchX,
  package: PackageOpen,
  folder: FolderOpen,
  users: Users,
  list: LayoutList,
}

export function EmptyState({ icon, preset, title, description, action }) {
  const Icon = icon || (preset && PRESET_ICONS[preset]) || FolderOpen
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <Icon size={28} strokeWidth={1.5} />
      </div>
      <p className="empty-state-title">{title}</p>
      {description && <p className="empty-state-desc">{description}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  )
}
