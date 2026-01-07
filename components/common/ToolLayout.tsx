import React from 'react';
import { SectionHeader } from '../common';
import { ArrowLeft } from 'lucide-react';

interface ToolLayoutProps {
  title: string;
  description: string;
  children: React.ReactNode;
  onBack?: () => void;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
}

export const ToolLayout: React.FC<ToolLayoutProps> = ({
  title,
  description,
  children,
  onBack,
  maxWidth = '4xl'
}) => {
  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl'
  };

  return (
    <div className="w-full min-h-screen py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8">
      <div className={`w-full ${maxWidthClasses[maxWidth]} mx-auto`}>
        {/* Back Button */}
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Back</span>
          </button>
        )}

        {/* Header */}
        <SectionHeader title={title} description={description} align="center" />

        {/* Content */}
        <div className="mt-8 sm:mt-12">
          {children}
        </div>
      </div>
    </div>
  );
};
