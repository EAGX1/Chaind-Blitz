import type { ThreeEvent } from "@react-three/fiber";

export type CardRarity = "N" | "R" | "SR" | "UR" | string;

const RARITY_COLOR: Record<string, string> = {
  N: "#8a9bb0",
  R: "#4aa8ff",
  SR: "#b8b8ff",
  UR: "#ffd700",
};

const TRIBE_TINT: Record<string, string> = {
  Ignis: "#e07038",
  Abyss: "#3d88cc",
  Terra: "#3d9a62",
  Neutral: "#8a7ab8",
};

export type CardMeshProps = {
  rarity?: CardRarity;
  tribe?: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  faceDown?: boolean;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
};

function MarkMat() {
  return (
    <meshStandardMaterial
      color="#7ec8ff"
      emissive="#1a4a70"
      emissiveIntensity={0.45}
      roughness={0.35}
      metalness={0.4}
    />
  );
}

function CbMark() {
  return (
    <group>
      <mesh position={[-0.09, 0, 0]} rotation={[0, 0, Math.PI * 0.22]}>
        <torusGeometry args={[0.105, 0.022, 8, 20, Math.PI * 1.38]} />
        <MarkMat />
      </mesh>
      <mesh position={[0.07, 0, 0]}>
        <boxGeometry args={[0.028, 0.22, 0.02]} />
        <MarkMat />
      </mesh>
      <mesh position={[0.125, 0.055, 0]}>
        <boxGeometry args={[0.09, 0.028, 0.02]} />
        <MarkMat />
      </mesh>
      <mesh position={[0.125, -0.055, 0]}>
        <boxGeometry args={[0.09, 0.028, 0.02]} />
        <MarkMat />
      </mesh>
    </group>
  );
}

/** Thicker rarity-rimmed card; dark CB back when face-down. */
export function CardMesh({
  rarity = "N",
  tribe,
  position = [0, 0, 0],
  rotation = [-Math.PI / 2, 0, 0],
  faceDown = false,
  onClick,
}: CardMeshProps) {
  const rim = RARITY_COLOR[rarity] || RARITY_COLOR.N;
  const face = TRIBE_TINT[tribe || ""] || "#c5d0e0";
  const ur = rarity === "UR";
  const rx = (rotation[0] ?? -Math.PI / 2) + (faceDown ? Math.PI : 0);
  const rot: [number, number, number] = [rx, rotation[1] ?? 0, rotation[2] ?? 0];

  return (
    <group position={position} rotation={rot}>
      <mesh castShadow onClick={onClick}>
        <boxGeometry args={[0.58, 0.84, 0.09]} />
        <meshStandardMaterial
          color={rim}
          roughness={ur ? 0.28 : 0.42}
          metalness={ur ? 0.7 : 0.22}
          emissive={ur ? "#ffd700" : "#000000"}
          emissiveIntensity={ur ? 0.32 : 0}
        />
      </mesh>
      <mesh position={[0, 0, 0.032]} castShadow onClick={onClick}>
        <boxGeometry args={[0.5, 0.74, 0.036]} />
        <meshStandardMaterial color={face} roughness={0.48} metalness={0.08} />
      </mesh>
      <mesh position={[0, 0, -0.032]} onClick={onClick}>
        <boxGeometry args={[0.5, 0.74, 0.036]} />
        <meshStandardMaterial color="#121820" roughness={0.72} metalness={0.12} />
      </mesh>
      <group position={[0, 0, -0.054]}>
        <CbMark />
      </group>
    </group>
  );
}
