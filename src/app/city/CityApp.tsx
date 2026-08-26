import { useCallback, useEffect, useState } from "react";
import { BattleCity } from "./BattleCity";
import { BUILDINGS } from "./buildings";
import { BuildingPanel } from "./BuildingPanel";
import { tierName } from "../../meta/pools.js";

type Props = {
  profile: any;
  save: () => void;
  onClassicHub: () => void;
  onOpenHubTab: (tab: string) => void;
  onStartGateDuel: (gateId: string) => void;
  onStartRanked: () => void;
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
  onQuickDuel,
  hidden,
}: Props) {
  const [building, setBuilding] = useState<string | null>(null);
  const reduced =
    !!profile?.settings?.reducedMotion ||
    document.documentElement.dataset.reducedMotion === "1";

  const close = useCallback(() => setBuilding(null), []);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (building) setBuilding(null);
      }
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [building]);

  if (hidden) return null;

  return (
    <div className={`city-root${building ? " has-panel" : ""}`}>
      <BattleCity
        reducedMotion={reduced}
        panelOpen={!!building}
        onEnterBuilding={(id) => setBuilding(id)}
        onOpenKiosk={(tab) => {
          onClassicHub();
          onOpenHubTab(tab);
        }}
        onOpenClassicHub={onClassicHub}
        onQuickDuel={onQuickDuel}
        wallet={{
          gems: profile?.gems ?? 0,
          coins: profile?.coins ?? 0,
          rank: `${tierName(profile?.rank?.tier || 0)} · ${profile?.rank?.lp ?? 0} LP`,
        }}
      />
      {building && (
        <BuildingPanel
          buildingId={building}
          label={BUILDINGS.find((b) => b.id === building)?.label || building}
          profile={profile}
          save={save}
          onClose={close}
          onStartGateDuel={onStartGateDuel}
          onStartRanked={onStartRanked}
          onOpenHubTab={(tab) => {
            close();
            onClassicHub();
            onOpenHubTab(tab);
          }}
        />
      )}
    </div>
  );
}
