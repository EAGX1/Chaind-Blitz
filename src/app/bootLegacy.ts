/** Boot the existing vanilla hub/duel UI after React chrome mounts. */
export async function bootLegacyUi(): Promise<void> {
  await import("../ui/main.js");
}
