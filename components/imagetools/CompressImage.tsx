import React, { useState, useRef, useCallback } from 'react';
import { ArrowLeft, Upload, Download, Loader2, Minimize2, Check, TrendingDown } from 'lucide-react';
import { ImageCompareSlider } from '../shared/ImageCompareSlider';
import { APIToggle } from '../shared/APIToggle';
import toast from 'react-hot-toast';

interface CompressImageProps {
  onBack: () => void;
}

export const CompressImage: React.FC<CompressImageProps> = ({ onBack }) => {
  const [image, setImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [originalSize, setOriginalSize] = useState<number>(0);
  const [compressedSize, setCompressedSize] = useState<number>(0);
  const [quality, setQuality] = useState<number>(80);
  const [isProcessing, setIsProcessing] = useState(false);
  const [compressedImage, setCompressedImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [useAPI, setUseAPI] = useState(false); // Default local to save credits
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    
    setFileName(file.name);
    setImageFile(file);
    setOriginalSize(file.size);
    setCompressedImage(null);
    setCompressedSize(0);
    
    const reader = new FileReader();
    reader.onload = (e) => setImage(e.target?.result as string);
    reader.readAsDataURL(file);
    toast.success('Image loaded');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFileSelect(e.dataTransfer.files[0]);
  }, [handleFileSelect]);

  const compressWithAPI = async () => {
    if (!imageFile) return;
    
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'https://ghostmail-worker.rafxyz.workers.dev';
      const formData = new FormData();
      formData.append('file', imageFile);

      const response = await fetch(`${API_URL}/api/image/compress`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('API failed');

      const resultBlob = await response.blob();
      setCompressedSize(resultBlob.size);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        setCompressedImage(e.target?.result as string);
        toast.success('Compressed with API');
      };
      reader.readAsDataURL(resultBlob);
    } catch {
      toast.error('API failed, using local');
      compressLocally();
    }
  };

  const compressLocally = () => {
    if (!image || !canvasRef.current) return;
    
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current!;
      canvas.width = img.width;
      canvas.height = img.height;
      
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      
      const compressed = canvas.toDataURL('image/jpeg', quality / 100);
      setCompressedImage(compressed);
      
      const base64Length = compressed.split(',')[1].length;
      setCompressedSize((base64Length * 3) / 4);
      toast.success('Compressed locally');
    };
    img.src = image;
  };

  const compressImage = async () => {
    setIsProcessing(true);
    if (useAPI) await compressWithAPI();
    else compressLocally();
    setIsProcessing(false);
  };

  const downloadImage = useCallback(() => {
    if (!compressedImage) return;
    const link = document.createElement('a');
    link.download = `${fileName.replace(/\.[^/.]+$/, '')}_compressed.jpg`;
    link.href = compressedImage;
    link.click();
    toast.success('Downloaded!');
  }, [compressedImage, fileName]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const reduction = originalSize > 0 && compressedSize > 0 
    ? Math.round((1 - compressedSize / originalSize) * 100)
    : 0;

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6 sm:mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 rounded-xl bg-cyber-dark/80 border border-white/10 hover:border-emerald-500/50 transition-all flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex-shrink-0">
                <Minimize2 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              Compress Image
            </h1>
            <p className="text-gray-500 text-xs sm:text-sm mt-1 ml-1">Reduce file size</p>
          </div>
        </div>
      </div>

      {!image ? (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-white/10 rounded-2xl p-12 text-center 
                   cursor-pointer hover:border-emerald-500/30 transition-all bg-cyber-dark/30"
        >
          <div className="inline-flex p-4 rounded-2xl bg-emerald-500/10 mb-4">
            <Upload className="w-8 h-8 text-emerald-400" />
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
      ) : compressedImage ? (
        <div className="space-y-6">
          {/* Compare slider */}
          <ImageCompareSlider
            beforeImage={image}
            afterImage={compressedImage}
            beforeLabel={`Original (${formatSize(originalSize)})`}
            afterLabel={`Compressed (${formatSize(compressedSize)})`}
          />
          
          {/* Stats */}
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <TrendingDown className="w-5 h-5 text-emerald-400" />
              <span className="text-white font-medium">
                Reduced by <span className="text-emerald-400 text-lg font-bold">{reduction}%</span>
              </span>
              <span className="text-gray-500">
                ({formatSize(originalSize)} → {formatSize(compressedSize)})
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => { setImage(null); setCompressedImage(null); setImageFile(null); }}
              className="px-4 py-3 sm:py-2 w-full sm:w-auto rounded-xl bg-cyber-dark border border-white/10 text-gray-300 order-2 sm:order-1"
            >
              New Image
            </button>
            <button
              onClick={downloadImage}
              className="flex-1 w-full sm:w-auto py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600
                       text-white font-semibold flex items-center justify-center gap-2 order-1 sm:order-2"
            >
              <Download className="w-5 h-5" /> Download Compressed
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Preview */}
          <div className="flex gap-6 items-start">
            <div className="flex-1 p-4 rounded-xl bg-cyber-dark border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-gray-400 text-sm font-medium">Original</h3>
                <span className="text-emerald-400 font-mono text-sm">{formatSize(originalSize)}</span>
              </div>
              <div className="aspect-video bg-cyber-panel rounded-lg overflow-hidden flex items-center justify-center">
                <img src={image} alt="Original" className="max-w-full max-h-full object-contain" />
              </div>
            </div>
          </div>

          {/* API Toggle */}
          <APIToggle useAPI={useAPI} onToggle={setUseAPI} />

          {/* Quality Slider (only for local) */}
          {!useAPI && (
            <div className="p-4 rounded-xl bg-cyber-dark/50 border border-white/5">
              <div className="flex justify-between items-center mb-3">
                <label className="text-gray-300 text-sm font-medium">Quality</label>
                <span className="text-emerald-400 font-mono font-bold">{quality}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="w-full h-2 bg-cyber-panel rounded-lg appearance-none cursor-pointer
                         [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 
                         [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full 
                         [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:cursor-pointer
                         [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(16,185,129,0.5)]"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>Smaller file</span>
                <span>Higher quality</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => { setImage(null); setImageFile(null); }}
              className="px-4 py-3 sm:py-2 w-full sm:w-auto rounded-xl bg-cyber-dark border border-white/10 text-gray-300 order-2 sm:order-1"
            >
              New Image
            </button>
            <button
              onClick={compressImage}
              disabled={isProcessing}
              className="flex-1 w-full sm:w-auto py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600
                       text-white font-semibold hover:shadow-lg transition-all disabled:opacity-50 
                       flex items-center justify-center gap-2 order-1 sm:order-2"
            >
              {isProcessing ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Compressing...</>
              ) : (
                <><Minimize2 className="w-5 h-5" /> Compress Image</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
