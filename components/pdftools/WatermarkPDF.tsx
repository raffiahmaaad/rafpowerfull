import React, { useState, useCallback } from 'react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Droplet, ArrowLeft, Upload, Download, FileText, Settings } from 'lucide-react';
import toast from 'react-hot-toast';

interface WatermarkPDFProps {
  onBack: () => void;
}

export const WatermarkPDF: React.FC<WatermarkPDFProps> = ({ onBack }) => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  const [fontSize, setFontSize] = useState(50);
  const [opacity, setOpacity] = useState(0.3);
  const [rotation, setRotation] = useState(-45);
  const [position, setPosition] = useState<'center' | 'top' | 'bottom'>('center');
  const [color, setColor] = useState('#ff0000');

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

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      return {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255,
      };
    }
    return { r: 1, g: 0, b: 0 };
  };

  const addWatermark = async () => {
    if (!pdfFile || !watermarkText.trim()) {
      toast.error('Please enter watermark text');
      return;
    }

    setIsProcessing(true);

    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const pages = pdfDoc.getPages();
      const { r, g, b } = hexToRgb(color);

      for (const page of pages) {
        const { width, height } = page.getSize();
        const textWidth = helveticaFont.widthOfTextAtSize(watermarkText, fontSize);
        const textHeight = fontSize;

        let x = width / 2 - textWidth / 2;
        let y = height / 2 - textHeight / 2;

        if (position === 'top') {
          y = height - 100;
        } else if (position === 'bottom') {
          y = 50;
        }

        page.drawText(watermarkText, {
          x,
          y,
          size: fontSize,
          font: helveticaFont,
          color: rgb(r, g, b),
          opacity: opacity,
          rotate: { type: 'degrees' as any, angle: rotation },
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = 'watermarked.pdf';
      link.click();
      
      URL.revokeObjectURL(url);
      toast.success('Watermark added successfully!');
    } catch (error) {
      toast.error('Failed to add watermark');
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
                   hover:border-purple-500/50 hover:bg-cyber-dark
                   transition-all duration-300 hover:scale-105"
        >
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600">
              <Droplet className="w-6 h-6 text-white" />
            </div>
            Add Watermark
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Add text watermark to PDF
          </p>
        </div>
      </div>

      {!pdfFile ? (
        /* Upload Area */
        <div 
          className="relative border-2 border-dashed border-white/10 rounded-2xl p-12
                     hover:border-purple-500/30 transition-all duration-300 bg-cyber-dark/30"
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
            <div className="inline-flex p-4 rounded-2xl bg-purple-500/10 mb-4">
              <Upload className="w-8 h-8 text-purple-400" />
            </div>
            <p className="text-white font-medium mb-2">Drop PDF file here</p>
            <p className="text-gray-500 text-sm">or click to browse</p>
          </div>
        </div>
      ) : (
        <>
          {/* File Info */}
          <div className="flex items-center gap-3 p-4 rounded-xl bg-cyber-dark/50 border border-white/5 mb-6">
            <FileText className="w-8 h-8 text-purple-400" />
            <div className="flex-1">
              <p className="text-white font-medium">{pdfFile.name}</p>
              <p className="text-gray-500 text-sm">{pageCount} pages</p>
            </div>
            <button
              onClick={() => {
                setPdfFile(null);
                setPageCount(0);
              }}
              className="text-gray-400 hover:text-purple-400 text-sm"
            >
              Change file
            </button>
          </div>

          {/* Watermark Settings */}
          <div className="mb-6 p-6 rounded-xl bg-cyber-dark/30 border border-white/5">
            <div className="flex items-center gap-2 mb-6">
              <Settings className="w-4 h-4 text-purple-400" />
              <h3 className="text-white font-medium">Watermark Settings</h3>
            </div>

            <div className="space-y-5">
              {/* Watermark Text */}
              <div>
                <label className="text-gray-400 text-xs mb-2 block uppercase tracking-wider">Watermark Text</label>
                <input
                  type="text"
                  value={watermarkText}
                  onChange={(e) => setWatermarkText(e.target.value)}
                  placeholder="Enter watermark text"
                  className="w-full bg-cyber-dark border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-purple-500/50"
                />
              </div>

              {/* Position */}
              <div>
                <label className="text-gray-400 text-xs mb-2 block uppercase tracking-wider">Position</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['top', 'center', 'bottom'] as const).map((pos) => (
                    <button
                      key={pos}
                      onClick={() => setPosition(pos)}
                      className={`py-2 rounded-lg border text-sm font-medium transition-all capitalize
                        ${position === pos
                          ? 'bg-purple-500/20 border-purple-500 text-purple-400'
                          : 'border-white/10 text-gray-400 hover:border-purple-500/30'}`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Size & Rotation */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 text-xs mb-2 block uppercase tracking-wider">Font Size</label>
                  <input
                    type="number"
                    min={10}
                    max={200}
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value) || 50)}
                    className="w-full bg-cyber-dark border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-purple-500/50"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-2 block uppercase tracking-wider">Rotation (°)</label>
                  <input
                    type="number"
                    min={-180}
                    max={180}
                    value={rotation}
                    onChange={(e) => setRotation(parseInt(e.target.value) || 0)}
                    className="w-full bg-cyber-dark border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-purple-500/50"
                  />
                </div>
              </div>

              {/* Opacity & Color */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 text-xs mb-2 block uppercase tracking-wider">
                    Opacity ({Math.round(opacity * 100)}%)
                  </label>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.1}
                    value={opacity}
                    onChange={(e) => setOpacity(parseFloat(e.target.value))}
                    className="w-full accent-purple-500"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-2 block uppercase tracking-wider">Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-12 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <input
                      type="text"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="flex-1 bg-cyber-dark border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-purple-500/50"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="mb-6 p-6 rounded-xl bg-cyber-dark/30 border border-white/5">
            <h4 className="text-gray-400 text-xs mb-3 uppercase tracking-wider">Preview</h4>
            <div className="relative aspect-[8.5/11] bg-white/5 rounded-xl overflow-hidden flex items-center justify-center">
              <div 
                className="text-center font-bold"
                style={{
                  fontSize: `${Math.min(fontSize / 3, 40)}px`,
                  color: color,
                  opacity: opacity,
                  transform: `rotate(${rotation}deg)`,
                }}
              >
                {watermarkText || 'Watermark Text'}
              </div>
            </div>
          </div>

          {/* Apply Button */}
          <button
            onClick={addWatermark}
            disabled={isProcessing || !watermarkText.trim()}
            className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-semibold rounded-xl
                     hover:shadow-xl hover:shadow-purple-500/30 hover:scale-[1.02] active:scale-[0.98]
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
                Add Watermark & Download
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
};
