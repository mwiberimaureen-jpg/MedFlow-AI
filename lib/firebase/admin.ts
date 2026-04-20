/**
 * Firebase Admin SDK init (server only).
 *
 * Verifies ID tokens issued to the browser after a successful phone OTP,
 * so we can trust the `phone_number` claim server-side before binding it
 * to a Supabase account.
 *
 * Service account env vars come from Firebase console:
 * Project settings -> Service accounts -> Generate new private key.
 */

import { initializeApp, getApps, cert, App } from 'firebase-admin/app'
import { getAuth, Auth } from 'firebase-admin/auth'

let app: App | null = null

function getAdminApp(): App {
  if (app) return app
  const existing = getApps()
  if (existing.length) {
    app = existing[0]
    return app
  }

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  // Private key is typically stored with `\n` literals — unescape them.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin SDK not configured (missing FIREBASE_* env vars)')
  }

  app = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  })
  return app
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp())
}
