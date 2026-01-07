import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  variant?: 'default' | 'hover' | 'highlight';
}

export const Card: React.FC<CardProps> = ({ 
  children, 
  className = '', 
  onClick,
  variant = 'default'
}) => {
  const baseStyles = "bg-cyber-dark/50 backdrop-blur-sm border rounded-2xl transition-all duration-300";
  
  const variantStyles = {
    default: "border-white/10 hover:border-white/20",
    hover: "border-white/10 hover:border-white/30 hover:bg-cyber-dark/70 cursor-pointer",
    highlight: "border-cyber-primary/30 bg-cyber-primary/5 hover:border-cyber-primary/50"
  };
  
  return (
    <div 
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};
