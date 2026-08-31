/**
 * North–south shopping street: asphalt, sidewalks, storefronts, lamps.
 * Inspired by TCG hub streets (storefronts + clock square), not a round plaza.
 */
import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { plazaClock, sampleWorld } from "./plazaTime";
import type { PlazaTextures } from "./plazaTextures";

const ROAD_W = 7.2;
const ROAD_LEN = 64;
const WALK_W = 4.8;
const CURB = ROAD_W / 2;

type RoofKey = "clay" | "teal" | "slate" | "amber";
type PlasterKey = "plaster" | "plasterCool" | "plasterSand";

function roofMap(tex: PlazaTextures, key: RoofKey) {
  switch (key) {
    case "clay":
      return tex.roofClay;
    case "teal":
      return tex.roofTeal;
    case "slate":
      return tex.roofSlate;
    case "amber":
      return tex.roofAmber;
    default: {
      const _n: never = key;
      return _n;
    }
  }
}

function plasterMap(tex: PlazaTextures, key: PlasterKey) {
  switch (key) {
    case "plaster":
      return tex.plaster;
    case "plasterCool":
      return tex.plasterCool;
    case "plasterSand":
      return tex.plasterSand;
    default: {
      const _n: never = key;
      return _n;
    }
  }
}

function StreetWindow({
  position,
  w = 0.62,
  h = 0.78,
}: {
  position: [number, number, number];
  w?: number;
  h?: number;
}) {
  const glass = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (glass.current) glass.current.emissiveIntensity = 0.05 + sampleWorld().window * 1.05;
  });
  return (
    <mesh position={position}>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial
        ref={glass}
        color="#7ec8e8"
        emissive="#f0d78c"
        emissiveIntensity={0.08}
        roughness={0.18}
      />
    </mesh>
  );
}

function Facade({
  x,
  z,
  w,
  h,
  d,
  roof,
  plaster,
  tex,
  awning = "#c45a3a",
}: {
  x: number;
  z: number;
  w: number;
  h: number;
  d: number;
  roof: RoofKey;
  plaster: PlasterKey;
  tex: PlazaTextures;
  awning?: string;
}) {
  const yaw = x < 0 ? Math.PI / 2 : -Math.PI / 2;
  const floors = Math.max(2, Math.round(h / 2.4));
  const wins: [number, number][] = [];
  for (let f = 0; f < floors; f++) {
    const wy = 1.15 + f * (h / floors);
    for (const wx of [-w * 0.28, w * 0.28]) wins.push([wx, wy]);
  }
  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      <mesh position={[0, 0.16, 0]} receiveShadow>
        <boxGeometry args={[w + 0.2, 0.32, d + 0.16]} />
        <meshStandardMaterial map={tex.brick} roughness={0.82} />
      </mesh>
      <mesh position={[0, h / 2 + 0.16, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial map={plasterMap(tex, plaster)} roughness={0.74} />
      </mesh>
      <mesh position={[0, h + 0.9, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[Math.max(w, d) * 0.62, 1.7, 4]} />
        <meshStandardMaterial map={roofMap(tex, roof)} roughness={0.52} />
      </mesh>
      <mesh position={[0, 2.35, d / 2 + 0.28]} rotation={[-0.42, 0, 0]} castShadow>
        <boxGeometry args={[w * 0.92, 0.07, 1.05]} />
        <meshStandardMaterial color={awning} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.95, d / 2 + 0.04]} castShadow>
        <boxGeometry args={[0.58, 1.28, 0.08]} />
        <meshStandardMaterial map={tex.wood} roughness={0.68} />
      </mesh>
      {wins.map(([wx, wy], i) => (
        <StreetWindow key={i} position={[wx, wy, d / 2 + 0.03]} />
      ))}
    </group>
  );
}

function SkylineBlock({
  x,
  z,
  w,
  h,
  d,
  tex,
  cool,
}: {
  x: number;
  z: number;
  w: number;
  h: number;
  d: number;
  tex: PlazaTextures;
  cool?: boolean;
}) {
  const rows = Math.min(5, Math.max(3, Math.round(h / 2.4)));
  const cols = Math.min(3, Math.max(2, Math.round(w / 2.2)));
  const lit = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (lit.current) lit.current.emissiveIntensity = 0.12 + sampleWorld().window * 0.85;
  });
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial map={cool ? tex.plasterCool : tex.plasterSand} roughness={0.7} />
      </mesh>
      <mesh position={[0, h + 0.12, 0]}>
        <boxGeometry args={[w * 0.92, 0.24, d * 0.92]} />
        <meshStandardMaterial map={tex.brick} roughness={0.55} />
      </mesh>
      {Array.from({ length: rows * cols }, (_, i) => {
        const c = i % cols;
        const r = Math.floor(i / cols);
        const wx = -w / 2 + 0.7 + c * ((w - 1.4) / Math.max(1, cols - 1));
        const wy = 1.4 + r * ((h - 2.2) / Math.max(1, rows - 1));
        const face = x < 0 ? w / 2 + 0.03 : -(w / 2 + 0.03);
        const zz = -d / 2 + 0.7 + (c / Math.max(1, cols - 1)) * (d - 1.4);
        return (
          <mesh key={i} position={[face, wy, zz]} rotation={[0, x > 0 ? Math.PI : 0, 0]}>
            <planeGeometry args={[0.38, 0.5]} />
            <meshStandardMaterial
              ref={i === 0 ? lit : undefined}
              color="#7ec8e8"
              emissive="#f0d78c"
              emissiveIntensity={0.2}
              roughness={0.22}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function ClockHands() {
  const hour = useRef<THREE.Group>(null);
  const minute = useRef<THREE.Group>(null);
  useFrame(() => {
    const p = plazaClock.phase;
    if (hour.current) hour.current.rotation.z = -p * Math.PI * 4;
    if (minute.current) minute.current.rotation.z = -p * Math.PI * 24;
  });
  return (
    <>
      <group ref={hour} position={[0, 0, 0.05]}>
        <mesh position={[0, 0.16, 0]}>
          <boxGeometry args={[0.08, 0.38, 0.04]} />
          <meshStandardMaterial color="#3a2a18" />
        </mesh>
      </group>
      <group ref={minute} position={[0, 0, 0.06]}>
        <mesh position={[0, 0.22, 0]}>
          <boxGeometry args={[0.05, 0.52, 0.03]} />
          <meshStandardMaterial color="#5a3a20" />
        </mesh>
      </group>
    </>
  );
}

function ClockTower({ tex }: { tex: PlazaTextures }) {
  return (
    <group position={[0, 0, -25.5]}>
      <mesh position={[0, 0.12, 0]} receiveShadow>
        <boxGeometry args={[5.4, 0.24, 5.4]} />
        <meshStandardMaterial map={tex.brick} roughness={0.78} />
      </mesh>
      <mesh position={[0, 5.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.4, 10.8, 3.4]} />
        <meshStandardMaterial map={tex.plasterSand} roughness={0.62} />
      </mesh>
      <mesh position={[0, 11.35, 0]} castShadow>
        <boxGeometry args={[3.9, 1.1, 3.9]} />
        <meshStandardMaterial map={tex.brick} roughness={0.55} />
      </mesh>
      <mesh position={[0, 13.2, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[2.55, 2.6, 4]} />
        <meshStandardMaterial map={tex.roofAmber} roughness={0.48} />
      </mesh>
      <mesh position={[0, 14.7, 0]}>
        <sphereGeometry args={[0.22, 10, 10]} />
        <meshStandardMaterial color="#c9a227" emissive="#c9a227" emissiveIntensity={0.8} />
      </mesh>
      {([0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2] as const).map((a) => (
        <group key={a} position={[Math.sin(a) * 1.74, 8.6, Math.cos(a) * 1.74]} rotation={[0, a, 0]}>
          <mesh>
            <circleGeometry args={[0.72, 20]} />
            <meshStandardMaterial color="#f4ead4" roughness={0.35} />
          </mesh>
          <mesh position={[0, 0, 0.03]}>
            <ringGeometry args={[0.66, 0.74, 20]} />
            <meshStandardMaterial color="#c9a227" metalness={0.4} roughness={0.35} />
          </mesh>
          <ClockHands />
        </group>
      ))}
    </group>
  );
}

function Lamp({
  x,
  z,
  tex,
  index,
}: {
  x: number;
  z: number;
  tex: PlazaTextures;
  index: number;
}) {
  const light = useRef<THREE.PointLight>(null);
  const globe = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    const w = sampleWorld();
    if (light.current) light.current.intensity = w.lamp * 0.85;
    if (globe.current) globe.current.emissiveIntensity = 0.22 + w.lamp * 1.05;
  });
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <cylinderGeometry args={[0.18, 0.22, 0.16, 8]} />
        <meshStandardMaterial map={tex.brick} roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.7, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.09, 3.4, 8]} />
        <meshStandardMaterial color="#3a3e46" metalness={0.45} roughness={0.4} />
      </mesh>
      <mesh position={[0, 3.42, 0]} rotation={[0, 0, x > 0 ? 0.55 : -0.55]}>
        <cylinderGeometry args={[0.03, 0.03, 0.7, 6]} />
        <meshStandardMaterial color="#3a3e46" metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[x > 0 ? -0.28 : 0.28, 3.28, 0]}>
        <sphereGeometry args={[0.16, 12, 12]} />
        <meshStandardMaterial
          ref={globe}
          color="#ffe9b0"
          emissive="#ffc060"
          emissiveIntensity={0.35}
        />
      </mesh>
      {index % 3 === 0 ? (
        <pointLight
          ref={light}
          position={[x > 0 ? -0.28 : 0.28, 3.2, 0]}
          color="#ffb060"
          intensity={0}
          distance={12}
          decay={2}
        />
      ) : null}
    </group>
  );
}

function Bench({ x, z, yaw, tex }: { x: number; z: number; yaw: number; tex: PlazaTextures }) {
  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      <mesh position={[0, 0.28, 0]} castShadow>
        <boxGeometry args={[1.15, 0.08, 0.38]} />
        <meshStandardMaterial map={tex.wood} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.52, -0.16]} castShadow>
        <boxGeometry args={[1.15, 0.36, 0.08]} />
        <meshStandardMaterial map={tex.wood} roughness={0.7} />
      </mesh>
      {[-0.46, 0.46].map((lx) => (
        <mesh key={lx} position={[lx, 0.14, 0]}>
          <boxGeometry args={[0.07, 0.28, 0.32]} />
          <meshStandardMaterial color="#4a3a2c" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function Planter({ x, z, tex }: { x: number; z: number; tex: PlazaTextures }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.38, 0.42, 0.44, 10]} />
        <meshStandardMaterial map={tex.brick} roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.52, 0]}>
        <sphereGeometry args={[0.32, 8, 8]} />
        <meshStandardMaterial map={tex.leaf} roughness={0.8} />
      </mesh>
    </group>
  );
}

function CafeTerrace({ x, z, yaw, tex, cloth }: { x: number; z: number; yaw: number; tex: PlazaTextures; cloth: string }) {
  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      <mesh position={[0, 1.55, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.05, 3.1, 8]} />
        <meshStandardMaterial color="#4a3a2c" roughness={0.65} />
      </mesh>
      <mesh position={[0, 3.05, 0]} rotation={[0, Math.PI / 5, 0]} castShadow>
        <coneGeometry args={[1.15, 0.42, 8]} />
        <meshStandardMaterial color={cloth} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.42, 0]} castShadow>
        <cylinderGeometry args={[0.42, 0.46, 0.08, 12]} />
        <meshStandardMaterial map={tex.wood} roughness={0.6} />
      </mesh>
      {[-0.55, 0.55].map((s) => (
        <mesh key={s} position={[s, 0.28, 0.35]} castShadow>
          <boxGeometry args={[0.34, 0.08, 0.34]} />
          <meshStandardMaterial map={tex.wood} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function Banner({ x, z, yaw, color }: { x: number; z: number; yaw: number; color: string }) {
  const cloth = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (cloth.current) cloth.current.rotation.z = Math.sin(clock.elapsedTime * 1.4 + x) * 0.08;
  });
  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      <mesh position={[0, 1.7, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.06, 3.4, 6]} />
        <meshStandardMaterial color="#3a3e46" metalness={0.35} roughness={0.45} />
      </mesh>
      <mesh ref={cloth} position={[0.42, 2.55, 0]} castShadow>
        <boxGeometry args={[0.85, 1.15, 0.04]} />
        <meshStandardMaterial color={color} roughness={0.55} />
      </mesh>
    </group>
  );
}

function CrateStack({ x, z, yaw, tex }: { x: number; z: number; yaw: number; tex: PlazaTextures }) {
  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      <mesh position={[0, 0.22, 0]} castShadow>
        <boxGeometry args={[0.55, 0.44, 0.42]} />
        <meshStandardMaterial map={tex.wood} roughness={0.75} />
      </mesh>
      <mesh position={[0.08, 0.58, 0.04]} rotation={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[0.42, 0.32, 0.36]} />
        <meshStandardMaterial map={tex.wood} roughness={0.75} />
      </mesh>
    </group>
  );
}

function SouthGate({ tex }: { tex: PlazaTextures }) {
  return (
    <group position={[0, 0, 25.5]}>
      {[-2.6, 2.6].map((x) => (
        <mesh key={x} position={[x, 2.4, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.7, 4.8, 0.7]} />
          <meshStandardMaterial map={tex.plasterSand} roughness={0.62} />
        </mesh>
      ))}
      <mesh position={[0, 4.95, 0]} castShadow>
        <boxGeometry args={[6.2, 0.7, 0.85]} />
        <meshStandardMaterial map={tex.brick} roughness={0.55} />
      </mesh>
      <mesh position={[0, 5.55, 0]}>
        <boxGeometry args={[3.4, 0.55, 0.2]} />
        <meshStandardMaterial color="#c45a3a" emissive="#c45a3a" emissiveIntensity={0.25} roughness={0.45} />
      </mesh>
      <mesh position={[0, 3.1, 0.08]}>
        <torusGeometry args={[1.15, 0.07, 8, 24]} />
        <meshStandardMaterial color="#c9a227" metalness={0.4} roughness={0.35} />
      </mesh>
    </group>
  );
}

function Crosswalk({ z }: { z: number }) {
  return (
    <group position={[0, 0.038, z]}>
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -1.7 + i * 0.42]} receiveShadow>
          <planeGeometry args={[ROAD_W - 0.5, 0.22]} />
          <meshStandardMaterial color="#f2eee4" roughness={0.55} />
        </mesh>
      ))}
    </group>
  );
}

function Dashes() {
  const zs: number[] = [];
  for (let z = -30; z <= 30; z += 2.4) {
    if (Math.abs(z) < 2.2 || Math.abs(Math.abs(z) - 16) < 2.2) continue;
    zs.push(z);
  }
  return (
    <group>
      {zs.map((z) => (
        <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.036, z]}>
          <planeGeometry args={[0.16, 1.15]} />
          <meshStandardMaterial color="#d8c46a" roughness={0.45} />
        </mesh>
      ))}
    </group>
  );
}

const FACADES: {
  x: number;
  z: number;
  w: number;
  h: number;
  d: number;
  roof: RoofKey;
  plaster: PlasterKey;
  awning: string;
}[] = [
  { x: -8.15, z: -26, w: 5.2, h: 7.4, d: 3.2, roof: "clay", plaster: "plaster", awning: "#c45a3a" },
  { x: -8.05, z: -21, w: 4.4, h: 9.6, d: 3.1, roof: "teal", plaster: "plasterCool", awning: "#3a8a88" },
  { x: -8.2, z: -16, w: 4.8, h: 6.6, d: 3.3, roof: "amber", plaster: "plasterSand", awning: "#d4783a" },
  { x: -8.1, z: -3.2, w: 5.0, h: 8.4, d: 3.2, roof: "slate", plaster: "plaster", awning: "#4a6a9a" },
  { x: -8.15, z: 2.4, w: 4.6, h: 7.2, d: 3.1, roof: "clay", plaster: "plasterSand", awning: "#c45a3a" },
  { x: -8.05, z: 15.6, w: 4.8, h: 8.8, d: 3.2, roof: "teal", plaster: "plasterCool", awning: "#2e8a38" },
  { x: -8.2, z: 21.2, w: 5.2, h: 10.4, d: 3.4, roof: "amber", plaster: "plaster", awning: "#d4783a" },
  { x: -8.1, z: 27, w: 4.4, h: 8.2, d: 3.0, roof: "slate", plaster: "plasterSand", awning: "#4a6a9a" },
  { x: 8.15, z: -26, w: 5.0, h: 8.2, d: 3.2, roof: "slate", plaster: "plasterCool", awning: "#4a6a9a" },
  { x: 8.05, z: -21, w: 4.6, h: 6.8, d: 3.1, roof: "clay", plaster: "plaster", awning: "#c45a3a" },
  { x: 8.2, z: -16, w: 5.2, h: 9.8, d: 3.3, roof: "teal", plaster: "plasterSand", awning: "#3a8a88" },
  { x: 8.1, z: -3.2, w: 4.4, h: 7.6, d: 3.2, roof: "amber", plaster: "plaster", awning: "#d4783a" },
  { x: 8.15, z: 2.4, w: 4.8, h: 8.6, d: 3.1, roof: "slate", plaster: "plasterCool", awning: "#4a6a9a" },
  { x: 8.05, z: 15.6, w: 5.0, h: 11.2, d: 3.3, roof: "clay", plaster: "plasterSand", awning: "#c45a3a" },
  { x: 8.2, z: 21.2, w: 4.6, h: 7.8, d: 3.2, roof: "teal", plaster: "plaster", awning: "#3a8a88" },
  { x: 8.1, z: 27, w: 5.2, h: 9.4, d: 3.1, roof: "amber", plaster: "plasterCool", awning: "#d4783a" },
];

const SKYLINE: { x: number; z: number; w: number; h: number; d: number; cool?: boolean }[] = [
  { x: -14.2, z: -12, w: 6.4, h: 16, d: 5.4 },
  { x: -14.6, z: 6, w: 5.8, h: 22, d: 5.2, cool: true },
  { x: -14.0, z: 20, w: 7.2, h: 15, d: 5.8 },
  { x: 14.2, z: -10, w: 6.2, h: 18, d: 5.4, cool: true },
  { x: 14.6, z: 8, w: 5.6, h: 24, d: 5.0 },
  { x: 14.0, z: 21, w: 7.4, h: 16, d: 5.6, cool: true },
  { x: -13.5, z: -30, w: 8, h: 13, d: 6 },
  { x: 13.5, z: -30, w: 7.2, h: 14, d: 5.8, cool: true },
  { x: -13.8, z: 30, w: 7.6, h: 14, d: 5.5 },
  { x: 13.8, z: 30, w: 8.0, h: 15, d: 6, cool: true },
];

const LAMPS: [number, number][] = [];
for (let z = -27; z <= 27; z += 6) {
  LAMPS.push([-(CURB + 0.28), z], [CURB + 0.28, z]);
}

export function CityStreet({
  tex,
  sidewalkMat,
  roadMat,
}: {
  tex: PlazaTextures;
  sidewalkMat: RefObject<THREE.MeshStandardMaterial | null>;
  roadMat: RefObject<THREE.MeshStandardMaterial | null>;
}) {
  const asphalt = useMemo(() => {
    const m = tex.asphalt.clone();
    m.repeat.set(3, 14);
    return m;
  }, [tex]);
  const walk = useMemo(() => {
    const m = tex.sidewalk.clone();
    m.repeat.set(4, 16);
    return m;
  }, [tex]);
  const cobbleSq = useMemo(() => {
    const m = tex.cobble.clone();
    m.repeat.set(4, 4);
    return m;
  }, [tex]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <planeGeometry args={[ROAD_W, ROAD_LEN]} />
        <meshStandardMaterial ref={roadMat} map={asphalt} roughness={0.92} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-(CURB + WALK_W / 2), 0.045, 0]} receiveShadow>
        <planeGeometry args={[WALK_W, ROAD_LEN]} />
        <meshStandardMaterial ref={sidewalkMat} map={walk} roughness={0.82} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[CURB + WALK_W / 2, 0.045, 0]} receiveShadow>
        <planeGeometry args={[WALK_W, ROAD_LEN]} />
        <meshStandardMaterial map={walk} roughness={0.82} />
      </mesh>
      {[-CURB, CURB].map((x) => (
        <mesh key={x} position={[x, 0.1, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.22, 0.18, ROAD_LEN]} />
          <meshStandardMaterial color="#b8b0a4" roughness={0.75} />
        </mesh>
      ))}
      <Dashes />
      <Crosswalk z={0} />
      <Crosswalk z={-16} />
      <Crosswalk z={16} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, -23.5]} receiveShadow>
        <circleGeometry args={[7.2, 40]} />
        <meshStandardMaterial map={cobbleSq} bumpMap={tex.cobbleBump} bumpScale={0.28} roughness={0.76} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 25.4]} receiveShadow>
        <circleGeometry args={[6.4, 36]} />
        <meshStandardMaterial map={cobbleSq} bumpMap={tex.cobbleBump} bumpScale={0.28} roughness={0.76} />
      </mesh>
      <ClockTower tex={tex} />
      <SouthGate tex={tex} />
      {FACADES.map((f, i) => (
        <Facade key={i} {...f} tex={tex} />
      ))}
      {SKYLINE.map((s, i) => (
        <SkylineBlock key={i} {...s} tex={tex} />
      ))}
      {LAMPS.map(([x, z], i) => (
        <Lamp key={`${x}:${z}`} x={x} z={z} tex={tex} index={i} />
      ))}
      <Bench x={-5.2} z={4} yaw={Math.PI / 2} tex={tex} />
      <Bench x={5.2} z={4} yaw={-Math.PI / 2} tex={tex} />
      <Bench x={-5.2} z={-12} yaw={Math.PI / 2} tex={tex} />
      <Bench x={5.2} z={-12} yaw={-Math.PI / 2} tex={tex} />
      <Bench x={5.15} z={13.2} yaw={-Math.PI / 2} tex={tex} />
      <Bench x={5.15} z={20.4} yaw={-Math.PI / 2} tex={tex} />
      <Planter x={-6.4} z={7.5} tex={tex} />
      <Planter x={6.4} z={7.5} tex={tex} />
      <Planter x={-6.4} z={-4.5} tex={tex} />
      <Planter x={6.4} z={-4.5} tex={tex} />
      <Planter x={6.35} z={12.2} tex={tex} />
      <Planter x={6.35} z={22.6} tex={tex} />
      <CafeTerrace x={5.7} z={13.8} yaw={-Math.PI / 2} tex={tex} cloth="#c45a3a" />
      <CafeTerrace x={5.7} z={16.6} yaw={-Math.PI / 2} tex={tex} cloth="#3a8a88" />
      <CafeTerrace x={-5.7} z={13.8} yaw={Math.PI / 2} tex={tex} cloth="#d4783a" />
      <Banner x={6.1} z={11.4} yaw={-Math.PI / 2} color="#c9a227" />
      <Banner x={6.1} z={19.2} yaw={-Math.PI / 2} color="#e85d4c" />
      <Banner x={-6.1} z={19.2} yaw={Math.PI / 2} color="#d4783a" />
      <CrateStack x={6.5} z={14.8} yaw={-0.4} tex={tex} />
      <CrateStack x={6.6} z={21.5} yaw={0.5} tex={tex} />
      <CrateStack x={-6.5} z={16.2} yaw={0.2} tex={tex} />
    </group>
  );
}
