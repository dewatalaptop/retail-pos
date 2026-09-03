import os from "os";
import path from "path";
import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import type { Express } from "express";

// Set before importing the backend: db/index.ts reads DB_PATH at module-load
// time, and TS's commonjs output preserves statement order, so this runs
// ahead of the `require()` that import produces. os.tmpdir() resolves to a
// real writable directory both here (Windows, during `firebase deploy`'s
// local code analysis) and on the actual Cloud Functions runtime (Linux
// /tmp) — a literal "/tmp/..." string only works on the latter.
const DB_PATH = path.join(os.tmpdir(), "retail-pos-data.db");
process.env.DB_PATH = DB_PATH;

// Same Firebase project as the AI App Builder dashboard, but this app's data
// lives under its own prefix in that project's default bucket — nothing here
// is shared with or readable by the dashboard's own Storage rules, since the
// Admin SDK bypasses security rules entirely (it authenticates as a service
// account, not as an end user).
const BUCKET_NAME = "ai-app-builder-7bf8e.firebasestorage.app";
const DB_STORAGE_PATH = "retail-pos-db/data.db";

if (!admin.apps.length) {
  admin.initializeApp({ storageBucket: BUCKET_NAME });
}

async function downloadDbIfExists(): Promise<boolean> {
  const file = admin.storage().bucket().file(DB_STORAGE_PATH);
  const [exists] = await file.exists();
  if (!exists) return false;
  await file.download({ destination: DB_PATH });
  return true;
}

async function uploadDb(): Promise<void> {
  // backend/src/db/index.ts opens SQLite in WAL mode, which means a write can
  // be fully committed yet still live only in the sidecar `-wal` file, not
  // yet folded into DB_PATH itself (SQLite only folds it in — "checkpoints"
  // — once the WAL crosses a size threshold or the connection closes).
  // Uploading DB_PATH alone without forcing a checkpoint first risks shipping
  // a file that's missing the very write that triggered this upload. `db` is
  // dynamically imported here (rather than at module top) so this file never
  // opens SQLite before `initApp` has had a chance to restore DB_PATH first.
  const { db } = await import("./backend/db");
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  await admin.storage().bucket().upload(DB_PATH, { destination: DB_STORAGE_PATH });
}

// Cloud Functions instances get an ephemeral filesystem, so every cold start
// would otherwise lose all data (sales, products, everything) — that made
// the live demo fine for a quick look, but useless for anyone actually
// running their shop on it. Fix: restore the last-known SQLite file from
// Firebase Storage before the backend even opens it, and re-upload it after
// every write (see backend/src/db/persistenceHook.ts + its call sites in the
// route files) so the next cold start picks up where this one left off.
//
// The download MUST finish before `./backend/app` is imported, because that
// import chain opens the SQLite file as a side effect at module-load time
// (backend/src/db/index.ts) — hence the dynamic `import()` below instead of
// a top-level one.
let appPromise: Promise<Express> | null = null;

async function initApp(): Promise<Express> {
  const restored = await downloadDbIfExists();

  const { app } = await import("./backend/app");

  if (!restored) {
    // First-ever cold start for this deployment (or the Storage object was
    // deleted): nothing to restore, so seed demo data like before — then
    // immediately persist that baseline so subsequent cold starts restore
    // it instead of re-seeding over whatever real data has since been added.
    const { seed } = await import("./backend/db/seed");
    seed();
    await uploadDb();
  }

  const { setDbSyncHook } = await import("./backend/db/persistenceHook");
  setDbSyncHook(uploadDb);

  return app;
}

function getApp(): Promise<Express> {
  if (!appPromise) appPromise = initApp();
  return appPromise;
}

export const api = onRequest({ region: "asia-southeast2" }, async (req, res) => {
  const app = await getApp();
  app(req, res);
});
