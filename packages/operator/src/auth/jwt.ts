/**
 * JWT Token Management
 *
 * Task ID: intentvision-cvo (Phase C)
 *
 * Provides JWT token generation and verification:
 * - HS256 signing with secret from environment
 * - Token generation with 24-hour expiry
 * - Token verification and payload extraction
 */

import { createHmac, timingSafeEqual } from 'crypto';

// =============================================================================
// Types
// =============================================================================

export interface TokenPayload {
  /** Organization ID */
  orgId: string;
  /** User ID */
  userId: string;
  /** User roles */
  roles: string[];
  /** Issued at timestamp (seconds) */
  iat: number;
  /** Expiration timestamp (seconds) */
  exp: number;
}

export interface JwtHeader {
  alg: 'HS256';
  typ: 'JWT';
}

// =============================================================================
// Configuration
// =============================================================================

const TOKEN_EXPIRY_HOURS = 24;
const DEFAULT_SECRET = 'intentvision-development-secret-change-in-production';

/**
 * Get JWT secret from environment or use default for development
 */
function getJwtSecret(): string {
  const secret = process.env.INTENTVISION_JWT_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('INTENTVISION_JWT_SECRET must be set in production');
    }
    console.warn('Warning: Using default JWT secret for development');
    return DEFAULT_SECRET;
  }

  return secret;
}

// =============================================================================
// JWT Helper Functions
// =============================================================================

/**
 * Base64URL encode a buffer
 */
function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Base64URL decode a string
 */
function base64UrlDecode(str: string): Buffer {
  // Add padding if needed
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64');
}

/**
 * Create HMAC-SHA256 signature
 */
function sign(data: string, secret: string): string {
  const hmac = createHmac('sha256', secret);
  hmac.update(data);
  return base64UrlEncode(hmac.digest());
}

/**
 * Verify HMAC-SHA256 signature using timing-safe comparison
 */
function verifySignature(expected: string, actual: string, secret: string): boolean {
  const expectedSig = sign(actual, secret);

  // Use timing-safe comparison to prevent timing attacks
  try {
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(expectedSig);

    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, actualBuffer);
  } catch {
    return false;
  }
}

// =============================================================================
// Token Generation
// =============================================================================

/**
 * Generate a JWT token
 *
 * @param payload - Token payload containing orgId, userId, and roles
 * @returns JWT token string
 *
 * @example
 * const token = generateToken({
 *   orgId: 'org-123',
 *   userId: 'user-456',
 *   roles: ['admin', 'operator']
 * });
 */
export function generateToken(payload: {
  orgId: string;
  userId: string;
  roles: string[];
}): string {
  const secret = getJwtSecret();

  // Create header
  const header: JwtHeader = {
    alg: 'HS256',
    typ: 'JWT',
  };

  // Create payload with timestamps
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: TokenPayload = {
    ...payload,
    iat: now,
    exp: now + TOKEN_EXPIRY_HOURS * 60 * 60,
  };

  // Encode header and payload
  const encodedHeader = base64UrlEncode(Buffer.from(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(Buffer.from(JSON.stringify(fullPayload)));

  // Create signature
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = sign(data, secret);

  // Return complete token
  return `${data}.${signature}`;
}

// =============================================================================
// Token Verification
// =============================================================================

/**
 * Verify and decode a JWT token
 *
 * @param token - JWT token string
 * @returns Token payload if valid, null if invalid or expired
 *
 * @example
 * const payload = verifyToken(token);
 * if (payload) {
 *   console.log(`User ${payload.userId} from org ${payload.orgId}`);
 * }
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const secret = getJwtSecret();

    // Split token into parts
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [encodedHeader, encodedPayload, signature] = parts;

    // Verify signature
    const data = `${encodedHeader}.${encodedPayload}`;
    if (!verifySignature(signature, data, secret)) {
      return null;
    }

    // Decode and parse header
    const headerJson = base64UrlDecode(encodedHeader).toString('utf8');
    const header: JwtHeader = JSON.parse(headerJson);

    // Verify algorithm
    if (header.alg !== 'HS256') {
      return null;
    }

    // Decode and parse payload
    const payloadJson = base64UrlDecode(encodedPayload).toString('utf8');
    const payload: TokenPayload = JSON.parse(payloadJson);

    // Verify expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) {
      return null;
    }

    // Validate required fields
    if (!payload.orgId || !payload.userId || !Array.isArray(payload.roles)) {
      return null;
    }

    return payload;
  } catch {
    // Any parsing or validation error returns null
    return null;
  }
}

/**
 * Get token expiry time in seconds from now
 */
export function getTokenExpirySeconds(): number {
  return TOKEN_EXPIRY_HOURS * 60 * 60;
}

/**
 * Check if a token is expired without full verification
 * (useful for checking if a token needs refresh)
 */
export function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return true;
    }

    const payloadJson = base64UrlDecode(parts[1]).toString('utf8');
    const payload = JSON.parse(payloadJson);

    const now = Math.floor(Date.now() / 1000);
    return payload.exp <= now;
  } catch {
    return true;
  }
}

/**
 * Decode token payload without verification
 * WARNING: Use only for debugging/logging, not for authentication
 */
export function decodeTokenUnsafe(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payloadJson = base64UrlDecode(parts[1]).toString('utf8');
    return JSON.parse(payloadJson);
  } catch {
    return null;
  }
}
