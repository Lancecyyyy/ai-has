"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { playBell } from "@/lib/client/sound";

/**
 * The assistant's body: a front-desk service bell on a piece of desk hardware.
 * Ring it = ask for help. LEDs show state, knobs turn while it works,
 * and the slot prints a ticket slip when something gets resolved.
 */

export type Mood = "idle" | "thinking" | "happy" | "alert";

const ALU = "#d6d6d2";
const ALU_DARK = "#bdbdb8";
const CARBON = "#161616";
const SIGNAL = "#ff4d00";
const damp = THREE.MathUtils.damp;

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

/** Shared ring trigger so the dome, plunger, wave and slip animate together. */
type RingState = { t: number };

function domeGeometry() {
  const r = 0.72;
  // bottom-to-top profile: inner lip, outer lip, then the dome arc up to the crown
  const pts: THREE.Vector2[] = [new THREE.Vector2(r - 0.02, -0.06), new THREE.Vector2(r + 0.04, -0.06), new THREE.Vector2(r + 0.04, -0.02)];
  for (let i = 0; i <= 28; i++) {
    const a = (i / 28) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.max(0.0001, Math.cos(a) * r), Math.sin(a) * r * 0.82));
  }
  const g = new THREE.LatheGeometry(pts, 64);
  g.computeVertexNormals();
  return g;
}

function Bell({ ring, onRing, interactive }: { ring: React.RefObject<RingState>; onRing: () => void; interactive: boolean }) {
  const dome = useRef<THREE.Group>(null);
  const plunger = useRef<THREE.Group>(null);
  const wave = useRef<THREE.Mesh>(null);
  const waveMat = useRef<THREE.MeshBasicMaterial>(null);
  const geo = useMemo(domeGeometry, []);
  const [hover, setHover] = useState(false);
  useEffect(() => {
    if (!interactive) return;
    document.body.style.cursor = hover ? "pointer" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hover, interactive]);

  useFrame((_, dt) => {
    const r = ring.current;
    const since = r.t >= 0 ? performance.now() / 1000 - r.t : 99;
    if (plunger.current) plunger.current.position.y = 0.66 - (since < 0.14 ? Math.sin((since / 0.14) * Math.PI) * 0.07 : 0);
    if (dome.current) {
      const wob = since < 1.6 ? Math.sin(since * 38) * 0.035 * Math.exp(-since * 3) : 0;
      dome.current.rotation.z = wob;
      dome.current.rotation.x = wob * 0.6;
      const s = hover && interactive ? 1.03 : 1;
      dome.current.scale.setScalar(damp(dome.current.scale.x, s, 10, dt));
    }
    if (wave.current && waveMat.current) {
      const p = Math.min(1, since / 1.1);
      wave.current.visible = since < 1.1;
      wave.current.scale.setScalar(1 + p * 1.8);
      waveMat.current.opacity = (1 - p) * 0.5;
    }
  });

  const press = (e: ThreeEvent<PointerEvent>) => {
    if (!interactive) return;
    e.stopPropagation();
    onRing();
  };

  return (
    <group>
      {/* rubber pad */}
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.86, 0.9, 0.08, 64]} />
        <meshStandardMaterial color={CARBON} roughness={0.85} />
      </mesh>
      <group ref={dome} position={[0, 0.12, 0]} onPointerDown={press} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
        <mesh geometry={geo}>
          <meshStandardMaterial color={SIGNAL} metalness={0.45} roughness={0.28} side={THREE.DoubleSide} />
        </mesh>
        <group ref={plunger} position={[0, 0.66, 0]}>
          <mesh position={[0, -0.04, 0]}>
            <cylinderGeometry args={[0.045, 0.045, 0.18, 20]} />
            <meshStandardMaterial color="#e8e8e8" metalness={0.9} roughness={0.15} />
          </mesh>
          <mesh position={[0, 0.07, 0]}>
            <sphereGeometry args={[0.11, 24, 16]} />
            <meshStandardMaterial color={CARBON} roughness={0.4} />
          </mesh>
        </group>
      </group>
      <mesh ref={wave} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]} visible={false}>
        <ringGeometry args={[0.8, 0.84, 64]} />
        <meshBasicMaterial ref={waveMat} color={SIGNAL} transparent opacity={0} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Led({ position, mood, kind }: { position: [number, number, number]; mood: Mood; kind: "power" | "work" | "alert" }) {
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const off = new THREE.Color("#3a3a38");
  useFrame(({ clock }, dt) => {
    if (!mat.current) return;
    const t = clock.elapsedTime;
    let target = off;
    if (kind === "power") target = new THREE.Color(mood === "alert" ? "#3a3a38" : "#19d27a").multiplyScalar(mood === "idle" ? 0.75 + Math.sin(t * 2) * 0.25 : 1);
    if (kind === "work" && (mood === "thinking" || mood === "happy")) target = new THREE.Color(mood === "happy" ? "#19d27a" : SIGNAL).multiplyScalar(mood === "thinking" ? (Math.sin(t * 14) > 0 ? 1 : 0.15) : 1);
    if (kind === "alert" && mood === "alert") target = new THREE.Color("#ff2a2a").multiplyScalar(Math.sin(t * 9) > 0 ? 1 : 0.2);
    mat.current.color.lerp(target, 1 - Math.exp(-dt * 20));
  });
  return (
    <group position={position}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.055, 0.055, 0.02, 20]} />
        <meshStandardMaterial color="#9a9a96" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0, 0.012]}>
        <sphereGeometry args={[0.04, 16, 12]} />
        <meshBasicMaterial ref={mat} color="#3a3a38" toneMapped={false} />
      </mesh>
    </group>
  );
}

function Knob({ position, spin }: { position: [number, number, number]; spin: () => number }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y += spin() * dt;
  });
  return (
    <group position={position}>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.02, 40]} />
        <meshStandardMaterial color={ALU_DARK} metalness={0.6} roughness={0.35} />
      </mesh>
      <group ref={g}>
        <mesh position={[0, 0.1, 0]}>
          <cylinderGeometry args={[0.15, 0.16, 0.16, 40]} />
          <meshStandardMaterial color={CARBON} roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.185, 0.08]}>
          <boxGeometry args={[0.025, 0.012, 0.11]} />
          <meshBasicMaterial color={SIGNAL} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

function slipTexture(lines: string[]) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 320;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fbfbf8";
  ctx.fillRect(0, 0, 256, 320);
  ctx.fillStyle = "#161616";
  ctx.font = "600 22px ui-monospace, monospace";
  ctx.fillText("AI-HAS", 20, 44);
  ctx.font = "15px ui-monospace, monospace";
  ctx.fillStyle = "#555";
  ctx.fillText("MERIDIAN IT DESK", 20, 68);
  ctx.strokeStyle = "#bbb";
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(20, 86);
  ctx.lineTo(236, 86);
  ctx.stroke();
  ctx.fillStyle = "#161616";
  ctx.font = "17px ui-monospace, monospace";
  lines.forEach((l, i) => ctx.fillText(l, 20, 118 + i * 30));
  ctx.fillStyle = SIGNAL;
  ctx.fillRect(20, 270, 92, 26);
  ctx.fillStyle = "#161616";
  ctx.font = "600 15px ui-monospace, monospace";
  ctx.fillText("RESOLVED", 26, 288);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const SLIPS = [
  ["HAS-1187", "VPN profile", "re-issued", "2.2s"],
  ["HAS-1192", "Password reset", "link sent", "1.9s"],
  ["HAS-1204", "Figma access", "approved", "3.1s"],
];

/** Ticket slip that feeds out of the front slot after each ring. */
function Slip({ ring }: { ring: React.RefObject<RingState> }) {
  const g = useRef<THREE.Group>(null);
  const textures = useMemo(() => SLIPS.map(slipTexture), []);
  const [idx, setIdx] = useState(0);
  const lastRing = useRef(-1);
  useFrame(() => {
    const r = ring.current;
    if (r.t !== lastRing.current && r.t >= 0) {
      lastRing.current = r.t;
      setIdx((i) => (i + 1) % SLIPS.length);
    }
    const since = r.t >= 0 ? performance.now() / 1000 - r.t : 99;
    // out between 0.4s and 1.4s, hold, back in after 3.4s
    let p = 0;
    if (since > 0.4 && since < 1.4) p = THREE.MathUtils.smoothstep(since, 0.4, 1.4);
    else if (since >= 1.4 && since < 3.4) p = 1;
    else if (since >= 3.4 && since < 4) p = 1 - THREE.MathUtils.smoothstep(since, 3.4, 4);
    if (g.current) {
      g.current.scale.y = Math.max(0.0001, p);
      g.current.visible = p > 0.001;
    }
  });
  return (
    <group position={[0.95, -0.08, 1.02]} rotation={[0.18, 0, 0]}>
      <group ref={g}>
        <mesh position={[0, -0.45, 0]}>
          <planeGeometry args={[0.72, 0.9]} />
          <meshStandardMaterial map={textures[idx]} roughness={0.95} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

function LcdFace({ mood }: { mood: Mood }) {
  const eyes = useRef<THREE.Group>(null);
  const l = useRef<THREE.Mesh>(null);
  const r = useRef<THREE.Mesh>(null);
  const scan = useRef<THREE.Mesh>(null);
  const blink = useRef({ next: 2, t: -1 });
  const color = mood === "alert" ? "#ff3b3b" : mood === "happy" ? "#19d27a" : SIGNAL;
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
    if (eyes.current) {
      eyes.current.position.x = damp(eyes.current.position.x, mood === "thinking" ? 0.12 + Math.sin(time * 2.4) * 0.06 : pointer.x * 0.14, 6, dt);
      eyes.current.position.y = damp(eyes.current.position.y, mood === "thinking" ? 0.06 : pointer.y * 0.06, 6, dt);
    }
    const sy = mood === "happy" ? 0.3 : mood === "alert" ? 1.3 : 1;
    for (const e of [l.current, r.current]) if (e) e.scale.y = damp(e.scale.y, sy * Math.max(0.08, open), 18, dt);
    if (scan.current) {
      scan.current.visible = mood === "thinking";
      scan.current.position.x = -0.6 + ((time * 1.2) % 1.2);
    }
  });
  return (
    <group position={[0, 0, 0.065]}>
      <group ref={eyes}>
        <mesh ref={l} position={[-0.22, 0, 0]}>
          <boxGeometry args={[0.13, 0.26, 0.01]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
        <mesh ref={r} position={[0.22, 0, 0]}>
          <boxGeometry args={[0.13, 0.26, 0.01]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      </group>
      <mesh ref={scan} position={[0, -0.26, 0.004]}>
        <boxGeometry args={[0.18, 0.025, 0.004]} />
        <meshBasicMaterial color={SIGNAL} toneMapped={false} />
      </mesh>
    </group>
  );
}


/** Scripted demo drawn onto the LCD as a texture (answer, fix, hand-off). */
type DemoLine = { who: "you" | "has" | "sys"; text: string; tag?: string };
const DEMO: { label: string; steps: DemoLine[] }[] = [
  {
    label: "FIX",
    steps: [
      { who: "you", text: "VPN says certificate expired" },
      { who: "has", text: "I can re-issue your VPN profile now.", tag: "ROUTINE" },
      { who: "sys", text: "revoke old cert ......... OK" },
      { who: "sys", text: "push profile via MDM ..... OK" },
      { who: "has", text: "Done. Reopen GlobalConnect." },
    ],
  },
  {
    label: "ANSWER",
    steps: [
      { who: "you", text: "Outlook keeps asking for my password" },
      { who: "sys", text: "reading EMAIL.SOP ........ 0.81" },
      { who: "has", text: "Sign out of Office, then back in.", tag: "SRC 1" },
      { who: "you", text: "that fixed it" },
    ],
  },
  {
    label: "HAND-OFF",
    steps: [
      { who: "you", text: "I clicked a link in a weird email" },
      { who: "has", text: "Disconnect Wi-Fi. Keep the email.", tag: "P1" },
      { who: "sys", text: "ticket HAS-1187 -> Security" },
    ],
  },
];

function LcdDemo() {
  const { canvas, tex } = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 680;
    canvas.height = 416;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return { canvas, tex };
  }, []);
  const [s, setS] = useState(0);
  const [n, setN] = useState(0);
  const [typing, setTyping] = useState(false);
  const [dot, setDot] = useState(0);

  useEffect(() => {
    const steps = DEMO[s].steps;
    if (n < steps.length) {
      const next = steps[n];
      setTyping(next.who === "has");
      const t = setTimeout(() => {
        setTyping(false);
        setN(n + 1);
      }, next.who === "has" ? 900 : next.who === "sys" ? 450 : 700);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setN(0);
      setS((s + 1) % DEMO.length);
    }, 2600);
    return () => clearTimeout(t);
  }, [s, n]);

  useEffect(() => {
    if (!typing) return;
    const t = setInterval(() => setDot((d) => (d + 1) % 3), 220);
    return () => clearInterval(t);
  }, [typing]);

  useEffect(() => {
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width;
    const H = canvas.height;
    const mono = (getComputedStyle(document.documentElement).getPropertyValue("--font-jetbrains") || "monospace").trim();
    ctx.fillStyle = "#0e0e0d";
    ctx.fillRect(0, 0, W, H);
    // pixel matrix
    ctx.fillStyle = "rgba(255,255,255,0.035)";
    for (let y = 0; y < H; y += 4) for (let x = 0; x < W; x += 4) ctx.fillRect(x, y, 1.4, 1.4);
    // header
    ctx.font = `500 17px ${mono}`;
    ctx.fillStyle = "rgba(237,237,234,0.5)";
    ctx.textBaseline = "middle";
    ctx.fillText("AI-HAS · DESK 01", 24, 30);
    let hx = W - 24;
    [...DEMO].reverse().forEach((d, ri) => {
      const i = DEMO.length - 1 - ri;
      const w = ctx.measureText(d.label).width + 14;
      hx -= w;
      if (i === s) {
        ctx.fillStyle = SIGNAL;
        ctx.fillRect(hx, 18, w, 24);
        ctx.fillStyle = "#121212";
      } else ctx.fillStyle = "rgba(237,237,234,0.4)";
      ctx.fillText(d.label, hx + 7, 31);
      hx -= 8;
    });
    // lines, bottom-up
    const lines = DEMO[s].steps.slice(0, n);
    let y = H - 40 - (typing ? 34 : 0);
    ctx.font = `20px ${mono}`;
    for (let i = lines.length - 1; i >= 0 && y > 70; i--) {
      const l = lines[i];
      if (l.who === "you") {
        const w = ctx.measureText(l.text).width + 20;
        ctx.fillStyle = "#ededea";
        ctx.fillRect(W - 24 - w, y - 17, w, 34);
        ctx.fillStyle = "#121212";
        ctx.fillText(l.text, W - 24 - w + 10, y + 1);
      } else if (l.who === "sys") {
        ctx.fillStyle = "rgba(237,237,234,0.42)";
        ctx.fillText("> " + l.text, 24, y);
      } else {
        ctx.fillStyle = "#ff6a1f";
        ctx.fillText(l.text, 24, y);
        if (l.tag) {
          const tx = 24 + ctx.measureText(l.text).width + 12;
          ctx.font = `14px ${mono}`;
          const tw = ctx.measureText(l.tag).width + 12;
          ctx.strokeStyle = "rgba(255,106,31,0.7)";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(tx, y - 11, tw, 22);
          ctx.fillText(l.tag, tx + 6, y + 1);
          ctx.font = `20px ${mono}`;
        }
      }
      y -= 44;
    }
    if (typing) {
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i === dot ? "#ff6a1f" : "rgba(255,106,31,0.3)";
        ctx.fillRect(24 + i * 18, H - 62, 10, 10);
      }
    }
    // prompt line
    ctx.fillStyle = "rgba(237,237,234,0.15)";
    ctx.fillRect(24, H - 28, W - 48, 1.5);
    tex.needsUpdate = true;
  }, [canvas, tex, s, n, typing, dot]);

  return (
    <mesh position={[0, 0, 0.063]}>
      <planeGeometry args={[1.7, 1.04]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

/** The desk unit: base, bell, LCD, knobs, LEDs, slot. */
function Desk({ mood, demo, ring, onRing, interactive }: { mood: Mood; demo: boolean; ring: React.RefObject<RingState>; onRing: () => void; interactive: boolean }) {
  const spin = () => (mood === "thinking" ? 3.2 : 0.15);
  return (
    <group>
      {/* base */}
      <RoundedBox args={[3.7, 0.56, 2.1]} radius={0.14} smoothness={4} position={[0, -0.28, 0]}>
        <meshStandardMaterial color={ALU} metalness={0.55} roughness={0.38} />
      </RoundedBox>
      {/* top seam + grid of vents */}
      <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.5, 1.9]} />
        <meshStandardMaterial color="#cfcfcb" metalness={0.5} roughness={0.45} />
      </mesh>
      {Array.from({ length: 7 }).map((_, i) => (
        <mesh key={i} position={[0.35 + i * 0.12, 0.004, 0.72]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.04, 0.36]} />
          <meshStandardMaterial color="#8f8f8b" roughness={0.7} />
        </mesh>
      ))}
      {/* feet */}
      {[-1.55, 1.55].map((x) => (
        <mesh key={x} position={[x, -0.6, 0]}>
          <boxGeometry args={[0.3, 0.06, 1.7]} />
          <meshStandardMaterial color={CARBON} roughness={0.9} />
        </mesh>
      ))}
      <group position={[-0.95, 0, 0.1]}>
        <Bell ring={ring} onRing={onRing} interactive={interactive} />
      </group>
      {/* LCD on a stand */}
      <group position={[0.85, 0.66, -0.35]} rotation={[-0.32, 0, 0]}>
        <mesh position={[0, -0.6, -0.05]}>
          <boxGeometry args={[0.5, 0.5, 0.18]} />
          <meshStandardMaterial color={ALU_DARK} metalness={0.6} roughness={0.35} />
        </mesh>
        <RoundedBox args={[1.86, 1.2, 0.12]} radius={0.05} smoothness={3}>
          <meshStandardMaterial color={CARBON} roughness={0.5} />
        </RoundedBox>
        <mesh position={[0, 0, 0.061]}>
          <planeGeometry args={[1.7, 1.04]} />
          <meshStandardMaterial color="#0e0e0d" roughness={0.25} metalness={0.2} />
        </mesh>
{demo ? <LcdDemo /> : <LcdFace mood={mood} />}
      </group>
      <Knob position={[0.42, 0, 0.62]} spin={spin} />
      <Knob position={[1.38, 0, 0.62]} spin={() => -spin() * 0.6} />
      {/* front face: LEDs + slot */}
      <Led position={[-1.55, -0.24, 1.05]} mood={mood} kind="power" />
      <Led position={[-1.38, -0.24, 1.05]} mood={mood} kind="work" />
      <Led position={[-1.21, -0.24, 1.05]} mood={mood} kind="alert" />
      <mesh position={[0.95, -0.08, 1.051]}>
        <boxGeometry args={[0.86, 0.045, 0.01]} />
        <meshStandardMaterial color="#0c0c0c" roughness={0.8} />
      </mesh>
      <Slip ring={ring} />
    </group>
  );
}

function Rig({ children, intensity = 1, tilt = 0.4, y = -0.15 }: { children: React.ReactNode; intensity?: number; tilt?: number; y?: number }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }, dt) => {
    if (!g.current) return;
    g.current.rotation.y = damp(g.current.rotation.y, pointer.x * 0.3 * intensity - 0.28, 2.5, dt);
    g.current.rotation.x = damp(g.current.rotation.x, tilt - pointer.y * 0.08 * intensity, 2.5, dt);
    g.current.position.y = y + Math.sin(clock.elapsedTime * 0.8) * 0.03;
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


/** Pull the camera back on narrow (portrait) canvases so the whole unit stays in frame. */
function Fit({ base }: { base: number }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    camera.position.z = aspect < 1.25 ? base * (1.25 / Math.max(0.55, aspect)) * 1.12 : base;
    camera.updateProjectionMatrix();
  }, [camera, size, base]);
  return null;
}

function Lights() {
  return (
    <>
      <hemisphereLight args={["#ffffff", "#bfbfb8", 1.2]} />
      <directionalLight position={[3, 6, 4]} intensity={2.1} />
      <directionalLight position={[-5, 3, -2]} intensity={0.7} color="#ffe2d1" />
      <directionalLight position={[0, 2, 6]} intensity={0.5} />
    </>
  );
}

/** Landing hero: auto-rings every few seconds; click the bell to ring it yourself (with sound). */
export function HeroDesk() {
  usePointer();
  const ring = useRef<RingState>({ t: -1 });
  const { ref, inView } = useInView<HTMLDivElement>();
  const [mood, setMood] = useState<Mood>("idle");
  useEffect(() => {
    let i = 0;
    const tick = () => {
      i++;
      setMood("thinking");
      setTimeout(() => {
        ring.current.t = performance.now() / 1000;
        setMood("happy");
      }, 1400);
      setTimeout(() => setMood("idle"), 4200);
    };
    const first = setTimeout(tick, 1600);
    const t = setInterval(tick, 6500);
    return () => {
      clearTimeout(first);
      clearInterval(t);
      void i;
    };
  }, []);
  return (
    <div ref={ref} className="h-full w-full">
      <Canvas frameloop={inView ? "always" : "never"} dpr={[1, 1.75]} camera={{ position: [0, 0.3, 7.3], fov: 30 }} gl={{ antialias: true, alpha: true }} aria-label="A desk service bell with a small screen, the AI-HAS assistant">
        <Lights />
        <Fit base={6.9} />
        <Suspense fallback={null}>
          <Rig y={-0.4}>
            <Desk
              mood={mood}
              demo
              ring={ring}
              interactive
              onRing={() => {
                ring.current.t = performance.now() / 1000;
                playBell();
              }}
            />
          </Rig>
          <ContactShadows position={[0, -1.2, 0]} opacity={0.35} scale={10} blur={2.4} far={3} color="#111111" />
        </Suspense>
      </Canvas>
    </div>
  );
}

/** Chat mascot: LCD shows eyes; rings (with sound) when something gets fixed. */
export function BellMascot({ mood, distance = 7.2 }: { mood: Mood; distance?: number }) {
  usePointer();
  const ring = useRef<RingState>({ t: -1 });
  const { ref, inView } = useInView<HTMLDivElement>();
  const prev = useRef<Mood>(mood);
  useEffect(() => {
    if (mood === "happy" && prev.current !== "happy") {
      ring.current.t = performance.now() / 1000;
      playBell(0.5);
    }
    prev.current = mood;
  }, [mood]);
  return (
    <div ref={ref} className="h-full w-full">
      <Canvas frameloop={inView ? "always" : "never"} dpr={[1, 1.75]} camera={{ position: [0, 0.3, distance], fov: 30 }} gl={{ antialias: true, alpha: true }} aria-label="The helpdesk assistant">
        <Lights />
        <Fit base={distance} />
        <Suspense fallback={null}>
          <Rig intensity={0.6}>
            <Desk
              mood={mood}
              demo={false}
              ring={ring}
              interactive
              onRing={() => {
                ring.current.t = performance.now() / 1000;
                playBell(0.6);
              }}
            />
          </Rig>
          <ContactShadows position={[0, -0.95, 0]} opacity={0.3} scale={8} blur={2.4} far={2} color="#111111" />
        </Suspense>
      </Canvas>
    </div>
  );
}
