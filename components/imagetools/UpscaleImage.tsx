import React, { useState, useRef, useCallback } from 'react';
import { ArrowLeft, Upload, Download, Loader2, Maximize, Check, Sparkles } from 'lucide-react';
import { ImageCompareSlider } from '../shared/ImageCompareSlider';
import toast from 'react-hot-toast';

interface UpscaleImageProps {
  onBack: () => void;
}

export const UpscaleImage: React.FC<UpscaleImageProps> = ({ onBack }) => {
  const [image, setImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const [scale, setScale] = useState<2 | 4>(2);
  const [originalDimensions, setOriginalDimensions] = useState<{width: number, height: number} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    
    setFileName(file.name);
    setImageFile(file);
    setProcessedImage(null);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImage(dataUrl);
      
      const img = new Image();
      img.onload = () => setOriginalDimensions({ width: img.width, height: img.height });
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    toast.success('Image loaded');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]);
  }, [handleFileSelect]);

  const upscaleWithAPI = async () => {
    if (!imageFile) return;
    
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'https://ghostmail-worker.rafxyz.workers.dev';
      
      const formData = new FormData();
      formData.append('file', imageFile);
      formData.append('scale', String(scale));

      const response = await fetch(`${API_URL}/api/image/upscale`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('API failed');

      const resultBlob = await response.blob();
      const reader = new FileReader();
      reader.onload = (e) => {
        setProcessedImage(e.target?.result as string);
        toast.success('Upscaled with AI!');
      };
      reader.readAsDataURL(resultBlob);
    } catch {
      toast.error('API failed, using local');
      upscaleLocally();
    }
  };

  const upscaleLocally = () => {
    if (!image || !canvasRef.current) return;
    
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current!;
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      setProcessedImage(canvas.toDataURL('image/jpeg', 0.95));
      toast.success('Upscaled locally');
    };
    img.src = image;
  };

  const upscaleImage = async () => {
    setIsProcessing(true);
    await upscaleWithAPI();
    setIsProcessing(false);
  };

  const downloadImage = useCallback(() => {
    if (!processedImage) return;
    const link = document.createElement('a');
    link.download = `${fileName.replace(/\.[^/.]+$/, '')}_${scale}x.jpg`;
    link.href = processedImage;
    link.click();
    toast.success('Downloaded!');
  }, [processedImage, fileName, scale]);

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6 sm:mb-8">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2.5 rounded-xl bg-cyber-dark/80 border border-white/10 hover:border-amber-500/50 transition-all flex-shrink-0">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex-shrink-0">
                <Maximize className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              Upscale Image
            </h1>
            <p className="text-gray-500 text-xs sm:text-sm mt-1 ml-1">AI-enhanced upscaling</p>
          </div>
        </div>
      </div>

      {!image ? (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-white/10 rounded-2xl p-12 text-center cursor-pointer hover:border-amber-500/30 transition-all bg-cyber-dark/30"
        >
          <div className="inline-flex p-4 rounded-2xl bg-amber-500/10 mb-4">
            <Upload className="w-8 h-8 text-amber-400" />
          </div>
          <p className="text-white font-medium mb-2">Drop your image here</p>
          <p className="text-gray-500 text-sm">or click to browse</p>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])} className="hidden" />
        </div>
      ) : processedImage ? (
        /* Result with compare slider */
        <div className="space-y-6">
          <ImageCompareSlider
            beforeImage={image}
            afterImage={processedImage}
            beforeLabel="Original"
            afterLabel={`${scale}x Upscaled`}
          />
          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={() => { setImage(null); setProcessedImage(null); setImageFile(null); }} className="px-4 py-3 sm:py-2 w-full sm:w-auto rounded-xl bg-cyber-dark border border-white/10 text-gray-300 order-2 sm:order-1">
              New Image
            </button>
            <button onClick={downloadImage} className="flex-1 w-full sm:w-auto py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold flex items-center justify-center gap-2 order-1 sm:order-2">
              <Download className="w-5 h-5" /> Download {scale}x
            </button>
          </div>
        </div>
      ) : (
        /* Settings */
        <div className="space-y-6">
          {/* Preview */}
          <div className="flex justify-center">
            <div className="p-4 rounded-xl bg-cyber-dark border border-white/10">
              <img src={image} alt="Preview" className="max-w-full max-h-[300px] rounded-lg" />
              {originalDimensions && (
                <p className="text-center text-gray-500 text-sm mt-3">
                  {originalDimensions.width}×{originalDimensions.height} → 
                  <span className="text-amber-400 font-medium ml-1">
                    {originalDimensions.width * scale}×{originalDimensions.height * scale}
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* Scale Options */}
          <div className="flex justify-center gap-4">
            {[2, 4].map((s) => (
              <button
                key={s}
                onClick={() => setScale(s as 2 | 4)}
                className={`px-8 py-4 rounded-xl border-2 transition-all ${
                  scale === s 
                    ? 'bg-amber-500/20 border-amber-500 text-amber-400' 
                    : 'bg-cyber-dark border-white/10 text-gray-400 hover:border-amber-500/50'
                }`}
              >
                <span className="text-2xl font-bold">{s}x</span>
                <p className="text-xs mt-1 opacity-70">{s === 2 ? 'Standard' : 'Maximum'}</p>
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={() => { setImage(null); setImageFile(null); }} className="px-4 py-3 sm:py-2 w-full sm:w-auto rounded-xl bg-cyber-dark border border-white/10 text-gray-300 order-2 sm:order-1">
              New Image
            </button>
            <button
              onClick={upscaleImage}
              disabled={isProcessing}
              className="flex-1 w-full sm:w-auto py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2 order-1 sm:order-2"
            >
              {isProcessing ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Upscaling with AI...</>
              ) : (
                <><Sparkles className="w-5 h-5" /> Upscale {scale}x</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
