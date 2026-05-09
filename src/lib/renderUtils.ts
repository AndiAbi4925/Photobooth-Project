import { format } from 'date-fns';

export interface LayoutDef {
  id: string;
  name: string;
  width: number;
  height: number;
  slots: { x: number; y: number; w: number; h: number }[];
  datePos: { x: number; y: number };
}

export const LAYOUTS: Record<string, LayoutDef> = {
  '1x4': {
    id: '1x4',
    name: 'Classic 4-Strip',
    width: 600,
    height: 1800,
    slots: [
      { x: 40, y: 40, w: 520, h: 390 },
      { x: 40, y: 450, w: 520, h: 390 },
      { x: 40, y: 860, w: 520, h: 390 },
      { x: 40, y: 1270, w: 520, h: 390 },
    ],
    datePos: { x: 40, y: 1730 },
  },
  '2x2': {
    id: '2x2',
    name: 'Quad (Square)',
    width: 1200,
    height: 1040,
    slots: [
      { x: 60, y: 60, w: 520, h: 390 },
      { x: 620, y: 60, w: 520, h: 390 },
      { x: 60, y: 490, w: 520, h: 390 },
      { x: 620, y: 490, w: 520, h: 390 },
    ],
    datePos: { x: 60, y: 980 },
  },
  '1x3': {
    id: '1x3',
    name: 'Minimal 3-Strip',
    width: 600,
    height: 1400,
    slots: [
      { x: 40, y: 40, w: 520, h: 390 },
      { x: 40, y: 450, w: 520, h: 390 },
      { x: 40, y: 860, w: 520, h: 390 },
    ],
    datePos: { x: 40, y: 1330 },
  },
};

export function drawGrain(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number
) {
  if (intensity <= 0) return;

  const noiseCanvas = document.createElement('canvas');
  noiseCanvas.width = 256;
  noiseCanvas.height = 256;
  const nCtx = noiseCanvas.getContext('2d');
  if (!nCtx) return;

  const imgData = nCtx.createImageData(256, 256);
  const data = imgData.data;

  // Max alpha correlates to intensity (scale 0-100)
  const maxAlpha = Math.min((intensity / 100) * 80, 255);

  for (let i = 0; i < data.length; i += 4) {
    const v = Math.random() * 255;
    data[i] = v; // R
    data[i + 1] = v; // G
    data[i + 2] = v; // B
    data[i + 3] = Math.random() * maxAlpha; // A
  }
  nCtx.putImageData(imgData, 0, 0);

  ctx.globalCompositeOperation = 'source-over';
  const pattern = ctx.createPattern(noiseCanvas, 'repeat');
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, width, height);
  }
}

export function renderStrip(
  photos: HTMLCanvasElement[][],
  layout: LayoutDef,
  grain: number,
  showDate: boolean,
  frameIndex: number
): HTMLCanvasElement {
  const bgCanvas = document.createElement('canvas');
  bgCanvas.width = layout.width;
  bgCanvas.height = layout.height;
  const ctx = bgCanvas.getContext('2d');
  if (!ctx) return bgCanvas;

  // Draw warm paper background
  ctx.fillStyle = '#f8f8f8';
  ctx.fillRect(0, 0, layout.width, layout.height);

  // Draw photos into computed slots
  layout.slots.forEach((slot, idx) => {
    if (photos[idx] && photos[idx][frameIndex]) {
      const img = photos[idx][frameIndex];
      const imgRatio = img.width / img.height;
      const slotRatio = slot.w / slot.h;

      let sx = 0,
        sy = 0,
        sw = img.width,
        sh = img.height;

      // Cover crop strategy
      if (imgRatio > slotRatio) {
        sw = sh * slotRatio;
        sx = (img.width - sw) / 2;
      } else {
        sh = sw / slotRatio;
        sy = (img.height - sh) / 2;
      }

      // Draw shadow/border
      ctx.fillStyle = '#e0e0e0';
      ctx.fillRect(slot.x, slot.y, slot.w, slot.h);

      ctx.drawImage(img, sx, sy, sw, sh, slot.x, slot.y, slot.w, slot.h);
    } else {
      // Empty slot placeholder
      ctx.fillStyle = '#eaeaea';
      ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
    }
  });

  // Apply Grain filter overlay
  drawGrain(ctx, layout.width, layout.height, grain);

  // Apply Date Stamp
  if (showDate) {
    const dateStr = format(new Date(), 'yyyy.MM.dd');
    ctx.font = '36px "VT323", monospace';
    ctx.fillStyle = '#ff4500'; // Classic digital camera orange
    ctx.fillText(dateStr, layout.datePos.x, layout.datePos.y);
  }

  return bgCanvas;
}
