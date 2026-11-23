import { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html, OrbitControls, Text } from '@react-three/drei';
import { inr, lakh } from '../lib/format';

export interface Bucket { label: string; amount: number; color: string; emissive: string }

function Pillar({ bucket, x, width, depth, max, onHover }: { bucket: Bucket; x: number; width: number; depth: number; max: number; onHover: (b: Bucket | null) => void }) {
  const h = Math.max(0.25, (bucket.amount / max) * 4.2);
  const active = bucket.amount > 0;
  return (
    <group position={[x, 0, 0]}>
      <mesh
        position={[0, h / 2, 0]}
        castShadow
        onPointerOver={(e) => { e.stopPropagation(); onHover(bucket); }}
        onPointerOut={() => onHover(null)}
      >
        <boxGeometry args={[width, h, depth]} />
        <meshStandardMaterial
          color={bucket.color}
          emissive={bucket.emissive}
          emissiveIntensity={active ? 0.55 : 0.08}
          metalness={0.35}
          roughness={0.25}
          transparent
          opacity={active ? 1 : 0.35}
        />
      </mesh>
      <Text position={[0, -0.35, depth / 2 + 0.05]} rotation={[-0.5, 0, 0]} fontSize={0.22} color="#94A3B8" anchorX="center">
        {bucket.label}
      </Text>
    </group>
  );
}

function Ledger({ buckets }: { buckets: Bucket[] }) {
  const [hover, setHover] = useState<Bucket | null>(null);
  const width = 1.6;
  const gap = 0.45;
  const depth = 1.6;
  const totalW = buckets.length * width + (buckets.length - 1) * gap;
  const max = Math.max(...buckets.map((b) => b.amount), 1);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[totalW + 1.4, depth + 1.6]} />
        <meshStandardMaterial color="#101725" metalness={0.6} roughness={0.4} />
      </mesh>
      {buckets.map((b, k) => (
        <Pillar key={b.label} bucket={b} x={-totalW / 2 + width / 2 + k * (width + gap)} width={width} depth={depth} max={max} onHover={setHover} />
      ))}
      {hover && (
        <Html position={[0, Math.max(0.25, (hover.amount / max) * 4.2) + 0.6, 0]} center distanceFactor={7}>
          <div className="glass pointer-events-none whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold text-white">
            {hover.label}: {lakh(hover.amount)} <span className="text-slate-400">({inr(hover.amount)})</span>
          </div>
        </Html>
      )}
    </group>
  );
}

export default function AgingLedger3D({ buckets }: { buckets: Bucket[] }) {
  const sig = useMemo(() => buckets.map((b) => b.amount).join(','), [buckets]);
  return (
    <div className="h-64 w-full cursor-grab active:cursor-grabbing" data-sig={sig}>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 3.4, 6.4], fov: 42 }}>
        <color attach="background" args={['#0D1320']} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[4, 6, 3]} intensity={1.4} castShadow />
        <pointLight position={[-4, 2, -3]} intensity={20} color="#34D399" />
        <pointLight position={[4, 1, 3]} intensity={12} color="#22D3EE" />
        <Ledger buckets={buckets} />
        <OrbitControls enablePan={false} autoRotate autoRotateSpeed={1.1} minDistance={4} maxDistance={10} minPolarAngle={0.6} maxPolarAngle={1.35} />
      </Canvas>
    </div>
  );
}
