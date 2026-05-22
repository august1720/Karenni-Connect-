import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ZoomIn, ZoomOut, Check, X, Move } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface ImageCropperProps {
  imageSrc: string;
  onCrop: (croppedFile: File) => void;
  onCancel: () => void;
}

export function ImageCropper({ imageSrc, onCrop, onCancel }: ImageCropperProps) {
  const { t } = useLanguage();
  const [imageDimensions, setImageDimensions] = useState<{ width: number, height: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const containerSize = 280;
  const cropSize = 200;
  const margin = (containerSize - cropSize) / 2; // 40px

  const imageRef = useRef<HTMLImageElement>(null);

  // Load natural dimensions of the image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Initial sizing and centering once image dimensions are loaded
  useEffect(() => {
    if (imageDimensions) {
      const { width, height } = imageDimensions;
      let itemWidth = containerSize;
      let itemHeight = containerSize;

      if (width < height) {
        itemWidth = containerSize;
        itemHeight = containerSize * (height / width);
      } else {
        itemHeight = containerSize;
        itemWidth = containerSize * (width / height);
      }

      // Initial center alignment
      const progressX = (containerSize - itemWidth) / 2;
      const progressY = (containerSize - itemHeight) / 2;
      setPosition({ x: progressX, y: progressY });
      setScale(1);
    }
  }, [imageDimensions]);

  if (!imageDimensions) {
    return (
      <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-[#D62828] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const { width: naturalWidth, height: naturalHeight } = imageDimensions;
  let itemWidth = containerSize;
  let itemHeight = containerSize;

  if (naturalWidth < naturalHeight) {
    itemWidth = containerSize;
    itemHeight = containerSize * (naturalHeight / naturalWidth);
  } else {
    itemHeight = containerSize;
    itemWidth = containerSize * (naturalWidth / naturalHeight);
  }

  // Constrain limits to keep image covering the crop circle:
  // boundaries on screen: crop circle is at [margin, margin + cropSize]
  // image bounding box on screen is: [x, x + itemWidth * scale] (with 0,0 transform-origin)
  const constrainBounds = (newX: number, newY: number, newScale: number) => {
    const minX = margin - (itemWidth * newScale - cropSize);
    const maxX = margin;
    
    const minY = margin - (itemHeight * newScale - cropSize);
    const maxY = margin;

    let rx = newX;
    if (itemWidth * newScale >= cropSize) {
      rx = Math.max(minX, Math.min(maxX, newX));
    } else {
      rx = (containerSize - itemWidth * newScale) / 2;
    }

    let ry = newY;
    if (itemHeight * newScale >= cropSize) {
      ry = Math.max(minY, Math.min(maxY, newY));
    } else {
      ry = (containerSize - itemHeight * newScale) / 2;
    }

    return { x: rx, y: ry };
  };

  // Zoom Handler with Focal Centering
  const handleZoomChange = (newScale: number) => {
    const clampedScale = Math.max(1, Math.min(4, newScale));
    
    // Zoom focal point is center of the crop circle (containerSize / 2, containerSize / 2) -> (140, 140)
    const focalX = containerSize / 2;
    const focalY = containerSize / 2;

    // Get unscaled coordinate under the focal center:
    const px = (focalX - position.x) / scale;
    const py = (focalY - position.y) / scale;

    // Calculate new top-left corner so that (px, py) stays at (focalX, focalY)
    const nextX = focalX - px * clampedScale;
    const nextY = focalY - py * clampedScale;

    const constrained = constrainBounds(nextX, nextY, clampedScale);
    setScale(clampedScale);
    setPosition(constrained);
  };

  // Mouse / Touch Handlers for Dragging
  const handleDragStart = (clientX: number, clientY: number) => {
    setIsDragging(true);
    dragStart.current = {
      x: clientX - position.x,
      y: clientY - position.y
    };
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    const newX = clientX - dragStart.current.x;
    const newY = clientY - dragStart.current.y;
    const constrained = constrainBounds(newX, newY, scale);
    setPosition(constrained);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleGenerateCrop = async () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image for cropping'));
        img.src = imageSrc;
      });

      // Map crop window coordinates back to natural coordinates
      // Screen space: crop window top-left is (margin, margin) -> (40, 40)
      // Unscaled image space position of crop window top-left:
      const crop_px = (margin - position.x) / scale;
      const crop_py = (margin - position.y) / scale;

      // Transform to original natural image coordinates
      const ratioX = naturalWidth / itemWidth;
      const ratioY = naturalHeight / itemHeight;

      const srcX = crop_px * ratioX;
      const srcY = crop_py * ratioY;
      const srcW = (cropSize / scale) * ratioX;
      const srcH = (cropSize / scale) * ratioY;

      // Draw onto canvas
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, 512, 512);

      canvas.toBlob((blob) => {
        if (blob) {
          const croppedFile = new File([blob], 'avatar_cropped.jpg', { type: 'image/jpeg', lastModified: Date.now() });
          onCrop(croppedFile);
        }
      }, 'image/jpeg', 0.92);
    } catch (e) {
      console.error(e);
      alert('Error during crop resolution. Please try another image.');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 select-none"
    >
      <motion.div 
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col gap-5 items-center"
      >
        <div className="w-full text-center">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t("Crop Profile Picture")}</h3>
          <p className="text-xs text-slate-500 mt-1">{t("Drag to position & slide to zoom")}</p>
        </div>

        {/* Draggable Viewport Container */}
        <div 
          className="relative overflow-hidden bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 cursor-grab active:cursor-grabbing shadow-inner"
          style={{ width: containerSize, height: containerSize }}
          onMouseDown={(e) => handleDragStart(e.clientX, e.clientY)}
          onMouseMove={(e) => handleDragMove(e.clientX, e.clientY)}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
          onTouchStart={(e) => {
            if (e.touches[0]) handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
          }}
          onTouchMove={(e) => {
            if (e.touches[0]) handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
          }}
          onTouchEnd={handleDragEnd}
        >
          {/* Draggable Image */}
          <img
            ref={imageRef}
            src={imageSrc}
            alt="Crop Target"
            className="absolute max-w-none origin-top-left pointer-events-none select-none"
            style={{
              width: itemWidth,
              height: itemHeight,
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            }}
          />

          {/* Symmetrical Semi-Transparent Crop Mask (Dark outside, transparent circle) */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <svg width={containerSize} height={containerSize} className="absolute inset-0">
              <defs>
                <mask id="cropMask">
                  <rect width={containerSize} height={containerSize} fill="white" />
                  <circle cx={containerSize / 2} cy={containerSize / 2} r={cropSize / 2} fill="black" />
                </mask>
              </defs>
              {/* Dark tinted outer area */}
              <rect width={containerSize} height={containerSize} fill="rgba(15, 23, 42, 0.72)" mask="url(#cropMask)" />
              {/* Highlight perimeter ring */}
              <circle cx={containerSize / 2} cy={containerSize / 2} r={cropSize / 2} fill="none" stroke="white" strokeWidth="2.5" className="opacity-90" />
            </svg>
            
            {/* Guide Grid overlay */}
            <div className="absolute w-[200px] h-[200px] rounded-full border border-dashed border-white/25 pointer-events-none flex items-center justify-center">
              <Move className="w-5 h-5 text-white/50" />
            </div>
          </div>
        </div>

        {/* Zoom Control Slider */}
        <div className="w-full flex items-center gap-3 bg-slate-50 dark:bg-slate-950/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/60">
          <button 
            type="button"
            onClick={() => handleZoomChange(scale - 0.2)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          
          <input
            type="range"
            min="1"
            max="4"
            step="0.01"
            value={scale}
            onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
            className="flex-1 h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#D62828]"
          />
          
          <button 
            type="button"
            onClick={() => handleZoomChange(scale + 0.2)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        {/* Dialog Control Buttons */}
        <div className="w-full flex gap-3 text-sm">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1.5"
          >
            <X className="w-4 h-4" />
            {t("Cancel")}
          </button>
          
          <button
            type="button"
            onClick={handleGenerateCrop}
            className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-gradient-to-r from-[#D62828] to-[#1E3A8A] hover:opacity-90 shadow-md shadow-[#D62828]/25 transition-all flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            {t("Apply")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
