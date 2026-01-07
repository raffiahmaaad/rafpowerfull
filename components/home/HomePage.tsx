import React from 'react';
import { Mail, Image, FileText, Link, FileType, Code, Shield, Zap, Globe, CreditCard, Database } from 'lucide-react';
import { ToolCard } from './ToolCard';

interface HomePageProps {
  onNavigate: (view: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const tools = [
    {
      icon: <Mail className="w-7 h-7" />,
      name: 'TempMail',
      description: 'Generate disposable email aliases that forward to your real inbox and self-destruct automatically.',
      status: 'active' as const,
      gradient: '#00f0ff',
      view: 'tempmail',
    },
    {
      icon: <Image className="w-7 h-7" />,
      name: 'Image Tools',
      description: 'Compress, resize, crop, convert, and rotate your images with powerful client-side processing.',
      status: 'active' as const,
      gradient: '#a855f7',
      view: 'imagetools',
    },
    {
      icon: <FileType className="w-7 h-7" />,
      name: 'PDF Tools',
      description: 'Merge, split, compress, and convert PDF files with ease.',
      status: 'active' as const,
      gradient: '#ef4444',
      view: 'pdftools',
    },
    {
      icon: <CreditCard className="w-7 h-7" />,
      name: 'CC Generator',
      description: 'Generate test credit card numbers for development. Includes Luhn validator and BIN checker.',
      status: 'active' as const,
      gradient: '#22c55e',
      view: 'cctools',
    },
    {
      icon: <Database className="w-7 h-7" />,
      name: 'Generators',
      description: 'Generate realistic fake identity data for testing. Supports 44 countries with accurate locale data.',
      status: 'active' as const,
      gradient: '#f59e0b',
      view: 'generators',
    },
    {
      icon: <FileText className="w-7 h-7" />,
      name: 'Text Tools',
      description: 'Word counter, case converter, text formatter, and more text manipulation utilities.',
      status: 'coming-soon' as const,
      gradient: '#f97316',
      view: 'texttools',
    },
    {
      icon: <Link className="w-7 h-7" />,
      name: 'URL Tools',
      description: 'URL shortener, QR code generator, link validator, and URL encoding tools.',
      status: 'coming-soon' as const,
      gradient: '#3b82f6',
      view: 'urltools',
    },
  ];

  return (
    <div className="w-full min-h-screen flex flex-col">
      {/* Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-cyber-primary/10 blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-purple-500/10 blur-3xl animate-pulse delay-1000" />
        </div>
        
        <div className="relative max-w-5xl mx-auto text-center">
          {/* Tagline Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 border border-cyber-primary/30 rounded-full bg-cyber-primary/10 text-cyber-primary text-sm font-medium">
            <Zap className="w-4 h-4" />
            <span>All-in-One Online Toolkit</span>
          </div>
          
          {/* Main Heading */}
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold mb-6 leading-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400">
              Your Ultimate
            </span>
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyber-primary via-purple-400 to-pink-500 drop-shadow-[0_0_30px_rgba(0,240,255,0.3)]">
              Online Toolkit
            </span>
          </h1>
          
          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-8 leading-relaxed">
            All the tools you need in one place. 
            <span className="text-white font-medium"> Privacy-first. </span>
            <span className="text-white font-medium"> Free. </span>
            <span className="text-white font-medium"> No signup required.</span>
          </p>
          
          {/* Stats/Trust indicators */}
          <div className="flex flex-wrap justify-center gap-6 sm:gap-10 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyber-primary" />
              <span>Privacy First</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-purple-400" />
              <span>Cloudflare Powered</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Lightning Fast</span>
            </div>
          </div>
        </div>
      </section>
      
      {/* Tools Grid Section */}
      <section className="flex-grow py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
              Explore Our Tools
            </h2>
            <p className="text-gray-400">
              Powerful utilities at your fingertips
            </p>
          </div>
          
          {/* Tools Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {tools.map((tool, index) => (
              <ToolCard
                key={tool.view}
                icon={tool.icon}
                name={tool.name}
                description={tool.description}
                status={tool.status}
                gradient={tool.gradient}
                onClick={() => tool.status === 'active' && onNavigate(tool.view)}
              />
            ))}
          </div>
        </div>
      </section>
      
      {/* Bottom CTA Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 border-t border-white/5">
        <div className="max-w-3xl mx-auto text-center">
          <h3 className="text-xl sm:text-2xl font-bold text-white mb-4">
            More Tools Coming Soon
          </h3>
          <p className="text-gray-400 mb-6">
            We're constantly adding new tools to make your life easier. 
            Stay tuned for more powerful utilities!
          </p>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => onNavigate('tempmail')}
              className="px-6 py-3 bg-cyber-primary text-black font-medium rounded-xl hover:bg-[#4df4ff] transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,240,255,0.4)]"
            >
              Try TempMail
            </button>
            <button
              onClick={() => onNavigate('imagetools')}
              className="px-6 py-3 bg-white/5 text-white font-medium rounded-xl border border-white/10 hover:bg-white/10 transition-all duration-300"
            >
              Image Tools
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
