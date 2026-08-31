import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CityEnvironment } from "./CityEnvironment";
import { CityBuildings, isBuildingId } from "./CityBuildings";
import { BUILDINGS, KIOSKS } from "./buildings";
import { PlazaPresence } from "./PlazaPresence";
import { CharacterBillboard, usePlazaAvatar } from "./CharacterBillboard";
import { readLocalAvatarFile } from "../../meta/avatarCutout.js";
import { sendMove } from "../../meta/plazaNet.js";
import { t } from "../../meta/i18n.js";
import { plazaClock, setClockMode, clockLabel, type ClockMode } from "./plazaTime";
import { puzzleOfTheDay } from "../../meta/labs.js";

const NEAR_RADIUS = 6;
const PLAZA_CAM = { position: [0, 4.8, 11.5] as [number, number, number], fov: 50 };
const POI_XZ: { id: string; x: number; z: number }[] = [
  ...BUILDINGS.map((b) => ({ id: b.id, x: b.position[0], z: b.position[2] })),
  ...KIOSKS.map((k) => ({ id: k.id, x: k.position[0], z: k.position[2] })),
];

type Props = {
  reducedMotion: boolean;
  panelOpen?: boolean;
  /** Drop the plaza WebGL canvas so an interior can take the only GPU context. */
  suspendCanvas?: boolean;
  onEnterBuilding: (id: string) => void;
  onOpenKiosk: (tab: string) => void;
  onOpenClassicHub: () => void;
  onQuickDuel: () => void;
  plazaCta?: { kind: "puzzle" | "quick"; puzzleLabel: string };
  wallet?: { gems: number; coins: number; rank: string };
};

export function DuelAvatar({
  groupRef,
  url,
  aspect,
}: {
  groupRef?: RefObject<THREE.Group | null>;
  url: string;
  aspect: number;
}) {
  return <CharacterBillboard groupRef={groupRef} url={url} aspect={aspect} />;
}

function FitPlaza() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  useLayoutEffect(() => {
    const host = gl.domElement.parentElement;
    if (!host) return;
    const apply = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (w < 1 || h < 1) return;
      gl.setSize(w, h, false);
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(host);
    const onWin = () => apply();
    window.addEventListener("resize", onWin);
    window.visualViewport?.addEventListener("resize", onWin);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onWin);
      window.visualViewport?.removeEventListener("resize", onWin);
    };
  }, [gl, camera]);
  return null;
}

function GroundNav({
  enabled,
  onPoint,
}: {
  enabled: boolean;
  onPoint: (x: number, z: number) => void;
}) {
  if (!enabled) return null;
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.01, 0]}
      onPointerDown={(e) => {
        e.stopPropagation();
        onPoint(e.point.x, e.point.z);
      }}
    >
      <planeGeometry args={[70, 70]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

function PlayerRig({
  reducedMotion,
  walkTarget,
  onNear,
  avatarUrl,
  avatarAspect,
}: {
  reducedMotion: boolean;
  walkTarget: RefObject<{ x: number; z: number } | null>;
  onNear: (id: string | null) => void;
  avatarUrl: string;
  avatarAspect: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const pos = useRef(new THREE.Vector3(0, 0, 6));
  const keys = useRef<Record<string, boolean>>({});
  const { camera } = useThree();
  const moveAcc = useRef(0);
  const lastNear = useRef<string | null>(null);
  const camTarget = useMemo(() => new THREE.Vector3(), []);
  const lookTarget = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => { keys.current[e.code] = true; };
    const up = (e: KeyboardEvent) => { keys.current[e.code] = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useLayoutEffect(() => {
    groupRef.current?.position.set(pos.current.x, 0, pos.current.z);
  }, []);

  useFrame((_, dt) => {
    if (reducedMotion) {
      camera.position.set(0, 8.5, 14);
      camera.lookAt(0, 0.6, 0);
      if (lastNear.current !== null) {
        lastNear.current = null;
        onNear(null);
      }
      return;
    }

    const step = Math.min(dt, 0.05);
    const speed = 8;
    const k = keys.current;
    const forward = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
    const strafe = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
    if (forward || strafe) {
      walkTarget.current = null;
      pos.current.x += strafe * speed * step;
      pos.current.z -= forward * speed * step;
    } else if (walkTarget.current) {
      const tx = walkTarget.current.x - pos.current.x;
      const tz = walkTarget.current.z - pos.current.z;
      const dist = Math.hypot(tx, tz);
      if (dist < 0.35) walkTarget.current = null;
      else {
        pos.current.x += (tx / dist) * speed * step;
        pos.current.z += (tz / dist) * speed * step;
      }
    }
    pos.current.x = THREE.MathUtils.clamp(pos.current.x, -28, 28);
    pos.current.z = THREE.MathUtils.clamp(pos.current.z, -28, 28);

    if (groupRef.current) {
      groupRef.current.position.set(pos.current.x, 0, pos.current.z);
    }

    camTarget.set(pos.current.x, 4.55, pos.current.z + 7.1);
    camera.position.lerp(camTarget, 1 - Math.exp(-8 * step));
    lookTarget.set(pos.current.x, 1.05, pos.current.z);
    camera.lookAt(lookTarget);

    moveAcc.current += step;
    if (moveAcc.current > 0.1) {
      moveAcc.current = 0;
      sendMove(pos.current.x, pos.current.z);
    }

    let best: string | null = null;
    let bestD = NEAR_RADIUS;
    for (const p of POI_XZ) {
      const d = Math.hypot(pos.current.x - p.x, pos.current.z - p.z);
      if (d < bestD) { bestD = d; best = p.id; }
    }
    if (best !== lastNear.current) {
      lastNear.current = best;
      onNear(best);
    }
  });

  return <DuelAvatar groupRef={groupRef} url={avatarUrl} aspect={avatarAspect} />;
}

export function BattleCity({
  reducedMotion,
  panelOpen = false,
  suspendCanvas = false,
  onEnterBuilding,
  onOpenKiosk,
  onOpenClassicHub,
  onQuickDuel,
  plazaCta,
  wallet,
}: Props) {
  const [nearId, setNearId] = useState<string | null>(null);
  const [tod, setTod] = useState(clockLabel());
  const [mode, setMode] = useState<ClockMode>(plazaClock.mode);
  const [pngMsg, setPngMsg] = useState("");
  const avatar = usePlazaAvatar();
  const walkTarget = useRef<{ x: number; z: number } | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => {
      const next = clockLabel();
      setTod((prev) => (prev === next ? prev : next));
    }, 500);
    return () => window.clearInterval(id);
  }, []);

  const pickClock = (next: ClockMode) => {
    setClockMode(next);
    setMode(next);
    setTod(clockLabel());
  };

  const nearInfo = useMemo(() => {
    if (!nearId) return { label: "", desc: "" };
    const b = BUILDINGS.find((x) => x.id === nearId);
    const k = KIOSKS.find((x) => x.id === nearId);
    return { label: b?.label || k?.label || "", desc: b?.desc || k?.desc || "" };
  }, [nearId]);

  const enterNear = useCallback(() => {
    if (!nearId || panelOpen) return;
    if (isBuildingId(nearId)) onEnterBuilding(nearId);
    else {
      const k = KIOSKS.find((x) => x.id === nearId);
      if (k) onOpenKiosk(k.tab);
    }
  }, [nearId, panelOpen, onEnterBuilding, onOpenKiosk]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.code !== "KeyE" && e.code !== "Enter" && e.code !== "NumpadEnter") || !nearId || panelOpen) return;
      enterNear();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nearId, panelOpen, enterNear]);

  const teleporter = useMemo(
    () => (
      <div className="city-teleport">
        <p>Reduced motion — jump to a place</p>
        {BUILDINGS.map((b) => (
          <button key={b.id} type="button" onClick={() => onEnterBuilding(b.id)}>{b.label}</button>
        ))}
        {KIOSKS.map((k) => (
          <button key={k.id} type="button" onClick={() => onOpenKiosk(k.tab)}>{k.label}</button>
        ))}
      </div>
    ),
    [onEnterBuilding, onOpenKiosk]
  );

  return (
    <div className="battle-city">
      {!suspendCanvas && (
      <Canvas
        shadows
        camera={PLAZA_CAM}
        dpr={[1, 1.75]}
        resize={{ debounce: 0 }}
        style={{ width: "100%", height: "100%", display: "block" }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.setClearColor("#7ec8f0", 1);
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.12;
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
      >
        <FitPlaza />
        <CityEnvironment reducedMotion={reducedMotion} />
        <GroundNav
          enabled={!reducedMotion && !panelOpen}
          onPoint={(x, z) => { walkTarget.current = { x, z }; }}
        />
        <CityBuildings
          nearId={nearId}
          panelOpen={panelOpen}
          onEnter={(id, kind) => {
            if (panelOpen) return;
            if (kind === "building") onEnterBuilding(id);
            else {
              const k = KIOSKS.find((x) => x.id === id);
              if (k) onOpenKiosk(k.tab);
            }
          }}
        />
        <PlayerRig
          reducedMotion={reducedMotion}
          walkTarget={walkTarget}
          onNear={setNearId}
          avatarUrl={avatar.url}
          avatarAspect={avatar.aspect}
        />
        <PlazaPresence roomCode={typeof window !== "undefined" ? String((window as unknown as { __CB_PVP_CODE?: string }).__CB_PVP_CODE || "") : ""} />
      </Canvas>
      )}

      <div className={`city-hud city-hud-${tod.toLowerCase()}`}>
        <div className="city-brand">
          <b>CHAIND BLITZ</b>
          <span>{t("city.battleCity")}</span>
          {wallet && (
            <div className="city-wallet">
              <em>{wallet.rank}</em>
              <span>{wallet.gems} ◆</span>
              <span>{wallet.coins} ●</span>
            </div>
          )}
        </div>
        <nav className="city-util" aria-label="Plaza utilities">
          <button type="button" className="city-classic" title="Open Deck, Cards, Shop, and Rank menus" onClick={onOpenClassicHub}>Hub</button>
          <button
            type="button"
            className="city-util-btn"
            title={t("hub.settings")}
            aria-label={t("hub.settings")}
            onClick={() => window.dispatchEvent(new CustomEvent("cb-open-settings"))}
          >
            ⚙
          </button>
          <button
            type="button"
            className="city-util-btn"
            title="Glossary"
            aria-label="Glossary"
            onClick={() => window.dispatchEvent(new CustomEvent("cb-open-glossary"))}
          >
            ?
          </button>
        </nav>
        <div className="city-clock" role="group" aria-label="Time of day">
          <span>{tod}</span>
          <button type="button" className={mode === "day" ? "on" : ""} onClick={() => pickClock("day")}>DAY</button>
          <button type="button" className={mode === "auto" ? "on" : ""} onClick={() => pickClock("auto")}>CYCLE</button>
          <button type="button" className={mode === "night" ? "on" : ""} onClick={() => pickClock("night")}>NIGHT</button>
        </div>
        <label className="city-avatar" title="Change plaza avatar">
          <img src={avatar.url} alt="" />
          <span>Avatar</span>
          <input
            type="file"
            accept="image/png,image/webp,image/jpeg,image/*"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              try {
                await readLocalAvatarFile(file);
                setPngMsg("Loaded");
              } catch (err) {
                setPngMsg(err instanceof Error ? err.message : "Could not load PNG");
              }
            }}
          />
          {pngMsg ? <em>{pngMsg}</em> : null}
        </label>
        {nearId && !panelOpen && (
          <div className="city-prompt">
            <div className="city-prompt-copy">
              <b>{nearInfo.label}</b>
              <span>{nearInfo.desc || "Walk in"}</span>
            </div>
            <button type="button" className="city-enter-cta" onClick={enterNear}>
              ENTER
            </button>
          </div>
        )}
        <nav className="city-dock" aria-label="Plaza actions">
          {plazaCta?.kind === "quick" ? (
            <button type="button" className="city-quick" onClick={onQuickDuel}>FIRST DUEL</button>
          ) : (
            <button type="button" className="city-quick" onClick={() => onOpenKiosk("puzzle")}>
              TODAY · {(plazaCta?.puzzleLabel || puzzleOfTheDay().label).toUpperCase()}
            </button>
          )}
          {plazaCta?.kind === "quick"
            ? <button type="button" className="city-dock-btn" onClick={() => onOpenKiosk("puzzle")}>TODAY</button>
            : <button type="button" className="city-dock-btn" onClick={onQuickDuel}>QUICK DUEL</button>}
          {BUILDINGS.map((b) => (
            <button key={b.id} type="button" className="city-dock-btn" onClick={() => onEnterBuilding(b.id)}>
              {b.short}
            </button>
          ))}
          <button type="button" className="city-dock-btn" onClick={() => onOpenKiosk("play")}>PLAY</button>
        </nav>
        {!nearId && !panelOpen && (
          <p className="city-hint">
            {reducedMotion ? "Teleporter mode" : "Click to walk · WASD · E near a door · Hub (top right) opens menus"}
          </p>
        )}
      </div>
      {reducedMotion && teleporter}
    </div>
  );
}
