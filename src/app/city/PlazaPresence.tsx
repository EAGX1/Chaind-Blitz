import { useEffect, useState } from "react";
import { connectPlaza, onPeers } from "../../meta/plazaNet.js";

const TINTS = ["#c45a3a", "#3a6a9a", "#2a6a48", "#5a3a7a", "#8a6a20"];
const TRIMS = ["#e85d4c", "#7ec8e3", "#6bcb77", "#b08cff", "#c9a227"];

function tintIndex(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % TINTS.length;
}

/** Remote duelists — same coat language as the local pawn, tribe-tinted. Offline no-ops. */
function PeerAvatar({ tint, trim }: { tint: string; trim: string }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.4, 16]} />
        <meshBasicMaterial color="#1a3020" transparent opacity={0.25} />
      </mesh>
      <mesh position={[0, 0.48, 0]} castShadow>
        <capsuleGeometry args={[0.16, 0.4, 4, 8]} />
        <meshStandardMaterial color={tint} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.52, 0.05]} castShadow>
        <capsuleGeometry args={[0.2, 0.3, 3, 8]} />
        <meshStandardMaterial color="#f4efe4" roughness={0.6} />
      </mesh>
      <mesh position={[0.26, 0.58, 0.1]} rotation={[0.5, 0, -0.35]}>
        <torusGeometry args={[0.14, 0.035, 6, 12]} />
        <meshStandardMaterial color={trim} emissive={trim} emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0, 1.0, 0]} castShadow>
        <sphereGeometry args={[0.18, 10, 10]} />
        <meshStandardMaterial color="#f0d8c0" roughness={0.55} />
      </mesh>
    </group>
  );
}

export function PlazaPresence({ enabled }: { enabled: boolean }) {
  const [peers, setPeers] = useState<{ id: string; x: number; z: number }[]>([]);

  useEffect(() => {
    if (!enabled) return;
    connectPlaza();
    return onPeers((list: any[]) => {
      setPeers(
        (list || []).map((p) => ({
          id: String(p.id || Math.random()),
          x: Number(p.x) || 0,
          z: Number(p.z) || 0,
        }))
      );
    });
  }, [enabled]);

  if (!enabled) return null;
  return (
    <group>
      {peers.map((p) => {
        const i = tintIndex(p.id);
        return (
          <group key={p.id} position={[p.x, 0, p.z]}>
            <PeerAvatar tint={TINTS[i]} trim={TRIMS[i]} />
          </group>
        );
      })}
    </group>
  );
}
