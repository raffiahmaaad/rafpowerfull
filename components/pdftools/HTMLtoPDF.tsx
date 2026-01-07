import React, { useState, useCallback } from 'react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { FileCode, ArrowLeft, Upload, Download, FileText, Settings } from 'lucide-react';
import toast from 'react-hot-toast';

interface HTMLtoPDFProps {
  onBack: () => void;
}

export const HTMLtoPDF: React.FC<HTMLtoPDFProps> = ({ onBack }) => {
  const [htmlContent, setHtmlContent] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pageSize, setPageSize] = useState<'a4' | 'letter'>('a4');

  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    if (!file.name.endsWith('.html') && !file.name.endsWith('.htm') && file.type !== 'text/html') {
      toast.error('Please upload an HTML file');
      return;
    }

    try {
      const text = await file.text();
      setHtmlContent(text);
      toast.success('HTML file loaded');
    } catch (error) {
      toast.error('Failed to load HTML file');
      console.error(error);
    }
  }, []);

  const convertToPDF = async () => {
    if (!htmlContent.trim()) {
      toast.error('Please enter or upload HTML content');
      return;
    }

    setIsProcessing(true);

    try {
      // Extract text content from HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      const textContent = doc.body.innerText || doc.body.textContent || '';

      const pdfDoc = await PDFDocument.create();
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const pageDims = pageSize === 'a4' 
        ? { width: 595, height: 842 } 
        : { width: 612, height: 792 };
      
      const margin = 50;
      const lineHeight = 14;
      const fontSize = 12;
      const maxWidth = pageDims.width - margin * 2;

      // Split text into lines
      const lines = textContent.split('\n').filter(line => line.trim());
      let currentPage = pdfDoc.addPage([pageDims.width, pageDims.height]);
      let yPosition = pageDims.height - margin;

      for (const line of lines) {
        // Word wrap
        const words = line.split(' ');
        let currentLine = '';

        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const textWidth = helveticaFont.widthOfTextAtSize(testLine, fontSize);

          if (textWidth > maxWidth) {
            // Draw current line and start new one
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

        // Draw remaining text
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

        // Add extra space between paragraphs
        yPosition -= lineHeight / 2;
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = 'converted.pdf';
      link.click();
      
      URL.revokeObjectURL(url);
      toast.success('HTML converted to PDF!');
    } catch (error) {
      toast.error('Failed to convert HTML');
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
                   hover:border-orange-500/50 hover:bg-cyber-dark
                   transition-all duration-300 hover:scale-105"
        >
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500 to-red-600">
              <FileCode className="w-6 h-6 text-white" />
            </div>
            HTML to PDF
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Convert HTML content to PDF document
          </p>
        </div>
      </div>

      {/* Upload or Paste Area */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-medium">HTML Content</h3>
          <label className="text-sm text-orange-400 hover:underline cursor-pointer">
            <input
              type="file"
              accept=".html,.htm"
              onChange={(e) => handleFileUpload(e.target.files)}
              className="hidden"
            />
            Upload HTML file
          </label>
        </div>
        <textarea
          value={htmlContent}
          onChange={(e) => setHtmlContent(e.target.value)}
          placeholder="Paste your HTML content here or upload an HTML file..."
          className="w-full h-64 bg-cyber-dark border border-white/10 rounded-xl px-4 py-3 text-white text-sm 
                   outline-none focus:border-orange-500/50 resize-none font-mono"
        />
      </div>

      {/* Settings */}
      <div className="mb-6 p-5 rounded-xl bg-cyber-dark/30 border border-white/5">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-4 h-4 text-orange-400" />
          <h3 className="text-white font-medium">PDF Settings</h3>
        </div>
        <div>
          <label className="text-gray-400 text-xs mb-2 block uppercase tracking-wider">Page Size</label>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(e.target.value as any)}
            className="w-full bg-cyber-dark border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-orange-500/50"
          >
            <option value="a4">A4</option>
            <option value="letter">Letter</option>
          </select>
        </div>
      </div>

      {/* Convert Button */}
      <button
        onClick={convertToPDF}
        disabled={isProcessing || !htmlContent.trim()}
        className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-600 text-white font-semibold rounded-xl
                 hover:shadow-xl hover:shadow-orange-500/30 hover:scale-[1.02] active:scale-[0.98]
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

      {/* Note */}
      <div className="mt-6 p-4 rounded-xl bg-cyber-dark/30 border border-white/5">
        <p className="text-gray-500 text-sm">
          <span className="text-orange-400 font-medium">Note:</span> This tool extracts text content from HTML and converts it to PDF. 
          Complex styling and images may not be preserved.
        </p>
      </div>
    </div>
  );
};
