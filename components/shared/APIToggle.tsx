import React from 'react';
import { Zap, Cpu } from 'lucide-react';

interface APIToggleProps {
  useAPI: boolean;
  onToggle: (useAPI: boolean) => void;
  apiLabel?: string;
  localLabel?: string;
  className?: string;
}

export const APIToggle: React.FC<APIToggleProps> = ({
  useAPI,
  onToggle,
  apiLabel = 'Use API (Better quality)',
  localLabel = 'Local (Saves credits)',
  className = ''
}) => {
  return (
    <div className={`flex items-center gap-2 p-3 rounded-xl bg-cyber-dark/50 border border-white/5 ${className}`}>
      <span className="text-gray-400 text-sm mr-2">Mode:</span>
      <button
        onClick={() => onToggle(false)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all
          ${!useAPI 
            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
            : 'text-gray-500 hover:text-gray-300'}`}
      >
        <Cpu className="w-3.5 h-3.5" />
        Local
      </button>
      <button
        onClick={() => onToggle(true)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all
          ${useAPI 
            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
            : 'text-gray-500 hover:text-gray-300'}`}
      >
        <Zap className="w-3.5 h-3.5" />
        API
      </button>
    </div>
  );
};
