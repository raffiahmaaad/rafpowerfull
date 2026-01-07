import React, { useState, useRef, useCallback } from 'react';
import { ArrowLeft, Upload, Download, Loader2, FileImage, Check } from 'lucide-react';
import toast from 'react-hot-toast';

interface ConvertImageProps {
  onBack: () => void;
}

type ImageFormat = 'jpg' | 'png' | 'webp' | 'gif';

export const ConvertImage: React.FC<ConvertImageProps> = ({ onBack }) => {
  const [image, setImage] = useState<string | null>(null);
  const [convertedImage, setConvertedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const [sourceFormat, setSourceFormat] = useState<string>('');
  const [targetFormat, setTargetFormat] = useState<ImageFormat>('png');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const formats: { value: ImageFormat; label: string; mime: string }[] = [
    { value: 'jpg', label: 'JPG', mime: 'image/jpeg' },
    { value: 'png', label: 'PNG', mime: 'image/png' },
    { value: 'webp', label: 'WebP', mime: 'image/webp' },
    { value: 'gif', label: 'GIF', mime: 'image/gif' },
  ];

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    
    setFileName(file.name);
    setConvertedImage(null);
    
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    setSourceFormat(ext);
    setTargetFormat(ext === 'png' ? 'jpg' : 'png');
    
    const reader = new FileReader();
    reader.onload = (e) => setImage(e.target?.result as string);
    reader.readAsDataURL(file);
    toast.success('Image loaded');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]);
  }, [handleFileSelect]);

  const convertImage = () => {
    if (!image || !canvasRef.current) return;
    setIsProcessing(true);
    
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current!;
      canvas.width = img.width;
      canvas.height = img.height;
      
      const ctx = canvas.getContext('2d')!;
      if (targetFormat === 'jpg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0);
      
      const format = formats.find(f => f.value === targetFormat);
      setConvertedImage(canvas.toDataURL(format?.mime || 'image/png', 0.9));
      setIsProcessing(false);
      toast.success(`Converted to ${targetFormat.toUpperCase()}`);
    };
    img.src = image;
  };

  const downloadImage = useCallback(() => {
    if (!convertedImage) return;
    const link = document.createElement('a');
    link.download = `${fileName.replace(/\.[^/.]+$/, '')}.${targetFormat}`;
    link.href = convertedImage;
    link.click();
    toast.success('Downloaded!');
  }, [convertedImage, fileName, targetFormat]);

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6 sm:mb-8">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2.5 rounded-xl bg-cyber-dark/80 border border-white/10 hover:border-purple-500/50 transition-all flex-shrink-0">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex-shrink-0">
                <FileImage className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              Convert Image
            </h1>
            <p className="text-gray-500 text-xs sm:text-sm mt-1 ml-1">Change image format</p>
          </div>
        </div>
      </div>

      {!image ? (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-white/10 rounded-2xl p-12 text-center cursor-pointer hover:border-purple-500/30 transition-all bg-cyber-dark/30"
        >
          <div className="inline-flex p-4 rounded-2xl bg-purple-500/10 mb-4">
            <Upload className="w-8 h-8 text-purple-400" />
          </div>
          <p className="text-white font-medium mb-2">Drop your image here</p>
          <p className="text-gray-500 text-sm">JPG, PNG, WebP, GIF</p>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])} className="hidden" />
        </div>
      ) : convertedImage ? (
        /* Result - Clean view without slider */
        <div className="space-y-6">
          <div className="flex justify-center">
            <div className="p-4 rounded-xl bg-cyber-dark border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-emerald-400 text-sm font-medium flex items-center gap-2">
                  <Check className="w-4 h-4" /> Converted to .{targetFormat.toUpperCase()}
                </h3>
              </div>
              <img src={convertedImage} alt="Converted" className="max-w-full max-h-[400px] rounded-lg" />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={() => { setImage(null); setConvertedImage(null); }} className="px-4 py-3 sm:py-2 w-full sm:w-auto rounded-xl bg-cyber-dark border border-white/10 text-gray-300 order-2 sm:order-1">
              New Image
            </button>
            <button onClick={downloadImage} className="flex-1 w-full sm:w-auto py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold flex items-center justify-center gap-2 order-1 sm:order-2">
              <Download className="w-5 h-5" /> Download .{targetFormat.toUpperCase()}
            </button>
          </div>
        </div>
      ) : (
        /* Format selection */
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-cyber-dark border border-white/10">
            <div className="flex justify-center bg-cyber-panel rounded-lg p-4">
              <img src={image} alt="Preview" className="max-w-full max-h-[300px] object-contain rounded" />
            </div>
            <p className="text-center text-gray-500 text-sm mt-3">
              Current: <span className="text-purple-400 font-medium">.{sourceFormat.toUpperCase()}</span>
            </p>
          </div>

          <div className="p-4 rounded-xl bg-cyber-dark/50 border border-white/5">
            <h3 className="text-gray-300 text-sm font-medium mb-3">Convert to:</h3>
            <div className="grid grid-cols-4 gap-3">
              {formats.map((format) => (
                <button
                  key={format.value}
                  onClick={() => setTargetFormat(format.value)}
                  disabled={format.value === sourceFormat}
                  className={`p-3 rounded-xl border text-center transition-all
                    ${targetFormat === format.value && format.value !== sourceFormat
                      ? 'bg-purple-500 text-white border-purple-500' 
                      : format.value === sourceFormat
                        ? 'opacity-30 cursor-not-allowed border-white/5'
                        : 'bg-cyber-panel border-white/10 text-gray-400 hover:border-purple-500/50'}`}
                >
                  <span className="font-bold">.{format.label}</span>
                </button>
              ))}
            </div>
            {(sourceFormat === 'jpg' || sourceFormat === 'jpeg') && (targetFormat === 'png' || targetFormat === 'gif') && (
              <p className="text-amber-400 text-xs mt-3">
                ⚠️ Converting JPG to {targetFormat.toUpperCase()} may increase file size (lossless format)
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={() => { setImage(null); setConvertedImage(null); }} className="px-4 py-3 sm:py-2 w-full sm:w-auto rounded-xl bg-cyber-dark border border-white/10 text-gray-300 order-2 sm:order-1">
              New Image
            </button>
            <button
              onClick={convertImage}
              disabled={isProcessing || targetFormat === sourceFormat}
              className="flex-1 w-full sm:w-auto py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 text-white font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2 order-1 sm:order-2"
            >
              {isProcessing ? <><Loader2 className="w-5 h-5 animate-spin" /> Converting...</> : `Convert to .${targetFormat.toUpperCase()}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
