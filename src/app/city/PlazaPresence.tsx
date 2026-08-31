import { useEffect, useState } from "react";
import { Html } from "@react-three/drei";
import { onPeers, sendInvite, isOnline } from "../../meta/plazaNet.js";

const TINTS = ["#c45a3a", "#3aa0c8", "#6bcb77", "#c9a227", "#b08cff", "#e8789a"];

function tintFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

/** Static local greeters — unique silhouettes. Remote peers render when plaza net is up. */
const GREETERS: {
  id: string;
  poi: string;
  x: number;
  z: number;
  yaw: number;
  kind: "vendor" | "stylist" | "keeper" | "marshal";
}[] = [
  { id: "vendor", poi: "pack_shop", x: -6.35, z: -8, yaw: Math.PI / 2, kind: "vendor" },
  { id: "stylist", poi: "boutique", x: 6.35, z: -8, yaw: -Math.PI / 2, kind: "stylist" },
  { id: "keeper", poi: "solo_gates", x: -6.35, z: 10, yaw: Math.PI / 2, kind: "keeper" },
  { id: "marshal", poi: "coliseum", x: 6.35, z: 10, yaw: -Math.PI / 2, kind: "marshal" },
];

function Shadow() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
      <circleGeometry args={[0.42, 16]} />
      <meshBasicMaterial color="#1a3020" transparent opacity={0.28} />
    </mesh>
  );
}

function Vendor() {
  return (
    <group>
      <Shadow />
      <mesh position={[0, 0.42, 0]} castShadow>
        <boxGeometry args={[0.52, 0.72, 0.36]} />
        <meshStandardMaterial color="#1c2a44" roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.38, 0.2]} castShadow>
        <boxGeometry args={[0.46, 0.38, 0.08]} />
        <meshStandardMaterial color="#c9a227" roughness={0.4} metalness={0.25} />
      </mesh>
      <mesh position={[0, 0.96, 0]} castShadow>
        <sphereGeometry args={[0.16, 10, 10]} />
        <meshStandardMaterial color="#e8c8a8" roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.1, 0.04]} castShadow>
        <boxGeometry args={[0.34, 0.1, 0.28]} />
        <meshStandardMaterial color="#8a6a12" roughness={0.45} />
      </mesh>
    </group>
  );
}

function Stylist() {
  return (
    <group>
      <Shadow />
      <mesh position={[0, 0.62, 0]} castShadow>
        <capsuleGeometry args={[0.12, 0.72, 4, 8]} />
        <meshStandardMaterial color="#2a6a78" roughness={0.45} />
      </mesh>
      <mesh position={[0, 1.18, 0]} castShadow>
        <sphereGeometry args={[0.14, 10, 10]} />
        <meshStandardMaterial color="#f0d8c0" roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.28, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.32, 0.05, 16]} />
        <meshStandardMaterial color="#d8ecf4" roughness={0.4} />
      </mesh>
    </group>
  );
}

function Keeper() {
  return (
    <group>
      <Shadow />
      <mesh position={[0, 0.55, 0]} castShadow>
        <coneGeometry args={[0.32, 1.05, 8]} />
        <meshStandardMaterial color="#1a3a28" roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.05, 0]} castShadow>
        <sphereGeometry args={[0.16, 10, 10]} />
        <meshStandardMaterial color="#c8b090" roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.22, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.22, 0.03, 6, 16]} />
        <meshStandardMaterial color="#6bcb77" emissive="#6bcb77" emissiveIntensity={0.45} />
      </mesh>
    </group>
  );
}

function Marshal() {
  return (
    <group>
      <Shadow />
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[0.4, 0.95, 0.28]} />
        <meshStandardMaterial color="#8a3228" roughness={0.5} />
      </mesh>
      <mesh position={[-0.28, 0.88, 0]} castShadow>
        <boxGeometry args={[0.18, 0.22, 0.26]} />
        <meshStandardMaterial color="#c9a227" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[0.28, 0.88, 0]} castShadow>
        <boxGeometry args={[0.18, 0.22, 0.26]} />
        <meshStandardMaterial color="#c9a227" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[0, 1.16, 0]} castShadow>
        <sphereGeometry args={[0.16, 10, 10]} />
        <meshStandardMaterial color="#e8c8a8" roughness={0.55} />
      </mesh>
    </group>
  );
}

function GreeterMesh({ kind }: { kind: (typeof GREETERS)[number]["kind"] }) {
  if (kind === "vendor") return <Vendor />;
  if (kind === "stylist") return <Stylist />;
  if (kind === "keeper") return <Keeper />;
  return <Marshal />;
}

function RemotePawn({
  peer,
  roomCode,
}: {
  peer: { id: string; name?: string; x: number; z: number };
  roomCode: string;
}) {
  const color = tintFor(peer.id || "x");
  return (
    <group position={[peer.x || 0, 0, peer.z || 0]}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <boxGeometry args={[0.42, 1.7, 0.32]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.85, 0]} castShadow>
        <sphereGeometry args={[0.16, 8, 8]} />
        <meshStandardMaterial color="#e8c8a8" />
      </mesh>
      <Html position={[0, 2.3, 0]} center pointerEvents="none" zIndexRange={[6, 0]}>
        <div className="city-peer-name">{peer.name || "Duelist"}</div>
      </Html>
      {roomCode ? (
        <Html position={[0, 2.75, 0]} center zIndexRange={[7, 0]}>
          <button
            type="button"
            className="city-invite-btn"
            onClick={(e) => {
              e.stopPropagation();
              sendInvite(peer.id, roomCode);
            }}
          >
            Invite
          </button>
        </Html>
      ) : null}
    </group>
  );
}

export function PlazaPresence({ roomCode = "" }: { enabled?: boolean; roomCode?: string }) {
  const [remotes, setRemotes] = useState<{ id: string; name?: string; x: number; z: number }[]>([]);

  useEffect(() => {
    return onPeers((list: { id: string; name?: string; x: number; z: number }[]) => setRemotes(list || []));
  }, []);

  return (
    <group>
      {GREETERS.map((g) => (
        <group key={g.id} position={[g.x, 0, g.z]} rotation={[0, g.yaw, 0]}>
          <GreeterMesh kind={g.kind} />
        </group>
      ))}
      {isOnline() && remotes.map((p) => (
        <RemotePawn key={p.id} peer={p} roomCode={roomCode} />
      ))}
    </group>
  );
}
