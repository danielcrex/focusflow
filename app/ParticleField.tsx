'use client';

import { useEffect, useRef, type RefObject } from 'react';

/**
 * A calm, meditative physics particle field. Particles stream out of the clock
 * circle and interact as soft bodies: each one repels its near neighbours, so
 * the field self-organises into a gently drifting, breathing lattice rather
 * than overlapping into mush. Interaction is made cheap for thousands of
 * particles with a uniform spatial-hash grid (each particle only tests the 3x3
 * block of cells around it), and the state lives in flat typed arrays.
 *
 * Runs only while `active`, and respects prefers-reduced-motion.
 */

const CAP = 3200; // hard cap on live particles
const EMIT_RATE = 150; // particles spawned per second (continuous, not pulsed)
const LIFE = 22; // seconds a particle lives (avg)
const INIT_SPEED = 34; // px/s outward nudge at birth
const CELL = 26; // spatial-hash cell size == interaction radius
const REPULSION = 1150; // strength of neighbour repulsion
const FRICTION_PER_SEC = 0.5; // velocity retained per second (decay -> settles)
const MAX_SPEED = 260; // px/s clamp, keeps the sim stable and gentle
const OFFSCREEN_MARGIN = 140; // cull particles this far outside the viewport
const DOT_RADIUS = 1.2;
const PEAK_ALPHA = 0.34;
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const clearCanvas = () => ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!active) {
      clearCanvas();
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // Particle state as flat typed arrays (swap-removed to stay compact).
    const px = new Float32Array(CAP);
    const py = new Float32Array(CAP);
    const vx = new Float32Array(CAP);
    const vy = new Float32Array(CAP);
    const age = new Float32Array(CAP);
    const life = new Float32Array(CAP);
    let count = 0;

    const R2 = CELL * CELL;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let cx = 0;
    let cy = 0;
    let startRadius = 150;
    let cols = 0;
    let rows = 0;
    let head = new Int32Array(0);
    const next = new Int32Array(CAP);

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
        startRadius = (Math.min(r.width, r.height) / 2) * 0.94;
      } else {
        cx = width / 2;
        cy = height / 2;
      }
      cols = Math.ceil(width / CELL) + 1;
      rows = Math.ceil(height / CELL) + 1;
      head = new Int32Array(cols * rows);
    };
    measure();
    window.addEventListener('resize', measure);

    const spawn = () => {
      if (count >= CAP) return;
      const a = Math.random() * Math.PI * 2;
      const sr = startRadius + (Math.random() - 0.5) * 6;
      const sp = INIT_SPEED * (0.85 + Math.random() * 0.3);
      const i = count++;
      px[i] = cx + Math.cos(a) * sr;
      py[i] = cy + Math.sin(a) * sr;
      vx[i] = Math.cos(a) * sp;
      vy[i] = Math.sin(a) * sp;
      age[i] = 0;
      life[i] = LIFE * (0.8 + Math.random() * 0.4);
    };

    const remove = (i: number) => {
      const last = --count;
      px[i] = px[last];
      py[i] = py[last];
      vx[i] = vx[last];
      vy[i] = vy[last];
      age[i] = age[last];
      life[i] = life[last];
    };

    let last = performance.now();
    let emitAcc = 0;

    const frame = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;

      // Continuous emission (spread across frames so there is no pulse).
      emitAcc += EMIT_RATE * dt;
      while (emitAcc >= 1) {
        spawn();
        emitAcc -= 1;
      }

      // Build the spatial hash for this frame.
      head.fill(-1);
      for (let i = 0; i < count; i++) {
        let gx = (px[i] / CELL) | 0;
        let gy = (py[i] / CELL) | 0;
        if (gx < 0) gx = 0;
        else if (gx >= cols) gx = cols - 1;
        if (gy < 0) gy = 0;
        else if (gy >= rows) gy = rows - 1;
        const c = gy * cols + gx;
        next[i] = head[c];
        head[c] = i;
      }

      // Neighbour repulsion — each unordered pair handled once (j > i).
      for (let i = 0; i < count; i++) {
        let gx = (px[i] / CELL) | 0;
        let gy = (py[i] / CELL) | 0;
        if (gx < 0) gx = 0;
        else if (gx >= cols) gx = cols - 1;
        if (gy < 0) gy = 0;
        else if (gy >= rows) gy = rows - 1;
        const xi = px[i];
        const yi = py[i];
        for (let oy = -1; oy <= 1; oy++) {
          const ny = gy + oy;
          if (ny < 0 || ny >= rows) continue;
          for (let ox = -1; ox <= 1; ox++) {
            const nx = gx + ox;
            if (nx < 0 || nx >= cols) continue;
            let j = head[ny * cols + nx];
            while (j !== -1) {
              if (j > i) {
                const dx = px[j] - xi;
                const dy = py[j] - yi;
                const d2 = dx * dx + dy * dy;
                if (d2 < R2 && d2 > 0.0001) {
                  const d = Math.sqrt(d2);
                  const f = (REPULSION * (1 - d / CELL)) / d;
                  const fx = dx * f * dt;
                  const fy = dy * f * dt;
                  vx[i] -= fx;
                  vy[i] -= fy;
                  vx[j] += fx;
                  vy[j] += fy;
                }
              }
              j = next[j];
            }
          }
        }
      }

      // Integrate, fade, cull, and draw.
      const damp = Math.pow(FRICTION_PER_SEC, dt);
      clearCanvas();
      ctx.fillStyle = `rgb(${ACCENT_RGB})`;
      for (let i = count - 1; i >= 0; i--) {
        age[i] += dt;
        if (age[i] >= life[i]) {
          remove(i);
          continue;
        }
        let ux = vx[i] * damp;
        let uy = vy[i] * damp;
        const sp2 = ux * ux + uy * uy;
        if (sp2 > MAX_SPEED * MAX_SPEED) {
          const s = MAX_SPEED / Math.sqrt(sp2);
          ux *= s;
          uy *= s;
        }
        vx[i] = ux;
        vy[i] = uy;
        const x = (px[i] += ux * dt);
        const y = (py[i] += uy * dt);

        if (
          x < -OFFSCREEN_MARGIN ||
          x > width + OFFSCREEN_MARGIN ||
          y < -OFFSCREEN_MARGIN ||
          y > height + OFFSCREEN_MARGIN
        ) {
          remove(i);
          continue;
        }

        const t = age[i] / life[i];
        const alpha = PEAK_ALPHA * smoothstep(0, 0.06, t) * (1 - smoothstep(0.55, 1, t));
        if (alpha <= 0.002) continue;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', measure);
      clearCanvas();
    };
  }, [active, originRef]);

  return (
    <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-0" aria-hidden="true" />
  );
}
