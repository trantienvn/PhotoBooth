import type { DetectedFace, ArFilterId, ArFilterInfo, BeautySettings } from '@/types';

export const arFiltersList: ArFilterInfo[] = [
  { id: 'none', name: 'Tắt AR', icon: '🚫', description: 'Không dùng AR' },
  { id: 'bunny', name: 'Tai thỏ', icon: '🐰', description: 'Tai thỏ trắng hồng nhúc nhích dễ thương' },
  { id: 'cat', name: 'Mèo con', icon: '🐱', description: 'Tai mèo, mũi hồng & râu mèo xinh' },
  { id: 'heart_glasses', name: 'Kính tim', icon: '💖', description: 'Kính râm trái tim hồng thời thượng' },
  { id: 'crown', name: 'Vương miện', icon: '👑', description: 'Vương miện công chúa đính ngọc lấp lánh' },
  { id: 'sparkles', name: 'Lấp lánh', icon: '✨', description: 'Ngôi sao & hạt lấp lánh idol K-Pop' },
  { id: 'blush_hearts', name: 'Má tim', icon: '🥰', description: 'Má hồng đào & icon tim ngọt ngào' },
  { id: 'dog', name: 'Cún con', icon: '🐶', description: 'Tai cún cụp & mũi cún đáng yêu' },
  { id: 'flower', name: 'Hoa anh đào', icon: '🌸', description: 'Kẹp hoa Sakura cài tóc dịu dàng' },
  { id: 'angel', name: 'Thiên thần', icon: '😇', description: 'Vòng hào quang thiên thần phát sáng' },
];

/**
 * Renders localized face beauty: face-targeted smoothing & cheek blush
 */
export function renderFaceBeauty(
  ctx: CanvasRenderingContext2D,
  faceOrFaces: DetectedFace | DetectedFace[],
  width: number,
  height: number,
  beauty: BeautySettings
): void {
  if (!beauty.enabled) return;
  const faces = Array.isArray(faceOrFaces) ? faceOrFaces : [faceOrFaces];
  for (const face of faces) {
    renderSingleFaceBeauty(ctx, face, width, height, beauty);
  }
}

function renderSingleFaceBeauty(
  ctx: CanvasRenderingContext2D,
  face: DetectedFace,
  width: number,
  height: number,
  beauty: BeautySettings
): void {
  const fw = face.width * width;
  const fh = face.height * height;
  const centerX = face.nose.x * width;
  const centerY = face.nose.y * height;

  // 1. Localized Face Softening Glow (Smooth Skin)
  if (beauty.smooth > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const smoothRadius = Math.max(fw, fh) * 0.55;
    const grad = ctx.createRadialGradient(
      centerX, centerY, smoothRadius * 0.20,
      centerX, centerY, smoothRadius
    );
    const smoothAlpha = Math.min(0.42, (beauty.smooth / 100) * 0.42);
    grad.addColorStop(0, `rgba(255, 245, 240, ${smoothAlpha})`);
    grad.addColorStop(0.7, `rgba(255, 235, 230, ${smoothAlpha * 0.6})`);
    grad.addColorStop(1, 'rgba(255, 235, 230, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, fw * 0.52, fh * 0.55, face.roll, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 2. Targeted Cheek Blush (Rosy Glow)
  if (beauty.rosyGlow > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    const blushAlpha = Math.min(0.68, (beauty.rosyGlow / 100) * 0.68);
    const blushRadius = fw * 0.16;

    // Left cheek
    const lcx = face.leftCheek.x * width;
    const lcy = face.leftCheek.y * height;
    const lGrad = ctx.createRadialGradient(lcx, lcy, 0, lcx, lcy, blushRadius);
    lGrad.addColorStop(0, `rgba(255, 110, 140, ${blushAlpha})`);
    lGrad.addColorStop(0.6, `rgba(255, 140, 165, ${blushAlpha * 0.5})`);
    lGrad.addColorStop(1, 'rgba(255, 140, 165, 0)');
    ctx.fillStyle = lGrad;
    ctx.beginPath();
    ctx.arc(lcx, lcy, blushRadius, 0, Math.PI * 2);
    ctx.fill();

    // Right cheek
    const rcx = face.rightCheek.x * width;
    const rcy = face.rightCheek.y * height;
    const rGrad = ctx.createRadialGradient(rcx, rcy, 0, rcx, rcy, blushRadius);
    rGrad.addColorStop(0, `rgba(255, 110, 140, ${blushAlpha})`);
    rGrad.addColorStop(0.6, `rgba(255, 140, 165, ${blushAlpha * 0.5})`);
    rGrad.addColorStop(1, 'rgba(255, 140, 165, 0)');
    ctx.fillStyle = rGrad;
    ctx.beginPath();
    ctx.arc(rcx, rcy, blushRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

/**
 * Renders interactive AR filters on top of detected face(s)
 */
export function renderArFilter(
  ctx: CanvasRenderingContext2D,
  faceOrFaces: DetectedFace | DetectedFace[],
  width: number,
  height: number,
  arFilterId?: ArFilterId
): void {
  if (!arFilterId || arFilterId === 'none') return;
  const faces = Array.isArray(faceOrFaces) ? faceOrFaces : [faceOrFaces];
  for (const face of faces) {
    renderSingleArFilter(ctx, face, width, height, arFilterId);
  }
}

function renderSingleArFilter(
  ctx: CanvasRenderingContext2D,
  face: DetectedFace,
  width: number,
  height: number,
  arFilterId?: ArFilterId
): void {
  const fw = face.width * width;
  const eyeDx = (face.rightEye.x - face.leftEye.x) * width;
  const eyeDy = (face.rightEye.y - face.leftEye.y) * height;
  const eyeDist = Math.hypot(eyeDx, eyeDy);
  // Scale based on inter-pupillary distance (average reference 65px at 720p) or face width
  const scale = eyeDist > 15 ? eyeDist / 65 : fw / 200;

  ctx.save();

  switch (arFilterId) {
    case 'bunny':
      drawBunnyEars(ctx, face, width, height, scale);
      break;
    case 'cat':
      drawCatFeatures(ctx, face, width, height, scale);
      break;
    case 'heart_glasses':
      drawHeartGlasses(ctx, face, width, height, scale);
      break;
    case 'crown':
      drawCrown(ctx, face, width, height, scale);
      break;
    case 'sparkles':
      drawSparkles(ctx, face, width, height, scale);
      break;
    case 'blush_hearts':
      drawBlushHearts(ctx, face, width, height, scale);
      break;
    case 'dog':
      drawDogFeatures(ctx, face, width, height, scale);
      break;
    case 'flower':
      drawSakuraFlower(ctx, face, width, height, scale);
      break;
    case 'angel':
      drawAngelHalo(ctx, face, width, height, scale);
      break;
  }

  ctx.restore();
}

// ── AR Filter Drawers ────────────────────────────────────────────────────────

function drawBunnyEars(
  ctx: CanvasRenderingContext2D,
  face: DetectedFace,
  width: number,
  height: number,
  scale: number
): void {
  const fx = face.forehead.x * width;
  const fy = face.forehead.y * height;
  const earW = 34 * scale;
  const earH = 110 * scale;
  const wiggle = Math.sin(Date.now() / 320) * 0.08;

  ctx.save();
  ctx.translate(fx, fy - 48 * scale);
  ctx.rotate(face.roll);

  // Left ear
  ctx.save();
  ctx.translate(-45 * scale, 0);
  ctx.rotate(-0.15 + wiggle);
  drawSingleBunnyEar(ctx, earW, earH);
  ctx.restore();

  // Right ear
  ctx.save();
  ctx.translate(45 * scale, 0);
  ctx.rotate(0.15 - wiggle);
  drawSingleBunnyEar(ctx, earW, earH);
  ctx.restore();

  ctx.restore();
}

function drawSingleBunnyEar(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  // Outer ear
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#fbcfe8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, -h * 0.5, w * 0.5, h * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Inner ear
  ctx.fillStyle = '#f472b6';
  ctx.beginPath();
  ctx.ellipse(0, -h * 0.48, w * 0.28, h * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawCatFeatures(
  ctx: CanvasRenderingContext2D,
  face: DetectedFace,
  width: number,
  height: number,
  scale: number
): void {
  const fx = face.forehead.x * width;
  const fy = face.forehead.y * height;
  const earSize = 65 * scale;

  ctx.save();
  ctx.translate(fx, fy - 40 * scale);
  ctx.rotate(face.roll);

  // Left Cat Ear
  drawSingleCatEar(ctx, -60 * scale, 0, earSize, -1);
  // Right Cat Ear
  drawSingleCatEar(ctx, 60 * scale, 0, earSize, 1);
  ctx.restore();

  // Whiskers on cheeks & cute nose
  const nx = face.nose.x * width;
  const ny = face.nose.y * height;

  ctx.save();
  ctx.translate(nx, ny);
  ctx.rotate(face.roll);

  // Cute pink heart nose
  ctx.fillStyle = '#f43f5e';
  ctx.beginPath();
  ctx.arc(-4 * scale, -2 * scale, 5 * scale, 0, Math.PI * 2);
  ctx.arc(4 * scale, -2 * scale, 5 * scale, 0, Math.PI * 2);
  ctx.lineTo(0, 7 * scale);
  ctx.closePath();
  ctx.fill();

  // Left Whiskers
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5 * scale;
  ctx.lineCap = 'round';
  [-12, 0, 12].forEach((offsetY) => {
    ctx.beginPath();
    ctx.moveTo(-20 * scale, offsetY * 0.8 * scale);
    ctx.lineTo(-85 * scale, (offsetY * 1.6) * scale);
    ctx.stroke();
  });

  // Right Whiskers
  [-12, 0, 12].forEach((offsetY) => {
    ctx.beginPath();
    ctx.moveTo(20 * scale, offsetY * 0.8 * scale);
    ctx.lineTo(85 * scale, (offsetY * 1.6) * scale);
    ctx.stroke();
  });

  ctx.restore();
}

function drawSingleCatEar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  dir: number
): void {
  ctx.save();
  ctx.translate(x, y);

  // Outer ear
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#fbcfe8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-size * 0.45, 0);
  ctx.lineTo(dir * size * 0.1, -size * 0.95);
  ctx.lineTo(size * 0.45, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Inner ear
  ctx.fillStyle = '#fb7185';
  ctx.beginPath();
  ctx.moveTo(-size * 0.3, -size * 0.08);
  ctx.lineTo(dir * size * 0.08, -size * 0.78);
  ctx.lineTo(size * 0.3, -size * 0.08);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawHeartGlasses(
  ctx: CanvasRenderingContext2D,
  face: DetectedFace,
  width: number,
  height: number,
  scale: number
): void {
  const lx = face.leftEye.x * width;
  const ly = face.leftEye.y * height;
  const rx = face.rightEye.x * width;
  const ry = face.rightEye.y * height;
  const midX = (lx + rx) / 2;
  const midY = (ly + ry) / 2;
  const eyeDist = Math.hypot(rx - lx, ry - ly);
  const heartR = eyeDist * 0.42;

  ctx.save();
  ctx.translate(midX, midY);
  ctx.rotate(face.roll);

  // Bridge
  ctx.strokeStyle = '#ec4899';
  ctx.lineWidth = 4 * scale;
  ctx.beginPath();
  ctx.moveTo(-eyeDist * 0.2, -4);
  ctx.quadraticCurveTo(0, -14 * scale, eyeDist * 0.2, -4);
  ctx.stroke();

  // Left Heart Lens
  drawSingleHeartLens(ctx, -eyeDist * 0.48, 0, heartR);
  // Right Heart Lens
  drawSingleHeartLens(ctx, eyeDist * 0.48, 0, heartR);

  ctx.restore();
}

function drawSingleHeartLens(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number
): void {
  ctx.save();
  ctx.translate(cx, cy);

  // Heart path
  ctx.beginPath();
  const topY = -r * 0.5;
  ctx.moveTo(0, r * 0.55);
  ctx.bezierCurveTo(-r * 0.85, 0, -r * 0.85, -r * 0.8, -r * 0.35, -r * 0.8);
  ctx.bezierCurveTo(-0.05, -r * 0.8, 0, -r * 0.5, 0, topY);
  ctx.bezierCurveTo(0, -r * 0.5, 0.05, -r * 0.8, r * 0.35, -r * 0.8);
  ctx.bezierCurveTo(r * 0.85, -r * 0.8, r * 0.85, 0, 0, r * 0.55);
  ctx.closePath();

  // Tinted lens
  ctx.fillStyle = 'rgba(236, 72, 153, 0.42)';
  ctx.fill();

  // Frame
  ctx.strokeStyle = '#f43f5e';
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // Reflection gloss
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.28, -r * 0.45, r * 0.16, r * 0.08, -0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawCrown(
  ctx: CanvasRenderingContext2D,
  face: DetectedFace,
  width: number,
  height: number,
  scale: number
): void {
  const fx = face.forehead.x * width;
  const fy = face.forehead.y * height;
  const crownW = 120 * scale;
  const crownH = 65 * scale;

  ctx.save();
  ctx.translate(fx, fy - 46 * scale);
  ctx.rotate(face.roll);

  // Golden Crown
  const grad = ctx.createLinearGradient(0, -crownH, 0, 0);
  grad.addColorStop(0, '#fde047');
  grad.addColorStop(0.5, '#eab308');
  grad.addColorStop(1, '#ca8a04');

  ctx.fillStyle = grad;
  ctx.strokeStyle = '#a16207';
  ctx.lineWidth = 2.5;

  ctx.beginPath();
  ctx.moveTo(-crownW * 0.5, 0);
  ctx.lineTo(-crownW * 0.5, -crownH * 0.65);
  ctx.lineTo(-crownW * 0.25, -crownH * 0.3);
  ctx.lineTo(0, -crownH);
  ctx.lineTo(crownW * 0.25, -crownH * 0.3);
  ctx.lineTo(crownW * 0.5, -crownH * 0.65);
  ctx.lineTo(crownW * 0.5, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Jewels
  // Central Ruby
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(0, -crownH * 0.38, 7 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Diamonds on tips
  ctx.fillStyle = '#38bdf8';
  [-crownW * 0.5, 0, crownW * 0.5].forEach((tipX, i) => {
    const tipY = i === 1 ? -crownH : -crownH * 0.65;
    ctx.beginPath();
    ctx.arc(tipX, tipY, 4.5 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  ctx.restore();
}

function drawSparkles(
  ctx: CanvasRenderingContext2D,
  face: DetectedFace,
  width: number,
  height: number,
  scale: number
): void {
  const t = Date.now() / 400;
  const lcx = face.leftCheek.x * width;
  const lcy = face.leftCheek.y * height;
  const rcx = face.rightCheek.x * width;
  const rcy = face.rightCheek.y * height;
  const fhx = face.forehead.x * width;
  const fhy = face.forehead.y * height;

  const sparkles = [
    { x: lcx - 20 * scale, y: lcy - 10 * scale, s: (12 + Math.sin(t) * 4) * scale, color: '#fde047' },
    { x: lcx + 15 * scale, y: lcy + 15 * scale, s: (8 + Math.cos(t) * 3) * scale, color: '#f472b6' },
    { x: rcx + 20 * scale, y: rcy - 10 * scale, s: (12 + Math.cos(t) * 4) * scale, color: '#fde047' },
    { x: rcx - 15 * scale, y: rcy + 15 * scale, s: (9 + Math.sin(t) * 3) * scale, color: '#60a5fa' },
    { x: fhx, y: fhy - 15 * scale, s: (14 + Math.sin(t * 1.5) * 5) * scale, color: '#c084fc' },
  ];

  sparkles.forEach((sp) => {
    drawSingleStarSparkle(ctx, sp.x, sp.y, sp.s, sp.color);
  });
}

function drawSingleStarSparkle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;

  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2);
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(radius * 0.18, radius * 0.18, 0, radius);
    ctx.quadraticCurveTo(-radius * 0.18, radius * 0.18, 0, 0);
  }
  ctx.fill();
  ctx.restore();
}

function drawBlushHearts(
  ctx: CanvasRenderingContext2D,
  face: DetectedFace,
  width: number,
  height: number,
  scale: number
): void {
  const lcx = face.leftCheek.x * width;
  const lcy = face.leftCheek.y * height;
  const rcx = face.rightCheek.x * width;
  const rcy = face.rightCheek.y * height;

  const pulse = Math.sin(Date.now() / 300) * 2;
  const heartSize = 14 * scale + pulse;

  drawMiniHeart(ctx, lcx, lcy - 4 * scale, heartSize, '#f43f5e');
  drawMiniHeart(ctx, rcx, rcy - 4 * scale, heartSize, '#f43f5e');

  // Mini decorative floating hearts
  drawMiniHeart(ctx, lcx - 18 * scale, lcy + 12 * scale, heartSize * 0.65, '#fb7185');
  drawMiniHeart(ctx, rcx + 18 * scale, rcy + 12 * scale, heartSize * 0.65, '#fb7185');
}

function drawMiniHeart(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  const topY = -size * 0.4;
  ctx.moveTo(0, size * 0.4);
  ctx.bezierCurveTo(-size * 0.7, 0, -size * 0.7, -size * 0.6, -size * 0.3, -size * 0.6);
  ctx.bezierCurveTo(-0.05, -size * 0.6, 0, -size * 0.4, 0, topY);
  ctx.bezierCurveTo(0, -size * 0.4, 0.05, -size * 0.6, size * 0.3, -size * 0.6);
  ctx.bezierCurveTo(size * 0.7, -size * 0.6, size * 0.7, 0, 0, size * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawDogFeatures(
  ctx: CanvasRenderingContext2D,
  face: DetectedFace,
  width: number,
  height: number,
  scale: number
): void {
  const fx = face.forehead.x * width;
  const fy = face.forehead.y * height;
  const earW = 48 * scale;
  const earH = 80 * scale;

  ctx.save();
  ctx.translate(fx, fy - 36 * scale);
  ctx.rotate(face.roll);

  // Left Floppy Ear
  ctx.fillStyle = '#78350f';
  ctx.beginPath();
  ctx.ellipse(-70 * scale, 15 * scale, earW * 0.5, earH * 0.5, -0.4, 0, Math.PI * 2);
  ctx.fill();

  // Right Floppy Ear
  ctx.beginPath();
  ctx.ellipse(70 * scale, 15 * scale, earW * 0.5, earH * 0.5, 0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Dog Nose
  const nx = face.nose.x * width;
  const ny = face.nose.y * height;
  ctx.save();
  ctx.translate(nx, ny);
  ctx.fillStyle = '#1c1917';
  ctx.beginPath();
  ctx.ellipse(0, 0, 16 * scale, 12 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  // Nose highlight
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.ellipse(-4 * scale, -4 * scale, 4 * scale, 2 * scale, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSakuraFlower(
  ctx: CanvasRenderingContext2D,
  face: DetectedFace,
  width: number,
  height: number,
  scale: number
): void {
  const sx = face.rightEye.x * width + 26 * scale;
  const sy = face.forehead.y * height - 16 * scale;
  const flowerR = 24 * scale;

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(face.roll + 0.3);

  // 5 Sakura Petals
  for (let i = 0; i < 5; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI * 2) / 5);
    ctx.fillStyle = '#fbcfe8';
    ctx.strokeStyle = '#f472b6';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, -flowerR * 0.6, flowerR * 0.35, flowerR * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Golden center
  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.arc(0, 0, flowerR * 0.25, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawAngelHalo(
  ctx: CanvasRenderingContext2D,
  face: DetectedFace,
  width: number,
  height: number,
  scale: number
): void {
  const fx = face.forehead.x * width;
  const fy = face.forehead.y * height;
  const haloW = 90 * scale;
  const haloH = 24 * scale;

  ctx.save();
  ctx.translate(fx, fy - 70 * scale);
  ctx.rotate(face.roll);

  // Glowing halo
  ctx.shadowColor = '#fde047';
  ctx.shadowBlur = 18;
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 8 * scale;
  ctx.beginPath();
  ctx.ellipse(0, 0, haloW * 0.5, haloH * 0.5, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Core bright line
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3 * scale;
  ctx.stroke();

  ctx.restore();
}
