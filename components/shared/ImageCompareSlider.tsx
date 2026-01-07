import React, { useState, useRef, useCallback, useEffect } from 'react';

interface ImageCompareSliderProps {
  beforeImage: string;
  afterImage: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
}

export const ImageCompareSlider: React.FC<ImageCompareSliderProps> = ({
  beforeImage,
  afterImage,
  beforeLabel = 'Before',
  afterLabel = 'After',
  className = ''
}) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate container size based on image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const maxWidth = Math.min(500, window.innerWidth - 48);
      const maxHeight = 450;
      
      const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
      setContainerSize({
        width: Math.round(img.width * scale),
        height: Math.round(img.height * scale)
      });
    };
    img.src = beforeImage;
  }, [beforeImage]);

  const updateSliderPosition = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) updateSliderPosition(e.clientX);
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleTouchMove = (e: React.TouchEvent) => {
    updateSliderPosition(e.touches[0].clientX);
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    updateSliderPosition(e.clientX);
  };

  // Checkerboard pattern for transparency
  const checkerboardStyle = {
    backgroundImage: `
      linear-gradient(45deg, #3a3a3a 25%, transparent 25%),
      linear-gradient(-45deg, #3a3a3a 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #3a3a3a 75%),
      linear-gradient(-45deg, transparent 75%, #3a3a3a 75%)
    `,
    backgroundSize: '12px 12px',
    backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px',
    backgroundColor: '#2a2a2a'
  };

  if (!containerSize.width) {
    return (
      <div className="flex items-center justify-center h-48 bg-cyber-dark rounded-xl">
        <div className="animate-pulse text-gray-500">Loading preview...</div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Container with fixed dimensions */}
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-xl cursor-col-resize select-none"
        style={{ 
          width: containerSize.width, 
          height: containerSize.height,
          ...checkerboardStyle
        }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
        onClick={handleContainerClick}
      >
        {/* AFTER image - Full size, bottom layer */}
        <img
          src={afterImage}
          alt={afterLabel}
          className="absolute inset-0 w-full h-full object-contain"
          draggable={false}
        />

        {/* BEFORE image - Clipped with clip-path, top layer */}
        <div
          className="absolute inset-0"
          style={{
            clipPath: `polygon(0 0, ${sliderPosition}% 0, ${sliderPosition}% 100%, 0 100%)`
          }}
        >
          <img
            src={beforeImage}
            alt={beforeLabel}
            className="absolute inset-0 w-full h-full object-contain"
            draggable={false}
          />
        </div>

        {/* Vertical slider line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white/90"
          style={{ 
            left: `${sliderPosition}%`, 
            transform: 'translateX(-50%)',
            boxShadow: '0 0 6px rgba(0,0,0,0.5)'
          }}
        />

        {/* Slider handle */}
        <div
          className="absolute top-1/2 z-10"
          style={{ left: `${sliderPosition}%`, transform: 'translate(-50%, -50%)' }}
        >
          <div
            className="w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center
                       cursor-col-resize hover:scale-110 active:scale-95 transition-transform"
            onMouseDown={handleMouseDown}
            onTouchStart={() => setIsDragging(true)}
          >
            <svg className="w-5 h-5 text-gray-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l-5-7 5-7zm8 0v14l5-7-5-7z"/>
            </svg>
          </div>
        </div>

        {/* Labels */}
        <div className="absolute top-2 left-2 px-2 py-1 bg-black/70 rounded text-white text-xs font-medium">
          {beforeLabel}
        </div>
        <div className="absolute top-2 right-2 px-2 py-1 bg-emerald-600/90 rounded text-white text-xs font-medium">
          {afterLabel}
        </div>
      </div>

      {/* Hint */}
      <p className="text-gray-500 text-xs mt-2">← Drag slider to compare →</p>
    </div>
  );
};
