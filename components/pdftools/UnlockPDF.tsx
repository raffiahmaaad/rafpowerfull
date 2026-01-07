import React, { useState, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import { Unlock, ArrowLeft, Upload, Download, FileText, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

interface UnlockPDFProps {
  onBack: () => void;
}

export const UnlockPDF: React.FC<UnlockPDFProps> = ({ onBack }) => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [pageCount, setPageCount] = useState(0);

  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file');
      return;
    }

    setPdfFile(file);
    setPassword('');

    try {
      const arrayBuffer = await file.arrayBuffer();
      // Try to load without password first
      try {
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        setIsEncrypted(false);
        setPageCount(pdfDoc.getPageCount());
        toast.success('This PDF is not password protected');
      } catch (e) {
        // Likely encrypted
        setIsEncrypted(true);
        toast.success('PDF loaded - enter password to unlock');
      }
    } catch (error) {
      toast.error('Failed to load PDF');
      console.error(error);
    }
  }, []);

  const unlockPDF = async () => {
    if (!pdfFile) return;

    setIsProcessing(true);

    try {
      // Try API first for proper decryption
      const API_URL = import.meta.env.VITE_API_URL || 'https://ghostmail-worker.rafxyz.workers.dev';
      
      const formData = new FormData();
      formData.append('file', pdfFile);
      if (password) {
        formData.append('password', password);
      }

      const response = await fetch(`${API_URL}/api/pdf/unlock`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = 'unlocked_' + pdfFile.name;
        link.click();
        
        URL.revokeObjectURL(url);
        toast.success('PDF unlocked successfully!');
        return;
      }

      // API failed, try client-side fallback
      const errorData = await response.json().catch(() => ({}));
      console.warn('API unlock failed:', errorData.message || 'Unknown error');
      await unlockPDFClientSide();
    } catch (error) {
      console.error('API error, falling back to client-side:', error);
      await unlockPDFClientSide();
    } finally {
      setIsProcessing(false);
    }
  };

  const unlockPDFClientSide = async () => {
    if (!pdfFile) return;

    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      
      // Client-side fallback: try to load with ignoreEncryption
      const pdfDoc = await PDFDocument.load(arrayBuffer, {
        ignoreEncryption: true,
      });

      const pdfBytes = await pdfDoc.save();

      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = 'unlocked_' + pdfFile.name;
      link.click();
      
      URL.revokeObjectURL(url);
      toast.success('PDF processed (client-side)');
    } catch (error: any) {
      console.error(error);
      toast.error('Failed to unlock PDF');
    }
  };

  const downloadUnprotected = async () => {
    if (!pdfFile) return;

    setIsProcessing(true);

    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pdfBytes = await pdfDoc.save();

      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = pdfFile.name;
      link.click();
      
      URL.revokeObjectURL(url);
      toast.success('PDF downloaded!');
    } catch (error) {
      toast.error('Failed to process PDF');
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
                   hover:border-amber-500/50 hover:bg-cyber-dark
                   transition-all duration-300 hover:scale-105"
        >
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600">
              <Unlock className="w-6 h-6 text-white" />
            </div>
            Unlock PDF
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Remove password protection from PDF
          </p>
        </div>
      </div>

      {!pdfFile ? (
        /* Upload Area */
        <div 
          className="relative border-2 border-dashed border-white/10 rounded-2xl p-12
                     hover:border-amber-500/30 transition-all duration-300 bg-cyber-dark/30"
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
            <div className="inline-flex p-4 rounded-2xl bg-amber-500/10 mb-4">
              <Upload className="w-8 h-8 text-amber-400" />
            </div>
            <p className="text-white font-medium mb-2">Drop protected PDF here</p>
            <p className="text-gray-500 text-sm">or click to browse</p>
          </div>
        </div>
      ) : (
        <>
          {/* File Info */}
          <div className="flex items-center gap-3 p-4 rounded-xl bg-cyber-dark/50 border border-white/5 mb-6">
            <FileText className="w-8 h-8 text-amber-400" />
            <div className="flex-1">
              <p className="text-white font-medium">{pdfFile.name}</p>
              <p className={`text-sm ${isEncrypted ? 'text-amber-400' : 'text-emerald-400'}`}>
                {isEncrypted ? '🔒 Password protected' : '🔓 Not protected'}
              </p>
            </div>
            <button
              onClick={() => {
                setPdfFile(null);
                setPassword('');
                setIsEncrypted(false);
              }}
              className="text-gray-400 hover:text-amber-400 text-sm"
            >
              Change file
            </button>
          </div>

          {isEncrypted ? (
            <>
              {/* Password Input */}
              <div className="mb-6 p-6 rounded-xl bg-cyber-dark/30 border border-white/5">
                <div className="flex items-center gap-2 mb-4">
                  <Unlock className="w-4 h-4 text-amber-400" />
                  <h3 className="text-white font-medium">Enter Password</h3>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter PDF password"
                    className="w-full bg-cyber-dark border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-amber-500/50 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Warning */}
              <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-amber-300 font-medium text-sm">Important</p>
                  <p className="text-gray-400 text-sm mt-1">
                    You must know the password to unlock this PDF. We cannot recover forgotten passwords.
                  </p>
                </div>
              </div>

              {/* Unlock Button */}
              <button
                onClick={unlockPDF}
                disabled={isProcessing || !password}
                className="w-full py-4 bg-gradient-to-r from-amber-500 to-yellow-600 text-white font-semibold rounded-xl
                         hover:shadow-xl hover:shadow-amber-500/30 hover:scale-[1.02] active:scale-[0.98]
                         transition-all duration-200 flex items-center justify-center gap-2
                         disabled:opacity-50 disabled:hover:scale-100"
              >
                {isProcessing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Unlocking...
                  </>
                ) : (
                  <>
                    <Unlock className="w-5 h-5" />
                    Unlock & Download
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              {/* Not Protected Info */}
              <div className="mb-6 p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/20">
                    <Unlock className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-emerald-300 font-medium">PDF is not password protected</p>
                    <p className="text-gray-400 text-sm mt-1">
                      This file does not require a password to open.
                    </p>
                  </div>
                </div>
              </div>

              {/* Download Button */}
              <button
                onClick={downloadUnprotected}
                disabled={isProcessing}
                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-xl
                         hover:shadow-xl hover:shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98]
                         transition-all duration-200 flex items-center justify-center gap-2
                         disabled:opacity-50 disabled:hover:scale-100"
              >
                <Download className="w-5 h-5" />
                Download PDF
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
};
