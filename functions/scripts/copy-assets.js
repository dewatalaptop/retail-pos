// tsc only compiles .ts files, so schema.sql (read at runtime via
// fs.readFileSync relative to __dirname) needs to be copied into the
// compiled lib/ output separately, after tsc has run.
const fs = require("fs");
const path = require("path");

for (const file of ["schema.sql", "indexes.sql"]) {
  const src = path.join(__dirname, "..", "src", "backend", "db", file);
  const dest = path.join(__dirname, "..", "lib", "backend", "db", file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`Copied ${src} -> ${dest}`);
}
