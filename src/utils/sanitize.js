import DOMPurify from 'dompurify'

export function sanitizeMessage(text) {
  if (!text) return ''
  
  // Strip dangerous XSS HTML tags while preserving raw text and links
  let clean = DOMPurify.sanitize(text, { ALLOWED_TAGS: [] })
  
  // Enforce clean max length without stripping links or text
  clean = clean.trim().slice(0, 4000)
  
  return clean
}

export function sanitizeInput(text) {
  if (!text) return ''
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [] }).trim()
}
