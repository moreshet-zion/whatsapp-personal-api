import { Request, Response, NextFunction } from 'express'

function parseAllowedTokens(): Set<string> {
  const raw = process.env.API_TOKENS || ''
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  )
}

export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  // Allow health checks without a key
  if (req.method === 'GET' && req.path.startsWith('/health')) {
    return next()
  }
  const tokens = parseAllowedTokens()
  if (tokens.size === 0) {
    // if no tokens configured, deny by default
    return res.status(401).json({ success: false, error: 'API not configured: missing API_TOKENS' })
  }
  const headerKey =
    req.header('x-api-key') ||
    req.header('authorization')?.replace(/^Bearer\s+/i, '') ||
    (req.query.key as string | undefined) ||
    (req.query.api_key as string | undefined)
  if (!headerKey || !tokens.has(headerKey)) {
    return res.status(401).json({ success: false, error: 'Invalid or missing API key' })
  }
  return next()
}


