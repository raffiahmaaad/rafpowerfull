import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  type = 'button',
  fullWidth = false
}) => {
  const baseStyles = "font-semibold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2";
  
  const sizeStyles = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg"
  };
  
  const variantStyles = {
    primary: "bg-gradient-to-r from-cyber-primary to-blue-500 text-black hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] hover:scale-105",
    secondary: "bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-white/20",
    success: "bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:scale-105",
    danger: "bg-gradient-to-r from-rose-500 to-red-600 text-white hover:shadow-[0_0_20px_rgba(244,63,94,0.4)] hover:scale-105",
    warning: "bg-gradient-to-r from-amber-500 to-yellow-600 text-black hover:shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:scale-105"
  };
  
  const widthStyles = fullWidth ? "w-full" : "";
  
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${widthStyles} ${className}`}
    >
      {children}
    </button>
  );
};
