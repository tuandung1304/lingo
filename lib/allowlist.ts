// Comma-separated list in ALLOWED_EMAILS. Empty list = nobody allowed.
export function isAllowedEmail(email: string | undefined | null) {
  if (!email) return false
  const allowed = (process.env.ALLOWED_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return allowed.includes(email.toLowerCase())
}
