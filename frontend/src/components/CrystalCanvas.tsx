import React, { useEffect, useRef } from 'react';

export interface MarkerMaterial {
  id: string;
  formula: string;
  name: string;
  category: string;
  density: number;
  e_hull: number;
  band_gap: number;
  tau: number;
  hash: string;
  pos: [number, number, number];
}

export const DISCOVERED_MARKERS: MarkerMaterial[] = [
  {
    id: 'm1',
    formula: 'TiVAl',
    name: 'Aerospace High-Entropy Alloy',
    category: 'Structural Metallic',
    density: 4.52,
    e_hull: 0.002,
    band_gap: 0.0,
    tau: 0.08,
    hash: '0x7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
    pos: [-140, -40, 60],
  },
  {
    id: 'm2',
    formula: 'LiFePO4',
    name: 'Olivine Energy Storage Cathode',
    category: 'Battery Electrolyte',
    density: 3.60,
    e_hull: 0.000,
    band_gap: 3.75,
    tau: 0.05,
    hash: '0x9a82c4217ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d3311',
    pos: [120, -90, -40],
  },
  {
    id: 'm3',
    formula: 'BaTiO3',
    name: 'Perovskite Dielectric',
    category: 'Ferroelectric Ceramic',
    density: 6.02,
    e_hull: 0.003,
    band_gap: 3.20,
    tau: 0.06,
    hash: '0x12c4b8157ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d4455',
    pos: [130, 80, 50],
  },
  {
    id: 'm4',
    formula: 'SrTiO3',
    name: 'Quantum Oxide Substrate',
    category: 'Semiconductor Oxide',
    density: 5.12,
    e_hull: 0.001,
    band_gap: 3.25,
    tau: 0.07,
    hash: '0x43b2e9857ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d8822',
    pos: [-80, 110, -50],
  },
  {
    id: 'm5',
    formula: 'YBa2Cu3O7',
    name: 'Cuprate High-Tc Superconductor',
    category: 'Quantum Condensate',
    density: 6.38,
    e_hull: 0.007,
    band_gap: 0.0,
    tau: 0.11,
    hash: '0x55a1d7757ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9900',
    pos: [0, -130, 40],
  },
];

interface CrystalCanvasProps {
  onSelectMarker: (marker: MarkerMaterial) => void;
  selectedMarkerId?: string | null;
}

export default function CrystalCanvas({ onSelectMarker, selectedMarkerId }: CrystalCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Generate Crystal Lattice Nodes (FCC / BCC / Perovskite inspired geometry)
    interface Node3D {
      x: number;
      y: number;
      z: number;
      radius: number;
      color: string;
    }

    const nodes: Node3D[] = [];
    const step = 85;
    const range = 2;

    for (let x = -range; x <= range; x++) {
      for (let y = -range; y <= range; y++) {
        for (let z = -range; z <= range; z++) {
          // Filter to create a natural spherical / facet crystal habit
          const distSq = x * x + y * y + z * z;
          if (distSq <= 5.5) {
            const isCenter = distSq === 0;
            const isCorner = distSq >= 4;
            nodes.push({
              x: x * step,
              y: y * step,
              z: z * step,
              radius: isCenter ? 4.5 : isCorner ? 2.5 : 3.2,
              color: isCenter ? '#f59e0b' : isCorner ? '#38bdf8' : '#e9ecee',
            });
          }
        }
      }
    }

    // Atmospheric Stardust particles
    const particles = Array.from({ length: 60 }, () => ({
      x: (Math.random() - 0.5) * 800,
      y: (Math.random() - 0.5) * 800,
      z: (Math.random() - 0.5) * 800,
      size: Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.4 + 0.1,
    }));

    // Rotation state
    let rotX = 0.28;
    let rotY = 0.65;
    let targetRotX = rotX;
    let targetRotY = rotY;
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const dx = e.clientX - prevMouseX;
        const dy = e.clientY - prevMouseY;
        targetRotY += dx * 0.005;
        targetRotX += dy * 0.005;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
      }
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    // Touch controls for mobile
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging = true;
        prevMouseX = e.touches[0].clientX;
        prevMouseY = e.touches[0].clientY;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (isDragging && e.touches.length === 1) {
        const dx = e.touches[0].clientX - prevMouseX;
        const dy = e.touches[0].clientY - prevMouseY;
        targetRotY += dx * 0.007;
        targetRotX += dy * 0.007;
        prevMouseX = e.touches[0].clientX;
        prevMouseY = e.touches[0].clientY;
      }
    };

    const onTouchEnd = () => {
      isDragging = false;
    };

    // Marker click detection
    let markerScreenPositions: { id: string; x: number; y: number; marker: MarkerMaterial }[] = [];

    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      for (const m of markerScreenPositions) {
        const d = Math.hypot(clickX - m.x, clickY - m.y);
        if (d < 24) {
          onSelectMarker(m.marker);
          return;
        }
      }
    };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('click', onClick);

    let time = 0;

    const render = () => {
      time += 0.012;
      const isLightTheme = document.documentElement.dataset.theme === 'light';
      // Gentle automatic drift when user is not dragging
      if (!isDragging) {
        targetRotY += 0.0018;
      }

      // Smooth damping interpolation
      rotX += (targetRotX - rotX) * 0.08;
      rotY += (targetRotY - rotY) * 0.08;

      ctx.clearRect(0, 0, width, height);

      const fov = 550;
      const cx = width * 0.54; // Slightly offset to the right so left headline breathes
      const cy = height * 0.5;

      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);

      const project = (x: number, y: number, z: number) => {
        // Rotate around Y
        const x1 = x * cosY + z * sinY;
        const y1 = y;
        const z1 = -x * sinY + z * cosY;

        // Rotate around X
        const x2 = x1;
        const y2 = y1 * cosX - z1 * sinX;
        const z2 = y1 * sinX + z1 * cosX + 480;

        const scale = fov / Math.max(10, z2);
        return {
          px: cx + x2 * scale,
          py: cy + y2 * scale,
          depth: z2,
          scale,
        };
      };

      // Draw faint stardust particles
      for (const p of particles) {
        const prj = project(p.x, p.y, p.z);
        if (prj.depth > 50) {
          ctx.beginPath();
          ctx.arc(prj.px, prj.py, p.size * prj.scale, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(170, 185, 199, ${p.alpha * 0.35})`;
          ctx.fill();
        }
      }

      // Project crystal nodes
      const projectedNodes = nodes.map((n) => {
        const p = project(n.x, n.y, n.z);
        return { ...n, ...p };
      });

      // Draw lattice bond connections between nearby nodes
      ctx.lineWidth = 0.75;
      for (let i = 0; i < projectedNodes.length; i++) {
        for (let j = i + 1; j < projectedNodes.length; j++) {
          const a = projectedNodes[i];
          const b = projectedNodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dz = a.z - b.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          // Connect nearest neighbors in lattice
          if (dist <= step * 1.45) {
            const avgDepth = (a.depth + b.depth) / 2;
            const alpha = Math.max(0.04, Math.min(0.35, 1 - (avgDepth - 350) / 380));

            ctx.beginPath();
            ctx.moveTo(a.px, a.py);
            ctx.lineTo(b.px, b.py);
          ctx.strokeStyle = isLightTheme
            ? `rgba(53, 83, 108, ${Math.max(0.12, alpha * 0.9)})`
            : `rgba(110, 135, 153, ${alpha * 0.6})`;
            ctx.stroke();
          }
        }
      }

      // Sort nodes by depth for correct 3D overlap
      projectedNodes.sort((a, b) => b.depth - a.depth);

      for (const n of projectedNodes) {
        if (n.depth > 30) {
          const alpha = Math.max(0.2, Math.min(0.9, 1 - (n.depth - 350) / 400));
          const r = Math.max(1, n.radius * n.scale * 1.1);

          // Outer halo
          ctx.beginPath();
          ctx.arc(n.px, n.py, r * 2.2, 0, Math.PI * 2);
          ctx.fillStyle = n.color === '#f59e0b'
            ? (isLightTheme ? 'rgba(180, 83, 9, 0.12)' : 'rgba(245, 158, 11, 0.08)')
            : (isLightTheme ? 'rgba(8, 114, 138, 0.1)' : 'rgba(56, 189, 248, 0.06)');
          ctx.fill();

          // Core atom
          ctx.beginPath();
          ctx.arc(n.px, n.py, r, 0, Math.PI * 2);
          ctx.fillStyle = isLightTheme
            ? n.color === '#f59e0b' ? '#b45309' : n.color === '#38bdf8' ? '#08728a' : '#49657c'
            : n.color;
          ctx.globalAlpha = alpha;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      // Draw interactive Material Waypoints / Markers
      markerScreenPositions = [];

      for (const m of DISCOVERED_MARKERS) {
        // Floating oscillation
        const bob = Math.sin(time * 2 + m.pos[0]) * 5;
        const prj = project(m.pos[0], m.pos[1] + bob, m.pos[2]);

        if (prj.depth > 50) {
          markerScreenPositions.push({ id: m.id, x: prj.px, y: prj.py, marker: m });

          const isSelected = selectedMarkerId === m.id;
          const pulse = Math.sin(time * 3) * 3;

          // Glowing pulse rings around marker
          ctx.beginPath();
          ctx.arc(prj.px, prj.py, (12 + pulse) * prj.scale, 0, Math.PI * 2);
          ctx.strokeStyle = isSelected ? 'rgba(56, 189, 248, 0.9)' : 'rgba(245, 158, 11, 0.55)';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Marker core point
          ctx.beginPath();
          ctx.arc(prj.px, prj.py, 4.5 * prj.scale, 0, Math.PI * 2);
          ctx.fillStyle = isSelected ? '#38bdf8' : '#fbbf24';
          ctx.fill();

          // Marker Label Tag
          ctx.font = '500 10px JetBrains Mono, monospace';
          const label = m.formula;
          const textW = ctx.measureText(label).width;

          // Label badge box
          const badgeX = prj.px + 10;
          const badgeY = prj.py - 16;
          ctx.fillStyle = isLightTheme ? 'rgba(250, 253, 255, 0.94)' : 'rgba(8, 12, 22, 0.85)';
          ctx.strokeStyle = isSelected
            ? (isLightTheme ? 'rgba(8, 114, 138, 0.65)' : 'rgba(56, 189, 248, 0.6)')
            : (isLightTheme ? 'rgba(53, 83, 108, 0.28)' : 'rgba(233, 236, 238, 0.18)');
          ctx.lineWidth = 0.75;
          ctx.beginPath();
          ctx.roundRect(badgeX, badgeY, textW + 12, 18, 4);
          ctx.fill();
          ctx.stroke();

          // Label text
          ctx.fillStyle = isLightTheme
            ? isSelected ? '#08728a' : '#243f56'
            : isSelected ? '#38bdf8' : '#e9ecee';
          ctx.fillText(label, badgeX + 6, badgeY + 12);
        }
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('click', onClick);
    };
  }, [onSelectMarker, selectedMarkerId]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing z-0"
    />
  );
}
