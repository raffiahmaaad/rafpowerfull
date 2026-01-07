import React, { useState, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import { FilePlus, ArrowLeft, Upload, X, GripVertical, Download, Image, Plus, Settings } from 'lucide-react';
import toast from 'react-hot-toast';

interface ImageFile {
  id: string;
  file: File;
  name: string;
  preview: string;
}

interface JPGtoPDFProps {
  onBack: () => void;
}

export const JPGtoPDF: React.FC<JPGtoPDFProps> = ({ onBack }) => {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<'fit' | 'a4' | 'letter'>('a4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [margin, setMargin] = useState(20);

  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files) return;

    const newImages: ImageFile[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image file`);
        continue;
      }

      const preview = URL.createObjectURL(file);
      newImages.push({
        id: `${Date.now()}-${i}`,
        file,
        name: file.name,
        preview,
      });
    }

    setImages(prev => [...prev, ...newImages]);
    if (newImages.length > 0) {
      toast.success(`Added ${newImages.length} image(s)`);
    }
  }, []);

  const removeImage = (id: string) => {
    const image = images.find(img => img.id === id);
    if (image) {
      URL.revokeObjectURL(image.preview);
    }
    setImages(prev => prev.filter(img => img.id !== id));
  };

  const handleDragStart = (id: string) => {
    setDraggedItem(id);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (draggedItem === targetId) return;

    const draggedIndex = images.findIndex(img => img.id === draggedItem);
    const targetIndex = images.findIndex(img => img.id === targetId);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      const newImages = [...images];
      const [removed] = newImages.splice(draggedIndex, 1);
      newImages.splice(targetIndex, 0, removed);
      setImages(newImages);
    }
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const getPageDimensions = () => {
    // Dimensions in points (72 points = 1 inch)
    const sizes = {
      a4: { width: 595, height: 842 },
      letter: { width: 612, height: 792 },
      fit: { width: 0, height: 0 }, // Will be determined by image
    };

    const size = sizes[pageSize];
    if (orientation === 'landscape' && pageSize !== 'fit') {
      return { width: size.height, height: size.width };
    }
    return size;
  };

  const convertToPDF = async () => {
    if (images.length === 0) {
      toast.error('Please add at least one image');
      return;
    }

    setIsProcessing(true);

    try {
      const pdfDoc = await PDFDocument.create();

      for (const imageFile of images) {
        const arrayBuffer = await imageFile.file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        let image;
        const fileType = imageFile.file.type;
        
        if (fileType === 'image/jpeg' || fileType === 'image/jpg') {
          image = await pdfDoc.embedJpg(uint8Array);
        } else if (fileType === 'image/png') {
          image = await pdfDoc.embedPng(uint8Array);
        } else {
          // Convert other formats to PNG using canvas
          const img = document.createElement('img');
          img.src = imageFile.preview;
          await new Promise(resolve => img.onload = resolve);
          
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0);
          
          const pngBlob = await new Promise<Blob>((resolve) => {
            canvas.toBlob(blob => resolve(blob!), 'image/png');
          });
          const pngBuffer = await pngBlob.arrayBuffer();
          image = await pdfDoc.embedPng(new Uint8Array(pngBuffer));
        }

        const imgDims = image.scale(1);
        let pageWidth, pageHeight;

        if (pageSize === 'fit') {
          pageWidth = imgDims.width + margin * 2;
          pageHeight = imgDims.height + margin * 2;
        } else {
          const dims = getPageDimensions();
          pageWidth = dims.width;
          pageHeight = dims.height;
        }

        const page = pdfDoc.addPage([pageWidth, pageHeight]);

        // Calculate image dimensions to fit within page
        const availableWidth = pageWidth - margin * 2;
        const availableHeight = pageHeight - margin * 2;
        
        let drawWidth = imgDims.width;
        let drawHeight = imgDims.height;

        if (pageSize !== 'fit') {
          const scale = Math.min(
            availableWidth / imgDims.width,
            availableHeight / imgDims.height
          );
          drawWidth = imgDims.width * scale;
          drawHeight = imgDims.height * scale;
        }

        // Center the image
        const x = (pageWidth - drawWidth) / 2;
        const y = (pageHeight - drawHeight) / 2;

        page.drawImage(image, {
          x,
          y,
          width: drawWidth,
          height: drawHeight,
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = 'images.pdf';
      link.click();
      
      URL.revokeObjectURL(url);
      toast.success('PDF created successfully!');
    } catch (error) {
      toast.error('Failed to create PDF');
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
                   hover:border-yellow-500/50 hover:bg-cyber-dark
                   transition-all duration-300 hover:scale-105"
        >
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600">
              <FilePlus className="w-6 h-6 text-white" />
            </div>
            JPG to PDF
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Convert images to PDF document
          </p>
        </div>
      </div>

      {/* Upload Area */}
      <div 
        className="relative border-2 border-dashed border-white/10 rounded-2xl p-8 mb-6
                   hover:border-yellow-500/30 transition-all duration-300 bg-cyber-dark/30"
        onDrop={(e) => {
          e.preventDefault();
          handleFileUpload(e.dataTransfer.files);
        }}
        onDragOver={(e) => e.preventDefault()}
      >
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleFileUpload(e.target.files)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="text-center">
          <div className="inline-flex p-4 rounded-2xl bg-yellow-500/10 mb-4">
            <Upload className="w-8 h-8 text-yellow-400" />
          </div>
          <p className="text-white font-medium mb-2">Drop images here</p>
          <p className="text-gray-500 text-sm">JPG, PNG, GIF, WebP supported</p>
        </div>
      </div>

      {/* Settings */}
      {images.length > 0 && (
        <div className="mb-6 p-5 rounded-xl bg-cyber-dark/30 border border-white/5">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-4 h-4 text-yellow-400" />
            <h3 className="text-white font-medium">PDF Settings</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-gray-400 text-xs mb-2 block">Page Size</label>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(e.target.value as any)}
                className="w-full bg-cyber-dark border border-white/10 rounded-lg px-4 py-2 text-white text-sm"
              >
                <option value="a4">A4</option>
                <option value="letter">Letter</option>
                <option value="fit">Fit to Image</option>
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-2 block">Orientation</label>
              <select
                value={orientation}
                onChange={(e) => setOrientation(e.target.value as any)}
                className="w-full bg-cyber-dark border border-white/10 rounded-lg px-4 py-2 text-white text-sm"
                disabled={pageSize === 'fit'}
              >
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-2 block">Margin (pt)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={margin}
                onChange={(e) => setMargin(parseInt(e.target.value) || 0)}
                className="w-full bg-cyber-dark border border-white/10 rounded-lg px-4 py-2 text-white text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Image List */}
      {images.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-medium">Images ({images.length})</h3>
            <button
              onClick={() => {
                images.forEach(img => URL.revokeObjectURL(img.preview));
                setImages([]);
              }}
              className="text-xs text-gray-400 hover:text-yellow-400 transition-colors"
            >
              Clear all
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {images.map((image, index) => (
              <div
                key={image.id}
                draggable
                onDragStart={() => handleDragStart(image.id)}
                onDragOver={(e) => handleDragOver(e, image.id)}
                onDragEnd={handleDragEnd}
                className={`relative group rounded-xl overflow-hidden bg-cyber-dark/50 border border-white/5
                           hover:border-yellow-500/30 transition-all duration-200 cursor-move
                           ${draggedItem === image.id ? 'opacity-50' : ''}`}
              >
                <img
                  src={image.preview}
                  alt={image.name}
                  className="w-full aspect-[3/4] object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="absolute top-2 left-2 w-6 h-6 rounded-lg bg-yellow-500 flex items-center justify-center text-white text-xs font-bold">
                  {index + 1}
                </span>
                <button
                  onClick={() => removeImage(image.id)}
                  className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-white text-xs truncate">{image.name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add More Button */}
      {images.length > 0 && (
        <label className="flex items-center justify-center gap-2 p-4 rounded-xl border border-dashed border-white/10
                         hover:border-yellow-500/30 cursor-pointer transition-all duration-200 mb-6">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleFileUpload(e.target.files)}
            className="hidden"
          />
          <Plus className="w-5 h-5 text-yellow-400" />
          <span className="text-gray-400 text-sm">Add more images</span>
        </label>
      )}

      {/* Convert Button */}
      {images.length > 0 && (
        <button
          onClick={convertToPDF}
          disabled={isProcessing}
          className="w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-600 text-white font-semibold rounded-xl
                   hover:shadow-xl hover:shadow-yellow-500/30 hover:scale-[1.02] active:scale-[0.98]
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
      )}

      {/* Instructions */}
      <div className="mt-8 p-5 rounded-2xl bg-cyber-dark/30 border border-white/5">
        <h4 className="text-white font-medium mb-3">How to convert images to PDF:</h4>
        <ol className="text-gray-400 text-sm space-y-2">
          <li>1. Upload one or more images (JPG, PNG, GIF, WebP)</li>
          <li>2. Drag and drop to reorder them</li>
          <li>3. Adjust page settings if needed</li>
          <li>4. Click "Convert to PDF" to download</li>
        </ol>
      </div>
    </div>
  );
};
