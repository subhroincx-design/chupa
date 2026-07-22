import { getAvatarGradient, getInitials } from '../utils/avatar'

/**
 * Reusable avatar component.
 * Shows uploaded image if url is provided, otherwise renders
 * a beautiful gradient circle with the user's initials.
 *
 * @param {string} name - User's display name
 * @param {string} url  - Avatar image URL (optional)
 * @param {number} size - Width/height in px (default 40)
 * @param {boolean} circle - Use 50% border-radius (default true)
 */
export default function Avatar({ name, url, size = 40, circle = true }) {
  const radius = circle ? '50%' : `${Math.max(size * 0.22, 6)}px`
  const fontSize = Math.max(size * 0.36, 11)

  if (url) {
    return (
      <img
        src={url}
        alt=""
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          objectFit: 'cover',
          flexShrink: 0,
          display: 'block',
        }}
      />
    )
  }

  const initials = getInitials(name)
  const gradient = getAvatarGradient(name)

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: gradient,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#FFFFFF',
        fontSize,
        fontWeight: 700,
        letterSpacing: '-0.02em',
        flexShrink: 0,
        userSelect: 'none',
        textShadow: '0 1px 2px rgba(0,0,0,0.15)',
      }}
    >
      {initials}
    </div>
  )
}
