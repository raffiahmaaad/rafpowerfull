import React, { useState, useCallback, useRef } from 'react';
import { PDFDocument, degrees } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { RotateCw, ArrowLeft, Upload, Download, FileText, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';

// Set worker path
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface RotatePDFProps {
  onBack: () => void;
}

interface PageInfo {
  pageNum: number;
  rotation: number;
  preview: string;
}

export const RotatePDF: React.FC<RotatePDFProps> = ({ onBack }) => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const pdfBytesRef = useRef<ArrayBuffer | null>(null);

  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file');
      return;
    }

    setIsLoading(true);
    setPdfFile(file);
    setPages([]);

    try {
      const arrayBuffer = await file.arrayBuffer();
      pdfBytesRef.current = arrayBuffer;
      
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const pageInfos: PageInfo[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.3 });
        
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;
        
        await page.render({
          canvasContext: ctx,
          viewport: viewport,
          canvas: canvas,
        } as any).promise;

        pageInfos.push({
          pageNum: i,
          rotation: 0,
          preview: canvas.toDataURL('image/jpeg', 0.7),
        });
      }

      setPages(pageInfos);
      toast.success(`Loaded PDF with ${pdf.numPages} pages`);
    } catch (error) {
      toast.error('Failed to load PDF');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const rotatePage = (pageNum: number, direction: 'cw' | 'ccw') => {
    setPages(prev => prev.map(p => {
      if (p.pageNum === pageNum) {
        const newRotation = direction === 'cw' 
          ? (p.rotation + 90) % 360 
          : (p.rotation - 90 + 360) % 360;
        return { ...p, rotation: newRotation };
      }
      return p;
    }));
  };

  const rotateAll = (direction: 'cw' | 'ccw') => {
    setPages(prev => prev.map(p => {
      const newRotation = direction === 'cw' 
        ? (p.rotation + 90) % 360 
        : (p.rotation - 90 + 360) % 360;
      return { ...p, rotation: newRotation };
    }));
  };

  const resetAll = () => {
    setPages(prev => prev.map(p => ({ ...p, rotation: 0 })));
  };

  const rotatePDF = async () => {
    if (!pdfBytesRef.current) return;

    setIsProcessing(true);

    try {
      const pdfDoc = await PDFDocument.load(pdfBytesRef.current);
      const pdfPages = pdfDoc.getPages();

      pages.forEach((pageInfo, index) => {
        if (pageInfo.rotation !== 0) {
          const page = pdfPages[index];
          const currentRotation = page.getRotation().angle;
          page.setRotation(degrees(currentRotation + pageInfo.rotation));
        }
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = 'rotated.pdf';
      link.click();
      
      URL.revokeObjectURL(url);
      toast.success('PDF rotated successfully!');
    } catch (error) {
      toast.error('Failed to rotate PDF');
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={onBack}
          className="p-2.5 rounded-xl bg-cyber-dark/80 border border-white/10 
                   hover:border-blue-500/50 hover:bg-cyber-dark
                   transition-all duration-300 hover:scale-105"
        >
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
              <RotateCw className="w-6 h-6 text-white" />
            </div>
            Rotate PDF
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Rotate PDF pages to any angle
          </p>
        </div>
      </div>

      {!pdfFile ? (
        /* Upload Area */
        <div 
          className="relative border-2 border-dashed border-white/10 rounded-2xl p-12
                     hover:border-blue-500/30 transition-all duration-300 bg-cyber-dark/30"
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
            <div className="inline-flex p-4 rounded-2xl bg-blue-500/10 mb-4">
              <Upload className="w-8 h-8 text-blue-400" />
            </div>
            <p className="text-white font-medium mb-2">Drop PDF file here</p>
            <p className="text-gray-500 text-sm">or click to browse</p>
          </div>
        </div>
      ) : (
        <>
          {/* File Info */}
          <div className="flex items-center gap-3 p-4 rounded-xl bg-cyber-dark/50 border border-white/5 mb-6">
            <FileText className="w-8 h-8 text-blue-400" />
            <div className="flex-1">
              <p className="text-white font-medium">{pdfFile.name}</p>
              <p className="text-gray-500 text-sm">{pages.length} pages</p>
            </div>
            <button
              onClick={() => {
                setPdfFile(null);
                setPages([]);
                pdfBytesRef.current = null;
              }}
              className="text-gray-400 hover:text-blue-400 text-sm"
            >
              Change file
            </button>
          </div>

          {/* Rotate All Controls */}
          <div className="flex flex-wrap items-center gap-3 mb-6 p-4 rounded-xl bg-cyber-dark/30 border border-white/5">
            <span className="text-gray-400 text-sm">Rotate all pages:</span>
            <button
              onClick={() => rotateAll('ccw')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              90° Left
            </button>
            <button
              onClick={() => rotateAll('cw')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
            >
              <RotateCw className="w-4 h-4" />
              90° Right
            </button>
            <button
              onClick={resetAll}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Reset all
            </button>
          </div>

          {/* Page Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              <span className="ml-3 text-gray-400">Loading pages...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
              {pages.map((page) => (
                <div
                  key={page.pageNum}
                  className="relative rounded-xl overflow-hidden bg-cyber-dark/50 border border-white/10 p-3"
                >
                  <div className="relative aspect-[3/4] mb-3 rounded-lg overflow-hidden bg-white/5">
                    <img
                      src={page.preview}
                      alt={`Page ${page.pageNum}`}
                      className="w-full h-full object-contain transition-transform duration-300"
                      style={{ transform: `rotate(${page.rotation}deg)` }}
                    />
                    {page.rotation !== 0 && (
                      <div className="absolute top-2 right-2 px-2 py-0.5 bg-blue-500 text-white text-xs rounded font-medium">
                        {page.rotation}°
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Page {page.pageNum}</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => rotatePage(page.pageNum, 'ccw')}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-blue-500/20 text-gray-400 hover:text-blue-400 transition-colors"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => rotatePage(page.pageNum, 'cw')}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-blue-500/20 text-gray-400 hover:text-blue-400 transition-colors"
                      >
                        <RotateCw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Apply Button */}
          <button
            onClick={rotatePDF}
            disabled={isProcessing || pages.every(p => p.rotation === 0)}
            className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-xl
                     hover:shadow-xl hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98]
                     transition-all duration-200 flex items-center justify-center gap-2
                     disabled:opacity-50 disabled:hover:scale-100"
          >
            {isProcessing ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Apply & Download
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
};
