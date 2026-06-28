import type { MuscleHighlight } from './body-anatomy.js';

// ── Axis mapping ──────────────────────────────────────────────────────────────
// Each muscle name maps to one or more radar axes.
// Values: primary muscle = 2 pts, secondary = 1 pt, then capped/normalized.

const MUSCLE_AXIS_MAP: Record<string, string[]> = {
  // PUSH axis
  'Pectoralis Major':    ['Push'],
  'Pectoralis Minor':    ['Push'],
  'Anterior Deltoid':    ['Push'],
  'Medial Deltoid':      ['Push'],
  'Triceps Brachii':     ['Push'],
  'Serratus Anterior':   ['Push'],
  // PULL axis
  'Latissimus Dorsi':    ['Pull'],
  'Trapezius':           ['Pull'],
  'Rhomboids':           ['Pull'],
  'Rear Deltoid':        ['Pull'],
  'Biceps Brachii':      ['Pull'],
  'Brachialis':          ['Pull'],
  'Brachioradialis':     ['Pull'],
  'Teres Major':         ['Pull'],
  'Teres Minor':         ['Pull'],
  // LEGS axis
  'Quadriceps':          ['Legs'],
  'Hamstrings':          ['Legs'],
  'Gluteus Maximus':     ['Legs'],
  'Gluteus Medius':      ['Legs'],
  'Gastrocnemius':       ['Legs'],
  'Soleus':              ['Legs'],
  'Hip Flexors':         ['Legs'],
  // CORE axis
  'Rectus Abdominis':    ['Core'],
  'Obliquus Externus':   ['Core'],
  'Obliquus Internus':   ['Core'],
  'Transversus Abdominis':['Core'],
  'Erector Spinae':      ['Core'],
  // SKILL axis (forearms, stability, rotator)
  'Forearm Flexors':     ['Skill'],
  'Forearm Extensors':   ['Skill'],
  'Rotator Cuff':        ['Skill'],
};

const AXES = ['Push', 'Pull', 'Legs', 'Core', 'Skill'] as const;
type Axis = typeof AXES[number];

// Pentagon vertices going clockwise starting from top (-90°)
// Angle for axis i: -90 + i * 72 degrees
function axisAngle(i: number): number {
  return (Math.PI / 180) * (-90 + i * 72);
}

export function renderMuscleRadar(
  svgEl: SVGSVGElement,
  muscles: MuscleHighlight[],
): void {
  svgEl.setAttribute('viewBox', '0 0 160 160');
  svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svgEl.innerHTML = buildRadar(muscles);
}

function buildRadar(muscles: MuscleHighlight[]): string {
  const cx = 80, cy = 80, maxR = 60;

  // Compute raw scores per axis
  const scores: Record<string, number> = {};
  for (const ax of AXES) scores[ax] = 0;

  for (const m of muscles) {
    const axes = MUSCLE_AXIS_MAP[m.name] ?? [];
    const pts  = m.role === 'primary' ? 2 : 1;
    for (const ax of axes) scores[ax] = (scores[ax] ?? 0) + pts;
  }

  // Normalize to 0-10 (max reasonable = 6 pts per axis: 3 primary muscles)
  const MAX_SCORE = 6;
  const normalized: Record<string, number> = {};
  for (const ax of AXES) {
    normalized[ax] = Math.min(scores[ax] / MAX_SCORE, 1);
  }

  // ── Grid pentagons (5 levels) ──────────────────────────────────────────────
  const gridLines: string[] = [];
  for (let level = 1; level <= 5; level++) {
    const r = (maxR / 5) * level;
    const pts = AXES.map((_, i) => {
      const a = axisAngle(i);
      return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
    }).join(' ');
    const opacity = level === 5 ? '0.35' : '0.18';
    gridLines.push(`<polygon points="${pts}" fill="none" stroke="#1a3359" stroke-width="${level === 5 ? '0.8' : '0.5'}" opacity="${opacity}"/>`);
  }

  // ── Axis spokes ────────────────────────────────────────────────────────────
  const spokes: string[] = [];
  const labels: string[] = [];
  AXES.forEach((ax, i) => {
    const a  = axisAngle(i);
    const x2 = cx + maxR * Math.cos(a);
    const y2 = cy + maxR * Math.sin(a);
    spokes.push(`<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="#1a3359" stroke-width="0.5" opacity="0.4"/>`);

    // Label placement
    const lx = cx + (maxR + 14) * Math.cos(a);
    const ly = cy + (maxR + 14) * Math.sin(a);
    labels.push(`<text x="${lx.toFixed(1)}" y="${(ly + 2).toFixed(1)}" text-anchor="middle" dominant-baseline="middle"
      font-size="7.5" fill="#00e5ff" opacity="0.75" font-family="Orbitron,sans-serif">${ax}</text>`);
  });

  // ── Data polygon ───────────────────────────────────────────────────────────
  const dataPoints = AXES.map((ax, i) => {
    const r = normalized[ax] * maxR;
    const a = axisAngle(i);
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  });
  const dataPolygon = dataPoints.join(' ');

  // ── Dot markers at each vertex ─────────────────────────────────────────────
  const dots: string[] = [];
  AXES.forEach((ax, i) => {
    const r = normalized[ax] * maxR;
    const a = axisAngle(i);
    if (r > 0) {
      const x = (cx + r * Math.cos(a)).toFixed(2);
      const y = (cy + r * Math.sin(a)).toFixed(2);
      const isPrimary = scores[ax] > 0 && muscles.some(m => (MUSCLE_AXIS_MAP[m.name] ?? []).includes(ax) && m.role === 'primary');
      dots.push(`<circle cx="${x}" cy="${y}" r="2.5" fill="${isPrimary ? '#ef4444' : '#f97316'}" opacity="0.9"/>`);
    }
  });

  // ── Center dot ────────────────────────────────────────────────────────────
  const hasAny = Object.values(normalized).some(v => v > 0);

  return `
<defs>
  <filter id="mr-glow" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="2" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
</defs>
<rect x="0" y="0" width="160" height="160" fill="#050d18"/>

${gridLines.join('\n')}
${spokes.join('\n')}

${hasAny ? `
<polygon points="${dataPolygon}"
  fill="rgba(0,229,255,0.12)"
  stroke="#00e5ff"
  stroke-width="1.5"
  stroke-linejoin="round"
  filter="url(#mr-glow)"
  opacity="0.9"/>
` : ''}

${dots.join('\n')}
${labels.join('\n')}

${!hasAny ? `<text x="80" y="84" text-anchor="middle" font-size="8" fill="#64748b" font-family="Orbitron,sans-serif">NO DATA</text>` : ''}
`;
}
