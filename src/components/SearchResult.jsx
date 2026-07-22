import Avatar from './Avatar'

export default function SearchResult({ user, onClick }) {
  return (
    <button
      id={`search-result-${user.username}`}
      onClick={() => onClick(user)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        padding: '11px 14px',
        background: 'transparent', textAlign: 'left', cursor: 'pointer',
        transition: 'background 100ms',
        minHeight: 56,
        WebkitTapHighlightColor: 'transparent',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--c-surface-hover)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      <Avatar name={user.name || user.username} url={user.avatar_url} size={38} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.name}
        </p>
        <p style={{ fontSize: 12, color: 'var(--c-text-tertiary)', margin: 0 }}>
          @{user.username}
        </p>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--c-text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18l6-6-6-6"/>
      </svg>
    </button>
  )
}
