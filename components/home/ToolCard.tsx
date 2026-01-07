import React from 'react';
import { Mail, Image, FileText, Link, FileType, Wrench, ArrowRight, Sparkles } from 'lucide-react';

interface ToolCardProps {
  icon: React.ReactNode;
  name: string;
  description: string;
  status: 'active' | 'coming-soon';
  gradient: string;
  onClick?: () => void;
}

export const ToolCard: React.FC<ToolCardProps> = ({ 
  icon, 
  name, 
  description, 
  status, 
  gradient,
  onClick 
}) => {
  const isActive = status === 'active';
  
  return (
    <div
      onClick={isActive ? onClick : undefined}
      className={`
        relative group p-6 rounded-2xl border backdrop-blur-sm
        transition-all duration-500 overflow-hidden
        ${isActive 
          ? 'cursor-pointer border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 hover:shadow-2xl hover:-translate-y-2' 
          : 'border-white/5 bg-white/[0.02] cursor-not-allowed'
        }
      `}
    >
      {/* Gradient Background */}
      <div 
        className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${isActive ? '' : 'hidden'}`}
        style={{
          background: `radial-gradient(circle at 50% 50%, ${gradient}15, transparent 70%)`
        }}
      />
      
      {/* Status Badge */}
      <div className={`
        absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-medium
        ${isActive 
          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
          : 'bg-amber-500/10 text-amber-400/70 border border-amber-500/20'
        }
      `}>
        {isActive ? 'Active' : 'Coming Soon'}
      </div>
      
      {/* Icon */}
      <div 
        className={`
          w-14 h-14 rounded-xl flex items-center justify-center mb-4
          transition-all duration-300 group-hover:scale-110
          ${isActive ? 'bg-gradient-to-br' : 'bg-white/5'}
        `}
        style={isActive ? {
          background: `linear-gradient(135deg, ${gradient}30, ${gradient}10)`
        } : undefined}
      >
        <div style={{ color: isActive ? gradient : '#666' }}>
          {icon}
        </div>
      </div>
      
      {/* Content */}
      <h3 className={`text-xl font-bold mb-2 transition-colors ${isActive ? 'text-white group-hover:text-cyber-primary' : 'text-gray-500'}`}>
        {name}
      </h3>
      <p className={`text-sm leading-relaxed ${isActive ? 'text-gray-400' : 'text-gray-600'}`}>
        {description}
      </p>
      
      {/* Arrow indicator for active tools */}
      {isActive && (
        <div className="mt-4 flex items-center gap-2 text-cyber-primary opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-sm font-medium">Open Tool</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </div>
      )}
      
      {/* Coming soon sparkle effect */}
      {!isActive && (
        <div className="mt-4 flex items-center gap-2 text-amber-500/50">
          <Sparkles className="w-4 h-4" />
          <span className="text-xs">In Development</span>
        </div>
      )}
    </div>
  );
};
