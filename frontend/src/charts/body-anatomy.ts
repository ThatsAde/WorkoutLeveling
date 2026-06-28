export type MuscleRole = 'primary' | 'secondary';

export interface MuscleHighlight {
  name: string;
  role: MuscleRole;
}

// Maps DB muscle names â†’ SVG element IDs
const MUSCLE_SVG_MAP: Record<string, string[]> = {
  'Pectoralis Major':      ['chest-l',      'chest-r'],
  'Pectoralis Minor':      ['chest-minor-l','chest-minor-r'],
  'Anterior Deltoid':      ['front-delt-l', 'front-delt-r'],
  'Medial Deltoid':        ['med-delt-l',   'med-delt-r'],
  'Triceps Brachii':       ['triceps-l',    'triceps-r'],
  'Latissimus Dorsi':      ['lat-l',        'lat-r'],
  'Trapezius':             ['traps'],
  'Rhomboids':             ['rhomboids'],
  'Rear Deltoid':          ['rear-delt-l',  'rear-delt-r'],
  'Biceps Brachii':        ['biceps-l',     'biceps-r'],
  'Brachialis':            ['brachialis-l', 'brachialis-r'],
  'Brachioradialis':       ['forearm-l',    'forearm-r'],
  'Teres Major':           ['teres-l',      'teres-r'],
  'Teres Minor':           ['teres-minor-l','teres-minor-r'],
  'Rectus Abdominis':      ['abs'],
  'Obliquus Externus':     ['oblique-l',    'oblique-r'],
  'Obliquus Internus':     ['oblique-l',    'oblique-r'],
  'Transversus Abdominis': ['abs'],
  'Erector Spinae':        ['erector-l',    'erector-r'],
  'Serratus Anterior':     ['serratus-l',   'serratus-r'],
  'Quadriceps':            ['quad-l',       'quad-r'],
  'Hamstrings':            ['ham-l',        'ham-r'],
  'Gluteus Maximus':       ['glute-l',      'glute-r'],
  'Gluteus Medius':        ['glute-med-l',  'glute-med-r'],
  'Gastrocnemius':         ['calf-l',       'calf-r', 'calf-back-l', 'calf-back-r'],
  'Soleus':                ['soleus-l',     'soleus-r'],
  'Hip Flexors':           ['hip-flex'],
  'Forearm Flexors':       ['forearm-l',    'forearm-r'],
  'Forearm Extensors':     ['forearm-back-l','forearm-back-r'],
  'Rotator Cuff':          ['rotator-l',    'rotator-r'],
};

/** Render muscle highlights into an existing <svg> element. */
export function renderBodySVG(
  svgEl: SVGSVGElement,
  muscles: MuscleHighlight[],
): void {
  svgEl.setAttribute('viewBox', '0 0 200 400');
  svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svgEl.innerHTML = buildSVGContent();
  applyMuscleHighlights(svgEl, muscles);
}

function applyMuscleHighlights(
  svgEl: SVGSVGElement,
  muscles: MuscleHighlight[],
): void {
  const primaryIds   = new Set<string>();
  const secondaryIds = new Set<string>();

  for (const m of muscles) {
    const ids = MUSCLE_SVG_MAP[m.name] ?? [];
    for (const id of ids) {
      (m.role === 'primary' ? primaryIds : secondaryIds).add(id);
    }
  }

  for (const id of secondaryIds) {
    if (!primaryIds.has(id)) {
      svgEl.querySelector(`#${id}`)?.classList.add('muscle--secondary');
    }
  }
  for (const id of primaryIds) {
    const el = svgEl.querySelector(`#${id}`);
    el?.classList.remove('muscle--secondary');
    el?.classList.add('muscle--primary');
  }
}

// â”€â”€â”€ SVG content â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function buildSVGContent(): string {
  return `
<defs>
  <filter id="ba-glow-p" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="2.5" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="ba-glow-s" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="1.5" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
</defs>

<!-- Background -->
<rect x="0" y="0" width="200" height="400" fill="#050d18"/>

<!-- Labels -->
<text x="50"  y="8" text-anchor="middle" font-size="5.5" fill="#00e5ff" opacity="0.7">FRONT</text>
<text x="150" y="8" text-anchor="middle" font-size="5.5" fill="#00e5ff" opacity="0.7">BACK</text>
<line x1="100" y1="10" x2="100" y2="390" stroke="#2d6494" stroke-width="0.8" stroke-dasharray="3,3"/>

<!-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• FRONT FIGURE (cx=50) â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• -->
<g id="front-figure">
  <!-- Outline / silhouette helper shapes -->
  <circle cx="50" cy="21" r="13" fill="#0d1e2e" stroke="#2d6494" stroke-width="0.8"/>
  <rect x="44" y="34" width="12" height="9" rx="2" fill="#0d1e2e" stroke="#2d6494" stroke-width="0.5"/>

  <!-- Rotator Cuff (shoulder joint â€” front view) -->
  <ellipse id="rotator-l" data-muscle="1" cx="30" cy="48" rx="9" ry="7"  fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>
  <ellipse id="rotator-r" data-muscle="1" cx="70" cy="48" rx="9" ry="7"  fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>

  <!-- Anterior Deltoid -->
  <ellipse id="front-delt-l" data-muscle="1" cx="29" cy="46" rx="8" ry="6.5" fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>
  <ellipse id="front-delt-r" data-muscle="1" cx="71" cy="46" rx="8" ry="6.5" fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>

  <!-- Medial Deltoid (outer shoulder cap) -->
  <ellipse id="med-delt-l" data-muscle="1" cx="22" cy="52" rx="7" ry="9"  fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>
  <ellipse id="med-delt-r" data-muscle="1" cx="78" cy="52" rx="7" ry="9"  fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>

  <!-- Pectoralis Major -->
  <path id="chest-l" data-muscle="1"
    d="M35,43 Q50,42 50,66 L37,63 Q26,56 28,47 Z"
    fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>
  <path id="chest-r" data-muscle="1"
    d="M65,43 Q50,42 50,66 L63,63 Q74,56 72,47 Z"
    fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>

  <!-- Pectoralis Minor (inner, slightly smaller) -->
  <path id="chest-minor-l" data-muscle="1"
    d="M39,48 Q50,46 50,61 L41,58 Q33,54 34,49 Z"
    fill="#162e48" stroke="#2d6494" stroke-width="0.5"/>
  <path id="chest-minor-r" data-muscle="1"
    d="M61,48 Q50,46 50,61 L59,58 Q67,54 66,49 Z"
    fill="#162e48" stroke="#2d6494" stroke-width="0.5"/>

  <!-- Serratus Anterior (rib notches) -->
  <path id="serratus-l" data-muscle="1"
    d="M36,62 Q30,67 32,73 Q33,78 36,82 L40,78 L39,68 Z"
    fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>
  <path id="serratus-r" data-muscle="1"
    d="M64,62 Q70,67 68,73 Q67,78 64,82 L60,78 L61,68 Z"
    fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>

  <!-- Rectus Abdominis -->
  <rect id="abs" data-muscle="1"
    x="43" y="66" width="14" height="44" rx="3"
    fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>

  <!-- Obliques (sides of torso) -->
  <path id="oblique-l" data-muscle="1"
    d="M36,64 Q31,73 33,94 L43,90 L43,70 Z"
    fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>
  <path id="oblique-r" data-muscle="1"
    d="M64,64 Q69,73 67,94 L57,90 L57,70 Z"
    fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>

  <!-- Hip Flexors (hip crease) -->
  <path id="hip-flex" data-muscle="1"
    d="M40,110 Q36,115 37,123 L63,123 Q64,115 60,110 Z"
    fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>

  <!-- Biceps Brachii -->
  <ellipse id="biceps-l" data-muscle="1" cx="19" cy="68" rx="7" ry="13" fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>
  <ellipse id="biceps-r" data-muscle="1" cx="81" cy="68" rx="7" ry="13" fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>

  <!-- Brachialis (lower bicep region) -->
  <ellipse id="brachialis-l" data-muscle="1" cx="18" cy="85" rx="6" ry="7"  fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>
  <ellipse id="brachialis-r" data-muscle="1" cx="82" cy="85" rx="6" ry="7"  fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>

  <!-- Forearm Flexors (front forearm) -->
  <ellipse id="forearm-l" data-muscle="1" cx="16" cy="108" rx="6" ry="16" fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>
  <ellipse id="forearm-r" data-muscle="1" cx="84" cy="108" rx="6" ry="16" fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>

  <!-- Quadriceps -->
  <ellipse id="quad-l" data-muscle="1" cx="39" cy="150" rx="13" ry="27" fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>
  <ellipse id="quad-r" data-muscle="1" cx="61" cy="150" rx="13" ry="27" fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>

  <!-- Gastrocnemius / Calf front -->
  <ellipse id="calf-l" data-muscle="1" cx="38" cy="211" rx="9"  ry="20" fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>
  <ellipse id="calf-r" data-muscle="1" cx="62" cy="211" rx="9"  ry="20" fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>

  <!-- Soleus (lower calf) -->
  <ellipse id="soleus-l" data-muscle="1" cx="38" cy="234" rx="7" ry="10" fill="#162e48" stroke="#2d6494" stroke-width="0.5"/>
  <ellipse id="soleus-r" data-muscle="1" cx="62" cy="234" rx="7" ry="10" fill="#162e48" stroke="#2d6494" stroke-width="0.5"/>

  <!-- Feet -->
  <ellipse cx="38" cy="248" rx="8"  ry="4" fill="#0d1e2e" stroke="#2d6494" stroke-width="0.5"/>
  <ellipse cx="62" cy="248" rx="8"  ry="4" fill="#0d1e2e" stroke="#2d6494" stroke-width="0.5"/>
</g>

<!-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• BACK FIGURE (cx=150) â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• -->
<g id="back-figure">
  <circle cx="150" cy="21" r="13" fill="#0d1e2e" stroke="#2d6494" stroke-width="0.8"/>
  <rect x="144" y="34" width="12" height="9" rx="2" fill="#0d1e2e" stroke="#2d6494" stroke-width="0.5"/>

  <!-- Trapezius -->
  <path id="traps" data-muscle="1"
    d="M124,34 L150,40 L176,34 L174,58 L150,55 L126,58 Z"
    fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>

  <!-- Rear Deltoid -->
  <ellipse id="rear-delt-l" data-muscle="1" cx="122" cy="52" rx="10" ry="8" fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>
  <ellipse id="rear-delt-r" data-muscle="1" cx="178" cy="52" rx="10" ry="8" fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>

  <!-- Teres Major -->
  <ellipse id="teres-l"       data-muscle="1" cx="126" cy="68" rx="8" ry="7" fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>
  <ellipse id="teres-r"       data-muscle="1" cx="174" cy="68" rx="8" ry="7" fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>

  <!-- Teres Minor (smaller, above teres major) -->
  <ellipse id="teres-minor-l" data-muscle="1" cx="127" cy="62" rx="5" ry="5" fill="#162e48" stroke="#2d6494" stroke-width="0.5"/>
  <ellipse id="teres-minor-r" data-muscle="1" cx="173" cy="62" rx="5" ry="5" fill="#162e48" stroke="#2d6494" stroke-width="0.5"/>

  <!-- Latissimus Dorsi -->
  <path id="lat-l" data-muscle="1"
    d="M124,58 Q113,70 116,94 L134,90 L134,66 Z"
    fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>
  <path id="lat-r" data-muscle="1"
    d="M176,58 Q187,70 184,94 L166,90 L166,66 Z"
    fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>

  <!-- Rhomboids (between shoulder blades) -->
  <rect id="rhomboids" data-muscle="1"
    x="135" y="58" width="30" height="28" rx="3"
    fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>

  <!-- Erector Spinae (two columns either side of spine) -->
  <ellipse id="erector-l" data-muscle="1" cx="146" cy="102" rx="5" ry="23" fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>
  <ellipse id="erector-r" data-muscle="1" cx="154" cy="102" rx="5" ry="23" fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>

  <!-- Triceps Brachii (back of upper arm) -->
  <ellipse id="triceps-l" data-muscle="1" cx="119" cy="68" rx="7" ry="13" fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>
  <ellipse id="triceps-r" data-muscle="1" cx="181" cy="68" rx="7" ry="13" fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>

  <!-- Forearm Extensors (back forearm) -->
  <ellipse id="forearm-back-l" data-muscle="1" cx="117" cy="108" rx="6" ry="16" fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>
  <ellipse id="forearm-back-r" data-muscle="1" cx="183" cy="108" rx="6" ry="16" fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>

  <!-- Gluteus Medius (side of hip) -->
  <ellipse id="glute-med-l" data-muscle="1" cx="133" cy="132" rx="11" ry="13" fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>
  <ellipse id="glute-med-r" data-muscle="1" cx="167" cy="132" rx="11" ry="13" fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>

  <!-- Gluteus Maximus -->
  <ellipse id="glute-l" data-muscle="1" cx="138" cy="152" rx="16" ry="20" fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>
  <ellipse id="glute-r" data-muscle="1" cx="162" cy="152" rx="16" ry="20" fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>

  <!-- Hamstrings -->
  <ellipse id="ham-l" data-muscle="1" cx="138" cy="194" rx="14" ry="26" fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>
  <ellipse id="ham-r" data-muscle="1" cx="162" cy="194" rx="14" ry="26" fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>

  <!-- Gastrocnemius back calf -->
  <ellipse id="calf-back-l" data-muscle="1" cx="136" cy="211" rx="9"  ry="20" fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>
  <ellipse id="calf-back-r" data-muscle="1" cx="164" cy="211" rx="9"  ry="20" fill="#1e4262" stroke="#2d6494" stroke-width="0.5"/>

  <!-- Feet -->
  <ellipse cx="136" cy="235" rx="8" ry="4" fill="#0d1e2e" stroke="#2d6494" stroke-width="0.5"/>
  <ellipse cx="164" cy="235" rx="8" ry="4" fill="#0d1e2e" stroke="#2d6494" stroke-width="0.5"/>
</g>`;
}

