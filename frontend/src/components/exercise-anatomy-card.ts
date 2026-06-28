import { renderBodySVG, type MuscleHighlight } from '../charts/body-anatomy.js';
import { renderMuscleRadar } from '../charts/muscle-radar.js';
import type { Muscle } from '../types/index.js';

/**
 * Renders a body SVG + pentagon radar side-by-side into `container`.
 * `muscles` is the Exercise.muscles array (with role).
 */
export function renderAnatomyCard(container: HTMLElement, muscles: Muscle[]): void {
  const highlights: MuscleHighlight[] = muscles
    .filter(m => m.role === 'primary' || m.role === 'secondary')
    .map(m => ({ name: m.name, role: m.role as 'primary' | 'secondary' }));

  container.innerHTML = `
    <div class="anatomy-card">
      <div class="anatomy-card__body">
        <svg class="anatomy-svg" role="img" aria-label="Mappa muscolare"></svg>
      </div>
      <div class="anatomy-card__radar">
        <svg class="radar-svg" role="img" aria-label="Radar muscolare"></svg>
      </div>
    </div>
    <div class="anatomy-legend">
      <span class="anatomy-legend__item anatomy-legend__item--primary">■ Primario</span>
      <span class="anatomy-legend__item anatomy-legend__item--secondary">■ Secondario</span>
    </div>
  `;

  const bodySvg  = container.querySelector<SVGSVGElement>('.anatomy-svg')!;
  const radarSvg = container.querySelector<SVGSVGElement>('.radar-svg')!;

  renderBodySVG(bodySvg, highlights);
  renderMuscleRadar(radarSvg, highlights);
}
