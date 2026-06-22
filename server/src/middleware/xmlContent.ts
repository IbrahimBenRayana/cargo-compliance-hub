/**
 * XML content-negotiation for the public API.
 *
 * - Requests with an XML Content-Type are parsed to a JS object so the existing
 *   zod schemas + handlers work unchanged (a single root element is unwrapped,
 *   e.g. <filing>…</filing> → the filing object).
 * - Responses are serialized to XML (under a <response> root) when the client
 *   sends `Accept: application/xml`; otherwise JSON is returned as normal.
 *
 * JSON remains the default and is recommended for deeply-nested payloads; XML
 * array handling is configured for the common ISF list fields.
 */
import { Request, Response, NextFunction } from 'express';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';

// Fields that are arrays in our payloads — so a single XML element still parses
// to an array (avoids the single-vs-many ambiguity).
const ARRAY_FIELDS = new Set(['commodities', 'containers', 'manifest', 'invoices', 'items', 'data']);

const parser = new XMLParser({
  ignoreAttributes: true,
  // Keep every value a string. Customs identifiers (entry type "01", 10-digit
  // HTS, IOR/zip codes) must preserve leading zeros and never be coerced to
  // numbers — numeric coercion would silently corrupt them.
  parseTagValue: false,
  trimValues: true,
  isArray: (name) => ARRAY_FIELDS.has(name),
});

const builder = new XMLBuilder({ ignoreAttributes: true, format: true, suppressEmptyNode: true });

/** Parse an XML string into a JS object, unwrapping a single root element. */
export function xmlToObject(xml: string): any {
  const parsed = parser.parse(xml);
  const keys = Object.keys(parsed);
  // Unwrap a single root wrapper (<filing>…</filing> → {…}); keep as-is otherwise.
  return keys.length === 1 ? parsed[keys[0]] : parsed;
}

/** Serialize a response object to an XML document under a <response> root. */
export function objectToXml(body: unknown): string {
  const xml = builder.build({ response: body ?? {} });
  return `<?xml version="1.0" encoding="UTF-8"?>\n${xml}`;
}

function wantsXml(req: Request): boolean {
  // Only when the client explicitly prefers XML over JSON.
  return req.accepts(['application/json', 'application/xml']) === 'application/xml';
}

/**
 * Parse XML request bodies (expects express.text to have populated req.body as
 * a string for XML content-types) and, when the client asked for XML, wrap
 * res.json so every response on this router is emitted as XML.
 */
export function xmlContentNegotiation(req: Request, res: Response, next: NextFunction): void {
  const contentType = req.headers['content-type'] || '';
  if (typeof req.body === 'string' && req.body.trim().length > 0 && /xml/i.test(contentType)) {
    try {
      req.body = xmlToObject(req.body);
    } catch {
      res.status(400).json({ error: 'Invalid XML body.', code: 'invalid_xml' });
      return;
    }
  }

  if (wantsXml(req)) {
    res.json = (body: unknown) => {
      res.type('application/xml');
      return res.send(objectToXml(body)) as unknown as Response;
    };
  }

  next();
}
