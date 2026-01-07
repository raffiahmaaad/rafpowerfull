import React, { useState, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import { FileOutput, ArrowLeft, Upload, Download, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

interface ExtractPagesPDFProps {
  onBack: () => void;
}

export const ExtractPagesPDF: React.FC<ExtractPagesPDFProps> = ({ onBack }) => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

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
      const pages = pdfDoc.getPageCount();

      setPdfFile(file);
      setPageCount(pages);
      setSelectedPages(new Set());
      toast.success(`Loaded PDF with ${pages} pages`);
    } catch (error) {
      toast.error('Failed to load PDF');
      console.error(error);
    }
  }, []);

  const togglePage = (pageNum: number) => {
    const newSelected = new Set(selectedPages);
    if (newSelected.has(pageNum)) {
      newSelected.delete(pageNum);
    } else {
      newSelected.add(pageNum);
    }
    setSelectedPages(newSelected);
  };

  const selectAll = () => {
    const all = new Set<number>();
    for (let i = 1; i <= pageCount; i++) {
      all.add(i);
    }
    setSelectedPages(all);
  };

  const deselectAll = () => {
    setSelectedPages(new Set());
  };

  const extractPages = async () => {
    if (!pdfFile || selectedPages.size === 0) return;

    setIsProcessing(true);

    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const sourcePdf = await PDFDocument.load(arrayBuffer);
      const newPdf = await PDFDocument.create();

      const sortedPages = Array.from(selectedPages).sort((a, b) => a - b);
      
      for (const pageNum of sortedPages) {
        const [page] = await newPdf.copyPages(sourcePdf, [pageNum - 1]);
        newPdf.addPage(page);
      }

      const pdfBytes = await newPdf.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = 'extracted_pages.pdf';
      link.click();
      
      URL.revokeObjectURL(url);
      toast.success(`Extracted ${selectedPages.size} page(s)!`);
    } catch (error) {
      toast.error('Failed to extract pages');
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-6">
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
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600">
              <FileOutput className="w-6 h-6 text-white" />
            </div>
            Extract Pages
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Extract specific pages to a new PDF
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
              <p className="text-gray-500 text-sm">{pageCount} pages</p>
            </div>
            <button
              onClick={() => {
                setPdfFile(null);
                setPageCount(0);
                setSelectedPages(new Set());
              }}
              className="text-gray-400 hover:text-blue-400 text-sm"
            >
              Change file
            </button>
          </div>

          {/* Page Selection */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-medium">Select pages to extract</h3>
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="text-xs text-gray-400 hover:text-blue-400 transition-colors"
                >
                  Select all
                </button>
                <span className="text-gray-600">|</span>
                <button
                  onClick={deselectAll}
                  className="text-xs text-gray-400 hover:text-blue-400 transition-colors"
                >
                  Deselect all
                </button>
              </div>
            </div>
            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
              {Array.from({ length: pageCount }, (_, i) => i + 1).map(pageNum => (
                <button
                  key={pageNum}
                  onClick={() => togglePage(pageNum)}
                  className={`aspect-square rounded-lg border transition-all duration-200
                    ${selectedPages.has(pageNum)
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : 'bg-cyber-dark/50 border-white/10 text-gray-400 hover:border-blue-500/50'}`}
                >
                  {pageNum}
                </button>
              ))}
            </div>
            <p className="text-gray-500 text-sm mt-3">
              {selectedPages.size} page(s) selected
            </p>
          </div>

          {/* Extract Button */}
          <button
            onClick={extractPages}
            disabled={isProcessing || selectedPages.size === 0}
            className="w-full py-4 bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-semibold rounded-xl
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
                Extract Pages & Download
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
};
