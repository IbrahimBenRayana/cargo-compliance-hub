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
