// tsc only compiles .ts files, so schema.sql (read at runtime via
// fs.readFileSync relative to __dirname) needs to be copied into the
// compiled lib/ output separately, after tsc has run.
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "src", "backend", "db", "schema.sql");
const dest = path.join(__dirname, "..", "lib", "backend", "db", "schema.sql");

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);

console.log(`Copied ${src} -> ${dest}`);
