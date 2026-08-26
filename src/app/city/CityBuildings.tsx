import { useMemo, useRef, useState } from "react";
import { Html, useCursor } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { BuildingId } from "./buildings";
import { BUILDINGS, KIOSKS } from "./buildings";
import { sampleWorld } from "./plazaTime";
import { getPlazaTextures, type PlazaTextures } from "./plazaTextures";

type Props = {
  nearId: string | null;
  panelOpen?: boolean;
  onEnter: (id: string, kind: "building" | "kiosk") => void;
};

function faceOrigin(x: number, z: number) {
  return Math.atan2(-x, -z);
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

function ShopSign({ textColor, y = 4.15 }: { textColor: string; y?: number }) {
  return (
    <mesh position={[0, y, 1.55]}>
      <boxGeometry args={[2.4, 0.55, 0.12]} />
      <meshStandardMaterial color={textColor} emissive={textColor} emissiveIntensity={0.35} roughness={0.4} />
    </mesh>
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
      <ShopSign textColor="#c9a227" />
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
      <ShopSign textColor="#3aa0c8" y={4.55} />
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
};

function KioskMesh({ id, active, tex }: { id: string; active: boolean; tex: PlazaTextures }) {
  const look = KIOSK_LOOK[id] || { body: "#efe8dc", glow: "#c9a227", desc: "" };
  return (
    <group>
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.11, 0.15, 0.4, 8]} />
        <meshStandardMaterial map={tex.wood} roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.42, 0]} castShadow>
        <cylinderGeometry args={[0.7, 0.76, 0.14, 16]} />
        <meshStandardMaterial map={tex.wood} color={active ? "#fff6ea" : "#ffffff"} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.58, 16]} />
        <meshStandardMaterial color={look.body} emissive={look.glow} emissiveIntensity={0.25} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.95, 0]}>
        <octahedronGeometry args={[0.16, 0]} />
        <meshStandardMaterial color={look.glow} emissive={look.glow} emissiveIntensity={active ? 0.9 : 0.4} />
      </mesh>
    </group>
  );
}

function BuildingMesh({ id, active, tex }: { id: string; active: boolean; tex: PlazaTextures }) {
  if (id === "pack_shop") return <PackShop active={active} tex={tex} />;
  if (id === "boutique") return <Boutique active={active} tex={tex} />;
  if (id === "solo_gates") return <SoloGates active={active} tex={tex} />;
  return <Coliseum active={active} tex={tex} />;
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
          <group key={b.id} position={b.position} rotation={[0, faceOrigin(b.position[0], b.position[2]), 0]}>
            <BuildingMesh id={b.id} active={active} tex={tex} />
            <HitBox
              size={[5.2, 5.6, 4.2]}
              onEnter={() => go(b.id, "building")}
              onHover={(v) => setHovered(v ? b.id : null)}
            />
            <PoiLabel name={b.label} desc={b.desc} y={b.id === "boutique" ? 5.9 : 5.2} active={active} />
          </group>
        );
      })}
      {KIOSKS.map((k) => {
        const active = nearId === k.id || hovered === k.id;
        return (
          <group key={k.id} position={k.position}>
            <KioskMesh id={k.id} active={active} tex={tex} />
            <HitBox
              size={[1.8, 2.4, 1.8]}
              onEnter={() => go(k.id, "kiosk")}
              onHover={(v) => setHovered(v ? k.id : null)}
            />
            <PoiLabel name={k.label} desc={k.desc} y={1.85} active={active} />
          </group>
        );
      })}
    </group>
  );
}

export function isBuildingId(id: string): id is BuildingId {
  return BUILDINGS.some((b) => b.id === id);
}
