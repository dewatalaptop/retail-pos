import os from "os";
import path from "path";

// Set before importing the backend: db/index.ts reads DB_PATH at module-load
// time, and TS's commonjs output preserves statement order, so this runs
// ahead of the `require()` that import produces. os.tmpdir() resolves to a
// real writable directory both here (Windows, during `firebase deploy`'s
// local code analysis) and on the actual Cloud Functions runtime (Linux
// /tmp) — a literal "/tmp/..." string only works on the latter.
process.env.DB_PATH = path.join(os.tmpdir(), "retail-pos-data.db");

import { onRequest } from "firebase-functions/v2/https";
import { app } from "./backend/app";
import { seed } from "./backend/db/seed";

// Cloud Functions instances get an ephemeral filesystem, so each cold start
// seeds demo data automatically — there's no persistent disk to run
// `npm run seed` against like local dev.
seed();

export const api = onRequest({ region: "asia-southeast2" }, app);
