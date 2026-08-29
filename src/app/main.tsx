import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { AppChrome } from "./AppChrome";
import { StarterPick } from "./StarterPick";
import { CityApp } from "./city/CityApp";
import { DuelBoardMount } from "./duel3d/DuelBoardMount";
import { bootLegacyUi } from "./bootLegacy";
import { loadSettings, applySettingsToDom } from "../ui/settingsStore.js";
import { playBed } from "../meta/music.js";
import { applyEquippedToDom } from "../meta/cosmetics.js";
import { setLocale } from "../meta/i18n.js";

import "../../css/style.css";
import "../../css/duel.css";
import "../../css/mobile.css";
import "../../css/aaa.css";
import "../../css/home.css";
import "./chrome.css";
import "./city/city.css";

function Root() {
  const [classic, setClassic] = useState(() => {
    const s = loadSettings();
    return !!(s.classicHub || s.hidePlaza);
  });
  const [ready, setReady] = useState(false);
  const [tick, setTick] = useState(0);
  const [dueling, setDueling] = useState(false);

  useEffect(() => {
    const s = applySettingsToDom(loadSettings());
    setLocale(s.locale || "en");
    bootLegacyUi().then(() => {
      const p = (window as unknown as { __CB?: { profile?: unknown } }).__CB?.profile;
      if (p) applyEquippedToDom(p);
      setReady(true);
    }).catch(() => {
      setClassic(true);
      setReady(true);
    });
    if ("serviceWorker" in navigator) {
      if (import.meta.env.DEV) {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          regs.forEach((r) => r.unregister());
        });
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
      } else {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      }
    }
  }, []);

  useEffect(() => {
    const onSettings = (e: Event) => {
      const s = (e as CustomEvent).detail;
      if (s && typeof s.classicHub === "boolean") setClassic(!!s.classicHub || !!s.hidePlaza);
      if (s && typeof s.hidePlaza === "boolean" && s.hidePlaza) setClassic(true);
      if (s?.locale) setLocale(s.locale);
    };
    const onScreen = (e: Event) => {
      setDueling((e as CustomEvent).detail?.screen === "duel");
    };
    const onMutate = () => setTick((t) => t + 1);
    window.addEventListener("cb-settings-changed", onSettings);
    window.addEventListener("cb-screen", onScreen);
    window.addEventListener("cb-profile-mutated", onMutate);
    return () => {
      window.removeEventListener("cb-settings-changed", onSettings);
      window.removeEventListener("cb-screen", onScreen);
      window.removeEventListener("cb-profile-mutated", onMutate);
    };
  }, []);

  const plazaOn = !classic && !dueling;

  useEffect(() => {
    const app = document.getElementById("app");
    if (!app) return;
    app.classList.toggle("city-mode", !classic);
    app.classList.toggle("classic-mode", classic);
    document.documentElement.dataset.classicHub = classic ? "1" : "0";
    document.documentElement.dataset.plaza = plazaOn ? "1" : "0";
  }, [classic, ready, plazaOn]);

  useEffect(() => {
    if (!ready || dueling) return;
    playBed(classic ? "hub" : "city");
  }, [classic, dueling, ready]);

  useEffect(() => {
    const btn = document.getElementById("btn-to-plaza");
    if (!btn) return;
    const go = () => {
      if (loadSettings().hidePlaza) return;
      setClassic(false);
    };
    btn.addEventListener("click", go);
    return () => btn.removeEventListener("click", go);
  }, [ready]);

  const profile = (window as any).__CB?.profile;
  const save = () => {
    (window as any).__CB?.save?.();
    setTick((t) => t + 1);
  };

  const openHubTab = useCallback((tab: string) => {
    setClassic(true);
    requestAnimationFrame(() => {
      const btn = document.querySelector(`[data-tab="${tab}"]`) as HTMLButtonElement | null;
      btn?.click();
    });
  }, []);

  const startRanked = useCallback(() => {
    setClassic(true);
    requestAnimationFrame(() => {
      document.querySelector('[data-tab="ranked"]')?.dispatchEvent(new Event("click", { bubbles: true }));
      requestAnimationFrame(() => {
        const hub = (window as any).__CB?.hub;
        if (hub?.queueRanked?.()) return;
        (document.getElementById("btn-queue") as HTMLButtonElement | null)?.click();
      });
    });
  }, []);

  const startGateDuel = useCallback((gateId: string) => {
    setClassic(true);
    (window as any).__CB?.startGateDuel?.(gateId);
  }, []);

  const startQuickDuel = useCallback(() => {
    (window as any).__CB?.startQuickDuel?.();
  }, []);

  return (
    <>
      <AppChrome hideChrome={plazaOn && ready} />
      {ready && <StarterPick />}
      <DuelBoardMount />
      {ready && profile && (
        <CityApp
          key={tick}
          profile={profile}
          save={save}
          hidden={classic || dueling}
          onClassicHub={() => setClassic(true)}
          onOpenHubTab={openHubTab}
          onStartGateDuel={startGateDuel}
          onStartRanked={startRanked}
          onQuickDuel={startQuickDuel}
        />
      )}
    </>
  );
}

createRoot(document.getElementById("react-root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
