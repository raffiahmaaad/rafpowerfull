import React, { useState, useCallback, useRef, useEffect } from 'react';
import { FileImage, ArrowLeft, Upload, Download, FileText, Settings, Image } from 'lucide-react';
import toast from 'react-hot-toast';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';

// Set worker path
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface PDFtoJPGProps {
  onBack: () => void;
}

interface PagePreview {
  pageNum: number;
  imageUrl: string;
  selected: boolean;
}

export const PDFtoJPG: React.FC<PDFtoJPGProps> = ({ onBack }) => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pages, setPages] = useState<PagePreview[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [quality, setQuality] = useState(0.9);
  const [scale, setScale] = useState(2);
  const [format, setFormat] = useState<'jpeg' | 'png'>('jpeg');
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

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
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      pdfDocRef.current = pdf;
      setPageCount(pdf.numPages);

      // Generate previews for all pages
      const previews: PagePreview[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.5 }); // Small scale for preview
        
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;
        
        await page.render({
          canvasContext: ctx,
          viewport: viewport,
          canvas: canvas,
        } as any).promise;

        previews.push({
          pageNum: i,
          imageUrl: canvas.toDataURL('image/jpeg', 0.7),
          selected: true,
        });
      }

      setPages(previews);
      toast.success(`Loaded PDF with ${pdf.numPages} pages`);
    } catch (error) {
      toast.error('Failed to load PDF');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const togglePage = (pageNum: number) => {
    setPages(prev => prev.map(p => 
      p.pageNum === pageNum ? { ...p, selected: !p.selected } : p
    ));
  };

  const selectAll = () => {
    setPages(prev => prev.map(p => ({ ...p, selected: true })));
  };

  const deselectAll = () => {
    setPages(prev => prev.map(p => ({ ...p, selected: false })));
  };

  const convertToImages = async () => {
    if (!pdfDocRef.current) return;

    const selectedPages = pages.filter(p => p.selected);
    if (selectedPages.length === 0) {
      toast.error('Please select at least one page');
      return;
    }

    setIsProcessing(true);

    try {
      const zip = new JSZip();
      const pdf = pdfDocRef.current;

      for (const pagePreview of selectedPages) {
        const page = await pdf.getPage(pagePreview.pageNum);
        const viewport = page.getViewport({ scale });
        
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;
        
        await page.render({
          canvasContext: ctx,
          viewport: viewport,
          canvas: canvas,
        } as any).promise;

        const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
        const extension = format === 'jpeg' ? 'jpg' : 'png';
        
        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob(b => resolve(b!), mimeType, quality);
        });

        zip.file(`page_${pagePreview.pageNum}.${extension}`, blob);
      }

      if (selectedPages.length === 1) {
        // Single page - download directly
        const page = await pdf.getPage(selectedPages[0].pageNum);
        const viewport = page.getViewport({ scale });
        
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;
        
        await page.render({
          canvasContext: ctx,
          viewport: viewport,
          canvas: canvas,
        } as any).promise;

        const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
        const extension = format === 'jpeg' ? 'jpg' : 'png';
        
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `page_${selectedPages[0].pageNum}.${extension}`;
            link.click();
            URL.revokeObjectURL(url);
          }
        }, mimeType, quality);
      } else {
        // Multiple pages - download as ZIP
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'pdf_images.zip';
        link.click();
        URL.revokeObjectURL(url);
      }

      toast.success(`Converted ${selectedPages.length} page(s) to images!`);
    } catch (error) {
      toast.error('Failed to convert PDF');
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
                   hover:border-pink-500/50 hover:bg-cyber-dark
                   transition-all duration-300 hover:scale-105"
        >
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600">
              <FileImage className="w-6 h-6 text-white" />
            </div>
            PDF to JPG
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Convert PDF pages to images
          </p>
        </div>
      </div>

      {!pdfFile ? (
        /* Upload Area */
        <div 
          className="relative border-2 border-dashed border-white/10 rounded-2xl p-12
                     hover:border-pink-500/30 transition-all duration-300 bg-cyber-dark/30"
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
            <div className="inline-flex p-4 rounded-2xl bg-pink-500/10 mb-4">
              <Upload className="w-8 h-8 text-pink-400" />
            </div>
            <p className="text-white font-medium mb-2">Drop PDF file here</p>
            <p className="text-gray-500 text-sm">or click to browse</p>
          </div>
        </div>
      ) : (
        <>
          {/* File Info */}
          <div className="flex items-center gap-3 p-4 rounded-xl bg-cyber-dark/50 border border-white/5 mb-6">
            <FileText className="w-8 h-8 text-pink-400" />
            <div className="flex-1">
              <p className="text-white font-medium">{pdfFile.name}</p>
              <p className="text-gray-500 text-sm">{pageCount} pages</p>
            </div>
            <button
              onClick={() => {
                setPdfFile(null);
                setPageCount(0);
                setPages([]);
                pdfDocRef.current = null;
              }}
              className="text-gray-400 hover:text-pink-400 text-sm"
            >
              Change file
            </button>
          </div>

          {/* Settings */}
          <div className="mb-6 p-5 rounded-xl bg-cyber-dark/30 border border-white/5">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="w-4 h-4 text-pink-400" />
              <h3 className="text-white font-medium">Export Settings</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-gray-400 text-xs mb-2 block">Format</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as any)}
                  className="w-full bg-cyber-dark border border-white/10 rounded-lg px-4 py-2 text-white text-sm"
                >
                  <option value="jpeg">JPG</option>
                  <option value="png">PNG</option>
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-2 block">Quality</label>
                <select
                  value={quality}
                  onChange={(e) => setQuality(parseFloat(e.target.value))}
                  className="w-full bg-cyber-dark border border-white/10 rounded-lg px-4 py-2 text-white text-sm"
                >
                  <option value="1">Maximum (100%)</option>
                  <option value="0.9">High (90%)</option>
                  <option value="0.8">Medium (80%)</option>
                  <option value="0.6">Low (60%)</option>
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-2 block">Resolution</label>
                <select
                  value={scale}
                  onChange={(e) => setScale(parseFloat(e.target.value))}
                  className="w-full bg-cyber-dark border border-white/10 rounded-lg px-4 py-2 text-white text-sm"
                >
                  <option value="1">Standard (1x)</option>
                  <option value="2">High (2x)</option>
                  <option value="3">Very High (3x)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Page Selection */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-pink-500/30 border-t-pink-500 rounded-full animate-spin" />
              <span className="ml-3 text-gray-400">Loading pages...</span>
            </div>
          ) : (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-medium">
                  Select pages ({pages.filter(p => p.selected).length} selected)
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={selectAll}
                    className="text-xs text-gray-400 hover:text-pink-400 transition-colors"
                  >
                    Select all
                  </button>
                  <span className="text-gray-600">|</span>
                  <button
                    onClick={deselectAll}
                    className="text-xs text-gray-400 hover:text-pink-400 transition-colors"
                  >
                    Deselect all
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {pages.map((page) => (
                  <button
                    key={page.pageNum}
                    onClick={() => togglePage(page.pageNum)}
                    className={`relative rounded-xl overflow-hidden border-2 transition-all duration-200
                      ${page.selected
                        ? 'border-pink-500 ring-2 ring-pink-500/30'
                        : 'border-white/10 hover:border-pink-500/30'}`}
                  >
                    <img
                      src={page.imageUrl}
                      alt={`Page ${page.pageNum}`}
                      className="w-full aspect-[3/4] object-cover"
                    />
                    <div className={`absolute inset-0 flex items-center justify-center
                      ${page.selected ? 'bg-pink-500/20' : 'bg-black/30'}`}>
                      {page.selected && (
                        <div className="w-8 h-8 rounded-full bg-pink-500 flex items-center justify-center">
                          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <span className="absolute bottom-2 left-2 text-white text-xs font-medium bg-black/50 px-2 py-0.5 rounded">
                      {page.pageNum}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Convert Button */}
          <button
            onClick={convertToImages}
            disabled={isProcessing || pages.filter(p => p.selected).length === 0}
            className="w-full py-4 bg-gradient-to-r from-pink-500 to-rose-600 text-white font-semibold rounded-xl
                     hover:shadow-xl hover:shadow-pink-500/30 hover:scale-[1.02] active:scale-[0.98]
                     transition-all duration-200 flex items-center justify-center gap-2
                     disabled:opacity-50 disabled:hover:scale-100"
          >
            {isProcessing ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Converting...
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Convert to {format.toUpperCase()}
                {pages.filter(p => p.selected).length > 1 && ' (ZIP)'}
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
};
