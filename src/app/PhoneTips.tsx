import { useEffect, useState } from "react";
import { t } from "../meta/i18n.js";

const DISMISS_KEY = "cb-install-dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
};

function isStandalone() {
  if (typeof window === "undefined") return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone) return true;
  return window.matchMedia("(display-mode: standalone)").matches
    || window.matchMedia("(display-mode: fullscreen)").matches;
}

function isPhoneish() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent || "";
  if (/iphone|ipad|ipod|android/i.test(ua)) return true;
  if (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1) return true;
  return window.matchMedia("(max-width: 900px) and (pointer: coarse)").matches;
}

function isIos() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent || "";
  if (/iphone|ipad|ipod/i.test(ua)) return true;
  return window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
}

export function PhoneTips() {
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone() || !isPhoneish()) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch { /* ignore */ }
    setIos(isIos());
    setShow(true);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!show) return null;

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
    setShow(false);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    setDeferred(null);
    dismiss();
  }

  return (
    <div className="cb-install-hint" role="status">
      <p>{ios ? t("install.ios") : t("install.android")}</p>
      <div className="cb-install-actions">
        {deferred ? (
          <button type="button" className="cb-btn" onClick={() => { void install(); }}>{t("install.add")}</button>
        ) : null}
        <button type="button" className="cb-btn" onClick={dismiss}>{t("install.dismiss")}</button>
      </div>
    </div>
  );
}
