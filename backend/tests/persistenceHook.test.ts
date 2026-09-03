import { describe, it, expect, afterEach } from "vitest";
import { notifyDbChanged, setDbSyncHook } from "../src/db/persistenceHook";

describe("persistenceHook", () => {
  afterEach(() => {
    // Reset to the module's default no-op so other tests aren't affected.
    setDbSyncHook(() => {});
  });

  it("is a no-op when no hook has been installed", async () => {
    await expect(notifyDbChanged()).resolves.toBeUndefined();
  });

  it("calls the installed hook", async () => {
    let called = false;
    setDbSyncHook(() => {
      called = true;
    });
    await notifyDbChanged();
    expect(called).toBe(true);
  });

  it("awaits an async hook before resolving", async () => {
    let resolved = false;
    setDbSyncHook(async () => {
      await new Promise((r) => setTimeout(r, 5));
      resolved = true;
    });
    await notifyDbChanged();
    expect(resolved).toBe(true);
  });

  it("swallows a hook error instead of rejecting", async () => {
    setDbSyncHook(() => {
      throw new Error("cloud storage is down");
    });
    await expect(notifyDbChanged()).resolves.toBeUndefined();
  });

  it("swallows a rejected async hook instead of rejecting", async () => {
    setDbSyncHook(async () => {
      throw new Error("cloud storage is down");
    });
    await expect(notifyDbChanged()).resolves.toBeUndefined();
  });
});
