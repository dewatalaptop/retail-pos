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
// authDomain is deliberately this app's OWN hosting domain, not the shared
// project's default `ai-app-builder-7bf8e.firebaseapp.com` (already listed
// in Authentication's authorized domains, so this is a supported, sanctioned
// swap, not a workaround). signInWithRedirect's whole round trip — app ->
// Google -> Firebase's reserved /__/auth/handler path -> back to the app —
// has to correlate state across that trip via storage that's shared between
// the app's own origin and whatever authDomain is. With the shared
// firebaseapp.com domain, that storage access counts as third-party from
// retail-pos-demo.web.app's point of view and gets silently blocked by an
// increasing number of browsers' storage-partitioning defaults — the
// redirect completes, but getRedirectResult() comes back null instead of
// the signed-in user, with no error thrown, dropping the user right back on
// the login screen after a moment of "loading" (confirmed as the actual
// failure mode, 2026-09-04, via direct user report). Since /__/auth/** is a
// path Firebase Hosting reserves and serves automatically on every site in
// the project (not just a "default" one), pointing authDomain at this
// app's own already-authorized domain keeps the entire trip same-site, with
// no third-party storage boundary for any browser to partition.
const firebaseApp = initializeApp({
  apiKey: "AIzaSyCiBe6t2_26DflR3W7TbDf4HwDI5Hh0TI4",
  authDomain: "retail-pos-demo.web.app",
  projectId: "ai-app-builder-7bf8e",
});

export const firebaseAuth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();
