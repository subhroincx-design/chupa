import DOMPurify from 'dompurify'

const URL_REGEX = /https?:\/\/[^\s]+|www\.[^\s]+/gi
const EMOJI_SHORTCODE_REGEX = /:[a-zA-Z0-9_+-]+:/g

export function sanitizeMessage(text) {
  if (!text) return ''
  
  // Strip ALL HTML tags
  let clean = DOMPurify.sanitize(text, { ALLOWED_TAGS: [] })
  
  // Block emoji shortcodes
  clean = clean.replace(EMOJI_SHORTCODE_REGEX, '')
  
  // Replace URLs with [link removed]
  clean = clean.replace(URL_REGEX, '[link removed]')
  
  // Trim and enforce max length
  clean = clean.trim().slice(0, 2000)
  
  return clean
}

export function sanitizeInput(text) {
  if (!text) return ''
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [] }).trim()
}
