/**
 * Rate Limiting Middleware
 * 
 * Different limits for different endpoint groups:
 * - Auth endpoints: 10 requests / minute (brute force protection)
 * - Filing mutations: 30 requests / minute
 * - General API: 100 requests / minute
 */

import rateLimit from 'express-rate-limit';

// Auth endpoints — strict to prevent brute force
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 10,                    // 10 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts. Please try again in a minute.',
    code: 'RATE_LIMIT_AUTH',
  },
  // Default key is req.ip which is fine for auth rate limiting
});

// Filing mutations (create, update, submit, amend, cancel)
export const filingMutationLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many filing operations. Please slow down.',
    code: 'RATE_LIMIT_FILING',
  },
});

// General API — generous limit
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests. Please try again shortly.',
    code: 'RATE_LIMIT_GENERAL',
  },
});

// Marketing contact form — strict, anti-spam. The form is unauthenticated
// and routed to a real inbox, so we cap aggressively per IP. 5/hr is enough
// for a legitimate visitor who hits "send" twice + waits + retries; deters
// drive-by scraper spam.
export const contactFormLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many contact-form submissions. Please email us directly.',
    code: 'RATE_LIMIT_CONTACT',
  },
});

// AI chat — per-IP cap on message/stream traffic. The assistant is also bounded
// by the per-key daily AI cap inside services/ai.ts (userId for signed-in users,
// anon:<visitorId> for marketing visitors); this protects the endpoint itself
// (and the OpenAI budget) from a burst. 20/min comfortably covers an active
// back-and-forth.
export const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'You are sending messages too quickly. Please wait a moment.',
    code: 'RATE_LIMIT_CHAT',
  },
});

// New-conversation creation — anti-abuse on the unauthenticated marketing path,
// where each create can mint a visitor token. 30/hr/IP deters churn/spam while
// leaving plenty of headroom for legitimate visitors who reopen the widget.
export const chatCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many new chats from this network. Please try again later.',
    code: 'RATE_LIMIT_CHAT_CREATE',
  },
});

// CBP filing API calls — protect against accidental hammering of external API
export const ccApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many filing requests. Please wait a moment before trying again.',
    code: 'RATE_LIMIT_FILING_API',
  },
});

// Public API — per-API-KEY ceiling (not per-IP). The generalLimiter only bounds
// per IP, so a single key hammering from many IPs, or a leaked key, could still
// burst. This caps each key independently. Mounted AFTER apiKeyAuth so
// req.apiContext.keyId is set; keying on the key id (never the IP) also avoids
// the IPv6 key-generator pitfall.
export const apiKeyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as { apiContext?: { keyId?: string } }).apiContext?.keyId ?? 'unauthenticated',
  message: {
    error: 'API rate limit exceeded for this key. Please slow down.',
    code: 'RATE_LIMIT_API_KEY',
  },
});
