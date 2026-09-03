import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// This app doesn't use Firebase for its own data (that's the Express +
// SQLite backend) — only for "Sign in with Google", which is already
// enabled as a provider on this shared Firebase project (same project as
// the AI App Builder dashboard, id ai-app-builder-7bf8e). The apiKey below
// is Firebase's public client key — it identifies the project, it isn't a
// secret (Firebase access control happens via its security rules / this
// app's own backend auth, never via hiding this key).
const firebaseApp = initializeApp({
  apiKey: "AIzaSyCiBe6t2_26DflR3W7TbDf4HwDI5Hh0TI4",
  authDomain: "ai-app-builder-7bf8e.firebaseapp.com",
  projectId: "ai-app-builder-7bf8e",
});

export const firebaseAuth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();
