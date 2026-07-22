/**
 * Chupa Logo — a modern chat bubble icon with three dots.
 * Gradient green background, white speech bubble cutout.
 */
export default function Logo({ size = 32 }) {
  const r = size * 0.25
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: r,
        background: 'linear-gradient(135deg, #059669, #10B981)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(5,150,105,0.3)',
        flexShrink: 0,
      }}
    >
      <svg
        width={size * 0.56}
        height={size * 0.56}
        viewBox="0 0 24 24"
        fill="none"
      >
        {/* Speech bubble */}
        <path
          d="M12 3C6.48 3 2 6.58 2 11c0 2.39 1.19 4.55 3.14 6.07L4 22l4.89-2.41A11.39 11.39 0 0012 20c5.52 0 10-3.58 10-8s-4.48-8-10-8z"
          fill="white"
        />
        {/* Three dots */}
        <circle cx="8.5" cy="11.5" r="1.3" fill="#059669" />
        <circle cx="12" cy="11.5" r="1.3" fill="#059669" />
        <circle cx="15.5" cy="11.5" r="1.3" fill="#059669" />
      </svg>
    </div>
  )
}
