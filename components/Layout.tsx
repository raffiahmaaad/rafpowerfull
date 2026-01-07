import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Terminal, Image, Mail, CreditCard, FileText, Database, LogIn, User, RotateCcw, Menu, X } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentView: string;
  onViewChange: (view: string) => void;
  isLoggedIn?: boolean;
  onLogout?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentView, onViewChange, isLoggedIn, onLogout }) => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Don't show header/footer on dashboard
  if (currentView === 'dashboard') {
    return <>{children}</>;
  }

  // Check if we're on a TempMail related page
  const isTempMailPage = currentView === 'tempmail';

  // Navigation items
  const navItems = [
    { to: '/tempmail', icon: Mail, label: 'TempMail', isActive: isTempMailPage },
    { to: '/imagetools', icon: Image, label: 'Image Tools', isActive: currentView === 'imagetools' },
    { to: '/pdftools', icon: FileText, label: 'PDF Tools', isActive: currentView === 'pdftools' },
    { to: '/cctools', icon: CreditCard, label: 'CC Tools', isActive: currentView === 'cctools' },
    { to: '/generators', icon: Database, label: 'Address Tools', isActive: currentView === 'generators' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0f0f1a] to-[#0a0a0f] text-cyber-text font-sans selection:bg-cyber-primary selection:text-black flex flex-col overflow-hidden relative">
      {/* Modern Gradient Mesh Background */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Animated Gradient Orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyber-primary/10 rounded-full blur-3xl animate-pulse" 
             style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" 
             style={{ animationDuration: '10s', animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-0 w-72 h-72 bg-amber-500/8 rounded-full blur-3xl animate-pulse" 
             style={{ animationDuration: '12s', animationDelay: '4s' }} />
        <div className="absolute top-1/3 right-0 w-80 h-80 bg-rose-500/8 rounded-full blur-3xl animate-pulse" 
             style={{ animationDuration: '14s', animationDelay: '1s' }} />
        
        {/* Subtle Dot Grid Overlay */}
        <div className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: `radial-gradient(circle, rgba(0,240,255,0.3) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
            maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 80%)'
          }}
        />
        
        {/* Noise Texture for Premium Feel */}
        <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <header className="w-full px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between z-20 border-b border-cyber-primary/20 backdrop-blur-xl sticky top-0 bg-gradient-to-r from-[#0a0a0f]/95 via-[#0f1520]/95 to-[#0a0a0f]/95 shadow-[0_4px_20px_rgba(0,240,255,0.05)]">
        {/* Logo - Left */}
        <Link
          to="/"
          className="flex items-center cursor-pointer group flex-shrink-0"
        >
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-white">
            RAF<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyber-primary to-purple-400">TOOLS</span>
          </h1>
        </Link>

        {/* Desktop Navigation - Center (hidden on mobile) */}
        <nav className="hidden md:flex flex-1 justify-center gap-1 lg:gap-2">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-2 px-2 lg:px-3 py-2 rounded-xl transition-all duration-300 text-xs sm:text-sm font-medium border
                ${item.isActive
                  ? 'bg-gradient-to-r from-cyber-primary/20 to-cyber-primary/10 text-cyber-primary border-cyber-primary/30 shadow-[0_0_15px_rgba(0,240,255,0.2)]'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border-transparent hover:border-white/10'}`}
            >
              <item.icon className="w-4 h-4" />
              <span className="hidden lg:inline">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Right Side - Auth + Mobile Menu Toggle */}
        <div className="flex items-center gap-2">
          {/* Recover Button (hidden on mobile) */}
          <Link
            to="/tempmail/recover"
            className="hidden sm:flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-all duration-300 text-xs sm:text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden lg:inline">Recover Email</span>
          </Link>
          
          {/* Sign In / Dashboard */}
          {isLoggedIn ? (
            <Link
              to="/dashboard"
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-cyber-primary text-black font-medium rounded-lg hover:bg-[#4df4ff] transition-all duration-300 hover:shadow-[0_0_15px_rgba(0,240,255,0.4)] text-xs sm:text-sm"
            >
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-cyber-primary text-black font-medium rounded-lg hover:bg-[#4df4ff] transition-all duration-300 hover:shadow-[0_0_15px_rgba(0,240,255,0.4)] text-xs sm:text-sm"
            >
              <LogIn className="w-4 h-4" />
              <span className="hidden sm:inline">Sign In</span>
            </Link>
          )}

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed top-[60px] left-0 right-0 z-30 bg-[#0a0a0f]/98 backdrop-blur-xl border-b border-cyber-primary/20 animate-fade-in-up">
          <nav className="flex flex-col p-4 gap-2">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 text-sm font-medium border
                  ${item.isActive
                    ? 'bg-gradient-to-r from-cyber-primary/20 to-cyber-primary/10 text-cyber-primary border-cyber-primary/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/5 border-transparent hover:border-white/10'}`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            ))}
            
            {/* Recover in mobile menu */}
            <Link
              to="/tempmail/recover"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10"
            >
              <RotateCcw className="w-5 h-5" />
              Recover Email
            </Link>
          </nav>
        </div>
      )}

      {children}

      <footer className="w-full p-4 sm:p-6 text-center text-gray-500 text-xs z-20 border-t border-white/5">
        <div className="flex justify-center items-center gap-4 sm:gap-6 mb-2">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5" />
            <span>Cloudflare Secured</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>System Online</span>
          </div>
        </div>
        <p className="text-gray-600">RafTools v5.0.0 by Leraie</p>
      </footer>
    </div>
  );
};