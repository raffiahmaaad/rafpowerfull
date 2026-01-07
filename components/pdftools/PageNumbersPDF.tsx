import React, { useState, useCallback } from 'react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Hash, ArrowLeft, Upload, Download, FileText, Settings } from 'lucide-react';
import toast from 'react-hot-toast';

interface PageNumbersPDFProps {
  onBack: () => void;
}

export const PageNumbersPDF: React.FC<PageNumbersPDFProps> = ({ onBack }) => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [position, setPosition] = useState<'bottom-center' | 'bottom-left' | 'bottom-right' | 'top-center' | 'top-left' | 'top-right'>('bottom-center');
  const [format, setFormat] = useState<'number' | 'page-x' | 'x-of-y'>('number');
  const [startFrom, setStartFrom] = useState(1);
  const [fontSize, setFontSize] = useState(12);

  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file');
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      setPageCount(pdfDoc.getPageCount());
      setPdfFile(file);
      toast.success(`Loaded PDF with ${pdfDoc.getPageCount()} pages`);
    } catch (error) {
      toast.error('Failed to load PDF');
      console.error(error);
    }
  }, []);

  const addPageNumbers = async () => {
    if (!pdfFile) return;

    setIsProcessing(true);

    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const pages = pdfDoc.getPages();
      const totalPages = pages.length;

      pages.forEach((page, index) => {
        const pageNumber = index + startFrom;
        const { width, height } = page.getSize();
        
        let text = '';
        switch (format) {
          case 'number':
            text = `${pageNumber}`;
            break;
          case 'page-x':
            text = `Page ${pageNumber}`;
            break;
          case 'x-of-y':
            text = `${pageNumber} of ${totalPages + startFrom - 1}`;
            break;
        }

        const textWidth = helveticaFont.widthOfTextAtSize(text, fontSize);
        let x = 0;
        let y = 0;

        // Calculate position
        switch (position) {
          case 'bottom-center':
            x = width / 2 - textWidth / 2;
            y = 30;
            break;
          case 'bottom-left':
            x = 40;
            y = 30;
            break;
          case 'bottom-right':
            x = width - textWidth - 40;
            y = 30;
            break;
          case 'top-center':
            x = width / 2 - textWidth / 2;
            y = height - 40;
            break;
          case 'top-left':
            x = 40;
            y = height - 40;
            break;
          case 'top-right':
            x = width - textWidth - 40;
            y = height - 40;
            break;
        }

        page.drawText(text, {
          x,
          y,
          size: fontSize,
          font: helveticaFont,
          color: rgb(0.3, 0.3, 0.3),
        });
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = 'numbered.pdf';
      link.click();
      
      URL.revokeObjectURL(url);
      toast.success('Page numbers added successfully!');
    } catch (error) {
      toast.error('Failed to add page numbers');
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={onBack}
          className="p-2.5 rounded-xl bg-cyber-dark/80 border border-white/10 
                   hover:border-cyan-500/50 hover:bg-cyber-dark
                   transition-all duration-300 hover:scale-105"
        >
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600">
              <Hash className="w-6 h-6 text-white" />
            </div>
            Add Page Numbers
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Insert page numbers on PDF
          </p>
        </div>
      </div>

      {!pdfFile ? (
        /* Upload Area */
        <div 
          className="relative border-2 border-dashed border-white/10 rounded-2xl p-12
                     hover:border-cyan-500/30 transition-all duration-300 bg-cyber-dark/30"
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
            <div className="inline-flex p-4 rounded-2xl bg-cyan-500/10 mb-4">
              <Upload className="w-8 h-8 text-cyan-400" />
            </div>
            <p className="text-white font-medium mb-2">Drop PDF file here</p>
            <p className="text-gray-500 text-sm">or click to browse</p>
          </div>
        </div>
      ) : (
        <>
          {/* File Info */}
          <div className="flex items-center gap-3 p-4 rounded-xl bg-cyber-dark/50 border border-white/5 mb-6">
            <FileText className="w-8 h-8 text-cyan-400" />
            <div className="flex-1">
              <p className="text-white font-medium">{pdfFile.name}</p>
              <p className="text-gray-500 text-sm">{pageCount} pages</p>
            </div>
            <button
              onClick={() => {
                setPdfFile(null);
                setPageCount(0);
              }}
              className="text-gray-400 hover:text-cyan-400 text-sm"
            >
              Change file
            </button>
          </div>

          {/* Settings */}
          <div className="mb-6 p-6 rounded-xl bg-cyber-dark/30 border border-white/5">
            <div className="flex items-center gap-2 mb-6">
              <Settings className="w-4 h-4 text-cyan-400" />
              <h3 className="text-white font-medium">Page Number Settings</h3>
            </div>

            <div className="space-y-5">
              {/* Position */}
              <div>
                <label className="text-gray-400 text-xs mb-3 block uppercase tracking-wider">Position</label>
                <div className="grid grid-cols-3 gap-2">
                  {/* Top row */}
                  <button
                    onClick={() => setPosition('top-left')}
                    className={`py-2 rounded-lg border text-xs font-medium transition-all
                      ${position === 'top-left'
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                        : 'border-white/10 text-gray-400 hover:border-cyan-500/30'}`}
                  >
                    Top Left
                  </button>
                  <button
                    onClick={() => setPosition('top-center')}
                    className={`py-2 rounded-lg border text-xs font-medium transition-all
                      ${position === 'top-center'
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                        : 'border-white/10 text-gray-400 hover:border-cyan-500/30'}`}
                  >
                    Top Center
                  </button>
                  <button
                    onClick={() => setPosition('top-right')}
                    className={`py-2 rounded-lg border text-xs font-medium transition-all
                      ${position === 'top-right'
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                        : 'border-white/10 text-gray-400 hover:border-cyan-500/30'}`}
                  >
                    Top Right
                  </button>
                  {/* Bottom row */}
                  <button
                    onClick={() => setPosition('bottom-left')}
                    className={`py-2 rounded-lg border text-xs font-medium transition-all
                      ${position === 'bottom-left'
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                        : 'border-white/10 text-gray-400 hover:border-cyan-500/30'}`}
                  >
                    Bottom Left
                  </button>
                  <button
                    onClick={() => setPosition('bottom-center')}
                    className={`py-2 rounded-lg border text-xs font-medium transition-all
                      ${position === 'bottom-center'
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                        : 'border-white/10 text-gray-400 hover:border-cyan-500/30'}`}
                  >
                    Bottom Center
                  </button>
                  <button
                    onClick={() => setPosition('bottom-right')}
                    className={`py-2 rounded-lg border text-xs font-medium transition-all
                      ${position === 'bottom-right'
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                        : 'border-white/10 text-gray-400 hover:border-cyan-500/30'}`}
                  >
                    Bottom Right
                  </button>
                </div>
              </div>

              {/* Format */}
              <div>
                <label className="text-gray-400 text-xs mb-2 block uppercase tracking-wider">Number Format</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as any)}
                  className="w-full bg-cyber-dark border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-cyan-500/50"
                >
                  <option value="number">1, 2, 3...</option>
                  <option value="page-x">Page 1, Page 2...</option>
                  <option value="x-of-y">1 of 10, 2 of 10...</option>
                </select>
              </div>

              {/* Start From & Font Size */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 text-xs mb-2 block uppercase tracking-wider">Start from</label>
                  <input
                    type="number"
                    min={1}
                    value={startFrom}
                    onChange={(e) => setStartFrom(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-cyber-dark border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-2 block uppercase tracking-wider">Font Size</label>
                  <input
                    type="number"
                    min={8}
                    max={36}
                    value={fontSize}
                    onChange={(e) => setFontSize(Math.max(8, Math.min(36, parseInt(e.target.value) || 12)))}
                    className="w-full bg-cyber-dark border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-cyan-500/50"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Apply Button */}
          <button
            onClick={addPageNumbers}
            disabled={isProcessing}
            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-xl
                     hover:shadow-xl hover:shadow-cyan-500/30 hover:scale-[1.02] active:scale-[0.98]
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
                Add Page Numbers & Download
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
};
