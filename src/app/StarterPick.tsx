import { useEffect, useState } from "react";
import { applyStarter, needsStarterPick, starterChoices } from "../meta/campaign.js";

function bumpProfile() {
  window.dispatchEvent(new Event("cb-profile-mutated"));
}

export function StarterPick() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const p = (window as unknown as { __CB?: { profile?: unknown } }).__CB?.profile;
    setOpen(!!p && needsStarterPick(p));
  }, []);

  if (!open) return null;

  const choices = starterChoices();

  function pick(id: string) {
    const cb = (window as unknown as {
      __CB?: { profile?: unknown; save?: () => void };
    }).__CB;
    if (!cb?.profile) return;
    applyStarter(cb.profile, id);
    cb.save?.();
    bumpProfile();
    setOpen(false);
  }

  return (
    <div className="cb-modal cb-starter-overlay" role="dialog" aria-label="Choose your first deck">
      <div className="cb-modal-card cb-starter-card">
        <h2>Choose your first deck</h2>
        <p className="cb-hint">
          One legal 40-card list to start. Packs and ranks unlock the rest of the pool over time.
        </p>
        <div className="cb-starter-grid">
          {choices.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`cb-starter-choice tribe-${s.id}`}
              onClick={() => pick(s.id)}
            >
              <b>{s.name}</b>
              <span>{s.desc}</span>
              <em>Play this deck</em>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
