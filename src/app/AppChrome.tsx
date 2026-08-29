import { useEffect, useState } from "react";
import { AI_BUDGETS, type AiTier } from "../ai/budgets";
import { ThreeBackdrop } from "./ThreeBackdrop";
import { cloudPull, cloudPush, deviceId, fetchBanlist } from "../meta/backendClient.js";
import { bindSettings, applyVolumes, playBed } from "../meta/music.js";
import { exportSaveJson, importSaveJson } from "../meta/backups.js";
import { t, setLocale } from "../meta/i18n.js";
import { openReplayScrubber } from "../ui/replayScrubber.js";
import {
  loadSettings,
  saveSettings,
  applySettingsToDom,
  CHAIN_MODES,
  UI_SCALES,
  FX_SPEEDS,
} from "../ui/settingsStore.js";
import { fxSpeedLabel } from "../ui/fxPace.js";
import { confirmDialog } from "../ui/confirmDialog.js";
import {
  applyDevWallet,
  grantSandboxCollection,
  setMaxRank,
} from "../meta/campaign.js";
import { resetProfile } from "../meta/profile.js";

type Settings = ReturnType<typeof loadSettings> & { aiTier: AiTier; cloudSync: boolean };

function emitSettingsChanged(s: Settings) {
  window.dispatchEvent(new CustomEvent("cb-settings-changed", { detail: s }));
}

export function AppChrome({ hideChrome = false }: { hideChrome?: boolean }) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(() => loadSettings() as Settings);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [cloudMsg, setCloudMsg] = useState("");
  const [backupMsg, setBackupMsg] = useState("");
  const [devMsg, setDevMsg] = useState("");

  useEffect(() => {
    const s = applySettingsToDom(settings);
    setLocale(s.locale || "en");
    (window as unknown as { __CB_SETTINGS?: Settings }).__CB_SETTINGS = s as Settings;
    bindSettings(s);
    applyVolumes();
  }, [settings]);

  useEffect(() => {
    const onSet = () => openSettings();
    const onGloss = () => setGlossaryOpen(true);
    window.addEventListener("cb-open-settings", onSet);
    window.addEventListener("cb-open-glossary", onGloss);
    return () => {
      window.removeEventListener("cb-open-settings", onSet);
      window.removeEventListener("cb-open-glossary", onGloss);
    };
  }, []);

  useEffect(() => {
    if (!settings.cloudSync) return;
    fetchBanlist().then((b) => {
      if (b) (window as unknown as { __CB_BANLIST?: unknown }).__CB_BANLIST = b;
    });
  }, [settings.cloudSync]);

  function patch(partial: Partial<Settings>) {
    const live = (window as unknown as { __CB?: { profile?: object } }).__CB?.profile;
    const next = saveSettings(partial, live) as Settings;
    if (partial.locale != null) setLocale(next.locale || "en");
    setSettings(next);
    applySettingsToDom(next);
    emitSettingsChanged(next);
    if (partial.music != null || partial.sfx != null || partial.musicMuted != null || partial.sfxMuted != null) {
      bindSettings(next);
      applyVolumes();
    }
    return next;
  }

  function openSettings() {
    setOpen(true);
    const s = loadSettings() as Settings;
    if (s.music > 0) {
      const city = document.getElementById("app")?.classList.contains("city-mode");
      playBed(city ? "city" : "hub", s);
    }
  }

  function openLastReplay() {
    const json = (window as unknown as { __CB?: { exportLastReplay?: () => string | null } }).__CB?.exportLastReplay?.();
    if (!json) {
      setBackupMsg("No replay yet — finish a duel first.");
      return;
    }
    openReplayScrubber(json);
  }

  const budget = AI_BUDGETS[(settings.aiTier as AiTier) || "normal"];

  async function syncNow() {
    const profile = (window as unknown as { __CB?: { profile: unknown } }).__CB?.profile;
    if (!profile) {
      setCloudMsg("No local profile yet.");
      return;
    }
    const pushed = await cloudPush(deviceId(), profile);
    setCloudMsg(pushed ? "Cloud save updated." : "Backend offline — local save still works.");
  }

  async function pullNow() {
    const row = await cloudPull(deviceId());
    if (!row?.profile) {
      setCloudMsg("No cloud save (or backend offline).");
      return;
    }
    localStorage.setItem("chaind-blitz-save-v1", JSON.stringify(row.profile));
    setCloudMsg("Cloud profile pulled — reload to apply.");
  }

  function exportBackup() {
    const json = exportSaveJson();
    if (!json) {
      setBackupMsg("Nothing to export.");
      return;
    }
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `chaind-blitz-save-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setBackupMsg("Save exported.");
  }

  function liveProfile() {
    return (window as unknown as { __CB?: { profile: Record<string, unknown>; save?: () => void } }).__CB;
  }

  function persistProfile() {
    const cb = liveProfile();
    cb?.save?.();
    window.dispatchEvent(new Event("cb-profile-mutated"));
  }

  function toggleDevMode(on: boolean) {
    patch({ devMode: on });
    const cb = liveProfile();
    if (!cb?.profile) return;
    cb.profile.devCheats = on;
    if (on) applyDevWallet(cb.profile);
    persistProfile();
    setDevMsg(on ? "Dev wallet is on — gems, coins, and dust stay full." : "Dev wallet off. Current amounts stay as they are.");
  }

  function fillDevWallet() {
    const cb = liveProfile();
    if (!cb?.profile) return;
    cb.profile.devCheats = true;
    applyDevWallet(cb.profile);
    persistProfile();
    setDevMsg("Wallet filled.");
  }

  function unlockAllCards() {
    const cb = liveProfile();
    if (!cb?.profile) return;
    grantSandboxCollection(cb.profile);
    persistProfile();
    setDevMsg("Playset of every card granted.");
  }

  function maxRank() {
    const cb = liveProfile();
    if (!cb?.profile) return;
    setMaxRank(cb.profile);
    persistProfile();
    setDevMsg("Rank set to Master — full pack pool.");
  }

  async function resetAccount() {
    const ok = await confirmDialog({
      title: "Reset account?",
      body: "You will pick Ignis, Abyss, or Terra again. Rank, collection, and decks are wiped. This cannot be undone.",
      confirm: "RESET",
      cancel: "KEEP",
      danger: true,
    });
    if (!ok) return;
    const s = loadSettings();
    const live = liveProfile()?.profile;
    resetProfile({ settings: s, devCheats: !!s.devMode, into: live });
    window.location.reload();
  }

  function importBackup() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const ok = importSaveJson(text);
        setBackupMsg(ok ? "Imported — reload to apply." : "Import failed (bad JSON).");
      } catch {
        setBackupMsg("Import failed.");
      }
    };
    input.click();
  }

  return (
    <>
      <ThreeBackdrop reducedMotion={!!settings.reducedMotion} />
      {!hideChrome ? (
        <div className="cb-chrome">
          <button type="button" className="cb-chrome-btn" onClick={() => (open ? setOpen(false) : openSettings())} title={t("hub.settings")}>
            ⚙
          </button>
          <button type="button" className="cb-chrome-btn" onClick={() => setGlossaryOpen((v) => !v)} title="Glossary">
            ?
          </button>
          <button type="button" className="cb-chrome-btn cb-replay" onClick={openLastReplay} title="Duel log">
            ▶
          </button>
          <span className="cb-version">v0.2 · offline</span>
        </div>
      ) : null}

      {open && (
        <div className="cb-modal" role="dialog" aria-label={t("hub.settings")}>
          <div className="cb-modal-card">
            <h2>{t("hub.settings")}</h2>
            <label>
              AI difficulty
              <select
                value={settings.aiTier || "normal"}
                onChange={(e) => patch({ aiTier: e.target.value as AiTier })}
              >
                {(Object.keys(AI_BUDGETS) as AiTier[]).map((tier) => (
                  <option key={tier} value={tier}>{tier} ({AI_BUDGETS[tier].ms}ms)</option>
                ))}
              </select>
            </label>
            <p className="cb-hint">
              Board heuristic — not a search. {budget.label}: {budget.feel}
            </p>
            <label>
              {t("settings.uiScale")}
              <select
                value={String(settings.uiScale)}
                onChange={(e) => patch({ uiScale: Number(e.target.value) })}
              >
                {UI_SCALES.map((s) => (
                  <option key={s} value={s}>{s}×</option>
                ))}
              </select>
            </label>
            <label>
              {t("settings.chainMode")}
              <select
                value={settings.chainMode}
                onChange={(e) => patch({ chainMode: e.target.value })}
              >
                {CHAIN_MODES.map((m) => (
                  <option key={m} value={m}>{t(`chain.${m}`)}</option>
                ))}
              </select>
            </label>
            <p className="cb-hint">
              {settings.chainMode === "smart"
                ? "Smart skips empty and low-threat windows. Confirm always asks."
                : settings.chainMode === "confirm"
                  ? "Confirm asks every time you have a legal response."
                  : settings.chainMode === "auto" || settings.chainMode === "off"
                    ? "Auto / Off never prompts — you will not chain."
                    : null}
            </p>
            <label>
              {t("settings.fxSpeed")}
              <select
                value={String(settings.fxSpeed ?? 1)}
                onChange={(e) => patch({ fxSpeed: Number(e.target.value) })}
              >
                {FX_SPEEDS.map((s) => (
                  <option key={s} value={s}>{fxSpeedLabel(s)}</option>
                ))}
              </select>
            </label>
            <p className="cb-hint">{t("settings.fxSpeedHint")}</p>
            <div className="cb-vol-row">
              <label>
                {t("settings.music")}
                <input type="range" min={0} max={1} step={0.05} value={settings.music}
                  onChange={(e) => patch({ music: Number(e.target.value) })} />
              </label>
              <button type="button" className="cb-btn" onClick={() => patch({ musicMuted: !settings.musicMuted })}>
                {settings.musicMuted ? t("settings.unmute") : t("settings.mute")}
              </button>
            </div>
            <div className="cb-vol-row">
              <label>
                {t("settings.sfx")}
                <input type="range" min={0} max={1} step={0.05} value={settings.sfx}
                  onChange={(e) => patch({ sfx: Number(e.target.value) })} />
              </label>
              <button type="button" className="cb-btn" onClick={() => patch({ sfxMuted: !settings.sfxMuted })}>
                {settings.sfxMuted ? t("settings.unmute") : t("settings.mute")}
              </button>
            </div>
            <label className="cb-check">
              <input type="checkbox" checked={settings.cpuIntent !== false}
                onChange={(e) => patch({ cpuIntent: e.target.checked })} />
              CPU telegraph (show the opponent's intended play)
            </label>
            <label className="cb-check">
              <input type="checkbox" checked={!!settings.board3d}
                onChange={(e) => patch({ board3d: e.target.checked })} />
              {t("settings.board3d")}
            </label>
            <label className="cb-check">
              <input type="checkbox" checked={!!settings.colorblind}
                onChange={(e) => patch({ colorblind: e.target.checked })} />
              {t("settings.colorblind")}
            </label>
            <label className="cb-check">
              <input type="checkbox" checked={!!settings.classicHub}
                onChange={(e) => patch({ classicHub: e.target.checked })} />
              Classic hub
            </label>
            <label className="cb-check">
              <input type="checkbox" checked={!!settings.hidePlaza}
                onChange={(e) => patch({ hidePlaza: e.target.checked, classicHub: e.target.checked ? true : settings.classicHub })} />
              {t("settings.hidePlaza")}
            </label>
            <label className="cb-check">
              <input type="checkbox" checked={!!settings.reducedMotion}
                onChange={(e) => patch({ reducedMotion: e.target.checked })} />
              {t("settings.reducedMotion")}
            </label>
            <label className="cb-check">
              <input type="checkbox" checked={!!settings.cloudSync}
                onChange={(e) => patch({ cloudSync: e.target.checked })} />
              Opt-in cloud features (optional backend)
            </label>
            <label className="cb-check">
              <input type="checkbox" checked={!!settings.devMode}
                onChange={(e) => toggleDevMode(e.target.checked)} />
              Dev Mode (unlimited wallet, test tools, banlist editor)
            </label>
            {settings.devMode && (
              <div className="cb-dev-tools">
                <p className="cb-hint">Local test account. Packs and ranks still work — the wallet just never runs dry.</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" className="cb-btn" onClick={fillDevWallet}>Fill wallet</button>
                  <button type="button" className="cb-btn" onClick={unlockAllCards}>Unlock all cards</button>
                  <button type="button" className="cb-btn" onClick={maxRank}>Max rank</button>
                </div>
                {devMsg && <p className="cb-hint">{devMsg}</p>}
              </div>
            )}
            {settings.cloudSync && (
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="cb-btn" onClick={syncNow}>Push save</button>
                <button type="button" className="cb-btn" onClick={pullNow}>Pull save</button>
              </div>
            )}
            {cloudMsg && <p className="cb-hint">{cloudMsg}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <button type="button" className="cb-btn" onClick={exportBackup}>Export save</button>
              <button type="button" className="cb-btn" onClick={importBackup}>Import save</button>
              <button type="button" className="cb-btn" onClick={openLastReplay}>Duel log</button>
              <button type="button" className="cb-btn danger" onClick={() => { void resetAccount(); }}>Reset account</button>
            </div>
            {backupMsg && <p className="cb-hint">{backupMsg}</p>}
            <button type="button" className="cb-btn" onClick={() => setOpen(false)}>{t("common.close")}</button>
          </div>
        </div>
      )}

      {glossaryOpen && (
        <div className="cb-modal" role="dialog" aria-label="Glossary">
          <div className="cb-modal-card wide">
            <h2>Glossary</h2>
            <ul className="cb-glossary">
              <li><b>Normal Summon</b> — exactly one per turn.</li>
              <li><b>Special Summon</b> — unlimited; never consumes the Normal Summon slot.</li>
              <li><b>Contact Fusion</b> — send field materials to GY; SS from Extra (no spell).</li>
              <li><b>Fusion ladder</b> — fusions can be materials for higher fusions (OPT per id).</li>
              <li><b>Ward</b> — must be attacked if able.</li>
              <li><b>Drain</b> — damage dealt also heals your LP.</li>
              <li><b>Ambush</b> — set face-down in MZ; flip on attack or effect.</li>
              <li><b>Rush</b> — can attack the turn summoned/evolved (not on the going-first player&apos;s first turn).</li>
              <li><b>First turn</b> — whoever goes first cannot attack that turn (Yu-Gi-Oh rule). Battle Phase and Main Phase 2 are both skipped.</li>
              <li><b>EP</b> — Evolution Points. First player starts with 2, second player with 3. Evolve unlocks on your 3rd own turn.</li>
              <li><b>Hand trap</b> — printed Quick/Counter from hand on opponent&apos;s turn.</li>
              <li><b>Fanfare</b> — optional trigger when summoned. Lane draws happen after, so they do not eat the window. Misses if a cost, tribute, or CL2+ death was already the last thing to happen.</li>
              <li><b>Contact</b> — send listed materials to GY; Special Summon from Extra. No Fusion Spell.</li>
              <li><b>Damage Step</b> — five windows: Start, Before calc, During calc (Surge Imp), After calc, End. SS3 Counters may answer; generic SS2 Quicks may not.</li>
            </ul>
            <button type="button" className="cb-btn" onClick={() => setGlossaryOpen(false)}>{t("common.close")}</button>
          </div>
        </div>
      )}
    </>
  );
}
