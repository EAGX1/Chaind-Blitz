import { useCallback, useEffect, useState } from "react";
import { BattleCity } from "./BattleCity";
import { BUILDINGS } from "./buildings";
import { BuildingPanel } from "./BuildingPanel";
import { InteriorWalk } from "./InteriorWalk";
import { PlazaChat } from "./PlazaChat";
import { tierName } from "../../meta/pools.js";
import { puzzleOfTheDay } from "../../meta/labs.js";
import { connectPlaza, disconnect, setPlazaName, onPlazaInvite } from "../../meta/plazaNet.js";
import { confirmDialog } from "../../ui/confirmDialog.js";

type Props = {
  profile: any;
  save: () => void;
  onClassicHub: () => void;
  onOpenHubTab: (tab: string) => void;
  onStartGateDuel: (gateId: string) => void;
  onStartRanked: () => void;
  onStartRankedPvp?: () => void;
  onQuickDuel: () => void;
  hidden?: boolean;
};

export function CityApp({
  profile,
  save,
  onClassicHub,
  onOpenHubTab,
  onStartGateDuel,
  onStartRanked,
  onStartRankedPvp,
  onQuickDuel,
  hidden,
}: Props) {
  const [building, setBuilding] = useState<string | null>(null);
  const [walkIn, setWalkIn] = useState<string | null>(null);
  const reduced =
    !!profile?.settings?.reducedMotion ||
    document.documentElement.dataset.reducedMotion === "1";

  const close = useCallback(() => setBuilding(null), []);

  useEffect(() => {
    setPlazaName(profile?.name || "Duelist");
    connectPlaza();
    const off = onPlazaInvite(async (msg: { code?: string; name?: string }) => {
      if (!msg?.code) return;
      const ok = await confirmDialog({
        title: "Duel invite",
        body: `${msg.name || "A duelist"} invited you to room ${msg.code}.`,
        confirm: "JOIN",
        cancel: "IGNORE"
      });
      if (ok) {
        window.dispatchEvent(new CustomEvent("cb-join-room", { detail: { code: msg.code } }));
      }
    });
    return () => { off(); disconnect(); };
  }, [profile?.name]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (building) setBuilding(null);
        else if (walkIn) setWalkIn(null);
      }
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [building, walkIn]);

  if (hidden) return null;

  return (
    <div className={`city-root${building || walkIn ? " has-panel" : ""}`}>
      <BattleCity
        reducedMotion={reduced}
        panelOpen={!!building || !!walkIn}
        suspendCanvas={!!walkIn && !building}
        onEnterBuilding={(id) => {
          if (reduced) setBuilding(id);
          else setWalkIn(id);
        }}
        onOpenKiosk={(tab) => {
          if (tab === "puzzle") {
            onStartGateDuel("puzzle");
            return;
          }
          onClassicHub();
          onOpenHubTab(tab);
        }}
        onOpenClassicHub={onClassicHub}
        onQuickDuel={onQuickDuel}
        plazaCta={{
          kind: profile?.soloGates?.tutorialSeen ? "puzzle" : "quick",
          puzzleLabel: puzzleOfTheDay().label,
        }}
        wallet={{
          gems: profile?.gems ?? 0,
          coins: profile?.coins ?? 0,
          rank: `${tierName(profile?.rank?.tier || 0)} · ${profile?.rank?.lp ?? 0} LP`,
        }}
      />
      <PlazaChat />
      {walkIn && !building && (
        <InteriorWalk
          buildingId={walkIn}
          label={BUILDINGS.find((b) => b.id === walkIn)?.label || walkIn}
          onOpenDesk={() => setBuilding(walkIn)}
          onExit={() => setWalkIn(null)}
        />
      )}
      {building && (
        <BuildingPanel
          buildingId={building}
          label={BUILDINGS.find((b) => b.id === building)?.label || building}
          profile={profile}
          save={save}
          onClose={close}
          onStartGateDuel={onStartGateDuel}
          onStartRanked={onStartRanked}
          onStartRankedPvp={onStartRankedPvp}
          onOpenHubTab={(tab) => {
            close();
            setWalkIn(null);
            onClassicHub();
            onOpenHubTab(tab);
          }}
        />
      )}
    </div>
  );
}

