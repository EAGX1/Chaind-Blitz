import { useMemo, useRef, useState } from "react";
import { Billboard, Html, Text, useCursor } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { BuildingId, KioskId } from "./buildings";
import { BUILDINGS, KIOSKS, streetYaw } from "./buildings";
import { sampleWorld } from "./plazaTime";
import { getPlazaTextures, type PlazaTextures } from "./plazaTextures";
import { t } from "../../meta/i18n.js";

type Props = {
  nearId: string | null;
  panelOpen?: boolean;
  onEnter: (id: string, kind: "building" | "kiosk") => void;
};

function poiTitle(id: BuildingId | KioskId) {
  switch (id) {
    case "pack_shop":
      return t("city.packShop");
    case "boutique":
      return t("city.boutique");
    case "solo_gates":
      return t("city.soloGates");
    case "coliseum":
      return t("city.coliseum");
    case "vault":
      return t("city.vault");
    case "collection":
      return t("city.collection");
    case "library":
      return t("city.library");
    case "today":
      return t("city.today");
    case "tavern":
      return t("city.tavern");
    case "arena":
      return t("city.arena");
    default: {
      const _n: never = id;
      return _n;
    }
  }
}

function buildingSignPose(id: BuildingId): { position: [number, number, number]; width: number } {
  switch (id) {
    case "pack_shop":
      return { position: [0, 4.18, 1.68], width: 2.75 };
    case "boutique":
      return { position: [0, 4.58, 1.4], width: 2.55 };
    case "solo_gates":
      return { position: [0, 4.58, 0.42], width: 2.85 };
    case "coliseum":
      return { position: [0, 3.42, 3.22], width: 2.65 };
    default: {
      const _n: never = id;
      return _n;
    }
  }
}

const signMaps = new Map<string, THREE.CanvasTexture>();

function signTex(title: string, fill: string) {
  const key = `${title}|${fill}`;
  const hit = signMaps.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = "rgba(20,16,10,0.28)";
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = "#f0d78c";
  ctx.lineWidth = 10;
  ctx.strokeRect(10, 10, 492, 108);
  ctx.strokeStyle = "rgba(255,248,232,0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(22, 22, 468, 84);
  const label = title.toUpperCase();
  let size = 54;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff8ee";
  do {
    ctx.font = `700 ${size}px Rajdhani, Segoe UI, sans-serif`;
    size -= 2;
  } while (size > 26 && ctx.measureText(label).width > 430);
  ctx.fillText(label, 256, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  signMaps.set(key, tex);
  return tex;
}

function PaintedSign({
  title,
  color,
  position,
  width = 2.6,
  height = 0.58,
}: {
  title: string;
  color: string;
  position: [number, number, number];
  width?: number;
  height?: number;
}) {
  const map = useMemo(() => signTex(title, color), [title, color]);
  return (
    <group position={position}>
      <mesh castShadow>
        <boxGeometry args={[width + 0.08, height + 0.08, 0.12]} />
        <meshStandardMaterial color="#2a2218" roughness={0.55} metalness={0.12} />
      </mesh>
      <mesh position={[0, 0, 0.07]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial map={map} roughness={0.38} metalness={0.08} />
      </mesh>
    </group>
  );
}

function SpotName({ name, y }: { name: string; y: number }) {
  return (
    <Billboard position={[0, y, 0.15]} follow>
      <Text
        fontSize={0.34}
        color="#fff8ee"
        outlineWidth={0.028}
        outlineColor="#1a1810"
        anchorX="center"
        anchorY="middle"
        maxWidth={4.2}
        textAlign="center"
      >
        {name.toUpperCase()}
      </Text>
    </Billboard>
  );
}

function PoiLabel({
  name,
  desc,
  y,
  active,
}: {
  name: string;
  desc: string;
  y: number;
  active: boolean;
}) {
  if (!active) return null;
  return (
    <Html
      position={[0, y, 0]}
      center
      pointerEvents="none"
      zIndexRange={[8, 0]}
      wrapperClass="city-poi-html"
      occlude={false}
    >
      <div className="city-poi-label is-near">
        <b>{name}</b>
        <span>{desc}</span>
      </div>
    </Html>
  );
}

function HitBox({
  size,
  onEnter,
  onHover,
}: {
  size: [number, number, number];
  onEnter: () => void;
  onHover: (v: boolean) => void;
}) {
  return (
    <mesh
      position={[0, size[1] / 2, 0]}
      visible={false}
      onPointerDown={(e) => {
        e.stopPropagation();
        onEnter();
      }}
      onClick={(e) => {
        e.stopPropagation();
        onEnter();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(true);
      }}
      onPointerOut={() => onHover(false)}
    >
      <boxGeometry args={size} />
    </mesh>
  );
}

function GlowWindow({ position, size }: { position: [number, number, number]; size: [number, number] }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (mat.current) mat.current.emissiveIntensity = 0.08 + sampleWorld().window * 0.95;
  });
  return (
    <mesh position={position}>
      <planeGeometry args={size} />
      <meshStandardMaterial
        ref={mat}
        color="#9ad4f0"
        emissive="#f0d78c"
        emissiveIntensity={0.1}
        roughness={0.18}
      />
    </mesh>
  );
}

function ShopFrame({
  position,
  size,
  tex,
}: {
  position: [number, number, number];
  size: [number, number];
  tex: PlazaTextures;
}) {
  const [w, h] = size;
  return (
    <group position={position}>
      <GlowWindow position={[0, 0, 0]} size={size} />
      <mesh position={[0, h / 2 + 0.04, 0.04]}>
        <boxGeometry args={[w + 0.16, 0.08, 0.08]} />
        <meshStandardMaterial map={tex.wood} />
      </mesh>
      <mesh position={[0, -h / 2 - 0.04, 0.04]}>
        <boxGeometry args={[w + 0.16, 0.08, 0.08]} />
        <meshStandardMaterial map={tex.wood} />
      </mesh>
      <mesh position={[-(w / 2) - 0.04, 0, 0.04]}>
        <boxGeometry args={[0.08, h + 0.16, 0.08]} />
        <meshStandardMaterial map={tex.wood} />
      </mesh>
      <mesh position={[w / 2 + 0.04, 0, 0.04]}>
        <boxGeometry args={[0.08, h + 0.16, 0.08]} />
        <meshStandardMaterial map={tex.wood} />
      </mesh>
    </group>
  );
}

function PackShop({ active, tex }: { active: boolean; tex: PlazaTextures }) {
  return (
    <group>
      <mesh position={[0, 0.14, 0]} receiveShadow>
        <boxGeometry args={[4.9, 0.28, 3.5]} />
        <meshStandardMaterial map={tex.brick} roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.7, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.6, 3.4, 3.2]} />
        <meshStandardMaterial map={tex.plaster} color={active ? "#fff8f0" : "#ffffff"} roughness={0.72} />
      </mesh>
      <mesh position={[0, 3.85, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[3.4, 1.7, 4]} />
        <meshStandardMaterial map={tex.roofClay} roughness={0.52} />
      </mesh>
      <mesh position={[0, 0.12, 1.2]} receiveShadow>
        <boxGeometry args={[4.8, 0.24, 1.6]} />
        <meshStandardMaterial map={tex.cobble} roughness={0.7} />
      </mesh>
      <ShopFrame position={[0, 1.65, 1.62]} size={[2.4, 1.5]} tex={tex} />
      {[-0.7, 0, 0.7].map((x, i) => (
        <mesh key={x} position={[x, 1.7, 1.55]} rotation={[0, 0, 0.1 * (i - 1)]} castShadow>
          <boxGeometry args={[0.32, 0.46, 0.04]} />
          <meshStandardMaterial color={i === 1 ? "#c9a227" : "#3a6a9a"} roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, 2.55, 1.64]} rotation={[-0.45, 0, 0]} castShadow>
        <boxGeometry args={[4.9, 0.08, 1.3]} />
        <meshStandardMaterial map={tex.roofClay} roughness={0.5} />
      </mesh>
    </group>
  );
}

function Boutique({ active, tex }: { active: boolean; tex: PlazaTextures }) {
  return (
    <group>
      <mesh position={[0, 0.14, 0]} receiveShadow>
        <boxGeometry args={[3.9, 0.28, 2.9]} />
        <meshStandardMaterial map={tex.brick} roughness={0.8} />
      </mesh>
      <mesh position={[0, 2.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.6, 4.4, 2.6]} />
        <meshStandardMaterial
          map={tex.plasterCool}
          color={active ? "#f4ffff" : "#ffffff"}
          roughness={0.42}
          metalness={0.08}
        />
      </mesh>
      <mesh position={[0, 4.7, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[2.7, 1.5, 4]} />
        <meshStandardMaterial map={tex.roofTeal} roughness={0.48} />
      </mesh>
      <ShopFrame position={[0, 2.15, 1.32]} size={[2.0, 2.2]} tex={tex} />
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} position={[x, 1.15, 0.55]} castShadow>
          <capsuleGeometry args={[0.14, 0.5, 4, 8]} />
          <meshStandardMaterial map={tex.plaster} roughness={0.55} />
        </mesh>
      ))}
    </group>
  );
}

function SoloGates({ active, tex }: { active: boolean; tex: PlazaTextures }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ring.current) ring.current.rotation.z = clock.elapsedTime * 0.28;
  });
  return (
    <group>
      <mesh position={[0, 0.1, 0.6]} receiveShadow>
        <boxGeometry args={[3.6, 0.2, 2.2]} />
        <meshStandardMaterial map={tex.cobble} bumpMap={tex.cobbleBump} bumpScale={0.2} roughness={0.7} />
      </mesh>
      {[-1.55, 1.55].map((x) => (
        <mesh key={x} position={[x, 2.05, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.55, 4.1, 0.55]} />
          <meshStandardMaterial map={tex.plaster} color={active ? "#fff8f0" : "#ffffff"} roughness={0.62} />
        </mesh>
      ))}
      <mesh position={[0, 4.2, 0]} castShadow>
        <boxGeometry args={[3.5, 0.4, 0.65]} />
        <meshStandardMaterial map={tex.leaf} color="#6bcb77" roughness={0.45} />
      </mesh>
      <mesh ref={ring} position={[0, 2.1, 0.04]}>
        <torusGeometry args={[1.25, 0.07, 8, 28]} />
        <meshStandardMaterial color="#6bcb77" emissive="#6bcb77" emissiveIntensity={0.45} />
      </mesh>
      <mesh position={[0, 2.1, 0]}>
        <circleGeometry args={[1.12, 24]} />
        <meshStandardMaterial
          color="#b8f0c4"
          emissive="#6bcb77"
          emissiveIntensity={0.35}
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

function Coliseum({ active, tex }: { active: boolean; tex: PlazaTextures }) {
  const stone = active ? "#fff6ea" : "#ffffff";
  return (
    <group>
      <mesh position={[0, 0.14, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[3.08, 3.18, 0.28, 20]} />
        <meshStandardMaterial map={tex.brick} roughness={0.82} />
      </mesh>
      <mesh position={[0, 0.58, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2.92, 3.02, 0.62, 20, 1, true]} />
        <meshStandardMaterial map={tex.plasterSand} color={stone} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.48, 0]} scale={[-1, 1, 1]} receiveShadow>
        <cylinderGeometry args={[1.52, 1.52, 0.52, 18, 1, true]} />
        <meshStandardMaterial map={tex.brick} roughness={0.78} />
      </mesh>
      <mesh position={[0, 0.2, 0]} receiveShadow>
        <cylinderGeometry args={[1.5, 1.5, 0.16, 18]} />
        <meshStandardMaterial map={tex.felt} color="#8a3a32" roughness={0.7} />
      </mesh>
      {Array.from({ length: 16 }, (_, i) => {
        const a = ((i + 0.5) / 16) * Math.PI * 2;
        return (
          <mesh
            key={`deck-${i}`}
            position={[Math.cos(a) * 2.2, 0.82, Math.sin(a) * 2.2]}
            rotation={[0, -a, 0]}
            receiveShadow
            castShadow
          >
            <boxGeometry args={[1.28, 0.14, 0.92]} />
            <meshStandardMaterial map={tex.cobble} bumpMap={tex.cobbleBump} bumpScale={0.12} roughness={0.72} />
          </mesh>
        );
      })}
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return (
          <mesh key={`col-${i}`} position={[Math.cos(a) * 2.72, 1.7, Math.sin(a) * 2.72]} castShadow>
            <cylinderGeometry args={[0.13, 0.16, 1.64, 8]} />
            <meshStandardMaterial map={tex.plasterSand} color={stone} roughness={0.52} />
          </mesh>
        );
      })}
      <mesh position={[0, 2.8, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[2.72, 0.15, 8, 28]} />
        <meshStandardMaterial map={tex.brick} roughness={0.55} />
      </mesh>
      {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((a) => (
        <mesh
          key={`ban-${a}`}
          position={[Math.cos(a) * 2.48, 1.85, Math.sin(a) * 2.48]}
          rotation={[0, -a, 0]}
          castShadow
        >
          <boxGeometry args={[0.48, 0.95, 0.06]} />
          <meshStandardMaterial map={tex.roofClay} roughness={0.55} />
        </mesh>
      ))}
    </group>
  );
}

const KIOSK_LOOK: Record<string, { body: string; glow: string; desc: string }> = {
  vault: { body: "#c9a227", glow: "#c9a227", desc: "Build a deck" },
  collection: { body: "#3aa0c8", glow: "#7ec8e3", desc: "Browse cards" },
  tavern: { body: "#d4783a", glow: "#e8a04a", desc: "Roguelike run" },
  arena: { body: "#c45a3a", glow: "#e85d4c", desc: "Extra modes" },
  library: { body: "#4a6a9a", glow: "#c9a227", desc: "How to play" },
  today: { body: "#f0d78c", glow: "#ffe27a", desc: "Puzzle of the day" },
};

function KioskMesh({ id, active, tex }: { id: string; active: boolean; tex: PlazaTextures }) {
  const look = KIOSK_LOOK[id] || { body: "#efe8dc", glow: "#c9a227", desc: "" };
  return (
    <group>
      <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.15, 1.1, 0.72]} />
        <meshStandardMaterial map={tex.wood} color={active ? "#fff6ea" : "#ffffff"} roughness={0.62} />
      </mesh>
      <mesh position={[0, 1.22, 0.18]} rotation={[-0.4, 0, 0]} castShadow>
        <boxGeometry args={[1.35, 0.08, 0.95]} />
        <meshStandardMaterial color={look.body} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.72, 0.38]}>
        <planeGeometry args={[0.7, 0.42]} />
        <meshStandardMaterial color={look.glow} emissive={look.glow} emissiveIntensity={active ? 0.55 : 0.22} />
      </mesh>
      <mesh position={[0, 1.48, 0]}>
        <octahedronGeometry args={[0.14, 0]} />
        <meshStandardMaterial color={look.glow} emissive={look.glow} emissiveIntensity={active ? 0.9 : 0.4} />
      </mesh>
    </group>
  );
}

function BuildingMesh({ id, active, tex }: { id: BuildingId; active: boolean; tex: PlazaTextures }) {
  switch (id) {
    case "pack_shop":
      return <PackShop active={active} tex={tex} />;
    case "boutique":
      return <Boutique active={active} tex={tex} />;
    case "solo_gates":
      return <SoloGates active={active} tex={tex} />;
    case "coliseum":
      return <Coliseum active={active} tex={tex} />;
    default: {
      const _n: never = id;
      return _n;
    }
  }
}

export function CityBuildings({ nearId, panelOpen, onEnter }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const tex = useMemo(() => getPlazaTextures(), []);
  useCursor(!!hovered && !panelOpen);

  const go = (id: string, kind: "building" | "kiosk") => {
    if (panelOpen) return;
    onEnter(id, kind);
  };

  if (!tex) return null;

  return (
    <group>
      {BUILDINGS.map((b) => {
        const active = nearId === b.id || hovered === b.id;
        return (
          <group key={b.id} position={b.position} rotation={[0, streetYaw(b.position[0], b.position[2]), 0]}>
            <BuildingMesh id={b.id} active={active} tex={tex} />
            <PaintedSign title={poiTitle(b.id)} color={b.color} {...buildingSignPose(b.id)} />
            <SpotName name={poiTitle(b.id)} y={b.id === "boutique" ? 6.15 : 5.55} />
            <HitBox
              size={[5.2, 5.6, 4.2]}
              onEnter={() => go(b.id, "building")}
              onHover={(v) => setHovered(v ? b.id : null)}
            />
            <PoiLabel name={poiTitle(b.id)} desc={b.desc} y={b.id === "boutique" ? 5.95 : 5.35} active={active} />
          </group>
        );
      })}
      {KIOSKS.map((k) => {
        const active = nearId === k.id || hovered === k.id;
        return (
          <group key={k.id} position={k.position} rotation={[0, streetYaw(k.position[0], k.position[2]), 0]}>
            <KioskMesh id={k.id} active={active} tex={tex} />
            <PaintedSign
              title={poiTitle(k.id)}
              color={k.color}
              position={[0, 1.78, 0.48]}
              width={1.42}
              height={0.36}
            />
            <SpotName name={poiTitle(k.id)} y={2.35} />
            <HitBox
              size={[2.1, 2.6, 1.9]}
              onEnter={() => go(k.id, "kiosk")}
              onHover={(v) => setHovered(v ? k.id : null)}
            />
            <PoiLabel name={poiTitle(k.id)} desc={k.desc} y={2.28} active={active} />
          </group>
        );
      })}
    </group>
  );
}

export function isBuildingId(id: string): id is BuildingId {
  return BUILDINGS.some((b) => b.id === id);
}
