import React from 'react';

interface SectionHeaderProps {
  title: string;
  description?: string;
  align?: 'left' | 'center';
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  description,
  align = 'center',
  className = ''
}) => {
  const alignStyles = align === 'center' ? 'text-center' : 'text-left';
  const descriptionAlign = align === 'center' ? 'mx-auto' : '';
  
  return (
    <div className={`mb-12 ${alignStyles} ${className}`}>
      <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
        {title}
      </h2>
      {description && (
        <p className={`text-gray-400 max-w-2xl ${descriptionAlign}`}>
          {description}
        </p>
      )}
    </div>
  );
};
