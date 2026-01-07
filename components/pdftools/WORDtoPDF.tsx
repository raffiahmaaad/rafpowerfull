import React, { useState, useCallback } from 'react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { FileText as FileWord, ArrowLeft, Upload, Download, FileText, Settings } from 'lucide-react';
import toast from 'react-hot-toast';

interface WORDtoPDFProps {
  onBack: () => void;
}

// Updated to use iLoveAPI for Office file conversion
export const WORDtoPDF: React.FC<WORDtoPDFProps> = ({ onBack }) => {
  const [textContent, setTextContent] = useState('');
  const [officeFile, setOfficeFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pageSize, setPageSize] = useState<'a4' | 'letter'>('a4');
  const [conversionMode, setConversionMode] = useState<'office' | 'text'>('office');

  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    // Office files - use API
    if (['.doc', '.docx', '.odt', '.rtf', '.ppt', '.pptx', '.xls', '.xlsx'].includes(ext)) {
      setOfficeFile(file);
      setFileName(file.name);
      setTextContent('');
      setConversionMode('office');
      toast.success(`${file.name} loaded - ready for conversion`);
      return;
    }
    
    // Text files - client-side
    if (ext === '.txt' || file.type.includes('text')) {
      try {
        const text = await file.text();
        setTextContent(text);
        setFileName(file.name);
        setOfficeFile(null);
        setConversionMode('text');
        toast.success('Text file loaded');
      } catch (e) {
        toast.error('Failed to read text file');
      }
      return;
    }

    toast.error('Unsupported file type. Supported: DOC, DOCX, RTF, ODT, TXT');
  }, []);

  const convertToPDF = async () => {
    if (conversionMode === 'office' && officeFile) {
      await convertOfficeFileToPDF();
    } else if (textContent.trim()) {
      await convertTextToPDF();
    } else {
      toast.error('Please upload a file or enter text content');
    }
  };

  const convertOfficeFileToPDF = async () => {
    if (!officeFile) return;

    setIsProcessing(true);

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'https://ghostmail-worker.rafxyz.workers.dev';
      
      const formData = new FormData();
      formData.append('file', officeFile);

      const response = await fetch(`${API_URL}/api/pdf/officetopdf`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName.replace(/\.[^/.]+$/, '.pdf');
        link.click();
        
        URL.revokeObjectURL(url);
        toast.success('Document converted to PDF!');
        return;
      }

      const errorData = await response.json().catch(() => ({}));
      toast.error(errorData.message || 'Failed to convert document');
    } catch (error) {
      console.error('API error:', error);
      toast.error('Failed to convert document. Please check your connection.');
    } finally {
      setIsProcessing(false);
    }
  };

  const convertTextToPDF = async () => {
    if (!textContent.trim()) return;

    setIsProcessing(true);

    try {
      const pdfDoc = await PDFDocument.create();
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

      const pageDims = pageSize === 'a4' 
        ? { width: 595, height: 842 } 
        : { width: 612, height: 792 };
      
      const margin = 50;
      const lineHeight = 16;
      const fontSize = 12;
      const maxWidth = pageDims.width - margin * 2;

      const paragraphs = textContent.split('\n');
      let currentPage = pdfDoc.addPage([pageDims.width, pageDims.height]);
      let yPosition = pageDims.height - margin;

      for (const paragraph of paragraphs) {
        if (!paragraph.trim()) {
          yPosition -= lineHeight;
          continue;
        }

        const words = paragraph.split(' ');
        let currentLine = '';

        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const textWidth = helveticaFont.widthOfTextAtSize(testLine, fontSize);

          if (textWidth > maxWidth && currentLine) {
            if (yPosition < margin + lineHeight) {
              currentPage = pdfDoc.addPage([pageDims.width, pageDims.height]);
              yPosition = pageDims.height - margin;
            }

            currentPage.drawText(currentLine, {
              x: margin,
              y: yPosition,
              size: fontSize,
              font: helveticaFont,
              color: rgb(0.1, 0.1, 0.1),
            });
            yPosition -= lineHeight;
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }

        if (currentLine) {
          if (yPosition < margin + lineHeight) {
            currentPage = pdfDoc.addPage([pageDims.width, pageDims.height]);
            yPosition = pageDims.height - margin;
          }

          currentPage.drawText(currentLine, {
            x: margin,
            y: yPosition,
            size: fontSize,
            font: helveticaFont,
            color: rgb(0.1, 0.1, 0.1),
          });
          yPosition -= lineHeight;
        }
        yPosition -= lineHeight / 2;
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName ? fileName.replace(/\.[^/.]+$/, '.pdf') : 'document.pdf';
      link.click();
      
      URL.revokeObjectURL(url);
      toast.success('Document converted to PDF!');
    } catch (error) {
      toast.error('Failed to convert document');
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
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800">
              <FileWord className="w-6 h-6 text-white" />
            </div>
            WORD to PDF
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Convert Office documents to PDF
          </p>
        </div>
      </div>

      {/* Office File Loaded */}
      {officeFile && conversionMode === 'office' ? (
        <>
          {/* File Info */}
          <div className="p-6 rounded-xl bg-cyber-dark/50 border border-white/5 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-blue-500/20">
                <FileText className="w-8 h-8 text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="text-white font-medium">{fileName}</p>
                <p className="text-gray-500 text-sm">Ready for conversion to PDF</p>
              </div>
              <button
                onClick={() => {
                  setOfficeFile(null);
                  setFileName('');
                  setConversionMode('text');
                }}
                className="text-gray-400 hover:text-blue-400 text-sm"
              >
                Change file
              </button>
            </div>
          </div>

          {/* Convert Button for Office */}
          <button
            onClick={convertToPDF}
            disabled={isProcessing}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-800 text-white font-semibold rounded-xl
                     hover:shadow-xl hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98]
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
                Convert to PDF
              </>
            )}
          </button>

          {/* Note for Office files */}
          <div className="mt-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <p className="text-gray-300 text-sm">
              <span className="text-blue-400 font-medium">✓ API Enabled:</span> Your document will be converted using iLoveAPI for accurate formatting.
            </p>
          </div>
        </>
      ) : (
        <>
          {/* Upload Area */}
          <div 
            className="relative border-2 border-dashed border-white/10 rounded-2xl p-8 mb-6
                       hover:border-blue-500/30 transition-all duration-300 bg-cyber-dark/30"
            onDrop={(e) => {
              e.preventDefault();
              handleFileUpload(e.dataTransfer.files);
            }}
            onDragOver={(e) => e.preventDefault()}
          >
            <input
              type="file"
              accept=".txt,.doc,.docx,.rtf,.odt,.ppt,.pptx,.xls,.xlsx"
              onChange={(e) => handleFileUpload(e.target.files)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="text-center">
              <div className="inline-flex p-4 rounded-2xl bg-blue-500/10 mb-4">
                <Upload className="w-8 h-8 text-blue-400" />
              </div>
              <p className="text-white font-medium mb-2">Drop Office file here</p>
              <p className="text-gray-500 text-sm">Supports DOC, DOCX, RTF, ODT, PPT, XLS, or TXT</p>
            </div>
          </div>

          {/* Text Area for manual input */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-medium">Or paste text content</h3>
              {fileName && <span className="text-gray-400 text-sm">{fileName}</span>}
            </div>
            <textarea
              value={textContent}
              onChange={(e) => {
                setTextContent(e.target.value);
                if (e.target.value.trim()) {
                  setConversionMode('text');
                  setOfficeFile(null);
                }
              }}
              placeholder="Paste your document content here..."
              className="w-full h-48 bg-cyber-dark border border-white/10 rounded-xl px-4 py-3 text-white text-sm 
                       outline-none focus:border-blue-500/50 resize-none font-mono"
            />
          </div>

          {/* Settings (for text mode) */}
          {textContent.trim() && (
            <div className="mb-6 p-5 rounded-xl bg-cyber-dark/30 border border-white/5">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="w-4 h-4 text-blue-400" />
                <h3 className="text-white font-medium">PDF Settings</h3>
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-2 block uppercase tracking-wider">Page Size</label>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(e.target.value as any)}
                  className="w-full bg-cyber-dark border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500/50"
                >
                  <option value="a4">A4</option>
                  <option value="letter">Letter</option>
                </select>
              </div>
            </div>
          )}

          {/* Convert Button for text */}
          <button
            onClick={convertToPDF}
            disabled={isProcessing || !textContent.trim()}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-800 text-white font-semibold rounded-xl
                     hover:shadow-xl hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98]
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
                Convert to PDF
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
};
