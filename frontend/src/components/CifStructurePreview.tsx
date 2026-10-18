import { useEffect, useRef } from 'react';

type Vec3 = { x: number; y: number; z: number };
type Atom = Vec3 & { element: string };
type Crystal = { atoms: Atom[]; cell: [Vec3, Vec3, Vec3] };

const palette: Record<string, string> = {
  H: '#f8fafc', C: '#cbd5e1', N: '#60a5fa', O: '#f87171', F: '#86efac', P: '#fb923c', S: '#facc15',
  Li: '#c084fc', Na: '#a78bfa', Mg: '#34d399', Al: '#94a3b8', Si: '#fbbf24', Cl: '#4ade80', K: '#c4b5fd',
  Ca: '#22d3ee', Ti: '#64748b', V: '#10b981', Cr: '#22c55e', Mn: '#a3e635', Fe: '#fb7185', Co: '#818cf8',
  Ni: '#84cc16', Cu: '#f97316', Zn: '#38bdf8', Br: '#a16207', I: '#8b5cf6',
};
const covalentRadius: Record<string, number> = {
  H: 0.31, Li: 1.28, C: 0.76, N: 0.71, O: 0.66, F: 0.57, Na: 1.66, Mg: 1.41, Al: 1.21, Si: 1.11,
  P: 1.07, S: 1.05, Cl: 1.02, K: 2.03, Ca: 1.76, Ti: 1.60, V: 1.53, Cr: 1.39, Mn: 1.39,
  Fe: 1.32, Co: 1.26, Ni: 1.24, Cu: 1.32, Zn: 1.22, Br: 1.20, I: 1.39,
};

function cifNumber(value: string | undefined): number | null {
  if (!value || value === '.' || value === '?') return null;
  const parsed = Number(value.replace(/\([^)]*\)/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function cifTokens(line: string): string[] {
  return line.match(/'(?:[^']*)'|"(?:[^"]*)"|\S+/g)?.map((token) => token.replace(/^['"]|['"]$/g, '')) ?? [];
}

function parseCrystal(text: string): Crystal | null {
  const tags = new Map<string, number>();
  for (const [key, raw] of text.matchAll(/^\s*(_cell_(?:length_[abc]|angle_(?:alpha|beta|gamma)))\s+([^\s#]+)/gim)) {
    const value = cifNumber(raw);
    if (value !== null) tags.set(key.toLowerCase(), value);
  }
  const a = tags.get('_cell_length_a') ?? 1;
  const b = tags.get('_cell_length_b') ?? 1;
  const c = tags.get('_cell_length_c') ?? 1;
  const alpha = (tags.get('_cell_angle_alpha') ?? 90) * Math.PI / 180;
  const beta = (tags.get('_cell_angle_beta') ?? 90) * Math.PI / 180;
  const gamma = (tags.get('_cell_angle_gamma') ?? 90) * Math.PI / 180;
  const sinGamma = Math.sin(gamma);
  if (Math.abs(sinGamma) < 1e-6) return null;
  const cell: Crystal['cell'] = [
    { x: a, y: 0, z: 0 },
    { x: b * Math.cos(gamma), y: b * sinGamma, z: 0 },
    {
      x: c * Math.cos(beta),
      y: c * (Math.cos(alpha) - Math.cos(beta) * Math.cos(gamma)) / sinGamma,
      z: 0,
    },
  ];
  cell[2].z = Math.sqrt(Math.max(0, c * c - cell[2].x ** 2 - cell[2].y ** 2));

  const lines = text.split(/\r?\n/);
  const atoms: Atom[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().toLowerCase() !== 'loop_') continue;
    const headers: string[] = [];
    let j = i + 1;
    while (j < lines.length && lines[j].trim().startsWith('_')) headers.push(lines[j++].trim().split(/\s+/)[0].toLowerCase());
    const ix = headers.indexOf('_atom_site_fract_x');
    const iy = headers.indexOf('_atom_site_fract_y');
    const iz = headers.indexOf('_atom_site_fract_z');
    if (ix < 0 || iy < 0 || iz < 0) { i = j - 1; continue; }
    const ie = headers.indexOf('_atom_site_type_symbol');
    const il = headers.indexOf('_atom_site_label');
    while (j < lines.length) {
      const line = lines[j].trim();
      if (!line || line.startsWith('#')) {
        j++;
        if (atoms.length) break;
        continue;
      }
      if (line.startsWith('_') || line.toLowerCase() === 'loop_' || line.startsWith('data_')) break;
      const values = cifTokens(line);
      const fx = cifNumber(values[ix]), fy = cifNumber(values[iy]), fz = cifNumber(values[iz]);
      if (fx !== null && fy !== null && fz !== null) {
        const rawElement = values[ie] || values[il] || 'C';
        const element = rawElement.replace(/[^A-Za-z].*$/, '').slice(0, 2);
        atoms.push({
          x: fx * cell[0].x + fy * cell[1].x + fz * cell[2].x,
          y: fx * cell[0].y + fy * cell[1].y + fz * cell[2].y,
          z: fx * cell[0].z + fy * cell[1].z + fz * cell[2].z,
          element: element.charAt(0).toUpperCase() + element.slice(1).toLowerCase(),
        });
      }
      j++;
    }
    i = j - 1;
    if (atoms.length) break;
  }
  return atoms.length ? { atoms, cell } : null;
}

function add(a: Vec3, b: Vec3): Vec3 { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
function distance(a: Vec3, b: Vec3): number { return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z); }

export default function CifStructurePreview({ cifText }: { cifText: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotation = useRef({ x: -0.48, y: 0.65 });
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const crystal = parseCrystal(cifText);
    if (!canvas || !ctx || !crystal) return;

    // Limit pathological CIF sizes while preserving the entire cell geometry.
    const atoms = crystal.atoms.slice(0, 500);
    const [va, vb, vc] = crystal.cell;
    const corners: Vec3[] = [];
    for (const i of [0, 1]) for (const j of [0, 1]) for (const k of [0, 1]) {
      corners.push({ x: i * va.x + j * vb.x + k * vc.x, y: i * va.y + j * vb.y + k * vc.y, z: i * va.z + j * vb.z + k * vc.z });
    }
    const center = corners.reduce((sum, p) => add(sum, p), { x: 0, y: 0, z: 0 });
    center.x /= corners.length; center.y /= corners.length; center.z /= corners.length;
    const centeredAtoms = atoms.map((atom) => ({ ...atom, x: atom.x - center.x, y: atom.y - center.y, z: atom.z - center.z }));
    const centeredCorners = corners.map((p) => ({ x: p.x - center.x, y: p.y - center.y, z: p.z - center.z }));
    const edges: [number, number][] = [];
    for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) {
      const bitDifference = i ^ j;
      if (bitDifference === 1 || bitDifference === 2 || bitDifference === 4) edges.push([i, j]);
    }

    const draw = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      ctx.clearRect(0, 0, w, h);
      const rotate = (point: Vec3) => {
        const cy = Math.cos(rotation.current.y), sy = Math.sin(rotation.current.y);
        const cx = Math.cos(rotation.current.x), sx = Math.sin(rotation.current.x);
        const x = point.x * cy - point.z * sy;
        const z = point.x * sy + point.z * cy;
        return { x, y: point.y * cx - z * sx, z: point.y * sx + z * cx };
      };
      const rotatedCorners = centeredCorners.map(rotate);
      const maxExtent = Math.max(1, ...rotatedCorners.flatMap((p) => [Math.abs(p.x), Math.abs(p.y), Math.abs(p.z)]));
      const scale = Math.min(w, h) * 0.39 / maxExtent;
      const project = (point: Vec3) => {
        const p = rotate(point);
        const perspective = 1 / (1 + p.z / (maxExtent * 4));
        return { x: w / 2 + p.x * scale * perspective, y: h / 2 - p.y * scale * perspective, z: p.z, perspective };
      };
      const cellPoints = centeredCorners.map(project);
      ctx.strokeStyle = 'rgba(34,211,238,0.32)'; ctx.lineWidth = 1;
      for (const [from, to] of edges) {
        ctx.beginPath(); ctx.moveTo(cellPoints[from].x, cellPoints[from].y); ctx.lineTo(cellPoints[to].x, cellPoints[to].y); ctx.stroke();
      }

      const points = centeredAtoms.map((atom) => ({ ...project(atom), atom })).sort((p, q) => p.z - q.z);
      ctx.strokeStyle = 'rgba(148,163,184,0.4)'; ctx.lineWidth = 1.2;
      for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
        const a = points[i], b = points[j];
        const limit = (covalentRadius[a.atom.element] ?? 1.1) + (covalentRadius[b.atom.element] ?? 1.1) + 0.18;
        const realDistance = distance(a.atom, b.atom);
        if (realDistance > 0.35 && realDistance <= limit) {
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      for (const point of points) {
        ctx.fillStyle = palette[point.atom.element] || '#67e8f9';
        ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(point.x, point.y, Math.max(2.5, 5 * point.perspective), 0, Math.PI * 2); ctx.fill();
      }
      ctx.shadowBlur = 0;
    };

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * ratio; canvas.height = canvas.clientHeight * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0); draw();
    };
    let dragging = false, px = 0, py = 0;
    const down = (event: PointerEvent) => { dragging = true; px = event.clientX; py = event.clientY; canvas.setPointerCapture(event.pointerId); };
    const move = (event: PointerEvent) => {
      if (!dragging) return;
      rotation.current.y += (event.clientX - px) * 0.009; rotation.current.x += (event.clientY - py) * 0.009;
      px = event.clientX; py = event.clientY; draw();
    };
    const up = () => { dragging = false; };
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    window.addEventListener('resize', resize); resize();
    return () => {
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up);
      window.removeEventListener('resize', resize);
    };
  }, [cifText]);

  return <div className="relative h-56 overflow-hidden rounded-2xl border border-cyan-500/20 bg-[#07101b]">
    <canvas ref={canvasRef} className="h-full w-full touch-none cursor-grab active:cursor-grabbing" />
    <span className="absolute bottom-2 right-3 text-[9px] font-mono text-slate-400">Drag to rotate · CIF unit cell</span>
  </div>;
}
