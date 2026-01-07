import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ArrowLeft, Upload, Download, Loader2, Crop, Check, Move } from 'lucide-react';
import { ImageCompareSlider } from '../shared/ImageCompareSlider';
import toast from 'react-hot-toast';

interface CropImageProps {
  onBack: () => void;
}

export const CropImage: React.FC<CropImageProps> = ({ onBack }) => {
  const [image, setImage] = useState<string | null>(null);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const [imgNaturalSize, setImgNaturalSize] = useState({ width: 0, height: 0 });
  const [displayScale, setDisplayScale] = useState(1);
  const [selectedPreset, setSelectedPreset] = useState<string>('free');
  
  // Crop box in display coordinates
  const [cropBox, setCropBox] = useState({ x: 0, y: 0, width: 100, height: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, boxX: 0, boxY: 0, boxW: 0, boxH: 0 });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const presets = [
    { label: 'Free', value: 'free', ratio: null },
    { label: '1:1', value: '1:1', ratio: 1 },
    { label: '16:9', value: '16:9', ratio: 16/9 },
    { label: '4:3', value: '4:3', ratio: 4/3 },
    { label: '9:16', value: '9:16', ratio: 9/16 },
  ];

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    
    setFileName(file.name);
    setCroppedImage(null);
    setSelectedPreset('free');
    
    const reader = new FileReader();
    reader.onload = (e) => setImage(e.target?.result as string);
    reader.readAsDataURL(file);
    toast.success('Image loaded');
  }, []);

  // Calculate display scale and initial crop when image loads
  const handleImageLoad = useCallback(() => {
    if (!imageRef.current || !containerRef.current) return;
    
    const img = imageRef.current;
    const container = containerRef.current;
    
    setImgNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    
    const scale = img.width / img.naturalWidth;
    setDisplayScale(scale);
    
    // Initial crop: 80% centered
    const w = img.width * 0.8;
    const h = img.height * 0.8;
    setCropBox({
      x: (img.width - w) / 2,
      y: (img.height - h) / 2,
      width: w,
      height: h
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]);
  }, [handleFileSelect]);

  const applyPreset = useCallback((preset: typeof presets[0]) => {
    if (!imageRef.current) return;
    setSelectedPreset(preset.value);
    if (!preset.ratio) return;
    
    const img = imageRef.current;
    const ratio = preset.ratio;
    const maxW = img.width * 0.9;
    const maxH = img.height * 0.9;
    
    let w, h;
    if (maxW / ratio <= maxH) {
      w = maxW;
      h = maxW / ratio;
    } else {
      h = maxH;
      w = maxH * ratio;
    }
    
    setCropBox({
      x: (img.width - w) / 2,
      y: (img.height - h) / 2,
      width: w,
      height: h
    });
  }, []);

  // Mouse handlers for dragging
  const handleMouseDown = (e: React.MouseEvent, action: 'move' | string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      boxX: cropBox.x,
      boxY: cropBox.y,
      boxW: cropBox.width,
      boxH: cropBox.height
    });
    
    if (action === 'move') {
      setIsDragging(true);
    } else {
      setIsResizing(action);
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging && !isResizing) return;
    if (!imageRef.current) return;
    
    const img = imageRef.current;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    
    if (isDragging) {
      // Move the box
      let newX = dragStart.boxX + dx;
      let newY = dragStart.boxY + dy;
      
      // Constrain to image bounds
      newX = Math.max(0, Math.min(newX, img.width - cropBox.width));
      newY = Math.max(0, Math.min(newY, img.height - cropBox.height));
      
      setCropBox(prev => ({ ...prev, x: newX, y: newY }));
    } else if (isResizing) {
      let newX = cropBox.x;
      let newY = cropBox.y;
      let newW = dragStart.boxW;
      let newH = dragStart.boxH;
      
      // Handle different resize handles
      if (isResizing.includes('e')) newW = Math.max(50, dragStart.boxW + dx);
      if (isResizing.includes('w')) {
        newW = Math.max(50, dragStart.boxW - dx);
        newX = dragStart.boxX + dx;
      }
      if (isResizing.includes('s')) newH = Math.max(50, dragStart.boxH + dy);
      if (isResizing.includes('n')) {
        newH = Math.max(50, dragStart.boxH - dy);
        newY = dragStart.boxY + dy;
      }
      
      // Constrain
      newX = Math.max(0, newX);
      newY = Math.max(0, newY);
      newW = Math.min(newW, img.width - newX);
      newH = Math.min(newH, img.height - newY);
      
      setCropBox({ x: newX, y: newY, width: newW, height: newH });
      setSelectedPreset('free');
    }
  }, [isDragging, isResizing, dragStart, cropBox.width, cropBox.height]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(null);
  }, []);

  useEffect(() => {
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  const cropImage = useCallback(() => {
    if (!image || !canvasRef.current) return;
    setIsProcessing(true);
    
    // Convert display coords to natural coords
    const naturalCrop = {
      x: Math.round(cropBox.x / displayScale),
      y: Math.round(cropBox.y / displayScale),
      width: Math.round(cropBox.width / displayScale),
      height: Math.round(cropBox.height / displayScale)
    };
    
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current!;
      canvas.width = naturalCrop.width;
      canvas.height = naturalCrop.height;
      canvas.getContext('2d')!.drawImage(
        img, 
        naturalCrop.x, naturalCrop.y, naturalCrop.width, naturalCrop.height,
        0, 0, naturalCrop.width, naturalCrop.height
      );
      setCroppedImage(canvas.toDataURL('image/jpeg', 0.92));
      setIsProcessing(false);
      toast.success('Image cropped');
    };
    img.src = image;
  }, [image, cropBox, displayScale]);

  const downloadImage = useCallback(() => {
    if (!croppedImage) return;
    const link = document.createElement('a');
    link.download = `${fileName.replace(/\.[^/.]+$/, '')}_cropped.jpg`;
    link.href = croppedImage;
    link.click();
    toast.success('Downloaded!');
  }, [croppedImage, fileName]);

  // Natural size of crop
  const naturalCropW = Math.round(cropBox.width / displayScale) || 0;
  const naturalCropH = Math.round(cropBox.height / displayScale) || 0;

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6 sm:mb-8">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2.5 rounded-xl bg-cyber-dark/80 border border-white/10 hover:border-orange-500/50 transition-all flex-shrink-0">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex-shrink-0">
                <Crop className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              Crop Image
            </h1>
            <p className="text-gray-500 text-xs sm:text-sm mt-1 ml-1">Drag to move • Corners to resize</p>
          </div>
        </div>
      </div>

      {!image ? (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-white/10 rounded-2xl p-12 text-center cursor-pointer hover:border-orange-500/30 transition-all bg-cyber-dark/30"
        >
          <div className="inline-flex p-4 rounded-2xl bg-orange-500/10 mb-4">
            <Upload className="w-8 h-8 text-orange-400" />
          </div>
          <p className="text-white font-medium mb-2">Drop your image here</p>
          <p className="text-gray-500 text-sm">or click to browse</p>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])} className="hidden" />
        </div>
      ) : croppedImage ? (
        <div className="space-y-6">
          {/* Cropped Result */}
          <div className="flex justify-center">
            <div className="p-4 rounded-xl bg-cyber-dark border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-emerald-400 text-sm font-medium flex items-center gap-2">
                  <Check className="w-4 h-4" /> Cropped Result
                </h3>
                <span className="text-gray-400 font-mono text-sm">{naturalCropW}×{naturalCropH}px</span>
              </div>
              <img 
                src={croppedImage} 
                alt="Cropped" 
                className="max-w-full max-h-[400px] rounded-lg border border-white/10"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={() => { setImage(null); setCroppedImage(null); }} className="px-4 py-3 sm:py-2 w-full sm:w-auto rounded-xl bg-cyber-dark border border-white/10 text-gray-300 order-2 sm:order-1">New Image</button>
            <button onClick={downloadImage} className="flex-1 w-full sm:w-auto py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold flex items-center justify-center gap-2 order-1 sm:order-2">
              <Download className="w-5 h-5" /> Download
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Interactive Crop Area */}
          <div className="flex justify-center">
          <div ref={containerRef} className="relative inline-block rounded-xl overflow-hidden bg-black">
            {/* Base Image (dimmed) */}
            <img
              ref={imageRef}
              src={image}
              alt="Preview"
              className="max-w-full max-h-[60vh] opacity-40"
              onLoad={handleImageLoad}
              draggable={false}
            />
            
            {/* Crop Box Overlay */}
            <div
              className="absolute border-2 border-cyan-400 cursor-move"
              style={{
                left: cropBox.x,
                top: cropBox.y,
                width: cropBox.width,
                height: cropBox.height,
              }}
              onMouseDown={(e) => handleMouseDown(e, 'move')}
            >
              {/* Cropped area (bright) */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <img
                  src={image}
                  alt="Crop"
                  className="max-w-none"
                  style={{
                    width: imageRef.current?.width,
                    height: imageRef.current?.height,
                    marginLeft: -cropBox.x,
                    marginTop: -cropBox.y,
                  }}
                  draggable={false}
                />
              </div>
              
              {/* Grid lines */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/3 left-0 right-0 h-px border-t border-dashed border-white/40" />
                <div className="absolute top-2/3 left-0 right-0 h-px border-t border-dashed border-white/40" />
                <div className="absolute left-1/3 top-0 bottom-0 w-px border-l border-dashed border-white/40" />
                <div className="absolute left-2/3 top-0 bottom-0 w-px border-l border-dashed border-white/40" />
              </div>
              
              {/* Resize handles */}
              {['nw', 'ne', 'sw', 'se'].map(pos => (
                <div
                  key={pos}
                  className={`absolute w-4 h-4 bg-cyan-400 border-2 border-white cursor-${pos}-resize
                    ${pos.includes('n') ? '-top-2' : '-bottom-2'}
                    ${pos.includes('w') ? '-left-2' : '-right-2'}`}
                  onMouseDown={(e) => handleMouseDown(e, pos)}
                />
              ))}
            </div>
          </div>
          </div>
          {/* Info */}
          <p className="text-center text-gray-400 text-sm">
            {imgNaturalSize.width}×{imgNaturalSize.height} → <span className="text-orange-400 font-medium">{naturalCropW}×{naturalCropH}</span>
          </p>

          {/* Presets */}
          <div className="flex flex-wrap gap-2 justify-center">
            {presets.map((preset) => (
              <button
                key={preset.value}
                onClick={() => applyPreset(preset)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                  ${selectedPreset === preset.value 
                    ? 'bg-orange-500 text-white' 
                    : 'bg-cyber-dark border border-white/10 text-gray-400 hover:border-orange-500/50'}`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={() => { setImage(null); setCroppedImage(null); }} className="px-4 py-3 sm:py-2 w-full sm:w-auto rounded-xl bg-cyber-dark border border-white/10 text-gray-300 order-2 sm:order-1">
              New Image
            </button>
            <button
              onClick={cropImage}
              disabled={isProcessing}
              className="flex-1 w-full sm:w-auto py-3 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 text-white font-semibold hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 order-1 sm:order-2"
            >
              {isProcessing ? <><Loader2 className="w-5 h-5 animate-spin" /> Cropping...</> : <><Crop className="w-5 h-5" /> Crop Image</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
