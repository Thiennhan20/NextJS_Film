import Hashids from 'hashids'

const salt = process.env.NEXT_PUBLIC_HASHID_SALT || 'movie-web-hashid-salt-secret'
const hashids = new Hashids(salt, 10)

/**
 * Encode a MongoDB ObjectId (or 24-char hex string) to Hashids
 */
export function encodeCommentId(id: string | null | undefined): string {
  if (!id) return ''
  const hex = String(id).trim()
  if (!/^[0-9a-fA-F]{24}$/.test(hex)) {
    return hex
  }
  return hashids.encodeHex(hex)
}

/**
 * Decode a Hashids string or return the 24-char hex ObjectId if already hex
 */
export function decodeCommentId(hashOrId: string | null | undefined): string {
  if (!hashOrId) return ''
  const str = String(hashOrId).trim()
  if (/^[0-9a-fA-F]{24}$/.test(str)) {
    return str
  }
  try {
    const decoded = hashids.decodeHex(str)
    if (decoded && /^[0-9a-fA-F]{24}$/.test(decoded)) {
      return decoded
    }
  } catch {
    // ignore decode error
  }
  return str
}
