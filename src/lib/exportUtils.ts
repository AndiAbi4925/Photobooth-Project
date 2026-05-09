import { GIFEncoder, quantize, applyPalette } from 'gifenc';

export async function createGifExporter(
  frames: HTMLCanvasElement[],
  width: number,
  height: number,
  fps: number = 8
): Promise<Blob> {
  return new Promise(async (resolve) => {
    // gifenc encoder initialization
    const gif = GIFEncoder();
    
    for (let i = 0; i < frames.length; i++) {
      const ctx = frames[i].getContext('2d');
      if (!ctx) continue;
      
      const imageData = ctx.getImageData(0, 0, width, height).data;
      
      // Quantize to 256 colors using rgba4444 format for balanced speed/quality
      const palette = quantize(imageData, 256, { format: 'rgba4444' });
      const index = applyPalette(imageData, palette, 'rgba4444');
      
      // Write the frame
      gif.writeFrame(index, width, height, { palette, delay: 1000 / fps });
      
      // Yield to the event loop so the UI doesn't freeze entirely
      await new Promise((r) => setTimeout(r, 0));
    }
    
    gif.finish();
    resolve(new Blob([gif.bytes()], { type: 'image/gif' }));
  });
}
