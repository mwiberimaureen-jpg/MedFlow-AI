'use client'

/**
 * Firebase client SDK init (browser only).
 *
 * Used for Phone Auth at signup: Firebase handles OTP generation + SMS
 * delivery + verification client-side, then hands us a signed ID token
 * that the server can verify.
 *
 * All NEXT_PUBLIC_FIREBASE_* env vars are populated from the Firebase
 * console: Project settings -> General -> Your apps -> Web app.
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app'
import { getAuth, Auth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

let app: FirebaseApp | null = null
let authInstance: Auth | null = null

export function getFirebaseAuth(): Auth {
  if (typeof window === 'undefined') {
    throw new Error('getFirebaseAuth() must be called in the browser only')
  }
  if (!firebaseConfig.apiKey) {
    throw new Error('NEXT_PUBLIC_FIREBASE_API_KEY is not set')
  }
  if (!app) {
    app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
  }
  if (!authInstance) {
    authInstance = getAuth(app)
  }
  return authInstance
}
