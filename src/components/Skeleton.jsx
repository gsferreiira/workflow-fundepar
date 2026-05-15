export function SkeletonTable({ rows = 6 }) {
  return (
    <div className="fade-in" style={{ padding: '4px 0' }}>
      <div className="skel skel-title"></div>
      <div className="skel-card" style={{ padding: 0 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div className="skel-row" key={i}>
            <div className="skel skel-text" style={{ flex: 2 }}></div>
            <div className="skel skel-text" style={{ flex: 1 }}></div>
            <div className="skel skel-text" style={{ flex: 1 }}></div>
            <div className="skel skel-text" style={{ flex: 1 }}></div>
            <div className="skel skel-text" style={{ width: 80 }}></div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkeletonDashboard() {
  return (
    <div className="fade-in" style={{ padding: '4px 0' }}>
      <div className="skel skel-title" style={{ width: '30%' }}></div>
      <div className="skel-stat-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="skel-card" key={i}>
            <div className="skel skel-text" style={{ width: '60%', height: 36 }}></div>
            <div className="skel skel-text" style={{ width: '80%', marginTop: 8 }}></div>
          </div>
        ))}
      </div>
      <div className="skel-card" style={{ height: 200 }}></div>
    </div>
  )
}

export function SkeletonKanban() {
  return (
    <div className="fade-in" style={{ padding: '4px 0' }}>
      <div className="skel skel-title" style={{ width: '35%' }}></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div className="skel-card" style={{ minHeight: 300 }} key={i}>
            <div className="skel skel-text" style={{ width: '60%', height: 16 }}></div>
            {Array.from({ length: 3 }).map((_, j) => (
              <div
                className="skel skel-card"
                style={{ marginTop: 12, height: 70, border: 'none' }}
                key={j}
              ></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkeletonCards() {
  return (
    <div className="fade-in" style={{ padding: '4px 0' }}>
      <div className="skel skel-title" style={{ width: '25%' }}></div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))',
          gap: 16,
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div className="skel-card" style={{ height: 160 }} key={i}></div>
        ))}
      </div>
    </div>
  )
}

export function SkeletonProfile() {
  return (
    <div className="fade-in" style={{ padding: '4px 0' }}>
      <div className="skel skel-title" style={{ width: '20%' }}></div>
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>
        <div className="skel-card" style={{ height: 240 }}></div>
        <div className="skel-card" style={{ height: 240 }}></div>
      </div>
    </div>
  )
}

export function Skeleton({ variant = 'table' }) {
  if (variant === 'dashboard') return <SkeletonDashboard />
  if (variant === 'kanban') return <SkeletonKanban />
  if (variant === 'cards') return <SkeletonCards />
  if (variant === 'profile') return <SkeletonProfile />
  return <SkeletonTable />
}
