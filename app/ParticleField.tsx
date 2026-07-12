'use client';

import { useEffect, useRef, type RefObject } from 'react';

/**
 * A calm, meditative particle field. Every second a gentle concentric wave of
 * particles is emitted from the clock circle. Particles drift slowly outward
 * with soft velocity decay (natural deceleration) and fade out very gradually,
 * so successive rings overlap into a delicate, breathing lattice rather than a
 * busy or pulsing effect. Runs only while `active`, and respects
 * prefers-reduced-motion.
 */

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
};

const RING_INTERVAL = 1.0; // seconds between waves
const PARTICLES_PER_RING = 40; // dots per ring
const INIT_SPEED = 90; // px/s, outward — kept slow for a gentle drift
const DAMP_PER_SEC = 0.86; // fraction of speed retained each second (decay)
const LIFE = 17; // seconds a particle lives
const PEAK_ALPHA = 0.4; // low, so the field stays subtle
const DOT_RADIUS = 1.5; // px
const ACCENT_RGB = '43, 84, 240';

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

export default function ParticleField({
  originRef,
  active,
}: {
  originRef: RefObject<HTMLElement | null>;
  active: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const clear = () => ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!active) {
      particlesRef.current = [];
      clear();
      return;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let cx = 0;
    let cy = 0;
    let startRadius = 150;

    const measure = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const el = originRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        cx = r.left + r.width / 2;
        cy = r.top + r.height / 2;
        // Emit from just outside the progress ring (~94% of the box radius).
        startRadius = (Math.min(r.width, r.height) / 2) * 0.94;
      } else {
        cx = width / 2;
        cy = height / 2;
      }
    };
    measure();
    window.addEventListener('resize', measure);

    const spawnRing = () => {
      // Rotate each ring by a random offset so the lattice reads as organic
      // rather than a fixed radial grid (keeps it from feeling hypnotic).
      const base = Math.random() * Math.PI * 2;
      for (let i = 0; i < PARTICLES_PER_RING; i++) {
        // Gentle angular jitter keeps the ring organic; radius/speed are held
        // nearly uniform so every particle in a wave stays on a common
        // expanding circle — i.e. the rings read as recognizable concentric
        // waves rather than smearing radially over time.
        const a =
          base + (i / PARTICLES_PER_RING) * Math.PI * 2 + (Math.random() - 0.5) * 0.03;
        const sr = startRadius + (Math.random() - 0.5) * 3;
        const sp = INIT_SPEED * (0.98 + Math.random() * 0.04);
        particlesRef.current.push({
          x: cx + Math.cos(a) * sr,
          y: cy + Math.sin(a) * sr,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          age: 0,
          life: LIFE * (0.85 + Math.random() * 0.3),
        });
      }
    };

    let last = performance.now();
    let sinceRing = RING_INTERVAL; // emit the first ring immediately

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      sinceRing += dt;
      while (sinceRing >= RING_INTERVAL) {
        spawnRing();
        sinceRing -= RING_INTERVAL;
      }

      const damp = Math.pow(DAMP_PER_SEC, dt);
      clear();
      ctx.fillStyle = `rgb(${ACCENT_RGB})`;

      const arr = particlesRef.current;
      for (let i = arr.length - 1; i >= 0; i--) {
        const p = arr[i];
        p.age += dt;
        if (p.age >= p.life) {
          arr.splice(i, 1);
          continue;
        }
        p.vx *= damp;
        p.vy *= damp;
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        const t = p.age / p.life;
        // Gentle fade in, then a long, graceful fade out.
        const alpha = PEAK_ALPHA * smoothstep(0, 0.1, t) * (1 - smoothstep(0.4, 1, t));
        if (alpha <= 0.002) continue;

        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, DOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', measure);
      particlesRef.current = [];
      clear();
    };
  }, [active, originRef]);

  return (
    <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-0" aria-hidden="true" />
  );
}
