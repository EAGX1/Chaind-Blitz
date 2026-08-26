import { useState } from "react";
import { CATALOG, buyCosmetic, equipCosmetic, readLocalMatFile, applyEquippedToDom, loadCustomMatUrl } from "../../meta/cosmetics.js";
import { readLocalAvatarFile } from "../../meta/avatarCutout.js";
import { GATES, isUnlocked, clearGate } from "../../meta/soloGates.js";
import { canClaim, claimToday } from "../../meta/loginCalendar.js";
import { claimTier } from "../../meta/duelPass.js";
import { rollDailies, claim as claimMission, missionStatus, progress as missionProgress } from "../../meta/missions.js";
import { LABS, isLabCleared, allLabsCleared, isFirstFarer, puzzleOfTheDay } from "../../meta/labs.js";
import { openPack, grantCards, PACK_COST_GEMS } from "../../meta/packs.js";
import { spendGems, canAffordGems } from "../../meta/campaign.js";
import { poolForTier } from "../../meta/pools.js";
import { makeRng } from "../../engine/rng.js";
import { slamPackCards, packRecapLine } from "../../ui/packSlam.js";

type Props = {
  buildingId: string;
  label: string;
  profile: any;
  save: () => void;
  onClose: () => void;
  onStartGateDuel: (gateId: string) => void;
  onStartRanked: () => void;
  onOpenHubTab: (tab: string) => void;
};

export function BuildingPanel(props: Props) {
  const {
    buildingId, label, profile, save, onClose,
    onStartGateDuel, onStartRanked, onOpenHubTab,
  } = props;
  const [msg, setMsg] = useState("");

  let body: React.ReactNode = <p className="dim">Unknown building.</p>;

  if (buildingId === "pack_shop") {
    body = (
      <div className="bp-body">
        <p className="dim bp-kicker">Night stall · 10 cards · UR pity in {10 - (profile.packPity || 0)} pack(s)</p>
        <p>Gems: <b>{profile.gems}</b></p>
        <button
          type="button"
          className="cb-btn primary bp-cta"
          onClick={() => {
            if (!spendGems(profile, PACK_COST_GEMS)) { setMsg("Not enough gems."); return; }
            const cards = openPack(makeRng(Date.now() >>> 0), poolForTier(profile.rank?.tier || 0), profile).filter(Boolean);
            grantCards(profile, cards);
            slamPackCards(null, cards, { width: 128 });
            save();
            setMsg(packRecapLine(cards) || `Opened pack — ${cards.length} cards`);
          }}
          disabled={!canAffordGems(profile, PACK_COST_GEMS)}
        >
          OPEN PACK (100 ◆)
        </button>
      </div>
    );
  } else if (buildingId === "boutique") {
    body = (
      <div className="bp-body">
        <p className="dim">Coins: {profile.coins}</p>
        <div className="boutique-grid">
          {CATALOG.map((item: any) => {
            const owned = (profile.cosmeticsOwned || []).includes(item.id);
            return (
              <div key={item.id} className="boutique-card">
                <b>{item.icon} {item.name}</b>
                <span className="dim">{item.slot} · {item.coins || 0}c</span>
                <button
                  type="button"
                  className="cb-btn primary"
                  onClick={() => {
                    if (owned) {
                      if (item.slot === "emote") {
                        setMsg("Emotes fire from the in-duel wheel — already owned.");
                      } else {
                        const r = equipCosmetic(profile, item.slot, item.id);
                        setMsg(r?.ok ? `Equipped ${item.name}` : (r?.reason || "Cannot equip"));
                      }
                    } else {
                      const r = buyCosmetic(profile, item.id);
                      setMsg(r?.ok === false ? (r.reason || "Cannot buy") : `Bought ${item.name}`);
                    }
                    save();
                  }}
                >
                  {owned ? "EQUIP" : "BUY"}
                </button>
                {item.id === "mat_custom" && owned && (
                  <label className="dim">
                    Local image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          await readLocalMatFile(file);
                          equipCosmetic(profile, "mat", "mat_custom");
                          applyEquippedToDom(profile);
                          save();
                          setMsg(loadCustomMatUrl() ? "Custom mat loaded" : "Could not keep image");
                        } catch (err) {
                          setMsg(err instanceof Error ? err.message : "Could not load image");
                        }
                      }}
                    />
                  </label>
                )}
                {item.id === "avatar_custom" && owned && (
                  <label className="dim">
                    Character PNG
                    <input
                      type="file"
                      accept="image/png,image/webp,image/jpeg,image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          await readLocalAvatarFile(file);
                          equipCosmetic(profile, "avatar", "avatar_custom");
                          applyEquippedToDom(profile);
                          save();
                          setMsg("Character PNG stood in the plaza");
                        } catch (err) {
                          setMsg(err instanceof Error ? err.message : "Could not load PNG");
                        }
                      }}
                    />
                  </label>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  } else if (buildingId === "solo_gates") {
    body = (
      <div className="bp-body">
        <ul className="gate-list">
          {GATES.map((g: any) => {
            const unlocked = isUnlocked(profile, g.id);
            const done = !!profile.soloGates?.cleared?.[g.id];
            return (
              <li key={g.id} className={done ? "done" : unlocked ? "" : "locked"}>
                <div>
                  <b>{g.label}</b>
                  <p className="dim">{g.hint}</p>
                </div>
                {done ? <span className="tag">CLEARED</span> : unlocked ? (
                  <button
                    type="button"
                    className="cb-btn primary bp-cta"
                    onClick={() => {
                      if (g.id === "gate4") {
                        clearGate(profile, "gate4");
                        save();
                        onStartRanked();
                      } else if (g.id === "gate5") {
                        onStartRanked();
                      } else if (g.id === "gate6") {
                        if ((profile.rank?.tier || 0) >= 1) {
                          clearGate(profile, "gate6");
                          save();
                        } else onStartRanked();
                      } else onStartGateDuel(g.id);
                    }}
                  >
                    {g.id === "gate4" ? "VISIT" : g.id === "gate5" ? "QUEUE" : g.id === "gate6" ? ((profile.rank?.tier || 0) >= 1 ? "CLAIM" : "CLIMB") : "DUEL"}
                  </button>
                ) : <span className="tag">LOCKED</span>}
              </li>
            );
          })}
        </ul>
        <button type="button" className="cb-btn primary bp-cta" onClick={() => onStartGateDuel("puzzle")}>
          PUZZLE OF THE DAY · {puzzleOfTheDay().label}
        </button>
        {LABS.map((lab) => {
          const done = isLabCleared(profile, lab.id);
          return (
            <button
              key={lab.id}
              type="button"
              className="cb-btn"
              onClick={() => onStartGateDuel(lab.id)}
            >
              {done ? "CLEARED · " : ""}LABS: {lab.label}
            </button>
          );
        })}
        {allLabsCleared(profile) && (
          <p className="dim" style={{ marginTop: 8 }}>
            <b>First Farer</b> — all Labs cleared. The teaching path is complete.
          </p>
        )}
        <button type="button" className="cb-btn" onClick={() => onOpenHubTab("rulebook")}>Tutorials / Rulebook</button>
      </div>
    );
  } else if (buildingId === "coliseum") {
    rollDailies(profile);
    body = (
      <div className="bp-body">
        <p>Rank tier {profile.rank?.tier ?? 0} · LP {profile.rank?.lp ?? 0}</p>
        <p>Pass XP: {profile.duelPass?.xp ?? 0}</p>
        {allLabsCleared(profile) && (
          <p>
            <b>First Farer</b>
            <span className="dim"> — {isFirstFarer(profile) ? "all Labs cleared." : "Labs complete."}</span>
          </p>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="cb-btn primary bp-cta" onClick={onStartRanked}>QUEUE RANKED · VS CPU</button>
          <button
            type="button"
            className="cb-btn"
            disabled={!canClaim(profile)}
            onClick={() => {
              const r = claimToday(profile);
              if (r?.ok) missionProgress(profile, "login");
              setMsg(r?.ok === false ? (r.reason || "Already claimed") : "Login reward claimed!");
              save();
            }}
          >
            {canClaim(profile) ? "CLAIM LOGIN" : "LOGIN CLAIMED"}
          </button>
          <button
            type="button"
            className="cb-btn"
            onClick={() => {
              const r = claimTier(profile);
              setMsg(r?.ok ? `Claimed pass tier ${r.tier}` : (r?.reason || "Nothing to claim"));
              save();
            }}
          >
            CLAIM PASS
          </button>
        </div>
        <h3>Dailies</h3>
        <ul>
          {missionStatus(profile).dailies.map((d) => (
            <li key={d.id}>
              {d.label} ({d.have}/{d.goal}){" "}
              <button
                type="button"
                className="cb-btn"
                disabled={!d.done || d.claimed}
                onClick={() => {
                  const r = claimMission(profile, d.id);
                  setMsg(r?.ok ? "Daily claimed" : (r?.reason || "Not complete"));
                  save();
                }}
              >
                {d.claimed ? "CLAIMED" : d.done ? "CLAIM" : "IN PROGRESS"}
              </button>
            </li>
          ))}
        </ul>
        <h3>Achievements</h3>
        <ul>
          {missionStatus(profile).achievements.map((a) => (
            <li key={a.id}>
              {a.label} ({a.have}/{a.goal}){" "}
              <button
                type="button"
                className="cb-btn"
                disabled={!a.done || a.claimed}
                onClick={() => {
                  const r = claimMission(profile, a.id);
                  setMsg(r?.ok ? "Achievement claimed" : (r?.reason || "Not complete"));
                  save();
                }}
              >
                {a.claimed ? "CLAIMED" : a.done ? "CLAIM" : "IN PROGRESS"}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <>
      <div className="building-panel-scrim" onClick={onClose} aria-hidden="true" />
      <div
        className={`building-panel room room-${buildingId}`}
        data-room={buildingId}
        role="dialog"
        aria-label={label}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bp-inner">
          <header>
            <h2>{label}</h2>
            <button type="button" className="cb-btn bp-leave" onClick={onClose} aria-label="Leave building">LEAVE</button>
          </header>
          {msg && <p className="bp-msg">{msg}</p>}
          <div className="bp-room-body">{body}</div>
        </div>
      </div>
    </>
  );
}
