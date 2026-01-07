import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, Camera, RefreshCw, X, Check, Save, Download, Sliders, Image as ImageIcon, FileText, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { PDFDocument } from 'pdf-lib';

interface DocumentScannerProps {
  onBack: () => void;
}

type FilterType = 'original' | 'magic' | 'bw' | 'grayscale';

export const DocumentScanner: React.FC<DocumentScannerProps> = ({ onBack }) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('original');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize Camera
  const startCamera = async () => {
    setCameraError(false);
    
    const constraints: MediaStreamConstraints[] = [
      { 
        video: { 
          facingMode: { exact: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 } 
        } 
      }, // Rear camera forced with HD
      { 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      }, // Rear camera preferred with HD
      { video: { width: { ideal: 1920 }, height: { ideal: 1080 } } } // Any camera with HD
    ];

    for (const constraint of constraints) {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia(constraint);
        // Store stream in state, don't assign to ref yet
        setStream(mediaStream);
        setIsCameraReady(true);
        return; // Success
      } catch (err) {
        console.warn(`Camera access failed for constraint: ${JSON.stringify(constraint)}`, err);
        // Continue to next constraint
      }
    }

    // If we get here, all attempts failed
    console.error("All camera access attempts failed");
    setTimeout(() => {
      setCameraError(true);
      setIsCameraReady(false); 
    }, 500);
    toast.error("Could not access any camera. Please check permissions or try Upload.");
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraReady(false);
  };

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  // Monitor stream and video ref to assign srcObject when ready
  useEffect(() => {
    if (isCameraReady && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().catch(e => console.error("Play error:", e));
      };
    }
  }, [isCameraReady, stream]);

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageUrl = canvas.toDataURL('image/jpeg', 1.0);
        setCapturedImage(imageUrl);
        setProcessedImage(imageUrl); 
        stopCamera();
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setCapturedImage(result);
      setProcessedImage(result);
      stopCamera();
    };
    reader.readAsDataURL(file);
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setProcessedImage(null);
    setActiveFilter('original');
    setCameraError(false);
    startCamera();
  };

  // Apply Filters
  const applyFilter = useCallback(async (type: FilterType) => {
    if (!capturedImage) return;
    setIsProcessing(true);
    setActiveFilter(type);

    const img = new Image();
    img.src = capturedImage;
    await new Promise(resolve => { img.onload = resolve; });

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        if (type === 'bw') {
          const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          const val = gray > 128 ? 255 : 0;
          data[i] = val;
          data[i + 1] = val;
          data[i + 2] = val;
        } 
        else if (type === 'grayscale') {
           const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
           data[i] = gray;
           data[i + 1] = gray;
           data[i + 2] = gray;
        }
        else if (type === 'magic') {
          data[i] = r * 1.1 + 10;
          data[i+1] = g * 1.1 + 10;
          data[i+2] = b * 1.1 + 10;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      setProcessedImage(canvas.toDataURL('image/jpeg', 0.9));
    }
    setIsProcessing(false);
  }, [capturedImage]);

  const downloadAsJPG = () => {
    if (!processedImage) return;
    const link = document.createElement('a');
    link.href = processedImage;
    link.download = `scan-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Saved as JPG');
  };

  const downloadAsPDF = async () => {
    if (!processedImage) return;
    try {
      const pdfDoc = await PDFDocument.create();
      const img = new Image();
      img.src = processedImage;
      await new Promise(resolve => { img.onload = resolve; });

      const page = pdfDoc.addPage([img.width, img.height]);
      const imageEmbed = await pdfDoc.embedJpg(processedImage);
      
      page.drawImage(imageEmbed, {
        x: 0,
        y: 0,
        width: img.width,
        height: img.height,
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `scan-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Saved as PDF');
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate PDF');
    }
  };

  return (
    <div className="min-h-screen bg-cyber-black text-white p-4 sm:p-8 animate-fade-in">
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
              <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex-shrink-0">
                <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              Document Scanner
            </h1>
            <p className="text-gray-500 text-xs sm:text-sm mt-1 ml-1">Scan, enhance, and save documents</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto">
        {!capturedImage ? (
          // Camera View
          <div className="relative rounded-3xl overflow-hidden bg-black aspect-[3/4] sm:aspect-[4/3] shadow-2xl border border-white/10">
            {isCameraReady ? (
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline
                muted 
                className="w-full h-full object-cover"
              />
            ) : (
               <div className="absolute inset-0 flex items-center justify-center text-gray-500 bg-cyber-dark/80 p-4">
                  <div className="text-center w-full max-w-xs sm:max-w-sm">
                    {cameraError ? (
                      <>
                        <div className="bg-red-500/10 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                          <Camera className="w-8 h-8 text-red-500" />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">Camera Access Failed</h3>
                        <p className="text-sm text-gray-400 mb-6">
                          Browser blocks camera on insecure connections or permissions are denied. 
                          Please enable HTTPS or upload a file.
                        </p>
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="px-6 py-3 rounded-xl bg-gradient-to-r from-red-500 to-pink-600 
                                   text-white font-semibold transition-all hover:scale-105 flex items-center justify-center gap-2 mx-auto w-full"
                        >
                          <Upload className="w-5 h-5" />
                          Upload Image
                        </button>
                      </>
                    ) : (
                      <>
                        <Camera className="w-12 h-12 mx-auto mb-2 opacity-50 animate-pulse" />
                        <p>Starting Camera...</p>
                      </>
                    )}
                    
                    {/* Hidden input for fallbacks */}
                    <input 
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </div>
               </div>
            )}
            
            {/* Camera Overlay Guide */}
            {isCameraReady && (
              <div className="absolute inset-0 pointer-events-none border-[2px] border-white/20 m-8 rounded-lg" />
            )}
            
            {/* Capture Button */}
            {isCameraReady && (
               <div className="absolute bottom-8 left-0 right-0 flex justify-center z-10">
                 <button 
                   onClick={captureImage}
                   className="w-20 h-20 rounded-full border-4 border-white bg-white/20 backdrop-blur-sm 
                            flex items-center justify-center hover:bg-white/30 transition-all shadow-lg active:scale-95"
                 >
                   <div className="w-16 h-16 rounded-full bg-white" />
                 </button>
               </div>
            )}

            {/* Upload Button (Small overlay when camera is working) */}
            {isCameraReady && (
                <div className="absolute top-4 right-4 z-20">
                  <button 
                   onClick={() => fileInputRef.current?.click()}
                   className="p-3 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white hover:bg-black/60 transition-all"
                   title="Upload Image"
                  >
                    <Upload className="w-6 h-6" />
                  </button>
                </div>
             )}
          </div>
        ) : (
          // Edit/Preview View
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex-1">
               <div className="relative rounded-2xl overflow-hidden bg-cyber-dark/50 border border-white/10 shadow-xl">
                 <img src={processedImage || capturedImage} alt="Captured" className="w-full h-auto" />
               </div>
            </div>

            <div className="w-full lg:w-80 flex flex-col gap-6">
               <div className="bg-cyber-dark/50 p-5 rounded-2xl border border-white/5">
                 <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                   <Sliders className="w-4 h-4 text-cyan-400" />
                   Filters
                 </h3>
                 <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => applyFilter('original')}
                      className={`p-3 rounded-xl border transition-all text-sm font-medium ${
                        activeFilter === 'original' 
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400' 
                        : 'bg-cyber-dark border-white/10 text-gray-400 hover:border-white/20'
                      }`}
                    >
                      Original
                    </button>
                    <button 
                      onClick={() => applyFilter('magic')}
                      className={`p-3 rounded-xl border transition-all text-sm font-medium ${
                        activeFilter === 'magic' 
                        ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400' 
                        : 'bg-cyber-dark border-white/10 text-gray-400 hover:border-white/20'
                      }`}
                    >
                      Magic Color
                    </button>
                    <button 
                       onClick={() => applyFilter('bw')}
                       className={`p-3 rounded-xl border transition-all text-sm font-medium ${
                         activeFilter === 'bw' 
                         ? 'bg-gray-500/20 border-white text-white' 
                         : 'bg-cyber-dark border-white/10 text-gray-400 hover:border-white/20'
                       }`}
                    >
                      B&W
                    </button>
                    <button 
                       onClick={() => applyFilter('grayscale')}
                       className={`p-3 rounded-xl border transition-all text-sm font-medium ${
                         activeFilter === 'grayscale' 
                         ? 'bg-gray-500/20 border-gray-400 text-gray-300' 
                         : 'bg-cyber-dark border-white/10 text-gray-400 hover:border-white/20'
                       }`}
                    >
                      Grayscale
                    </button>
                 </div>
               </div>

               <div className="space-y-3">
                 <button 
                   onClick={downloadAsJPG}
                   className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 
                            text-white font-semibold shadow-lg shadow-emerald-500/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                 >
                   <ImageIcon className="w-5 h-5" />
                   Save as JPG
                 </button>
                 <button 
                   onClick={downloadAsPDF}
                   className="w-full py-4 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 
                            text-white font-semibold shadow-lg shadow-red-500/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                 >
                   <FileText className="w-5 h-5" />
                   Save as PDF
                 </button>
                 
                 <div className="h-px bg-white/10 my-4" />
                 
                 <button 
                   onClick={retakePhoto}
                   className="w-full py-3 rounded-xl bg-cyber-dark border border-white/10 
                            text-gray-400 hover:text-white hover:border-white/30 transition-all flex items-center justify-center gap-2"
                 >
                   <RefreshCw className="w-4 h-4" />
                   Retake Photo
                 </button>
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
