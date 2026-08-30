// Cloud Functions deploy only uploads the `functions/` directory, so the
// shared backend/src (Express app + routes/lib/db) has to be mirrored inside
// functions/src before `tsc` runs. `backend/` stays the single source of
// truth; this script just keeps functions/src/backend in sync at build time.
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "..", "backend", "src");
const dest = path.join(__dirname, "..", "src", "backend");

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });

console.log(`Copied ${src} -> ${dest}`);
