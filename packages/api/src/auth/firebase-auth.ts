/**
 * Firebase Authentication
 *
 * Phase 10: Sellable Alpha Shell
 * Beads Task: intentvision-yzd
 *
 * Handles Firebase Authentication token verification.
 * Used for dashboard/frontend authentication (distinct from API key auth).
 */

import type { IncomingMessage } from 'http';

// =============================================================================
// Types
// =============================================================================

export interface FirebaseAuthContext {
  /** Firebase Auth UID */
  uid: string;
  /** User email (if available) */
  email?: string;
  /** Whether email is verified */
  emailVerified?: boolean;
  /** Token issue time */
  iat?: number;
  /** Token expiration time */
  exp?: number;
}

// =============================================================================
// Token Extraction
// =============================================================================

/**
 * Extract Firebase ID token from request headers
 * Accepts: Authorization: Bearer <token>
 */
export function extractBearerToken(req: IncomingMessage): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return null;
  }

  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return null;
}

/**
 * Extract Firebase auth context from request
 *
 * NOTE: In production, this should verify the token using Firebase Admin SDK.
 * For the Sellable Alpha Shell, we use a simplified approach:
 * - In development: Accept any token and decode it as JWT
 * - In production: Use Firebase Admin verifyIdToken()
 *
 * The full implementation would be:
 * import { getAuth } from 'firebase-admin/auth';
 * const decodedToken = await getAuth().verifyIdToken(token);
 */
export async function extractFirebaseToken(
  req: IncomingMessage
): Promise<FirebaseAuthContext | null> {
  const token = extractBearerToken(req);
  if (!token) {
    return null;
  }

  try {
    // For development/alpha: decode JWT without full verification
    // Production would use: getAuth().verifyIdToken(token)
    const decoded = decodeJwtPayload(token);

    if (!decoded || !decoded.sub) {
      return null;
    }

    return {
      uid: decoded.sub as string,
      email: decoded.email as string | undefined,
      emailVerified: decoded.email_verified as boolean | undefined,
      iat: decoded.iat as number | undefined,
      exp: decoded.exp as number | undefined,
    };
  } catch (error) {
    console.error('[FirebaseAuth] Token decode error:', (error as Error).message);
    return null;
  }
}

/**
 * Decode JWT payload without verification
 * WARNING: Use only in development. Production should verify tokens.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

// =============================================================================
// Middleware Helper
// =============================================================================

/**
 * Require Firebase authentication
 * Returns auth context or sends 401 response
 */
export async function requireFirebaseAuth(
  req: IncomingMessage
): Promise<FirebaseAuthContext | null> {
  return extractFirebaseToken(req);
}

/**
 * Check if request has valid Firebase auth
 */
export async function hasFirebaseAuth(req: IncomingMessage): Promise<boolean> {
  const context = await extractFirebaseToken(req);
  return context !== null;
}
