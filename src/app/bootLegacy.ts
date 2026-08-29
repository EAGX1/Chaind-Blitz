/** Boot the existing vanilla hub/duel UI after React chrome mounts. */
export async function bootLegacyUi(): Promise<void> {
  try {
    await import("../ui/main.js");
  } catch (err) {
    const msg = err instanceof Error ? err.stack || err.message : String(err);
    console.error("legacy ui failed", err);
    (window as unknown as { __CB_BOOT_ERR?: string }).__CB_BOOT_ERR = msg;
    throw err;
  }
}
