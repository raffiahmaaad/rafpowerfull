import React, { useState, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import { Layers, ArrowLeft, Upload, X, GripVertical, Download, FileText, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

interface PDFFile {
  id: string;
  file: File;
  name: string;
  pageCount: number;
}

interface MergePDFProps {
  onBack: () => void;
}

export const MergePDF: React.FC<MergePDFProps> = ({ onBack }) => {
  const [pdfFiles, setPdfFiles] = useState<PDFFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files) return;

    const newFiles: PDFFile[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type !== 'application/pdf') {
        toast.error(`${file.name} is not a PDF file`);
        continue;
      }

      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const pageCount = pdfDoc.getPageCount();

        newFiles.push({
          id: `${Date.now()}-${i}`,
          file,
          name: file.name,
          pageCount,
        });
      } catch (error) {
        toast.error(`Failed to load ${file.name}`);
      }
    }

    setPdfFiles(prev => [...prev, ...newFiles]);
    if (newFiles.length > 0) {
      toast.success(`Added ${newFiles.length} PDF file(s)`);
    }
  }, []);

  const removeFile = (id: string) => {
    setPdfFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleDragStart = (id: string) => {
    setDraggedItem(id);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (draggedItem === targetId) return;

    const draggedIndex = pdfFiles.findIndex(f => f.id === draggedItem);
    const targetIndex = pdfFiles.findIndex(f => f.id === targetId);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      const newFiles = [...pdfFiles];
      const [removed] = newFiles.splice(draggedIndex, 1);
      newFiles.splice(targetIndex, 0, removed);
      setPdfFiles(newFiles);
    }
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const mergePDFs = async () => {
    if (pdfFiles.length < 2) {
      toast.error('Please add at least 2 PDF files to merge');
      return;
    }

    setIsProcessing(true);

    try {
      const mergedPdf = await PDFDocument.create();

      for (const pdfFile of pdfFiles) {
        const arrayBuffer = await pdfFile.file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach(page => mergedPdf.addPage(page));
      }

      const mergedPdfBytes = await mergedPdf.save();
      const blob = new Blob([new Uint8Array(mergedPdfBytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = 'merged.pdf';
      link.click();
      
      URL.revokeObjectURL(url);
      toast.success('PDFs merged successfully!');
    } catch (error) {
      toast.error('Failed to merge PDFs');
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
                   hover:border-rose-500/50 hover:bg-cyber-dark
                   transition-all duration-300 hover:scale-105"
        >
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-red-500 to-rose-600">
              <Layers className="w-6 h-6 text-white" />
            </div>
            Merge PDF
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Combine multiple PDFs into one file
          </p>
        </div>
      </div>

      {/* Upload Area */}
      <div 
        className="relative border-2 border-dashed border-white/10 rounded-2xl p-8 mb-6
                   hover:border-rose-500/30 transition-all duration-300 bg-cyber-dark/30"
        onDrop={(e) => {
          e.preventDefault();
          handleFileUpload(e.dataTransfer.files);
        }}
        onDragOver={(e) => e.preventDefault()}
      >
        <input
          type="file"
          accept=".pdf"
          multiple
          onChange={(e) => handleFileUpload(e.target.files)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="text-center">
          <div className="inline-flex p-4 rounded-2xl bg-rose-500/10 mb-4">
            <Upload className="w-8 h-8 text-rose-400" />
          </div>
          <p className="text-white font-medium mb-2">Drop PDF files here</p>
          <p className="text-gray-500 text-sm">or click to browse</p>
        </div>
      </div>

      {/* File List */}
      {pdfFiles.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-medium">Files to merge ({pdfFiles.length})</h3>
            <button
              onClick={() => setPdfFiles([])}
              className="text-xs text-gray-400 hover:text-rose-400 transition-colors"
            >
              Clear all
            </button>
          </div>
          <div className="space-y-2">
            {pdfFiles.map((pdfFile, index) => (
              <div
                key={pdfFile.id}
                draggable
                onDragStart={() => handleDragStart(pdfFile.id)}
                onDragOver={(e) => handleDragOver(e, pdfFile.id)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-3 p-4 rounded-xl bg-cyber-dark/50 border border-white/5
                           hover:border-rose-500/20 transition-all duration-200 cursor-move
                           ${draggedItem === pdfFile.id ? 'opacity-50' : ''}`}
              >
                <GripVertical className="w-5 h-5 text-gray-600" />
                <span className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center text-rose-400 text-sm font-bold">
                  {index + 1}
                </span>
                <FileText className="w-5 h-5 text-rose-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm truncate">{pdfFile.name}</p>
                  <p className="text-gray-500 text-xs">{pdfFile.pageCount} page(s)</p>
                </div>
                <button
                  onClick={() => removeFile(pdfFile.id)}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-gray-400 hover:text-rose-400" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add More Button */}
      {pdfFiles.length > 0 && (
        <label className="flex items-center justify-center gap-2 p-4 rounded-xl border border-dashed border-white/10
                         hover:border-rose-500/30 cursor-pointer transition-all duration-200 mb-6">
          <input
            type="file"
            accept=".pdf"
            multiple
            onChange={(e) => handleFileUpload(e.target.files)}
            className="hidden"
          />
          <Plus className="w-5 h-5 text-rose-400" />
          <span className="text-gray-400 text-sm">Add more PDFs</span>
        </label>
      )}

      {/* Merge Button */}
      {pdfFiles.length >= 2 && (
        <button
          onClick={mergePDFs}
          disabled={isProcessing}
          className="w-full py-4 bg-gradient-to-r from-red-500 to-rose-600 text-white font-semibold rounded-xl
                   hover:shadow-xl hover:shadow-rose-500/30 hover:scale-[1.02] active:scale-[0.98]
                   transition-all duration-200 flex items-center justify-center gap-2
                   disabled:opacity-50 disabled:hover:scale-100"
        >
          {isProcessing ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Merging...
            </>
          ) : (
            <>
              <Download className="w-5 h-5" />
              Merge & Download
            </>
          )}
        </button>
      )}

      {/* Instructions */}
      <div className="mt-8 p-5 rounded-2xl bg-cyber-dark/30 border border-white/5">
        <h4 className="text-white font-medium mb-3">How to merge PDFs:</h4>
        <ol className="text-gray-400 text-sm space-y-2">
          <li>1. Upload two or more PDF files</li>
          <li>2. Drag and drop to reorder them</li>
          <li>3. Click "Merge & Download" to combine</li>
        </ol>
      </div>
    </div>
  );
};
