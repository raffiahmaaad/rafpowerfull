import React, { useState, useCallback, useRef } from 'react';
import { PDFDocument, degrees } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { Copy, ArrowLeft, Upload, Download, FileText, RotateCw, RotateCcw, Trash2, GripVertical } from 'lucide-react';
import toast from 'react-hot-toast';

// Set worker path
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface OrganizePDFProps {
  onBack: () => void;
}

interface PageInfo {
  id: string;
  pageNum: number;
  rotation: number;
  preview: string;
  deleted: boolean;
}

export const OrganizePDF: React.FC<OrganizePDFProps> = ({ onBack }) => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
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
          id: `page-${i}-${Date.now()}`,
          pageNum: i,
          rotation: 0,
          preview: canvas.toDataURL('image/jpeg', 0.7),
          deleted: false,
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

  const rotatePage = (id: string, direction: 'cw' | 'ccw') => {
    setPages(prev => prev.map(p => {
      if (p.id === id) {
        const newRotation = direction === 'cw' 
          ? (p.rotation + 90) % 360 
          : (p.rotation - 90 + 360) % 360;
        return { ...p, rotation: newRotation };
      }
      return p;
    }));
  };

  const toggleDelete = (id: string) => {
    setPages(prev => prev.map(p => 
      p.id === id ? { ...p, deleted: !p.deleted } : p
    ));
  };

  const handleDragStart = (id: string) => {
    setDraggedItem(id);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (draggedItem === targetId) return;

    const draggedIndex = pages.findIndex(p => p.id === draggedItem);
    const targetIndex = pages.findIndex(p => p.id === targetId);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      const newPages = [...pages];
      const [removed] = newPages.splice(draggedIndex, 1);
      newPages.splice(targetIndex, 0, removed);
      setPages(newPages);
    }
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const applyChanges = async () => {
    if (!pdfBytesRef.current) return;

    const activePages = pages.filter(p => !p.deleted);
    if (activePages.length === 0) {
      toast.error('Cannot remove all pages');
      return;
    }

    setIsProcessing(true);

    try {
      const sourcePdf = await PDFDocument.load(pdfBytesRef.current);
      const newPdf = await PDFDocument.create();

      for (const pageInfo of activePages) {
        const [page] = await newPdf.copyPages(sourcePdf, [pageInfo.pageNum - 1]);
        
        if (pageInfo.rotation !== 0) {
          const currentRotation = page.getRotation().angle;
          page.setRotation(degrees(currentRotation + pageInfo.rotation));
        }
        
        newPdf.addPage(page);
      }

      const pdfBytes = await newPdf.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = 'organized.pdf';
      link.click();
      
      URL.revokeObjectURL(url);
      toast.success('PDF organized successfully!');
    } catch (error) {
      toast.error('Failed to organize PDF');
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const activePages = pages.filter(p => !p.deleted);
  const deletedCount = pages.filter(p => p.deleted).length;

  return (
    <div className="w-full max-w-6xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={onBack}
          className="p-2.5 rounded-xl bg-cyber-dark/80 border border-white/10 
                   hover:border-violet-500/50 hover:bg-cyber-dark
                   transition-all duration-300 hover:scale-105"
        >
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600">
              <Copy className="w-6 h-6 text-white" />
            </div>
            Organize PDF
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Reorder, rotate, and delete pages
          </p>
        </div>
      </div>

      {!pdfFile ? (
        /* Upload Area */
        <div 
          className="relative border-2 border-dashed border-white/10 rounded-2xl p-12
                     hover:border-violet-500/30 transition-all duration-300 bg-cyber-dark/30"
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
            <div className="inline-flex p-4 rounded-2xl bg-violet-500/10 mb-4">
              <Upload className="w-8 h-8 text-violet-400" />
            </div>
            <p className="text-white font-medium mb-2">Drop PDF file here</p>
            <p className="text-gray-500 text-sm">or click to browse</p>
          </div>
        </div>
      ) : (
        <>
          {/* File Info */}
          <div className="flex items-center gap-3 p-4 rounded-xl bg-cyber-dark/50 border border-white/5 mb-6">
            <FileText className="w-8 h-8 text-violet-400" />
            <div className="flex-1">
              <p className="text-white font-medium">{pdfFile.name}</p>
              <p className="text-gray-500 text-sm">
                {activePages.length} pages {deletedCount > 0 && `(${deletedCount} marked for deletion)`}
              </p>
            </div>
            <button
              onClick={() => {
                setPdfFile(null);
                setPages([]);
                pdfBytesRef.current = null;
              }}
              className="text-gray-400 hover:text-violet-400 text-sm"
            >
              Change file
            </button>
          </div>

          {/* Instructions */}
          <div className="mb-6 p-4 rounded-xl bg-cyber-dark/30 border border-white/5">
            <p className="text-gray-400 text-sm">
              <span className="text-violet-400 font-medium">Tip:</span> Drag pages to reorder, use buttons to rotate or mark for deletion
            </p>
          </div>

          {/* Page Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
              <span className="ml-3 text-gray-400">Loading pages...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 mb-6">
              {pages.map((page, index) => (
                <div
                  key={page.id}
                  draggable
                  onDragStart={() => handleDragStart(page.id)}
                  onDragOver={(e) => handleDragOver(e, page.id)}
                  onDragEnd={handleDragEnd}
                  className={`relative rounded-xl overflow-hidden bg-cyber-dark/50 border p-3 cursor-move
                    transition-all duration-200
                    ${page.deleted 
                      ? 'border-red-500/30 opacity-50' 
                      : 'border-white/10 hover:border-violet-500/30'}
                    ${draggedItem === page.id ? 'opacity-50' : ''}`}
                >
                  <div className="relative aspect-[3/4] mb-3 rounded-lg overflow-hidden bg-white/5">
                    <img
                      src={page.preview}
                      alt={`Page ${page.pageNum}`}
                      className="w-full h-full object-contain transition-transform duration-300"
                      style={{ transform: `rotate(${page.rotation}deg)` }}
                    />
                    {page.deleted && (
                      <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                        <Trash2 className="w-8 h-8 text-red-400" />
                      </div>
                    )}
                    <div className="absolute top-1 left-1">
                      <GripVertical className="w-4 h-4 text-gray-400" />
                    </div>
                    <span className="absolute top-1 right-1 px-1.5 py-0.5 bg-black/50 text-white text-xs rounded">
                      {index + 1}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-xs">Page {page.pageNum}</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => rotatePage(page.id, 'ccw')}
                        className="p-1 rounded bg-white/5 hover:bg-violet-500/20 text-gray-400 hover:text-violet-400 transition-colors"
                        title="Rotate left"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => rotatePage(page.id, 'cw')}
                        className="p-1 rounded bg-white/5 hover:bg-violet-500/20 text-gray-400 hover:text-violet-400 transition-colors"
                        title="Rotate right"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => toggleDelete(page.id)}
                        className={`p-1 rounded transition-colors ${
                          page.deleted 
                            ? 'bg-red-500/20 text-red-400' 
                            : 'bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400'
                        }`}
                        title={page.deleted ? 'Restore' : 'Delete'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Apply Button */}
          <button
            onClick={applyChanges}
            disabled={isProcessing || activePages.length === 0}
            className="w-full py-4 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold rounded-xl
                     hover:shadow-xl hover:shadow-violet-500/30 hover:scale-[1.02] active:scale-[0.98]
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
                Apply Changes & Download
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
};
