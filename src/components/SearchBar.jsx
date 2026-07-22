export default function SearchBar({ value, onChange, onClear }) {
  return (
    <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--c-border)', flexShrink: 0 }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <svg
          style={{ position: 'absolute', left: 10, pointerEvents: 'none', flexShrink: 0 }}
          width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke="var(--c-text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          id="user-search"
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search people..."
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck="false"
          style={{
            width: '100%',
            padding: '9px 36px 9px 34px',
            /* 16px prevents iOS zoom */
            fontSize: 16,
            background: 'var(--c-bg)',
            border: '1.5px solid var(--c-border)',
            borderRadius: 99,
            color: 'var(--c-text)',
            transition: 'border-color 150ms, box-shadow 150ms',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = 'var(--c-accent)'
            e.target.style.boxShadow = '0 0 0 3px rgba(5,150,105,0.08)'
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'var(--c-border)'
            e.target.style.boxShadow = 'none'
          }}
        />
        {value && (
          <button
            onClick={onClear}
            aria-label="Clear search"
            style={{
              position: 'absolute', right: 10,
              width: 20, height: 20, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--c-text-tertiary)',
              color: 'var(--c-surface)',
              fontSize: 10, fontWeight: 700,
              lineHeight: 1, padding: 0,
              transition: 'background 120ms',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--c-text-secondary)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--c-text-tertiary)'}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
