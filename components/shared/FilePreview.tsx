import React from 'react';
import { FileText, Image, File, X } from 'lucide-react';

interface FilePreviewProps {
  file: File;
  onRemove?: () => void;
  showSize?: boolean;
  className?: string;
}

export const FilePreview: React.FC<FilePreviewProps> = ({
  file,
  onRemove,
  showSize = true,
  className = ''
}) => {
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getFileIcon = (type: string, name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    
    if (type.startsWith('image/')) {
      return { icon: Image, color: 'text-emerald-400', bg: 'bg-emerald-500/20' };
    }
    if (type === 'application/pdf' || ext === 'pdf') {
      return { icon: FileText, color: 'text-red-400', bg: 'bg-red-500/20' };
    }
    if (['doc', 'docx'].includes(ext || '')) {
      return { icon: FileText, color: 'text-blue-400', bg: 'bg-blue-500/20' };
    }
    if (['xls', 'xlsx'].includes(ext || '')) {
      return { icon: FileText, color: 'text-green-400', bg: 'bg-green-500/20' };
    }
    if (['ppt', 'pptx'].includes(ext || '')) {
      return { icon: FileText, color: 'text-orange-400', bg: 'bg-orange-500/20' };
    }
    return { icon: File, color: 'text-gray-400', bg: 'bg-gray-500/20' };
  };

  const { icon: IconComponent, color, bg } = getFileIcon(file.type, file.name);

  return (
    <div className={`relative group flex items-center gap-3 p-4 rounded-xl bg-cyber-dark/50 border border-white/5 ${className}`}>
      {/* File Icon */}
      <div className={`p-3 rounded-xl ${bg}`}>
        <IconComponent className={`w-6 h-6 ${color}`} />
      </div>

      {/* File Info */}
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium truncate">{file.name}</p>
        {showSize && (
          <p className="text-gray-500 text-sm">{formatSize(file.size)}</p>
        )}
      </div>

      {/* Remove Button */}
      {onRemove && (
        <button
          onClick={onRemove}
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 
                   transition-colors opacity-0 group-hover:opacity-100"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

// Thumbnail preview for images
interface ImageThumbnailProps {
  file: File;
  onRemove?: () => void;
  className?: string;
}

export const ImageThumbnail: React.FC<ImageThumbnailProps> = ({
  file,
  onRemove,
  className = ''
}) => {
  const [preview, setPreview] = React.useState<string>('');

  React.useEffect(() => {
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  return (
    <div className={`relative group rounded-xl overflow-hidden border-2 border-white/10 hover:border-white/20 transition-colors ${className}`}>
      {preview ? (
        <img src={preview} alt={file.name} className="w-full h-40 object-cover" />
      ) : (
        <div className="w-full h-40 bg-cyber-dark flex items-center justify-center">
          <FileText className="w-12 h-12 text-gray-600" />
        </div>
      )}
      
      {/* Overlay with info */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent 
                    opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
        <p className="text-white text-sm font-medium truncate">{file.name}</p>
      </div>

      {/* Remove Button */}
      {onRemove && (
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white 
                   hover:bg-red-500 transition-colors opacity-0 group-hover:opacity-100"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
