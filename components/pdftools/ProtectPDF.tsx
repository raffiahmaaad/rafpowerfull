import React, { useState, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import { Lock, ArrowLeft, Upload, Download, FileText, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

interface ProtectPDFProps {
  onBack: () => void;
}

export const ProtectPDF: React.FC<ProtectPDFProps> = ({ onBack }) => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file');
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      setPageCount(pdfDoc.getPageCount());
      setPdfFile(file);
      toast.success(`Loaded PDF with ${pdfDoc.getPageCount()} pages`);
    } catch (error) {
      toast.error('Failed to load PDF');
      console.error(error);
    }
  }, []);

  const protectPDF = async () => {
    if (!pdfFile) return;

    if (!password) {
      toast.error('Please enter a password');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (password.length < 4) {
      toast.error('Password must be at least 4 characters');
      return;
    }

    setIsProcessing(true);

    try {
      // Try API first for proper encryption
      const API_URL = import.meta.env.VITE_API_URL || 'https://ghostmail-worker.rafxyz.workers.dev';
      
      const formData = new FormData();
      formData.append('file', pdfFile);
      formData.append('password', password);

      const response = await fetch(`${API_URL}/api/pdf/protect`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = 'protected_' + pdfFile.name;
        link.click();
        
        URL.revokeObjectURL(url);
        toast.success('PDF protected with password!');
        return;
      }

      // API failed
      const errorData = await response.json().catch(() => ({}));
      toast.error(errorData.message || 'Failed to protect PDF. Please try again.');
    } catch (error) {
      console.error('API error:', error);
      toast.error('Failed to protect PDF. Please check your connection.');
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
                   hover:border-rose-500/50 hover:bg-cyber-dark
                   transition-all duration-300 hover:scale-105"
        >
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-rose-500 to-red-600">
              <Lock className="w-6 h-6 text-white" />
            </div>
            Protect PDF
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Add password protection to PDF
          </p>
        </div>
      </div>

      {!pdfFile ? (
        /* Upload Area */
        <div 
          className="relative border-2 border-dashed border-white/10 rounded-2xl p-12
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
            onChange={(e) => handleFileUpload(e.target.files)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="text-center">
            <div className="inline-flex p-4 rounded-2xl bg-rose-500/10 mb-4">
              <Upload className="w-8 h-8 text-rose-400" />
            </div>
            <p className="text-white font-medium mb-2">Drop PDF file here</p>
            <p className="text-gray-500 text-sm">or click to browse</p>
          </div>
        </div>
      ) : (
        <>
          {/* File Info */}
          <div className="flex items-center gap-3 p-4 rounded-xl bg-cyber-dark/50 border border-white/5 mb-6">
            <FileText className="w-8 h-8 text-rose-400" />
            <div className="flex-1">
              <p className="text-white font-medium">{pdfFile.name}</p>
              <p className="text-gray-500 text-sm">{pageCount} pages</p>
            </div>
            <button
              onClick={() => {
                setPdfFile(null);
                setPageCount(0);
                setPassword('');
                setConfirmPassword('');
              }}
              className="text-gray-400 hover:text-rose-400 text-sm"
            >
              Change file
            </button>
          </div>

          {/* Password Settings */}
          <div className="mb-6 p-6 rounded-xl bg-cyber-dark/30 border border-white/5">
            <div className="flex items-center gap-2 mb-6">
              <Lock className="w-4 h-4 text-rose-400" />
              <h3 className="text-white font-medium">Set Password</h3>
            </div>

            <div className="space-y-4">
              {/* Password */}
              <div>
                <label className="text-gray-400 text-xs mb-2 block uppercase tracking-wider">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full bg-cyber-dark border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-rose-500/50 pr-12"
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

              {/* Confirm Password */}
              <div>
                <label className="text-gray-400 text-xs mb-2 block uppercase tracking-wider">Confirm Password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  className="w-full bg-cyber-dark border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-rose-500/50"
                />
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-rose-400 text-xs mt-2">Passwords do not match</p>
                )}
              </div>
            </div>
          </div>

          {/* Protection Info */}
          <div className="mb-6 p-4 rounded-xl bg-cyber-dark/30 border border-white/5">
            <h4 className="text-white font-medium text-sm mb-3">Protection includes:</h4>
            <ul className="text-gray-400 text-sm space-y-1">
              <li>• Password required to open document</li>
              <li>• Copying content restricted</li>
              <li>• Editing restricted</li>
              <li>• High-quality printing restricted</li>
            </ul>
          </div>

          {/* Protect Button */}
          <button
            onClick={protectPDF}
            disabled={isProcessing || !password || password !== confirmPassword}
            className="w-full py-4 bg-gradient-to-r from-rose-500 to-red-600 text-white font-semibold rounded-xl
                     hover:shadow-xl hover:shadow-rose-500/30 hover:scale-[1.02] active:scale-[0.98]
                     transition-all duration-200 flex items-center justify-center gap-2
                     disabled:opacity-50 disabled:hover:scale-100"
          >
            {isProcessing ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Protecting...
              </>
            ) : (
              <>
                <Lock className="w-5 h-5" />
                Protect & Download
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
};
