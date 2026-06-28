/**
 * Genera le icone PNG per la PWA usando Canvas API di Node (canvas package).
 * Eseguire con: node generate-icons.mjs
 */
import { createCanvas } from 'canvas';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, 'public', 'icons');
mkdirSync(iconsDir, { recursive: true });

function drawIcon(ctx, size, maskable = false) {
  const pad = maskable ? size * 0.12 : 0;
  const s = size - pad * 2;
  const cx = size / 2;
  const cy = size / 2;

  // Background
  ctx.fillStyle = '#03060d';
  ctx.fillRect(0, 0, size, size);

  if (maskable) {
    // Rounded bg circle for maskable
    ctx.fillStyle = '#0a0e17';
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(pad, pad);

  // Pentagon (Solo Leveling crystal shape)
  const r = s * 0.42;
  const points = 5;
  const startAngle = -Math.PI / 2;

  // Outer glow
  ctx.shadowColor = '#00e5ff';
  ctx.shadowBlur = s * 0.08;

  // Pentagon stroke
  ctx.strokeStyle = '#00e5ff';
  ctx.lineWidth = s * 0.04;
  ctx.beginPath();
  for (let i = 0; i < points; i++) {
    const angle = startAngle + (i * 2 * Math.PI) / points;
    const x = s / 2 + r * Math.cos(angle);
    const y = s / 2 + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();

  // Inner pentagon (smaller, dimmer)
  const r2 = s * 0.26;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  for (let i = 0; i < points; i++) {
    const angle = startAngle + (i * 2 * Math.PI) / points;
    const x = s / 2 + r2 * Math.cos(angle);
    const y = s / 2 + r2 * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Center dot
  ctx.fillStyle = '#00e5ff';
  ctx.shadowBlur = s * 0.12;
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s * 0.06, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

const sizes = [192, 512];
for (const size of sizes) {
  // Regular icon
  const canvas = createCanvas(size, size);
  drawIcon(canvas.getContext('2d'), size, false);
  writeFileSync(join(iconsDir, `icon-${size}.png`), canvas.toBuffer('image/png'));

  // Maskable icon (with safe zone padding)
  const mCanvas = createCanvas(size, size);
  drawIcon(mCanvas.getContext('2d'), size, true);
  writeFileSync(join(iconsDir, `icon-maskable-${size}.png`), mCanvas.toBuffer('image/png'));

  console.log(`Generated icon-${size}.png and icon-maskable-${size}.png`);
}
console.log('Done!');
