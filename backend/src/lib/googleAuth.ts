import * as admin from "firebase-admin";

// This project already has "Sign in with Google" enabled as a Firebase Auth
// provider (shared Firebase project with the AI App Builder dashboard, id
// ai-app-builder-7bf8e) — retail-pos doesn't use Firebase Auth for anything
// else, just this: verifying the ID token the frontend gets back from
// `signInWithPopup(auth, new GoogleAuthProvider())`. Verifying a token only
// needs the project id (to check the token's `aud` claim) and Google's public
// certs (fetched over HTTPS) — no service-account credentials required, so
// this works the same in local dev as it does deployed.
if (!admin.apps.length) {
  admin.initializeApp({ projectId: "ai-app-builder-7bf8e" });
}

export interface GoogleIdentity {
  uid: string;
  email: string | null;
  name: string;
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  const decoded = await admin.auth().verifyIdToken(idToken);
  return {
    uid: decoded.uid,
    email: decoded.email ?? null,
    name: (decoded.name as string | undefined) ?? decoded.email ?? "Pemilik Toko",
  };
}
