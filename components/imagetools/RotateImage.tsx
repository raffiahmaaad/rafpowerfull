import React, { useState, useRef, useCallback } from 'react';
import { ArrowLeft, Upload, Download, Loader2, RotateCw, RotateCcw, FlipHorizontal, FlipVertical, Check } from 'lucide-react';
import { ImageCompareSlider } from '../shared/ImageCompareSlider';
import toast from 'react-hot-toast';

interface RotateImageProps {
  onBack: () => void;
}

export const RotateImage: React.FC<RotateImageProps> = ({ onBack }) => {
  const [image, setImage] = useState<string | null>(null);
  const [rotation, setRotation] = useState<number>(0);
  const [flipH, setFlipH] = useState<boolean>(false);
  const [flipV, setFlipV] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    
    setFileName(file.name);
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setProcessedImage(null);
    
    const reader = new FileReader();
    reader.onload = (e) => setImage(e.target?.result as string);
    reader.readAsDataURL(file);
    toast.success('Image loaded');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const rotateLeft = () => setRotation((prev) => (prev - 90 + 360) % 360);
  const rotateRight = () => setRotation((prev) => (prev + 90) % 360);
  const toggleFlipH = () => setFlipH((prev) => !prev);
  const toggleFlipV = () => setFlipV((prev) => !prev);

  const processImage = useCallback(() => {
    if (!image || !canvasRef.current) return;
    
    setIsProcessing(true);
    
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d')!;
      
      const swap = rotation === 90 || rotation === 270;
      canvas.width = swap ? img.height : img.width;
      canvas.height = swap ? img.width : img.height;
      
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();
      
      setProcessedImage(canvas.toDataURL('image/png'));
      setIsProcessing(false);
      toast.success('Applied transformations');
    };
    img.src = image;
  }, [image, rotation, flipH, flipV]);

  const downloadImage = useCallback(() => {
    if (!processedImage) return;
    const link = document.createElement('a');
    const baseName = fileName.replace(/\.[^/.]+$/, '');
    link.download = `${baseName}_rotated.png`;
    link.href = processedImage;
    link.click();
    toast.success('Downloaded!');
  }, [processedImage, fileName]);

  const previewStyle = {
    transform: `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
    transition: 'transform 0.3s ease'
  };

  const hasChanges = rotation !== 0 || flipH || flipV;

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6 sm:mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 rounded-xl bg-cyber-dark/80 border border-white/10 hover:border-cyan-500/50 transition-all flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex-shrink-0">
                <RotateCw className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              Rotate Image
            </h1>
            <p className="text-gray-500 text-xs sm:text-sm mt-1 ml-1">Rotate and flip images (100% local)</p>
          </div>
        </div>
      </div>

      {!image ? (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-white/10 rounded-2xl p-12 text-center 
                   cursor-pointer hover:border-cyan-500/30 transition-all bg-cyber-dark/30"
        >
          <div className="inline-flex p-4 rounded-2xl bg-cyan-500/10 mb-4">
            <Upload className="w-8 h-8 text-cyan-400" />
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
          {/* Compare Slider (after processing) */}
          {processedImage && image ? (
            <div className="p-4 rounded-xl bg-cyber-dark/50 border border-white/5">
              <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                Transformation Applied
              </h3>
              <ImageCompareSlider
                beforeImage={image}
                afterImage={processedImage}
                beforeLabel="Original"
                afterLabel="Transformed"
                className="max-h-[400px]"
              />
            </div>
          ) : (
            /* Live Preview */
            <div className="p-4 rounded-xl bg-cyber-dark border border-white/10">
              <div className="aspect-video bg-cyber-panel rounded-lg overflow-hidden flex items-center justify-center">
                <img 
                  src={image} 
                  alt="Preview" 
                  className="max-w-[80%] max-h-[80%] object-contain"
                  style={previewStyle}
                />
              </div>
              <p className="text-center text-gray-400 text-sm mt-2">
                Rotation: {rotation}° 
                {flipH && ' | Flipped H'}
                {flipV && ' | Flipped V'}
              </p>
            </div>
          )}

          {/* Controls */}
          {!processedImage && (
            <div className="p-4 rounded-xl bg-cyber-dark/50 border border-white/5">
              <div className="flex justify-center gap-3 flex-wrap">
                <button
                  onClick={rotateLeft}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl bg-cyber-panel border border-white/10 
                           text-white hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all"
                >
                  <RotateCcw className="w-5 h-5" /> Rotate Left
                </button>
                
                <button
                  onClick={rotateRight}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl bg-cyber-panel border border-white/10 
                           text-white hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all"
                >
                  <RotateCw className="w-5 h-5" /> Rotate Right
                </button>
                
                <button
                  onClick={toggleFlipH}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all ${
                    flipH 
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400' 
                      : 'bg-cyber-panel border-white/10 text-white hover:border-cyan-500/50'
                  }`}
                >
                  <FlipHorizontal className="w-5 h-5" /> Flip H
                </button>
                
                <button
                  onClick={toggleFlipV}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all ${
                    flipV 
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400' 
                      : 'bg-cyber-panel border-white/10 text-white hover:border-cyan-500/50'
                  }`}
                >
                  <FlipVertical className="w-5 h-5" /> Flip V
                </button>
              </div>

              {/* Quick rotation presets */}
              <div className="flex justify-center gap-2 mt-4">
                {[0, 90, 180, 270].map((deg) => (
                  <button
                    key={deg}
                    onClick={() => setRotation(deg)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                      rotation === deg
                        ? 'bg-cyan-500 text-black font-bold'
                        : 'bg-cyber-panel text-gray-400 hover:text-white'
                    }`}
                  >
                    {deg}°
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => { setImage(null); setProcessedImage(null); setRotation(0); setFlipH(false); setFlipV(false); }}
              className="px-4 py-3 sm:py-2 w-full sm:w-auto rounded-xl bg-cyber-dark border border-white/10 text-gray-300 order-2 sm:order-1"
            >
              New Image
            </button>
            <button
              onClick={processImage}
              disabled={isProcessing || !hasChanges}
              className="flex-1 w-full sm:w-auto py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600
                       text-white font-semibold hover:shadow-lg hover:shadow-cyan-500/25 
                       transition-all disabled:opacity-50 flex items-center justify-center gap-2 order-1 sm:order-2"
            >
              {isProcessing ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
              ) : processedImage ? (
                <><Check className="w-5 h-5" /> Done!</>
              ) : (
                'Apply Changes'
              )}
            </button>
            {processedImage && (
              <button
                onClick={downloadImage}
                className="px-6 py-3 w-full sm:w-auto rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600
                         text-white font-semibold flex items-center justify-center gap-2 order-3"
              >
                <Download className="w-5 h-5" /> Download
              </button>
            )}
          </div>

          {/* Info */}
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
            <p className="text-gray-400 text-sm">
              🔒 <span className="text-emerald-400">100% Local</span> — No API credits used
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
