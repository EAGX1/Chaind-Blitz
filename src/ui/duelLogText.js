/** Plain-text side log. The Crucible steal — not replay JSON. */
import { logLineText } from "../meta/replay.js";

export { logLineText };

export function formatDuelLog(log) {
  return (log || []).map(logLineText).join("\n");
}

export function copyText(text) {
  const raw = String(text ?? "");
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(raw);
      return true;
    }
  } catch { /* fall through */ }
  try {
    if (typeof document === "undefined") return false;
    const ta = document.createElement("textarea");
    ta.value = raw;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    return true;
  } catch {
    return false;
  }
}
