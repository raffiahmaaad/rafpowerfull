import React, { useState, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import { Minimize2, ArrowLeft, Upload, Download, FileText, Settings } from 'lucide-react';
import toast from 'react-hot-toast';

interface CompressPDFProps {
  onBack: () => void;
}

export const CompressPDF: React.FC<CompressPDFProps> = ({ onBack }) => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [originalSize, setOriginalSize] = useState(0);
  const [compressedSize, setCompressedSize] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [compressionLevel, setCompressionLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file');
      return;
    }

    setPdfFile(file);
    setOriginalSize(file.size);
    setCompressedSize(0);
    setCompressedBlob(null);
    toast.success('PDF loaded');
  }, []);

  const compressPDF = async () => {
    if (!pdfFile) return;

    setIsProcessing(true);

    try {
      // Try API first for better compression
      const API_URL = import.meta.env.VITE_API_URL || 'https://ghostmail-worker.rafxyz.workers.dev';
      
      const formData = new FormData();
      formData.append('file', pdfFile);
      formData.append('level', compressionLevel);

      const response = await fetch(`${API_URL}/api/pdf/compress`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const blob = await response.blob();
        const originalSizeHeader = response.headers.get('X-Original-Size');
        const outputSizeHeader = response.headers.get('X-Output-Size');
        
        setCompressedSize(outputSizeHeader ? parseInt(outputSizeHeader) : blob.size);
        setCompressedBlob(blob);

        const reduction = originalSizeHeader && outputSizeHeader 
          ? ((parseInt(originalSizeHeader) - parseInt(outputSizeHeader)) / parseInt(originalSizeHeader) * 100)
          : ((pdfFile.size - blob.size) / pdfFile.size * 100);
        
        if (reduction > 0) {
          toast.success(`Compressed by ${reduction.toFixed(1)}%`);
        } else {
          toast.success('PDF optimized (already well compressed)');
        }
        return;
      }

      // API failed, fall back to client-side
      console.warn('API compression failed, using client-side fallback');
      await compressPDFClientSide();
    } catch (error) {
      console.error('API error, falling back to client-side:', error);
      // Fall back to client-side compression
      await compressPDFClientSide();
    } finally {
      setIsProcessing(false);
    }
  };

  const compressPDFClientSide = async () => {
    if (!pdfFile) return;

    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer, { 
        ignoreEncryption: true,
      });

      // Save with compression options
      const compressedBytes = await pdfDoc.save({
        useObjectStreams: true,
        addDefaultPage: false,
      });

      const blob = new Blob([new Uint8Array(compressedBytes)], { type: 'application/pdf' });
      setCompressedSize(blob.size);
      setCompressedBlob(blob);

      const reduction = ((pdfFile.size - blob.size) / pdfFile.size * 100);
      if (reduction > 0) {
        toast.success(`Compressed by ${reduction.toFixed(1)}% (client-side)`);
      } else {
        toast.success('PDF optimized (already well compressed)');
      }
    } catch (error) {
      toast.error('Failed to compress PDF');
      console.error(error);
    }
  };

  const downloadCompressed = () => {
    if (!compressedBlob) return;

    const url = URL.createObjectURL(compressedBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `compressed_${pdfFile?.name || 'document.pdf'}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const reduction = originalSize > 0 && compressedSize > 0 
    ? ((originalSize - compressedSize) / originalSize * 100) 
    : 0;

  return (
    <div className="w-full max-w-3xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={onBack}
          className="p-2.5 rounded-xl bg-cyber-dark/80 border border-white/10 
                   hover:border-emerald-500/50 hover:bg-cyber-dark
                   transition-all duration-300 hover:scale-105"
        >
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600">
              <Minimize2 className="w-6 h-6 text-white" />
            </div>
            Compress PDF
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Reduce PDF file size
          </p>
        </div>
      </div>

      {!pdfFile ? (
        /* Upload Area */
        <div 
          className="relative border-2 border-dashed border-white/10 rounded-2xl p-12
                     hover:border-emerald-500/30 transition-all duration-300 bg-cyber-dark/30"
          onDrop={(e) => {
            e.preventDefault();
            handleFileUpload(e.dataTransfer.files);
          }}
          onDragOver={(e) => e.preventDefault()}
        >
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => handleFileUpload(e.target.files)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="text-center">
            <div className="inline-flex p-4 rounded-2xl bg-emerald-500/10 mb-4">
              <Upload className="w-8 h-8 text-emerald-400" />
            </div>
            <p className="text-white font-medium mb-2">Drop PDF file here</p>
            <p className="text-gray-500 text-sm">or click to browse</p>
          </div>
        </div>
      ) : (
        <>
          {/* File Info */}
          <div className="p-6 rounded-xl bg-cyber-dark/50 border border-white/5 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="w-10 h-10 text-emerald-400" />
              <div className="flex-1">
                <p className="text-white font-medium">{pdfFile.name}</p>
                <p className="text-gray-500 text-sm">Original size: {formatSize(originalSize)}</p>
              </div>
              <button
                onClick={() => {
                  setPdfFile(null);
                  setOriginalSize(0);
                  setCompressedSize(0);
                  setCompressedBlob(null);
                }}
                className="text-gray-400 hover:text-emerald-400 text-sm"
              >
                Change file
              </button>
            </div>

            {/* Compression Results */}
            {compressedSize > 0 && (
              <div className="mt-4 pt-4 border-t border-white/5">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Original</p>
                    <p className="text-white font-semibold">{formatSize(originalSize)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Compressed</p>
                    <p className="text-emerald-400 font-semibold">{formatSize(compressedSize)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Reduced</p>
                    <p className={`font-semibold ${reduction > 0 ? 'text-emerald-400' : 'text-gray-400'}`}>
                      {reduction > 0 ? `-${reduction.toFixed(1)}%` : '0%'}
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-4 h-2 bg-cyber-dark rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 transition-all duration-500"
                    style={{ width: `${Math.max(0, 100 - reduction)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Compression Settings */}
          <div className="mb-6 p-5 rounded-xl bg-cyber-dark/30 border border-white/5">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="w-4 h-4 text-emerald-400" />
              <h3 className="text-white font-medium">Compression Level</h3>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(['low', 'medium', 'high'] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setCompressionLevel(level)}
                  className={`p-4 rounded-xl border transition-all duration-200 text-center
                    ${compressionLevel === level
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                      : 'border-white/10 text-gray-400 hover:border-emerald-500/30'}`}
                >
                  <p className="font-medium capitalize">{level}</p>
                  <p className="text-xs mt-1 opacity-60">
                    {level === 'low' && 'Best quality'}
                    {level === 'medium' && 'Balanced'}
                    {level === 'high' && 'Smallest size'}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          {!compressedBlob ? (
            <button
              onClick={compressPDF}
              disabled={isProcessing}
              className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-xl
                       hover:shadow-xl hover:shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98]
                       transition-all duration-200 flex items-center justify-center gap-2
                       disabled:opacity-50 disabled:hover:scale-100"
            >
              {isProcessing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Compressing...
                </>
              ) : (
                <>
                  <Minimize2 className="w-5 h-5" />
                  Compress PDF
                </>
              )}
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={downloadCompressed}
                className="flex-1 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-xl
                         hover:shadow-xl hover:shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98]
                         transition-all duration-200 flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Download Compressed PDF
              </button>
              <button
                onClick={() => {
                  setCompressedBlob(null);
                  setCompressedSize(0);
                }}
                className="px-6 py-4 bg-white/5 text-gray-300 hover:text-white rounded-xl border border-white/10
                         hover:border-white/20 transition-all duration-200"
              >
                Retry
              </button>
            </div>
          )}

          {/* Note */}
          <div className="mt-6 p-4 rounded-xl bg-cyber-dark/30 border border-white/5">
            <p className="text-gray-500 text-sm">
              <span className="text-emerald-400 font-medium">Note:</span> Compression results vary based on the PDF content. 
              PDFs with many images will see greater size reduction. Already optimized PDFs may show minimal change.
            </p>
          </div>
        </>
      )}
    </div>
  );
};
