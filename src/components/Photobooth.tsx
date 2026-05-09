import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Download, RefreshCw, Settings2, LayoutGrid } from 'lucide-react';
import { cn } from '../lib/utils';
import { LAYOUTS, LayoutDef, renderStrip } from '../lib/renderUtils';
import { createGifExporter } from '../lib/exportUtils';

type CapturingState = 'idle' | 'countdown' | 'capturing' | 'review';

export default function Photobooth() {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Settings State
  const [activeLayoutId, setActiveLayoutId] = useState<string>('1x4');
  const [grainIntensity, setGrainIntensity] = useState<number>(25);
  const [showDate, setShowDate] = useState<boolean>(true);
  
  // App State
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [captureState, setCaptureState] = useState<CapturingState>('idle');
  const [countdownNum, setCountdownNum] = useState<number>(3);
  const [flash, setFlash] = useState(false);
  const [capturedPhotos, setCapturedPhotos] = useState<HTMLCanvasElement[][]>([]);
  const [previewCanvasDataUrl, setPreviewCanvasDataUrl] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const activeLayout = LAYOUTS[activeLayoutId];

  // Initialize Camera
  useEffect(() => {
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setIsCameraReady(true);
        }
      } catch (err) {
        console.error('Failed to access camera', err);
      }
    }
    setupCamera();

    return () => {
      // Cleanup
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const captureFrame = useCallback((): HTMLCanvasElement => {
    const video = videoRef.current;
    if (!video) return document.createElement('canvas');

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Flip horizontally to mirror the user's view correctly
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0);
    }
    return canvas;
  }, []);

  const runSession = async () => {
    setCaptureState('countdown');
    setCapturedPhotos([]);
    const totalShots = activeLayout.slots.length;
    const newPhotos: HTMLCanvasElement[][] = [];

    for (let shot = 0; shot < totalShots; shot++) {
      // Countdown phase
      setCaptureState('countdown');
      for (let i = 3; i > 0; i--) {
        setCountdownNum(i);
        await new Promise((r) => setTimeout(r, 1000));
      }

      // Capture phase (burst of 5 frames)
      setCaptureState('capturing');
      setFlash(true);
      setTimeout(() => setFlash(false), 50);

      const frames: HTMLCanvasElement[] = [];
      for (let f = 0; f < 5; f++) {
        frames.push(captureFrame());
        await new Promise((r) => setTimeout(r, 100)); // 100ms between frames (~0.5s total burst)
      }
      newPhotos.push(frames);
      setCapturedPhotos([...newPhotos]); // Update intermediate state
    }

    setCapturedPhotos(newPhotos);
    setCaptureState('review');
  };

  // Generate Preview image when entering review state or settings change
  useEffect(() => {
    if (captureState === 'review' && capturedPhotos.length > 0) {
      const cvs = renderStrip(capturedPhotos, activeLayout, grainIntensity, showDate, 2); // Middle frame (index 2)
      setPreviewCanvasDataUrl(cvs.toDataURL('image/jpeg', 0.95));
    }
  }, [captureState, capturedPhotos, activeLayout, grainIntensity, showDate]);

  const handleExport = async (format: 'jpg' | 'png' | 'gif') => {
    if (!capturedPhotos.length) return;
    setIsExporting(true);

    try {
      let url = '';
      let filename = `photobooth-${new Date().getTime()}`;

      if (format === 'jpg' || format === 'png') {
        const cvs = renderStrip(capturedPhotos, activeLayout, grainIntensity, showDate, 2);
        const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
        url = cvs.toDataURL(mime, 0.9);
        filename += `.${format}`;
      } else if (format === 'gif') {
        // Generate 5 composited frames for the final animated GIF
        const frames: HTMLCanvasElement[] = [];
        for (let i = 0; i < 5; i++) {
          frames.push(renderStrip(capturedPhotos, activeLayout, grainIntensity, showDate, i));
        }
        
        // Use a scaled-down resolution for GIF to keep file size reasonable
        const scale = 0.5;
        const gifFrames = frames.map(f => {
           const c = document.createElement('canvas');
           c.width = f.width * scale;
           c.height = f.height * scale;
           c.getContext('2d')?.drawImage(f, 0, 0, c.width, c.height);
           return c;
        });

        const blob = await createGifExporter(gifFrames, gifFrames[0].width, gifFrames[0].height, 8);
        url = URL.createObjectURL(blob);
        filename += '.gif';
      }

      // Download trigger
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('Export failed', e);
      alert('Failed to export image.');
    } finally {
      setIsExporting(false);
    }
  };

  const resetSession = () => {
    setCapturedPhotos([]);
    setCaptureState('idle');
    setPreviewCanvasDataUrl(null);
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#0c0c0c] text-[#e0e0e0] font-sans overflow-hidden md:border-8 border-[#1a1a1a]">
      
      {/* Settings / Controls Sidebar */}
      <aside className="w-full md:w-80 bg-[#0f0f0f] md:border-r border-[#2a2a2a] p-8 flex flex-col shrink-0 z-10 overflow-y-auto">
        <div className="mb-12">
          <h1 className="font-serif text-3xl italic tracking-tight text-white">Lumière</h1>
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#666] mt-1">Studio Photobooth v2.4</p>
        </div>

        <div className="space-y-6 flex-grow">
          {/* Layout Selection */}
          <section>
            <label className="text-[11px] uppercase tracking-widest text-[#888] font-semibold block mb-3">Frame Configuration</label>
            <div className="grid grid-cols-3 gap-3">
              {Object.values(LAYOUTS).map((layout) => (
                <button
                  key={layout.id}
                  onClick={() => setActiveLayoutId(layout.id)}
                  disabled={captureState !== 'idle' && captureState !== 'review'}
                  className={cn(
                    "aspect-square border flex flex-col gap-1 p-2 items-center justify-center transition-all disabled:opacity-50",
                    activeLayoutId === layout.id 
                      ? "border-white bg-white/5 text-white" 
                      : "border-[#333] hover:bg-white/5 text-[#888] hover:text-white"
                  )}
                >
                  {layout.id === '1x3' && (
                    <>
                      <div className="w-4 h-6 border border-white/50"></div>
                      <span className="text-[9px] uppercase mt-1">1×3</span>
                    </>
                  )}
                  {layout.id === '2x2' && (
                    <div className="flex flex-col items-center gap-1">
                      <div className="grid grid-cols-2 gap-[2px]">
                        <div className="w-3 h-3 border border-white/30"></div>
                        <div className="w-3 h-3 border border-white/30"></div>
                        <div className="w-3 h-3 border border-white/30"></div>
                        <div className="w-3 h-3 border border-white/30"></div>
                      </div>
                      <span className="text-[9px] uppercase mt-1">2×2</span>
                    </div>
                  )}
                  {layout.id === '1x4' && (
                    <>
                      <div className="flex flex-col gap-[2px]">
                        <div className="w-6 h-1.5 border border-white/30"></div>
                        <div className="w-6 h-1.5 border border-white/30"></div>
                        <div className="w-6 h-1.5 border border-white/30"></div>
                        <div className="w-6 h-1.5 border border-white/30"></div>
                      </div>
                      <span className="text-[9px] uppercase mt-1">4×1</span>
                    </>
                  )}
                  {!['1x3','2x2','1x4'].includes(layout.id) && (
                     <span className="text-[9px] uppercase mt-1">{layout.name}</span>
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Filters */}
          <section className="space-y-4 pt-4 border-t border-[#2a2a2a]">
            <label className="text-[11px] uppercase tracking-widest text-[#888] font-semibold block">Post-Processing</label>
            
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-[11px]">
                  <span>Grain Intensity</span>
                  <span className="text-[#666]">{grainIntensity}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" max="100" 
                  value={grainIntensity}
                  onChange={(e) => setGrainIntensity(Number(e.target.value))}
                  className="w-full h-1 bg-[#222] rounded-none appearance-none cursor-pointer accent-white"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px]">Y2K Date Stamp</span>
                <button 
                  onClick={() => setShowDate(!showDate)}
                  className={cn(
                    "w-10 h-5 rounded-full flex items-center px-1 transition-colors relative",
                    showDate ? "bg-white" : "bg-[#222]"
                  )}
                >
                  <div className={cn(
                    "w-3 h-3 rounded-full transition-transform absolute",
                    showDate ? "bg-black translate-x-5" : "bg-[#666]"
                  )} />
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Action Area */}
        <div className="mt-8 space-y-3">
          <label className="text-[11px] uppercase tracking-widest text-[#888] font-semibold block">Deliverables</label>
          
          {captureState === 'idle' && (
            <button
              onClick={runSession}
              disabled={!isCameraReady}
              className="w-full py-4 bg-white text-black text-[12px] font-bold uppercase tracking-widest hover:bg-[#ccc] transition-colors disabled:opacity-50"
            >
              Capture Session
            </button>
          )}

          {captureState === 'review' && (
            <div className="space-y-2">
              <button
                onClick={() => handleExport('jpg')}
                disabled={isExporting}
                className="w-full py-4 bg-white text-black text-[12px] font-bold uppercase tracking-widest hover:bg-[#ccc] transition-colors disabled:opacity-50"
              >
                Export High-Res JPG
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => handleExport('png')}
                  disabled={isExporting}
                  className="flex-1 py-2 border border-[#333] text-[#e0e0e0] hover:bg-white/5 text-[10px] uppercase tracking-tighter transition-colors disabled:opacity-50"
                >
                  Save PNG
                </button>
                <button
                  onClick={() => handleExport('gif')}
                  disabled={isExporting}
                  className="flex-1 py-2 border border-[#333] text-[#e0e0e0] hover:bg-white/5 text-[10px] uppercase tracking-tighter transition-colors disabled:opacity-50"
                >
                  {isExporting ? 'Encoding...' : 'Export GIF'}
                </button>
              </div>
              <button
                onClick={resetSession}
                className="w-full py-3 mt-2 text-[#666] hover:text-white text-[10px] uppercase tracking-tighter transition-colors"
              >
                Retake Photos
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Viewport */}
      <main className="flex-1 relative flex items-center justify-center p-4 md:p-12 bg-[#080808] overflow-hidden">
        {/* Canvas Overlay: Vignette */}
        <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_150px_rgba(0,0,0,0.9)] z-10"></div>
        
        {/* Camera Feedback Overlays */}
        {captureState !== 'review' && (
          <>
            <div className="absolute top-8 left-8 flex items-center gap-3 z-10">
              <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
              <span className="text-[11px] font-mono uppercase tracking-widest text-[#aaa]">Live Feed{isCameraReady ? ': 60 FPS' : ''}</span>
            </div>
            <div className="absolute bottom-8 right-8 text-right z-10 hidden md:block">
              <p className="text-[40px] font-serif italic text-white/5 leading-none">EXHIBITION QUALITY</p>
              <p className="text-[10px] font-mono text-white/20">BUFFER: READY / MEM: OPTIMAL</p>
            </div>
          </>
        )}

        {/* State: Idle, Countdown, Capturing -> Show Live Camera */}
        {captureState !== 'review' && (
          <div className="relative w-full max-w-4xl aspect-[4/3] bg-[#111] overflow-hidden border-2 border-[#1a1a1a] shadow-2xl z-0">
            <video
              ref={videoRef}
              muted
              playsInline
              className="w-full h-full object-cover transform -scale-x-100 grayscale-[15%]"
            />
            
            {/* Countdown Overlay */}
            {captureState === 'countdown' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <span className="text-9xl text-white font-serif italic drop-shadow-xl animate-pulse">
                  {countdownNum}
                </span>
              </div>
            )}

            {/* Flash Overlay */}
            {flash && (
              <div className="absolute inset-0 bg-white opacity-100 z-50 duration-75 ease-out" />
            )}

            {/* In-progress indicator */}
            {['countdown', 'capturing'].includes(captureState) && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#111]/90 border border-[#333] backdrop-blur-md px-4 py-2 text-[11px] font-mono uppercase tracking-widest text-[#e0e0e0]">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Shot {capturedPhotos.length + 1} of {activeLayout.slots.length}
              </div>
            )}
          </div>
        )}

        {/* State: Review -> Show Composited Strip Preview */}
        {captureState === 'review' && previewCanvasDataUrl && (
          <div className="relative max-h-full max-w-full flex items-center justify-center animate-in fade-in zoom-in-95 duration-500 z-20">
            <img 
              src={previewCanvasDataUrl} 
              alt="Final photobooth strip" 
              className="max-h-full max-w-full object-contain shadow-2xl transform md:rotate-1"
              style={{
                filter: 'drop-shadow(0 25px 25px rgb(0 0 0 / 0.5))'
              }}
            />
            {isExporting && (
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center">
                <div className="w-8 h-8 border-4 border-[#333] border-t-white rounded-full animate-spin mb-4" />
                <p className="text-white text-[11px] uppercase tracking-widest font-mono shadow-md">Processing...</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );

}
