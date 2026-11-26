import {
  DEMO_DURATION,
  clamp,
  easeInOutCubic,
  easeInOutQuart,
  easeOutCubic,
  easeOutExpo,
  lerp,
  segment,
} from './timeline';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawObsidianCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r = 32,
  alpha = 1
) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  roundRectPath(ctx, x, y, w, h, r);
  const grad = ctx.createLinearGradient(x, y, x + w * 0.4, y + h);
  grad.addColorStop(0, 'rgba(28, 28, 33, 0.92)');
  grad.addColorStop(0.55, 'rgba(12, 12, 15, 0.96)');
  grad.addColorStop(1, 'rgba(7, 7, 9, 0.98)');
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.stroke();

  // Top studio rim highlight
  const rim = ctx.createLinearGradient(x, y, x + w, y);
  rim.addColorStop(0, 'rgba(255,255,255,0)');
  rim.addColorStop(0.5, 'rgba(255,255,255,0.45)');
  rim.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.strokeStyle = rim;
  ctx.beginPath();
  ctx.moveTo(x + r, y + 1);
  ctx.lineTo(x + w - r, y + 1);
  ctx.stroke();
  ctx.restore();
}

function drawSubGlass(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r = 20
) {
  ctx.save();
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = 'rgba(255,255,255,0.035)';
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(255,255,255,0.09)';
  ctx.stroke();
  ctx.restore();
}

function drawLogoWithSweep(
  ctx: CanvasRenderingContext2D,
  logo: HTMLImageElement,
  cx: number,
  cy: number,
  w: number,
  h: number,
  alpha: number,
  sweep?: number
) {
  if (alpha <= 0.005) return;
  ctx.save();
  ctx.globalAlpha = clamp(alpha);
  ctx.globalCompositeOperation = 'screen';

  const aspect = logo.naturalWidth / Math.max(1, logo.naturalHeight);
  const drawW = w * 1.55;
  const drawH = drawW / aspect;
  ctx.drawImage(logo, cx - drawW / 2, cy - drawH / 2, drawW, drawH);

  if (typeof sweep === 'number' && sweep > -0.35 && sweep < 1.35) {
    const x0 = cx - w * 0.65;
    const x1 = cx + w * 0.65;
    const sx = lerp(x0, x1, sweep);
    const beam = ctx.createLinearGradient(sx - 120, cy - h * 0.6, sx + 120, cy + h * 0.6);
    beam.addColorStop(0, 'rgba(255,255,255,0)');
    beam.addColorStop(0.42, 'rgba(255,255,255,0.08)');
    beam.addColorStop(0.5, 'rgba(255,255,255,0.75)');
    beam.addColorStop(0.58, 'rgba(255,255,255,0.1)');
    beam.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = beam;
    ctx.fillRect(cx - w * 0.8, cy - h * 0.8, w * 1.6, h * 1.6);
  }
  ctx.restore();
}

function renderFrame(ctx: CanvasRenderingContext2D, logo: HTMLImageElement, time: number) {
  const W = 1920;
  const H = 1080;

  // Clear pure black
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);

  // Subtle overhead studio key light
  const keyLight = ctx.createRadialGradient(W / 2, 0, 20, W / 2, 0, 920);
  keyLight.addColorStop(0, 'rgba(255,255,255,0.065)');
  keyLight.addColorStop(0.55, 'rgba(255,255,255,0.015)');
  keyLight.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = keyLight;
  ctx.fillRect(0, 0, W, H);

  // ACT I (0 - 3.0s)
  if (time < 3.2) {
    const aIn = easeOutCubic(segment(time, 0.28, 1.65));
    const aOut = 1 - easeInOutCubic(segment(time, 2.58, 3.05));
    const op = aIn * aOut;
    const sc = lerp(0.9, 1.0, easeOutExpo(segment(time, 0.28, 2.3)));
    const sweep = lerp(-0.35, 1.35, easeInOutCubic(segment(time, 0.78, 2.25)));
    const wm = easeOutCubic(segment(time, 1.68, 2.42));

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(sc, sc);
    drawLogoWithSweep(ctx, logo, 0, -48, 560, 360, op, sweep);

    if (wm * op > 0.01) {
      ctx.globalAlpha = wm * op;
      ctx.strokeStyle = 'rgba(212,212,216,0.65)';
      ctx.lineWidth = 1.5;
      const lineW = lerp(0, 130, wm);
      ctx.beginPath();
      ctx.moveTo(-lineW / 2, 162);
      ctx.lineTo(lineW / 2, 162);
      ctx.stroke();

      ctx.fillStyle = '#F4F4F5';
      ctx.font = '600 34px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('K  L  Y  R  O', 0, 224 + lerp(16, 0, wm));
    }
    ctx.restore();
  }

  // ACT II (3.0 - 6.2s)
  if (time >= 2.65 && time <= 6.4) {
    const aIn = easeOutCubic(segment(time, 2.72, 3.45));
    const aOut = 1 - easeInOutCubic(segment(time, 5.8, 6.32));
    const op = aIn * aOut;
    const sc = lerp(0.9, 1.0, easeOutExpo(segment(time, 2.72, 4.1)));
    const textIn = easeOutCubic(segment(time, 3.05, 3.85));
    const countP = easeOutCubic(segment(time, 3.35, 5.1));
    const sweep = lerp(-0.2, 1.2, easeInOutCubic(segment(time, 3.6, 5.4)));

    ctx.save();
    ctx.globalAlpha = op;
    ctx.translate(W / 2, H / 2);
    ctx.scale(sc, sc);

    const cw = 1620;
    const ch = 918;
    const x = -cw / 2;
    const y = -ch / 2;
    drawObsidianCard(ctx, x, y, cw, ch, 34, 1);

    // Top Nav
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '600 26px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Klyro', x + 76, y + 72);

    ctx.fillStyle = '#A1A1AA';
    ctx.font = '500 20px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Discover     Launch     Studio     Community     Learn', 0, y + 71);

    roundRectPath(ctx, x + cw - 235, y + 40, 165, 50, 25);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.font = '600 18px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Get Started ->', x + cw - 152, y + 71);

    // Hero Left
    ctx.save();
    ctx.globalAlpha = op * textIn;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '600 80px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Everything', x + 76, y + 290 + lerp(20, 0, textIn));
    ctx.fillText('starts with an', x + 76, y + 382 + lerp(20, 0, textIn));
    ctx.fillStyle = '#D4D4D8';
    ctx.fillText('idea.', x + 76, y + 474 + lerp(20, 0, textIn));

    ctx.fillStyle = '#A1A1AA';
    ctx.font = '400 24px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Launch creator tokens, rally communities, and scale', x + 76, y + 538);
    ctx.fillText('fair-curve markets in seconds.', x + 76, y + 572);

    roundRectPath(ctx, x + 76, y + 618, 236, 56, 28);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.font = '600 19px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Explore Launches ->', x + 194, y + 653);
    ctx.restore();

    // Orbital ring + logo right
    ctx.save();
    ctx.translate(x + cw * 0.72, y + ch * 0.48);
    ctx.rotate(-0.28);
    ctx.strokeStyle = 'rgba(228,228,231,0.45)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 290, 98, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    drawLogoWithSweep(ctx, logo, x + cw * 0.72, y + ch * 0.47, 420, 280, op, sweep);

    // Bottom metrics
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 76, y + ch - 138);
    ctx.lineTo(x + cw - 76, y + ch - 138);
    ctx.stroke();

    const stats = [
      {val: Math.round(lerp(120, 1000, countP)) === 1000 ? '1M+' : `${Math.round(lerp(120, 990, countP))}K+`, lbl: 'Tokens Launched'},
      {val: `${Math.round(lerp(40, 500, countP))}K+`, lbl: 'Creators'},
      {val: `${Math.round(lerp(12, 100, countP))}+`, lbl: 'Communities'},
      {val: 'Fast & Verified', lbl: 'Audited bonding curves'},
    ];
    stats.forEach((st, idx) => {
      const sx = x + 76 + idx * 380;
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '600 30px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(st.val, sx, y + ch - 82);
      ctx.fillStyle = '#71717A';
      ctx.font = '400 18px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(st.lbl, sx, y + ch - 48);
    });

    ctx.restore();
  }

  // ACT III (6.2 - 9.5s)
  if (time >= 5.9 && time <= 9.7) {
    const aIn = easeOutCubic(segment(time, 5.95, 6.55));
    const aOut = 1 - easeInOutCubic(segment(time, 9.1, 9.6));
    const op = aIn * aOut;
    const sc = lerp(0.92, 1.0, easeOutExpo(segment(time, 5.95, 7.2)));
    const wizardStep = time < 7.05 ? 1 : time < 7.85 ? 2 : time < 8.55 ? 3 : 4;
    const curveP = easeInOutCubic(segment(time, 7.35, 8.75));
    const typedLen = Math.floor(lerp(0, 13, segment(time, 6.35, 7.25)));
    const typedTitle = 'Klyro Genesis'.slice(0, typedLen);

    ctx.save();
    ctx.globalAlpha = op;
    ctx.translate(W / 2, H / 2);
    ctx.scale(sc, sc);
    const cw = 1560;
    const ch = 885;
    const x = -cw / 2;
    const y = -ch / 2;
    drawObsidianCard(ctx, x, y, cw, ch, 34, 1);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '600 22px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Klyro Studio', x + 72, y + 66);

    const stepLabels = ['Details', 'Tokenomics', 'Preview', 'Publish'];
    stepLabels.forEach((lbl, idx) => {
      const sx = -260 + idx * 175;
      const sy = y + 60;
      const active = idx + 1 <= wizardStep;
      ctx.beginPath();
      ctx.arc(sx - 44, sy - 6, 18, 0, Math.PI * 2);
      ctx.fillStyle = active ? '#FFFFFF' : 'rgba(255,255,255,0.08)';
      ctx.fill();
      ctx.fillStyle = active ? '#000000' : '#71717A';
      ctx.font = '500 16px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${idx + 1}`, sx - 44, sy);
      ctx.fillStyle = active ? '#FFFFFF' : '#71717A';
      ctx.font = '500 18px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(lbl, sx - 16, sy);
    });

    // Left Form
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '600 46px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Launch Your Project', x + 72, y + 198);
    ctx.fillStyle = '#A1A1AA';
    ctx.font = '400 20px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Configure your creator token, supply curve, and identity.', x + 72, y + 236);

    drawSubGlass(ctx, x + 72, y + 295, 760, 74, 18);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '500 22px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(typedTitle || 'Klyro Genesis', x + 98, y + 340);

    drawSubGlass(ctx, x + 72, y + 398, 760, 145, 18);
    ctx.fillStyle = '#D4D4D8';
    ctx.font = '400 20px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Fair-launch bonding curve · Zero creator tax · Instant liquidity.', x + 98, y + 450);

    roundRectPath(ctx, x + 72, y + 660, 760, 72, 36);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.font = '600 21px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(wizardStep === 4 ? 'Publish Launch ->' : 'Continue ->', x + 452, y + 704);

    // Right Preview Card
    drawSubGlass(ctx, x + 890, y + 150, 598, 610, 26);
    drawObsidianCard(ctx, x + 924, y + 215, 530, 280, 18, 1);
    drawLogoWithSweep(
      ctx,
      logo,
      x + 1189,
      y + 355,
      250,
      165,
      op,
      lerp(-0.2, 1.2, segment(time, 7.0, 8.7))
    );
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '600 24px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(typedTitle || 'Klyro Genesis', x + 924, y + 548);
    ctx.fillStyle = '#A1A1AA';
    ctx.font = '500 18px "IBM Plex Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText('$KLYR', x + 1454, y + 548);

    // Curve
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const steps = 40;
    for (let i = 0; i <= steps * curveP; i++) {
      const u = i / steps;
      const px = x + 924 + u * 530;
      const py = y + 710 - Math.pow(u, 1.8) * 95;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    ctx.restore();
  }

  // ACT IV (9.5 - 12.8s)
  if (time >= 9.2 && time <= 13.05) {
    const aIn = easeOutCubic(segment(time, 9.25, 9.8));
    const aOut = 1 - easeInOutCubic(segment(time, 12.45, 12.95));
    const op = aIn * aOut;
    const slide = easeInOutQuart(segment(time, 10.75, 11.45));
    const chartDraw = easeInOutCubic(segment(time, 11.2, 12.35));
    const peakPop = easeOutExpo(segment(time, 12.0, 12.45));
    const dashCount = easeOutCubic(segment(time, 11.05, 12.2));

    ctx.save();
    ctx.globalAlpha = op;

    // Beat 1: Discover
    if (slide < 0.99) {
      ctx.save();
      ctx.globalAlpha = op * (1 - slide);
      ctx.translate(W / 2 + lerp(0, -1700, slide), H / 2);
      const cw = 1620;
      const ch = 918;
      const x = -cw / 2;
      const y = -ch / 2;
      drawObsidianCard(ctx, x, y, cw, ch, 34, 1);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '600 50px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Discover', x + 76, y + 170);
      ctx.fillStyle = '#A1A1AA';
      ctx.font = '400 22px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('Explore trending launches, creator ecosystems, and live bonding curves.', x + 76, y + 210);

      const cards = [
        {name: 'Nova Studio', ticker: '$NOVA', desc: 'Create. Innovate. Share.', meta: '128K holders · $4.2M'},
        {name: 'Zenith', ticker: '$ZNTH', desc: 'Next-gen design collective.', meta: '98K holders · $2.9M'},
        {name: 'Orbit AI', ticker: '$ORBT', desc: 'Autonomous creator agents.', meta: '72K holders · $1.8M'},
      ];
      cards.forEach((c, i) => {
        const cx = x + 76 + i * 498;
        const cy = y + 320;
        drawSubGlass(ctx, cx, cy, 468, 510, 24);
        roundRectPath(ctx, cx + 26, cy + 26, 416, 250, 18);
        ctx.fillStyle = '#000000';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '600 24px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(c.name, cx + 28, cy + 340);
        ctx.fillStyle = '#A1A1AA';
        ctx.font = '400 18px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(c.desc, cx + 28, cy + 375);
        ctx.fillStyle = '#D4D4D8';
        ctx.font = '500 17px "IBM Plex Mono", monospace';
        ctx.fillText(c.meta, cx + 28, cy + 465);
      });
      ctx.restore();
    }

    // Beat 2: Creator Dashboard
    if (slide > 0.01) {
      ctx.save();
      ctx.globalAlpha = op * slide;
      ctx.translate(W / 2 + lerp(1700, 0, slide), H / 2);
      const cw = 1620;
      const ch = 918;
      const x = -cw / 2;
      const y = -ch / 2;
      drawObsidianCard(ctx, x, y, cw, ch, 34, 1);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '600 44px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Welcome back', x + 76, y + 100);

      const kpis = [
        {l: 'Active Launches', v: `${Math.round(lerp(2, 12, dashCount))}`},
        {l: 'Total Views', v: `${Math.round(lerp(180, 842, dashCount))}K`},
        {l: 'Token Holders', v: `${Math.round(lerp(24, 128, dashCount))}K`},
        {l: 'Followers', v: `${Math.round(lerp(4, 24, dashCount))}K`},
      ];
      kpis.forEach((k, i) => {
        const kx = x + 76 + i * 372;
        drawSubGlass(ctx, kx, y + 160, 344, 148, 22);
        ctx.fillStyle = '#A1A1AA';
        ctx.font = '400 18px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(k.l, kx + 30, y + 210);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '600 44px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(k.v, kx + 30, y + 270);
      });

      drawSubGlass(ctx, x + 76, y + 345, cw - 152, 495, 24);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '600 22px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('Project Analytics', x + 116, y + 402);

      // Animated spline chart
      const pts = [
        [0, 0.85],
        [0.18, 0.62],
        [0.34, 0.72],
        [0.5, 0.42],
        [0.72, 0.14],
        [1.0, 0.36],
      ];
      const gx = x + 160;
      const gy = y + 460;
      const gw = cw - 320;
      const gh = 300;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 4;
      ctx.beginPath();
      const totalSeg = 80;
      for (let s = 0; s <= totalSeg * chartDraw; s++) {
        const u = s / totalSeg;
        // smooth sample
        let idx = 0;
        while (idx < pts.length - 2 && u > pts[idx + 1][0]) idx++;
        const p0 = pts[idx];
        const p1 = pts[idx + 1];
        const localT = clamp((u - p0[0]) / Math.max(0.001, p1[0] - p0[0]));
        const smoothT = localT * localT * (3 - 2 * localT);
        const pyNorm = lerp(p0[1], p1[1], smoothT);
        const px = gx + u * gw;
        const py = gy + pyNorm * gh;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      if (peakPop > 0.05) {
        ctx.save();
        ctx.globalAlpha *= peakPop;
        const peakX = gx + 0.72 * gw;
        const peakY = gy + 0.14 * gh;
        ctx.beginPath();
        ctx.arc(peakX, peakY, 9, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();

        roundRectPath(ctx, peakX - 78, peakY - 62, 156, 40, 20);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.font = '600 17px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('178K volume', peakX, peakY - 36);
        ctx.restore();
      }
      ctx.restore();
    }

    ctx.restore();
  }

  // ACT V (12.8 - 15.0s)
  if (time >= 12.65) {
    const aIn = easeOutCubic(segment(time, 12.7, 13.5));
    const sc = lerp(0.93, 1.0, easeOutExpo(segment(time, 12.7, 14.3)));
    const sweep = lerp(-0.3, 1.3, easeInOutCubic(segment(time, 13.25, 14.35)));
    const textIn = easeOutCubic(segment(time, 13.55, 14.35));

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(sc, sc);
    drawLogoWithSweep(ctx, logo, 0, -56, 500, 325, aIn, sweep);

    if (textIn > 0.01) {
      ctx.globalAlpha = aIn * textIn;
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '600 40px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('K  L  Y  R  O', 0, 175 + lerp(14, 0, textIn));
      ctx.fillStyle = '#A1A1AA';
      ctx.font = '400 22px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('Create. Launch. Own.', 0, 224 + lerp(14, 0, textIn));
    }
    ctx.restore();
  }
}

export async function exportDemoVideo(
  onProgress: (percent: number) => void
): Promise<Blob> {
  const logo = await loadImage('/assets/aistudio/IMG_3735_0911aa51.png');

  const canvas = document.createElement('canvas');
  canvas.width = 1920;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm';

  const stream = canvas.captureStream(60);
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 10_000_000,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  return new Promise<Blob>((resolve, reject) => {
    recorder.onerror = () => reject(new Error('Video recording failed'));
    recorder.onstop = () => {
      resolve(new Blob(chunks, {type: mimeType}));
    };

    recorder.start(100);
    const startMs = performance.now();
    const durationMs = DEMO_DURATION * 1000;

    const tick = (now: number) => {
      const elapsedSec = Math.min(DEMO_DURATION, (now - startMs) / 1000);
      renderFrame(ctx, logo, elapsedSec);
      onProgress(Math.min(100, Math.round((elapsedSec / DEMO_DURATION) * 100)));

      if (now - startMs < durationMs) {
        requestAnimationFrame(tick);
      } else {
        // Hold final frame briefly before finalizing stream
        setTimeout(() => recorder.stop(), 120);
      }
    };

    requestAnimationFrame(tick);
  });
}
