/**
 * Deterministic gradient avatars based on user's name.
 * Each name gets a unique, vibrant gradient pair.
 */

const GRADIENTS = [
  ['#FF6B6B', '#FF8E53'],  // Coral → Orange
  ['#7C5CFC', '#B794F4'],  // Purple → Lavender
  ['#00B4D8', '#48CAE4'],  // Ocean → Sky
  ['#FF6392', '#FFB3C6'],  // Pink → Rose
  ['#059669', '#34D399'],  // Emerald → Mint
  ['#F59E0B', '#FBBF24'],  // Amber → Gold
  ['#8B5CF6', '#C4B5FD'],  // Violet → Lilac
  ['#EC4899', '#F472B6'],  // Magenta → Blush
  ['#06B6D4', '#67E8F9'],  // Cyan → Ice
  ['#EF4444', '#F87171'],  // Red → Light Red
  ['#3B82F6', '#93C5FD'],  // Blue → Sky Blue
  ['#14B8A6', '#5EEAD4'],  // Teal → Aqua
  ['#D946EF', '#E879F9'],  // Fuchsia → Pink
  ['#F97316', '#FB923C'],  // Orange → Peach
  ['#84CC16', '#A3E635'],  // Lime → Neon
  ['#E11D48', '#FB7185'],  // Rose → Salmon
]

/**
 * Get a deterministic gradient for a given name
 */
export function getAvatarGradient(name) {
  const str = (name || '?').toLowerCase()
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const idx = Math.abs(hash) % GRADIENTS.length
  const [c1, c2] = GRADIENTS[idx]
  return `linear-gradient(135deg, ${c1}, ${c2})`
}

/**
 * Get initials from a name (max 2 chars)
 */
export function getInitials(name) {
  if (!name) return '?'
  return name
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}
