/**
 * Cloud Functions instances get an ephemeral filesystem, so `functions/src/index.ts`
 * mirrors the SQLite file to/from Firebase Storage to survive cold starts (see that
 * file for the full explanation). This module is the seam between the two: backend
 * routes call `notifyDbChanged()` after every write, and the functions entrypoint
 * installs the actual upload behind it via `setDbSyncHook`. Local dev never calls
 * `setDbSyncHook`, so this stays a no-op there — plain local data.db, unchanged.
 */
type SyncHook = () => Promise<void> | void;

let hook: SyncHook = () => {};

export function setDbSyncHook(fn: SyncHook): void {
  hook = fn;
}

export async function notifyDbChanged(): Promise<void> {
  try {
    await hook();
  } catch (err) {
    // A failed cloud sync must never fail the request that already committed
    // locally — the write itself succeeded. Worst case, that write is lost on
    // the next cold start, same as before this module existed; log it so it's
    // visible in Cloud Functions logs, but the user's action still succeeds.
    console.error("db sync hook failed:", err);
  }
}
