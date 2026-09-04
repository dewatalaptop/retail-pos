import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// This app doesn't use Firebase for its own data (that's the Express +
// SQLite backend) — only for "Sign in with Google", which is already
// enabled as a provider on this shared Firebase project (same project as
// the AI App Builder dashboard, id ai-app-builder-7bf8e). The apiKey below
// is Firebase's public client key — it identifies the project, it isn't a
// secret (Firebase access control happens via its security rules / this
// app's own backend auth, never via hiding this key).
//
// authDomain MUST stay the shared project's own `ai-app-builder-7bf8e.
// firebaseapp.com` — briefly tried pointing it at this app's own
// `retail-pos-demo.web.app` instead (2026-09-04, to fix signInWithRedirect
// silently failing — see AuthContext.tsx for why redirect isn't used for
// web at all anymore) but that broke sign-in even harder: Google rejected
// every attempt with `redirect_uri_mismatch`, because the underlying OAuth
// 2.0 client's allow-listed redirect URIs are a DIFFERENT, Google
// Cloud Console-only-editable resource from Firebase's `authorizedDomains`
// list — adding a domain to authorizedDomains (even the proper way, via
// Firebase Console) does not by itself register a matching redirect URI on
// the OAuth client, and there is no public API to add one. Reverted.
const firebaseApp = initializeApp({
  apiKey: "AIzaSyCiBe6t2_26DflR3W7TbDf4HwDI5Hh0TI4",
  authDomain: "ai-app-builder-7bf8e.firebaseapp.com",
  projectId: "ai-app-builder-7bf8e",
});

export const firebaseAuth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();
