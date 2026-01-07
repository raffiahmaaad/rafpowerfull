import React, { useState, useRef, useCallback } from 'react';
import { ArrowLeft, Upload, Download, Loader2, ImageIcon, Eraser, Check } from 'lucide-react';
import { ImageCompareSlider } from '../shared/ImageCompareSlider';
import toast from 'react-hot-toast';

interface RemoveBGProps {
  onBack: () => void;
}

export const RemoveBG: React.FC<RemoveBGProps> = ({ onBack }) => {
  const [image, setImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [transparentImage, setTransparentImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const [bgColor, setBgColor] = useState<string>('transparent');
  const [showSlider, setShowSlider] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    
    setFileName(file.name);
    setImageFile(file);
    setTransparentImage(null);
    setProcessedImage(null);
    setShowSlider(false);
    
    const reader = new FileReader();
    reader.onload = (e) => {
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

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const removeBackground = useCallback(async () => {
    if (!imageFile) return;
    
    setIsProcessing(true);
    
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'https://ghostmail-worker.rafxyz.workers.dev';
      
      const formData = new FormData();
      formData.append('file', imageFile);

      const response = await fetch(`${API_URL}/api/image/removebg`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to remove background');
      }

      const resultBlob = await response.blob();
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const transparentResult = e.target?.result as string;
        setTransparentImage(transparentResult);
        setProcessedImage(transparentResult);
        setShowSlider(true);
        toast.success('Background removed successfully!');
      };
      reader.readAsDataURL(resultBlob);
      
    } catch (err: any) {
      console.error('Background removal failed:', err);
      toast.error(err.message || 'Failed to remove background');
    } finally {
      setIsProcessing(false);
    }
  }, [imageFile]);

  const applyBgColor = useCallback((newBgColor: string) => {
    if (!transparentImage || !canvasRef.current) return;
    
    setBgColor(newBgColor);
    
    if (newBgColor === 'transparent') {
      setProcessedImage(transparentImage);
      return;
    }
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      
      ctx.fillStyle = newBgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      
      setProcessedImage(canvas.toDataURL('image/png'));
    };
    img.src = transparentImage;
  }, [transparentImage]);

  const downloadImage = useCallback(() => {
    if (!processedImage) return;
    
    const link = document.createElement('a');
    const baseName = fileName.replace(/\.[^/.]+$/, '');
    link.download = `${baseName}_nobg.png`;
    link.href = processedImage;
    link.click();
    toast.success('Downloaded!');
  }, [processedImage, fileName]);

  const bgColorOptions = [
    { value: 'transparent', label: 'Transparent' },
    { value: '#ffffff', label: 'White' },
    { value: '#000000', label: 'Black' },
    { value: '#0066cc', label: 'Blue' },
    { value: '#cc0000', label: 'Red' },
    { value: '#00cc66', label: 'Green' },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6 sm:mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 rounded-xl bg-cyber-dark/80 border border-white/10 
                     hover:border-rose-500/50 hover:bg-cyber-dark
                     transition-all duration-300 hover:scale-105 flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex-shrink-0">
                <Eraser className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              Remove Background
            </h1>
            <p className="text-gray-500 text-xs sm:text-sm mt-1 ml-1">Powered by iLoveIMG API</p>
          </div>
        </div>
      </div>

      {!image ? (
        /* Upload Area */
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
          className="relative border-2 border-dashed border-white/10 rounded-2xl p-12
                   hover:border-rose-500/30 transition-all duration-300 bg-cyber-dark/30 cursor-pointer"
        >
          <div className="text-center">
            <div className="inline-flex p-4 rounded-2xl bg-rose-500/10 mb-4">
              <Upload className="w-8 h-8 text-rose-400" />
            </div>
            <p className="text-white font-medium mb-2">Drop your image here</p>
            <p className="text-gray-500 text-sm">or click to browse</p>
            <p className="text-gray-600 text-xs mt-4">Supports JPG, PNG, WebP</p>
          </div>
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
          {/* Compare Slider or Side by Side */}
          {showSlider && image && processedImage ? (
            <div className="p-4 rounded-xl bg-cyber-dark/50 border border-white/5">
              <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                Compare Result
              </h3>
              <ImageCompareSlider
                beforeImage={image}
                afterImage={processedImage}
                beforeLabel="Original"
                afterLabel="Processed"
                className="max-h-[500px]"
              />
            </div>
          ) : (
            /* Side by Side Preview */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-cyber-dark border border-white/10">
                <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" /> Original
                </h3>
                <div className="aspect-square bg-cyber-panel rounded-lg overflow-hidden flex items-center justify-center">
                  <img src={image} alt="Original" className="max-w-full max-h-full object-contain" />
                </div>
              </div>
              
              <div className="p-4 rounded-xl bg-cyber-dark border border-white/10">
                <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                  <Check className="w-4 h-4" /> Result
                </h3>
                <div 
                  className="aspect-square rounded-lg overflow-hidden flex items-center justify-center"
                  style={{
                    background: 'repeating-conic-gradient(#1c1c2e 0% 25%, #2d2d3d 0% 50%) 50% / 20px 20px'
                  }}
                >
                  {isProcessing ? (
                    <div className="text-center">
                      <Loader2 className="w-12 h-12 text-rose-400 animate-spin mx-auto mb-2" />
                      <p className="text-gray-400 text-sm">Processing with iLoveIMG...</p>
                    </div>
                  ) : (
                    <div className="text-center p-4">
                      <Eraser className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">Click "Remove Background" to process</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Background Color Options */}
          {processedImage && (
            <div className="p-4 rounded-xl bg-cyber-dark/50 border border-white/5">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Background Color</h3>
              <div className="flex flex-wrap gap-2">
                {bgColorOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => applyBgColor(option.value)}
                    className={`w-10 h-10 rounded-lg border-2 transition-all
                      ${option.value === 'transparent' 
                        ? 'bg-[repeating-conic-gradient(#ccc_0%_25%,#fff_0%_50%)_50%/10px_10px]' 
                        : ''
                      }
                      ${bgColor === option.value ? 'border-rose-500 scale-110' : 'border-white/20 hover:border-white/40'}`}
                    style={{ backgroundColor: option.value !== 'transparent' ? option.value : undefined }}
                    title={option.label}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => {
                setImage(null);
                setImageFile(null);
                setTransparentImage(null);
                setProcessedImage(null);
                setBgColor('transparent');
                setShowSlider(false);
              }}
              className="px-4 py-3 sm:py-2 w-full sm:w-auto rounded-xl bg-cyber-dark border border-white/10 
                       text-gray-300 hover:border-white/30 transition-all order-2 sm:order-1"
            >
              New Image
            </button>
            <button
              onClick={removeBackground}
              disabled={isProcessing || !!processedImage}
              className="flex-1 w-full sm:w-auto py-3 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600
                       text-white font-semibold hover:shadow-lg hover:shadow-rose-500/25 
                       transition-all disabled:opacity-50 flex items-center justify-center gap-2 order-1 sm:order-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : processedImage ? (
                <>
                  <Check className="w-5 h-5" />
                  Background Removed!
                </>
              ) : (
                <>
                  <Eraser className="w-5 h-5" />
                  Remove Background
                </>
              )}
            </button>
            {processedImage && (
              <button
                onClick={downloadImage}
                className="px-6 py-3 w-full sm:w-auto rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600
                         text-white font-semibold hover:shadow-lg hover:shadow-emerald-500/25 
                         transition-all flex items-center justify-center gap-2 order-3"
              >
                <Download className="w-5 h-5" />
                Download
              </button>
            )}
          </div>
        </div>
      )}

      {/* Info Notice */}
      <div className="mt-8 p-4 rounded-xl bg-gradient-to-r from-rose-500/10 to-pink-500/10 border border-white/5">
        <p className="text-gray-400 text-sm text-center">
          ✨ <span className="text-rose-400">Powered by iLoveAPI</span> — 2,500 free credits/month
        </p>
      </div>
    </div>
  );
};
