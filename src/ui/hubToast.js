// Hub receipts: gem/dust/craft toasts. Not a crypto wallet.

export function walletDeltaLine(before, after) {
  if (!before || !after) return "";
  const bits = [];
  const push = (key, label) => {
    const d = (after[key] ?? 0) - (before[key] ?? 0);
    if (!d) return;
    bits.push(`${d > 0 ? "+" : ""}${d} ${label}`);
  };
  push("gems", "gems");
  push("coins", "coins");
  if (before.dust && after.dust) {
    for (const r of ["N", "R", "SR", "UR"]) {
      const d = (after.dust[r] || 0) - (before.dust[r] || 0);
      if (d) bits.push(`${d > 0 ? "+" : ""}${d} ${r} dust`);
    }
  }
  return bits.join(" · ");
}

export function showHubToast(msg, cls = "") {
  const line = String(msg || "").trim();
  if (!line || typeof document === "undefined") return;
  let el = document.getElementById("hub-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "hub-toast";
    el.className = "hub-toast";
    el.setAttribute("aria-live", "polite");
    (document.getElementById("screen-hub") || document.body).appendChild(el);
  }
  el.textContent = line;
  el.dataset.cls = cls;
  el.classList.add("on");
  clearTimeout(showHubToast._t);
  showHubToast._t = setTimeout(() => el.classList.remove("on"), 2400);
}

export function pulseWallet() {
  if (typeof document === "undefined") return;
  const bar = document.querySelector(".hub-wallet");
  if (!bar) return;
  bar.classList.remove("wallet-pulse");
  void bar.offsetWidth;
  bar.classList.add("wallet-pulse");
  clearTimeout(pulseWallet._t);
  pulseWallet._t = setTimeout(() => bar.classList.remove("wallet-pulse"), 700);
}
