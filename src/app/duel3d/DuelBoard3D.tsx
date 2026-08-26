import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { CardMesh } from "./CardMesh";

export type ZoneClickPayload = {
  side: 0 | 1;
  zone: "mz" | "stz";
  index: number;
};

type SlimCard = {
  rarity?: string;
  tribe?: string;
  faceup?: boolean;
  faceDownMz?: boolean;
} | null;

export type DuelBoard3DProps = {
  /** Engine snapshot (serializeGame) — optional; empty board if missing. */
  snapshot?: {
    players?: Array<{
      mz?: SlimCard[];
      stz?: SlimCard[];
    }>;
    lanes?: Array<{ index: number; revealed?: boolean }>;
  } | null;
  onZoneClick?: (payload: ZoneClickPayload) => void;
};

const MZ_X = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5];
const LANE_X = [-1.5, 0, 1.5];
const WELL_X = { left: -3.55, right: 3.55 };

type CardSlim = NonNullable<SlimCard>;

function ZonePad({
  kind,
  onClick,
}: {
  kind: "mz" | "stz";
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const rim = kind === "mz" ? "#3d7ea6" : "#6b5aa8";
  const inner = kind === "mz" ? "#152a3e" : "#1c1834";
  return (
    <group>
      <mesh receiveShadow onClick={onClick}>
        <boxGeometry args={[0.78, 0.035, 1.04]} />
        <meshStandardMaterial color={rim} roughness={0.38} metalness={0.28} />
      </mesh>
      <mesh position={[0, 0.012, 0]} receiveShadow>
        <boxGeometry args={[0.64, 0.03, 0.88]} />
        <meshStandardMaterial color={inner} roughness={0.62} metalness={0.08} />
      </mesh>
    </group>
  );
}

function ZoneRow({
  side,
  z,
  zone,
  cards,
  onZoneClick,
}: {
  side: 0 | 1;
  z: number;
  zone: "mz" | "stz";
  cards?: SlimCard[];
  onZoneClick?: DuelBoard3DProps["onZoneClick"];
}) {
  const click = (i: number) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onZoneClick?.({ side, zone, index: i });
  };
  return (
    <group>
      {MZ_X.map((x, i) => {
        const c = cards?.[i];
        const faceDown =
          zone === "mz" ? !!(c as CardSlim | undefined)?.faceDownMz || c?.faceup === false : c?.faceup === false;
        return (
          <group key={`${zone}-${side}-${i}`} position={[x, 0.03, z]}>
            <ZonePad kind={zone} onClick={click(i)} />
            {c && (
              <group scale={zone === "stz" ? 0.9 : 1}>
                <CardMesh
                  rarity={c.rarity || "N"}
                  tribe={c.tribe}
                  faceDown={faceDown}
                  position={[0, 0.08, 0]}
                  onClick={click(i)}
                />
              </group>
            )}
          </group>
        );
      })}
    </group>
  );
}

function WellBlock({
  position,
  kind,
}: {
  position: [number, number, number];
  kind: "deck" | "gy" | "extra" | "ban";
}) {
  const colors = {
    deck: "#1a3d5c",
    gy: "#3a4454",
    extra: "#4a2a6e",
    ban: "#1e1e2c",
  };
  const rim = {
    deck: "#4a8ec8",
    gy: "#8a9bb0",
    extra: "#b07cff",
    ban: "#6a6070",
  };
  const stack = kind === "deck" || kind === "extra";
  return (
    <group position={position}>
      <mesh receiveShadow>
        <boxGeometry args={[0.72, 0.06, 0.92]} />
        <meshStandardMaterial color={rim[kind]} roughness={0.45} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[0.58, 0.05, 0.76]} />
        <meshStandardMaterial color={colors[kind]} roughness={0.6} />
      </mesh>
      {stack && (
        <>
          <mesh position={[0.02, 0.09, 0.01]} rotation={[0, 0.08, 0]}>
            <boxGeometry args={[0.5, 0.05, 0.68]} />
            <meshStandardMaterial color="#152030" roughness={0.55} />
          </mesh>
          <mesh position={[-0.01, 0.14, -0.01]} rotation={[0, -0.04, 0]}>
            <boxGeometry args={[0.5, 0.05, 0.68]} />
            <meshStandardMaterial color="#1a2838" roughness={0.5} />
          </mesh>
        </>
      )}
    </group>
  );
}

function BoardScene({ snapshot, onZoneClick }: DuelBoard3DProps) {
  const p0 = snapshot?.players?.[0];
  const p1 = snapshot?.players?.[1];
  const lanes = snapshot?.lanes || [{ index: 0 }, { index: 1 }, { index: 2 }];

  return (
    <>
      <hemisphereLight args={["#8ab4d8", "#1a1210", 0.4]} />
      <ambientLight intensity={0.42} />
      <directionalLight position={[5, 12, 6]} intensity={1.05} castShadow />
      <directionalLight position={[-6, 4, -3]} intensity={0.28} color="#6ea0ff" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
        <planeGeometry args={[14, 12]} />
        <meshStandardMaterial color="#080e16" />
      </mesh>
      <mesh position={[0, 0.0, 0]} receiveShadow>
        <boxGeometry args={[9.6, 0.05, 8.4]} />
        <meshStandardMaterial color="#1a2c44" roughness={0.55} metalness={0.18} />
      </mesh>
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <boxGeometry args={[8.8, 0.03, 7.6]} />
        <meshStandardMaterial color="#143044" roughness={0.88} />
      </mesh>

      {LANE_X.map((x, i) => {
        const revealed = lanes[i]?.revealed;
        return (
          <mesh key={`lane-${i}`} position={[x, 0.05, 0]} receiveShadow>
            <boxGeometry args={[1.15, 0.02, 2.25]} />
            <meshStandardMaterial
              color={revealed ? "#2a6a82" : "#1a384c"}
              roughness={0.55}
              metalness={0.12}
              transparent
              opacity={0.92}
            />
          </mesh>
        );
      })}

      <WellBlock position={[WELL_X.left, 0.06, -3.25]} kind="deck" />
      <WellBlock position={[WELL_X.left, 0.06, -2.15]} kind="gy" />
      <WellBlock position={[WELL_X.left, 0.06, 2.15]} kind="extra" />
      <WellBlock position={[WELL_X.left, 0.06, 3.25]} kind="ban" />
      <WellBlock position={[WELL_X.right, 0.06, -3.25]} kind="extra" />
      <WellBlock position={[WELL_X.right, 0.06, -2.15]} kind="ban" />
      <WellBlock position={[WELL_X.right, 0.06, 2.15]} kind="gy" />
      <WellBlock position={[WELL_X.right, 0.06, 3.25]} kind="deck" />

      <ZoneRow side={1} z={-3.45} zone="stz" cards={p1?.stz} onZoneClick={onZoneClick} />
      <ZoneRow side={1} z={-2.4} zone="mz" cards={p1?.mz} onZoneClick={onZoneClick} />
      <ZoneRow side={0} z={2.4} zone="mz" cards={p0?.mz} onZoneClick={onZoneClick} />
      <ZoneRow side={0} z={3.45} zone="stz" cards={p0?.stz} onZoneClick={onZoneClick} />
    </>
  );
}

/** R3F duel overlay: playmat, lanes, MZ + STZ rows, extra/GY wells. */
export function DuelBoard3D({ snapshot, onZoneClick }: DuelBoard3DProps) {
  return (
    <div
      className="duel-board-3d"
      style={{ width: "100%", height: "100%", minHeight: 0, pointerEvents: "none" }}
    >
      <Canvas camera={{ position: [0, 8.8, 7.6], fov: 34 }} dpr={[1, 1.5]} shadows gl={{ alpha: true }}>
        <BoardScene snapshot={snapshot} onZoneClick={onZoneClick} />
      </Canvas>
    </div>
  );
}
