// Procedurally renders a rotating low-poly icosahedron as a PNG image sequence.
// Each frame is one still image; the web page later maps scroll position -> frame index.
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const FRAMES = 120;
const SIZE = 900; // square canvas, downscaled responsively in CSS
const OUT_DIR = path.join(__dirname, '..', 'public', 'frames');

fs.mkdirSync(OUT_DIR, { recursive: true });

// --- Icosahedron geometry (12 vertices, 30 edges, 20 faces) ---
const t = (1 + Math.sqrt(5)) / 2;
const rawVerts = [
  [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
  [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
  [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
];
// normalize to unit sphere
const verts = rawVerts.map(([x, y, z]) => {
  const len = Math.sqrt(x * x + y * y + z * z);
  return [x / len, y / len, z / len];
});
const faces = [
  [0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],
  [1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
  [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],
  [4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1],
];

function rotateY(p, a) {
  const [x, y, z] = p;
  return [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)];
}
function rotateX(p, a) {
  const [x, y, z] = p;
  return [x, y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
}
function project(p, scale, dist) {
  const [x, y, z] = p;
  const f = dist / (dist - z);
  return [x * f * scale, y * f * scale];
}

function faceCenterZ(face, pts3d) {
  return (pts3d[face[0]][2] + pts3d[face[1]][2] + pts3d[face[2]][2]) / 3;
}

function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
}

for (let i = 0; i < FRAMES; i++) {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');

  // background: subtle vertical gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, SIZE);
  bgGrad.addColorStop(0, '#0b0f1a');
  bgGrad.addColorStop(1, '#161c2e');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, SIZE, SIZE);

  const progress = i / (FRAMES - 1); // 0..1
  const angleY = progress * Math.PI * 4;      // two full spins
  const angleX = Math.sin(progress * Math.PI * 2) * 0.6; // wobble
  const scale = SIZE * 0.28 * (0.85 + 0.15 * Math.sin(progress * Math.PI)); // gentle zoom pulse
  const dist = 4;
  const cx = SIZE / 2;
  const cy = SIZE / 2;

  const pts3d = verts.map(v => rotateX(rotateY(v, angleY), angleX));
  const pts2d = pts3d.map(p => {
    const [x, y] = project(p, scale, dist);
    return [cx + x, cy + y];
  });

  const order = faces
    .map((f, idx) => ({ f, idx, z: faceCenterZ(f, pts3d) }))
    .sort((a, b) => a.z - b.z); // painter's algorithm: back to front

  for (const { f, idx } of order) {
    const [a, b, c] = f.map(vi => pts2d[vi]);
    const hue = (idx * 18 + progress * 360) % 360;
    const [r, g, bch] = hslToRgb(hue, 65, 45);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.closePath();
    ctx.fillStyle = `rgba(${r},${g},${bch},0.92)`;
    ctx.fill();
    ctx.strokeStyle = 'rgba(10,12,20,0.85)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // frame counter watermark (small, bottom-right) proves distinct frames
  ctx.font = '20px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.textAlign = 'right';
  ctx.fillText(`${i + 1}/${FRAMES}`, SIZE - 16, SIZE - 16);

  const buf = canvas.toBuffer('image/png');
  const name = `frame_${String(i).padStart(4, '0')}.png`;
  fs.writeFileSync(path.join(OUT_DIR, name), buf);
}

console.log(`Wrote ${FRAMES} frames to ${OUT_DIR}`);
