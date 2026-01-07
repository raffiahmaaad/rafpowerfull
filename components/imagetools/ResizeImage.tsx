import React, { useState, useRef, useCallback } from 'react';
import { ArrowLeft, Upload, Download, Loader2, Link2, Link2Off, Scaling } from 'lucide-react';
import { ImageCompareSlider } from '../shared/ImageCompareSlider';
import { APIToggle } from '../shared/APIToggle';
import toast from 'react-hot-toast';

interface ResizeImageProps {
  onBack: () => void;
}

export const ResizeImage: React.FC<ResizeImageProps> = ({ onBack }) => {
  const [image, setImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [originalWidth, setOriginalWidth] = useState<number>(0);
  const [originalHeight, setOriginalHeight] = useState<number>(0);
  const [width, setWidth] = useState<number>(0);
  const [height, setHeight] = useState<number>(0);
  const [lockAspectRatio, setLockAspectRatio] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resizedImage, setResizedImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [useAPI, setUseAPI] = useState(false); // Default to local
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const aspectRatio = originalWidth / originalHeight;

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    
    setFileName(file.name);
    setImageFile(file);
    setResizedImage(null);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setOriginalWidth(img.width);
        setOriginalHeight(img.height);
        setWidth(img.width);
        setHeight(img.height);
      };
      img.src = e.target?.result as string;
      setImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);
    toast.success('Image loaded');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleWidthChange = (newWidth: number) => {
    setWidth(newWidth);
    if (lockAspectRatio && aspectRatio) {
      setHeight(Math.round(newWidth / aspectRatio));
    }
  };

  const handleHeightChange = (newHeight: number) => {
    setHeight(newHeight);
    if (lockAspectRatio && aspectRatio) {
      setWidth(Math.round(newHeight * aspectRatio));
    }
  };

  const resizeWithAPI = async () => {
    if (!imageFile) return;
    
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'https://ghostmail-worker.rafxyz.workers.dev';
      
      const formData = new FormData();
      formData.append('file', imageFile);
      formData.append('width', String(width));
      formData.append('height', String(height));

      const response = await fetch(`${API_URL}/api/image/resize`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('API resize failed');

      const resultBlob = await response.blob();
      const reader = new FileReader();
      reader.onload = (e) => {
        setResizedImage(e.target?.result as string);
        toast.success('Resized with API');
      };
      reader.readAsDataURL(resultBlob);
    } catch (err) {
      console.error('API resize failed:', err);
      toast.error('API failed, using local');
      resizeLocally();
    }
  };

  const resizeLocally = () => {
    if (!image || !canvasRef.current) return;
    
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current!;
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);
      
      setResizedImage(canvas.toDataURL('image/jpeg', 0.92));
      toast.success('Resized locally');
    };
    img.src = image;
  };

  const resizeImage = async () => {
    setIsProcessing(true);
    if (useAPI) {
      await resizeWithAPI();
    } else {
      resizeLocally();
    }
    setIsProcessing(false);
  };

  const downloadImage = useCallback(() => {
    if (!resizedImage) return;
    const link = document.createElement('a');
    const baseName = fileName.replace(/\.[^/.]+$/, '');
    link.download = `${baseName}_${width}x${height}.jpg`;
    link.href = resizedImage;
    link.click();
    toast.success('Downloaded!');
  }, [resizedImage, fileName, width, height]);

  const presetSizes = [
    { label: '50%', width: Math.round(originalWidth * 0.5), height: Math.round(originalHeight * 0.5) },
    { label: '75%', width: Math.round(originalWidth * 0.75), height: Math.round(originalHeight * 0.75) },
    { label: '150%', width: Math.round(originalWidth * 1.5), height: Math.round(originalHeight * 1.5) },
    { label: '200%', width: Math.round(originalWidth * 2), height: Math.round(originalHeight * 2) },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6 sm:mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 rounded-xl bg-cyber-dark/80 border border-white/10 hover:border-blue-500/50 transition-all flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex-shrink-0">
                <Scaling className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              Resize Image
            </h1>
            <p className="text-gray-500 text-xs sm:text-sm mt-1 ml-1">Change image dimensions</p>
          </div>
        </div>
      </div>

      {!image ? (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-white/10 rounded-2xl p-12 text-center 
                   cursor-pointer hover:border-blue-500/30 transition-all bg-cyber-dark/30"
        >
          <div className="inline-flex p-4 rounded-2xl bg-blue-500/10 mb-4">
            <Upload className="w-8 h-8 text-blue-400" />
          </div>
          <p className="text-white font-medium mb-2">Drop your image here</p>
          <p className="text-gray-500 text-sm">or click to browse</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            className="hidden"
          />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Compare Slider */}
          {resizedImage && image ? (
            <div className="p-4 rounded-xl bg-cyber-dark/50 border border-white/5">
              <h3 className="text-white font-medium mb-3">Compare Result</h3>
              <ImageCompareSlider
                beforeImage={image}
                afterImage={resizedImage}
                beforeLabel={`Original (${originalWidth}×${originalHeight})`}
                afterLabel={`Resized (${width}×${height})`}
                className="max-h-[400px]"
              />
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-cyber-dark border border-white/10">
              <div className="aspect-video bg-cyber-panel rounded-lg overflow-hidden flex items-center justify-center">
                <img src={image} alt="Preview" className="max-w-full max-h-full object-contain" />
              </div>
              <p className="text-center text-gray-400 text-sm mt-2">
                Original: {originalWidth} × {originalHeight}px
              </p>
            </div>
          )}

          {/* API Toggle */}
          <APIToggle useAPI={useAPI} onToggle={setUseAPI} />

          {/* Size Controls */}
          <div className="p-4 rounded-xl bg-cyber-dark/50 border border-white/5">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[120px]">
                <label className="text-sm font-medium text-gray-300 block mb-2">Width (px)</label>
                <input
                  type="number"
                  value={width}
                  onChange={(e) => handleWidthChange(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-cyber-panel border border-white/10 
                           text-white focus:border-blue-500 outline-none"
                />
              </div>
              
              <button
                onClick={() => setLockAspectRatio(!lockAspectRatio)}
                className={`p-2 rounded-lg border transition-all ${
                  lockAspectRatio 
                    ? 'bg-blue-500/20 border-blue-500 text-blue-400' 
                    : 'bg-cyber-dark border-white/10 text-gray-400'
                }`}
              >
                {lockAspectRatio ? <Link2 className="w-5 h-5" /> : <Link2Off className="w-5 h-5" />}
              </button>
              
              <div className="flex-1 min-w-[120px]">
                <label className="text-sm font-medium text-gray-300 block mb-2">Height (px)</label>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => handleHeightChange(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-cyber-panel border border-white/10 
                           text-white focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Preset Sizes */}
            <div className="flex flex-wrap gap-2 mt-4">
              {presetSizes.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => { setWidth(preset.width); setHeight(preset.height); }}
                  className="px-3 py-1 rounded-lg bg-cyber-panel border border-white/10 
                           text-gray-300 text-sm hover:border-blue-500/50 transition-all"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => { setImage(null); setResizedImage(null); setImageFile(null); }}
              className="px-4 py-3 sm:py-2 w-full sm:w-auto rounded-xl bg-cyber-dark border border-white/10 text-gray-300 hover:border-white/30 order-2 sm:order-1"
            >
              New Image
            </button>
            <button
              onClick={resizeImage}
              disabled={isProcessing}
              className="flex-1 w-full sm:w-auto py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600
                       text-white font-semibold hover:shadow-lg hover:shadow-blue-500/25 
                       transition-all disabled:opacity-50 flex items-center justify-center gap-2 order-1 sm:order-2"
            >
              {isProcessing ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Resizing...</>
              ) : (
                `Resize to ${width}×${height}`
              )}
            </button>
            {resizedImage && (
              <button
                onClick={downloadImage}
                className="px-6 py-3 w-full sm:w-auto rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600
                         text-white font-semibold flex items-center justify-center gap-2 order-3"
              >
                <Download className="w-5 h-5" /> Download
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
