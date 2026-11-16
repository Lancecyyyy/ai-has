"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Html, RoundedBox } from "@react-three/drei";
import * as THREE from "three";

/**
 * The assistant's body: a retro CRT terminal.
 * - "hero": keyboard, orbiting floppy-disk manuals that slide into the drive (RAG, literally),
 *   and a live DOM screen rendered in 3D.
 * - "mascot": the same machine with a face that watches the cursor and reacts to the chat state.
 */

export type Mood = "idle" | "thinking" | "happy" | "alert";

const CREAM = "#efe7d6";
const CREAM_2 = "#f7f1e4";
const DEEP = "#150f6e";
const COBALT = "#261cc1";
const BUTTER = "#f7dd7d";

const pointer = { x: 0, y: 0 };
function usePointer() {
  useEffect(() => {
    const on = (e: PointerEvent) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", on, { passive: true });
    return () => window.removeEventListener("pointermove", on);
  }, []);
}

const damp = THREE.MathUtils.damp;

function labelTexture(title: string, stripe: string) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 168;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fffdfb";
  ctx.fillRect(0, 0, 256, 168);
  ctx.fillStyle = stripe;
  ctx.fillRect(0, 0, 256, 34);
  ctx.strokeStyle = "rgba(20,17,107,0.14)";
  ctx.lineWidth = 2;
  for (let y = 98; y < 168; y += 22) {
    ctx.beginPath();
    ctx.moveTo(16, y);
    ctx.lineTo(240, y);
    ctx.stroke();
  }
  const family = getComputedStyle(document.documentElement).getPropertyValue("--font-dohyeon") || "sans-serif";
  ctx.fillStyle = DEEP;
  ctx.font = `40px ${family}`;
  ctx.fillText(title, 16, 82);
  ctx.font = `500 15px ui-monospace, monospace`;
  ctx.fillStyle = "rgba(20,17,107,0.55)";
  ctx.fillText("MERIDIAN · IT SOP", 16, 24 + 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function Floppy({ title, color, stripe }: { title: string; color: string; stripe: string }) {
  const tex = useMemo(() => labelTexture(title, stripe), [title, stripe]);
  return (
    <group>
      <RoundedBox args={[0.62, 0.62, 0.04]} radius={0.015} smoothness={2}>
        <meshStandardMaterial color={color} roughness={0.55} />
      </RoundedBox>
      <mesh position={[0.02, 0.21, 0.022]}>
        <boxGeometry args={[0.3, 0.2, 0.006]} />
        <meshStandardMaterial color="#c9ccd6" metalness={0.8} roughness={0.25} />
      </mesh>
      <mesh position={[0.07, 0.21, 0.026]}>
        <boxGeometry args={[0.07, 0.13, 0.004]} />
        <meshStandardMaterial color="#8d91a1" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, -0.1, 0.022]}>
        <planeGeometry args={[0.5, 0.33]} />
        <meshStandardMaterial map={tex} roughness={0.9} />
      </mesh>
    </group>
  );
}

const DISKS = [
  { title: "VPN.SOP", color: COBALT, stripe: BUTTER },
  { title: "PASSWORD", color: DEEP, stripe: "#ff9f87" },
  { title: "WI-FI.SOP", color: "#e7c65c", stripe: COBALT },
  { title: "MFA.SOP", color: "#2f27d0", stripe: "#9ee6cf" },
  { title: "PRINTERS", color: "#1b1680", stripe: BUTTER },
];

function Floppies({ onInsert }: { onInsert: () => void }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const state = useRef({ active: 0, t: -1, next: 1.6 });
  useFrame(({ clock }, dt) => {
    const time = clock.elapsedTime;
    const s = state.current;
    if (s.t < 0 && time > s.next) {
      s.t = 0;
      s.active = (s.active + 1) % DISKS.length;
    }
    if (s.t >= 0) {
      s.t += dt / 1.5;
      if (s.t >= 1) {
        s.t = -1;
        s.next = time + 2.2;
        onInsert();
      }
    }
    refs.current.forEach((g, i) => {
      if (!g) return;
      const a = time * 0.32 + (i / DISKS.length) * Math.PI * 2;
      const orbit = new THREE.Vector3(Math.cos(a) * 2.55, 0.35 + Math.sin(time * 0.9 + i) * 0.18, Math.sin(a) * 1.25 + 0.15);
      if (i === s.active && s.t >= 0) {
        const p = s.t;
        const slotFront = new THREE.Vector3(0.35, -0.56, 1.25);
        const slot = new THREE.Vector3(0.35, -0.56, 0.62);
        const e = p < 0.6 ? THREE.MathUtils.smootherstep(p / 0.6, 0, 1) : 1;
        const pos = orbit.clone().lerp(slotFront, e);
        if (p >= 0.6) pos.lerp(slot, THREE.MathUtils.smootherstep((p - 0.6) / 0.4, 0, 1));
        g.position.copy(pos);
        g.rotation.x = THREE.MathUtils.lerp(0.15, -Math.PI / 2, e);
        g.rotation.y = THREE.MathUtils.lerp(-a * 0.2, 0, e);
        g.rotation.z = 0;
        const sc = p > 0.85 ? 1 - (p - 0.85) / 0.15 : 1;
        g.scale.setScalar(Math.max(0.001, sc * 0.62));
      } else {
        g.position.lerp(orbit, 1 - Math.exp(-dt * 3));
        g.rotation.x = damp(g.rotation.x, 0.15 + Math.sin(time + i) * 0.1, 3, dt);
        g.rotation.y = damp(g.rotation.y, Math.sin(time * 0.4 + i) * 0.5, 3, dt);
        g.rotation.z = damp(g.rotation.z, Math.sin(time * 0.6 + i * 2) * 0.12, 3, dt);
        g.scale.setScalar(damp(g.scale.x, 0.62, 4, dt));
      }
    });
  });
  return (
    <>
      {DISKS.map((d, i) => (
        <group key={d.title} ref={(el) => void (refs.current[i] = el)} scale={0.62}>
          <Floppy {...d} />
        </group>
      ))}
    </>
  );
}

function Keyboard() {
  const keys = useMemo(() => {
    const out: { x: number; z: number; w: number; accent: boolean }[] = [];
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 13; c++) {
        out.push({ x: -1.08 + c * 0.18, z: -0.24 + r * 0.17, w: 0.14, accent: (r === 0 && c === 0) || (r === 3 && c === 12) });
      }
    return out;
  }, []);
  const inst = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = new THREE.Matrix4();
    keys.forEach((k, i) => {
      m.makeTranslation(k.x, 0.09, k.z);
      inst.current!.setMatrixAt(i, m);
      inst.current!.setColorAt(i, new THREE.Color(k.accent ? BUTTER : "#fbf6ea"));
    });
    inst.current!.instanceMatrix.needsUpdate = true;
    if (inst.current!.instanceColor) inst.current!.instanceColor.needsUpdate = true;
  }, [keys]);
  return (
    <group position={[0, -1.18, 1.55]} rotation={[0.1, 0, 0]}>
      <RoundedBox args={[2.55, 0.14, 0.86]} radius={0.05} smoothness={3}>
        <meshStandardMaterial color={CREAM} roughness={0.7} />
      </RoundedBox>
      <instancedMesh ref={inst} args={[undefined, undefined, keys.length]}>
        <boxGeometry args={[0.14, 0.07, 0.13]} />
        <meshStandardMaterial roughness={0.6} />
      </instancedMesh>
      <mesh position={[0.15, 0.09, 0.44]}>
        <boxGeometry args={[1.1, 0.06, 0.12]} />
        <meshStandardMaterial color="#fbf6ea" roughness={0.6} />
      </mesh>
    </group>
  );
}

function Face({ mood }: { mood: Mood }) {
  const eyes = useRef<THREE.Group>(null);
  const left = useRef<THREE.Mesh>(null);
  const right = useRef<THREE.Mesh>(null);
  const mouth = useRef<THREE.Mesh>(null);
  const scan = useRef<THREE.Mesh>(null);
  const blink = useRef({ next: 2, t: -1 });
  useFrame(({ clock }, dt) => {
    const time = clock.elapsedTime;
    const b = blink.current;
    if (b.t < 0 && time > b.next) b.t = 0;
    let open = 1;
    if (b.t >= 0) {
      b.t += dt * 7;
      open = Math.abs(Math.cos(b.t * Math.PI));
      if (b.t >= 1) {
        b.t = -1;
        b.next = time + 2 + Math.random() * 3;
      }
    }
    const lookX = mood === "thinking" ? 0.16 + Math.sin(time * 2) * 0.05 : pointer.x * 0.2;
    const lookY = mood === "thinking" ? 0.12 : pointer.y * 0.12;
    if (eyes.current) {
      eyes.current.position.x = damp(eyes.current.position.x, lookX, 6, dt);
      eyes.current.position.y = damp(eyes.current.position.y, 0.12 + lookY, 6, dt);
    }
    const sy = mood === "happy" ? 0.35 : mood === "alert" ? 1.25 : 1;
    for (const e of [left.current, right.current]) if (e) e.scale.y = damp(e.scale.y, sy * Math.max(0.08, open), 18, dt);
    if (mouth.current) {
      const target = mood === "happy" ? 1.25 : mood === "thinking" ? 0.45 : mood === "alert" ? 0.7 : 0.9;
      mouth.current.scale.x = damp(mouth.current.scale.x, target, 6, dt);
      mouth.current.rotation.z = Math.PI + (mood === "alert" ? Math.PI : 0);
    }
    if (scan.current) {
      scan.current.visible = mood === "thinking";
      scan.current.position.y = 0.7 - ((time * 1.4) % 1.4);
    }
  });
  return (
    <group position={[0, 0.42, 0.79]}>
      <group ref={eyes}>
        <mesh ref={left} position={[-0.36, 0, 0]}>
          <capsuleGeometry args={[0.1, 0.2, 6, 16]} />
          <meshBasicMaterial color={BUTTER} toneMapped={false} />
        </mesh>
        <mesh ref={right} position={[0.36, 0, 0]}>
          <capsuleGeometry args={[0.1, 0.2, 6, 16]} />
          <meshBasicMaterial color={BUTTER} toneMapped={false} />
        </mesh>
      </group>
      <mesh ref={mouth} position={[0, -0.32, 0]}>
        <torusGeometry args={[0.16, 0.035, 8, 24, Math.PI]} />
        <meshBasicMaterial color={BUTTER} toneMapped={false} />
      </mesh>
      <mesh ref={scan} position={[0, 0, 0.005]}>
        <planeGeometry args={[1.9, 0.05]} />
        <meshBasicMaterial color={BUTTER} transparent opacity={0.25} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Monitor({ screen, mood = "idle", led }: { screen: "face" | "html"; mood?: Mood; led: number }) {
  const ledRef = useRef<THREE.MeshBasicMaterial>(null);
  useFrame((_, dt) => {
    if (ledRef.current) {
      const on = performance.now() - led < 900;
      ledRef.current.color.lerp(new THREE.Color(on ? "#7dffb6" : mood === "alert" ? "#ff8a7a" : "#3cc98a"), 1 - Math.exp(-dt * 12));
    }
  });
  return (
    <group>
      {/* tube housing */}
      <RoundedBox args={[2.2, 1.85, 1.3]} radius={0.3} smoothness={4} position={[0, 0.35, -0.55]}>
        <meshStandardMaterial color={CREAM} roughness={0.75} />
      </RoundedBox>
      {/* front frame */}
      <RoundedBox args={[2.7, 2.3, 0.55]} radius={0.16} smoothness={4} position={[0, 0.3, 0.36]}>
        <meshStandardMaterial color={CREAM_2} roughness={0.6} />
      </RoundedBox>
      {/* screen well */}
      <RoundedBox args={[2.16, 1.66, 0.1]} radius={0.12} smoothness={4} position={[0, 0.42, 0.62]}>
        <meshStandardMaterial color="#d9d0bb" roughness={0.8} />
      </RoundedBox>
      <RoundedBox args={[2.02, 1.52, 0.06]} radius={0.1} smoothness={4} position={[0, 0.42, 0.66]}>
        <meshStandardMaterial color={DEEP} roughness={0.3} emissive={COBALT} emissiveIntensity={0.18} />
      </RoundedBox>
      {/* floppy drive + LED */}
      <mesh position={[0.35, -0.56, 0.64]}>
        <boxGeometry args={[0.82, 0.08, 0.02]} />
        <meshStandardMaterial color="#2a2547" roughness={0.6} />
      </mesh>
      <mesh position={[0.95, -0.56, 0.645]}>
        <boxGeometry args={[0.1, 0.05, 0.02]} />
        <meshBasicMaterial ref={ledRef} color="#3cc98a" toneMapped={false} />
      </mesh>
      {[-1.05, -0.9, -0.75].map((x) => (
        <mesh key={x} position={[x, -0.56, 0.64]}>
          <boxGeometry args={[0.06, 0.12, 0.02]} />
          <meshStandardMaterial color="#d9d0bb" roughness={0.8} />
        </mesh>
      ))}
      {/* stand */}
      <mesh position={[0, -0.95, -0.1]}>
        <boxGeometry args={[1.1, 0.12, 0.9]} />
        <meshStandardMaterial color={CREAM} roughness={0.75} />
      </mesh>
      {screen === "face" && <Face mood={mood} />}
    </group>
  );
}

function Rig({ children, intensity = 1 }: { children: React.ReactNode; intensity?: number }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }, dt) => {
    if (!g.current) return;
    g.current.rotation.y = damp(g.current.rotation.y, pointer.x * 0.28 * intensity - 0.12, 2.5, dt);
    g.current.rotation.x = damp(g.current.rotation.x, -pointer.y * 0.1 * intensity + 0.04, 2.5, dt);
    g.current.position.y = Math.sin(clock.elapsedTime * 0.8) * 0.04;
  });
  return <group ref={g}>{children}</group>;
}

function useInView<T extends Element>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(true);
  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: "100px" });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return { ref, inView };
}

export function HeroTerminal({ screen }: { screen: React.ReactNode }) {
  usePointer();
  const [led, setLed] = useState(0);
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className="h-full w-full">
      <Canvas
        frameloop={inView ? "always" : "never"}
        dpr={[1, 1.75]}
        camera={{ position: [0, 0.35, 7.4], fov: 34 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        aria-label="A retro computer terminal reading floppy-disk manuals"
      >
        <hemisphereLight args={["#fffaf0", "#c9c3ff", 1.1]} />
        <directionalLight position={[3, 5, 4]} intensity={1.6} />
        <directionalLight position={[-4, 2, -2]} intensity={0.45} color="#b9b2ff" />
        <Suspense fallback={null}>
          <Rig>
            <Monitor screen="html" led={led} />
            <Html transform distanceFactor={2.37} position={[0, 0.42, 0.7]} zIndexRange={[10, 0]} pointerEvents="none">
              <div style={{ width: 320, height: 240 }}>{screen}</div>
            </Html>
            <Keyboard />
            <Floppies onInsert={() => setLed(performance.now())} />
          </Rig>
          <ContactShadows position={[0, -1.32, 0]} opacity={0.32} scale={9} blur={2.6} far={3} color="#150f6e" />
        </Suspense>
      </Canvas>
    </div>
  );
}

export function MascotTerminal({ mood, distance = 6.2 }: { mood: Mood; distance?: number }) {
  usePointer();
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className="h-full w-full">
      <Canvas frameloop={inView ? "always" : "never"} dpr={[1, 1.75]} camera={{ position: [0, 0.15, distance], fov: 32 }} gl={{ antialias: true, alpha: true }} aria-label="The helpdesk assistant">
        <hemisphereLight args={["#fffaf0", "#c9c3ff", 1.1]} />
        <directionalLight position={[3, 5, 4]} intensity={1.5} />
        <Suspense fallback={null}>
          <Rig intensity={0.6}>
            <Monitor screen="face" mood={mood} led={mood === "thinking" ? performance.now() : 0} />
          </Rig>
          <ContactShadows position={[0, -1.08, 0]} opacity={0.28} scale={6} blur={2.4} far={2} color="#150f6e" />
        </Suspense>
      </Canvas>
    </div>
  );
}
