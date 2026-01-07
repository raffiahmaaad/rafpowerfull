import React from "react";
import {
  Routes,
  Route,
  useNavigate,
} from "react-router-dom";
import {
  Image,
  Minimize2,
  Crop,
  RotateCw,
  FileImage,
  ArrowLeft,
  Maximize2,
  Eraser,
  Maximize,
  Sparkles,
  Zap,
} from "lucide-react";
import { CompressImage } from "./CompressImage";
import { ResizeImage } from "./ResizeImage";
import { CropImage } from "./CropImage";
import { ConvertImage } from "./ConvertImage";
import { RotateImage } from "./RotateImage";
import { RemoveBG } from "./RemoveBG";
import { UpscaleImage } from "./UpscaleImage";
import { DocumentScanner } from "./DocumentScanner";

type ToolType = "compress" | "resize" | "crop" | "convert" | "rotate" | "removebg" | "upscale" | "scanner";

interface Tool {
  id: ToolType;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  badge?: string;
  badgeColor?: string;
}

const basicTools: Tool[] = [
  {
    id: "compress",
    name: "Compress",
    description: "Reduce file size while maintaining quality",
    icon: <Minimize2 className="w-6 h-6" />,
    color: "from-emerald-500 to-teal-600",
    badge: "Fast",
    badgeColor: "bg-emerald-500/20 text-emerald-400",
  },
  {
    id: "resize",
    name: "Resize",
    description: "Change image dimensions",
    icon: <Maximize2 className="w-6 h-6" />,
    color: "from-blue-500 to-indigo-600",
  },
  {
    id: "crop",
    name: "Crop",
    description: "Cut and trim your images",
    icon: <Crop className="w-6 h-6" />,
    color: "from-purple-500 to-pink-600",
  },
  {
    id: "convert",
    name: "Convert",
    description: "Convert between JPG, PNG, WebP",
    icon: <FileImage className="w-6 h-6" />,
    color: "from-orange-500 to-red-600",
  },
  {
    id: "rotate",
    name: "Rotate",
    description: "Rotate and flip your images",
    icon: <RotateCw className="w-6 h-6" />,
    color: "from-cyan-500 to-blue-600",
  },
];

const aiTools: Tool[] = [
  {
    id: "removebg",
    name: "Remove Background",
    description: "AI-powered background removal",
    icon: <Eraser className="w-6 h-6" />,
    color: "from-rose-500 to-pink-600",
    badge: "AI",
    badgeColor: "bg-rose-500/20 text-rose-400",
  },
  {
    id: "upscale",
    name: "Upscale Image",
    description: "Enlarge and enhance photos",
    icon: <Maximize className="w-6 h-6" />,
    color: "from-amber-500 to-orange-600",
    badge: "New",
    badgeColor: "bg-amber-500/20 text-amber-400",
  },
  {
    id: "scanner",
    name: "Document Scanner",
    description: "Scan documents with camera",
    icon: <Zap className="w-6 h-6" />,
    color: "from-indigo-500 to-violet-600",
    badge: "New",
    badgeColor: "bg-indigo-500/20 text-indigo-400",
  },
];

interface ImageToolsProps {
  onBack: () => void;
}

const ImageToolsMenu: React.FC = () => {
  const navigate = useNavigate();

  const ToolCard = ({ tool }: { tool: Tool }) => (
    <button
      key={tool.id}
      onClick={() => navigate(tool.id)}
      className="group relative p-4 rounded-xl bg-gradient-to-br from-cyber-dark/80 to-cyber-panel/50 
                border border-white/5 backdrop-blur-sm
                hover:border-cyber-primary/30 transition-all duration-500
                hover:shadow-[0_0_40px_rgba(0,240,255,0.1)]
                hover:scale-[1.02] hover:-translate-y-1
                text-left overflow-hidden"
    >
      {/* Animated gradient background */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${tool.color} opacity-0 
                    group-hover:opacity-[0.08] transition-opacity duration-500`}
      />
      
      {/* Glow effect */}
      <div
        className={`absolute -inset-1 bg-gradient-to-br ${tool.color} opacity-0 
                    group-hover:opacity-20 blur-xl transition-opacity duration-500 -z-10`}
      />

      {/* Badge */}
      {tool.badge && (
        <div className={`absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${tool.badgeColor}`}>
          {tool.badge}
        </div>
      )}

      {/* Icon with gradient background */}
      <div
        className={`inline-flex p-2.5 rounded-lg bg-gradient-to-br ${tool.color} 
                    text-white mb-3 shadow-lg group-hover:shadow-xl
                    group-hover:scale-110 transition-all duration-300`}
      >
        {tool.icon}
      </div>

      {/* Content */}
      <h3 className="text-base font-semibold text-white mb-1 group-hover:text-cyber-primary transition-colors duration-300">
        {tool.name}
      </h3>
      <p className="text-gray-500 text-xs leading-relaxed">{tool.description}</p>

      {/* Arrow indicator */}
      <div
        className="absolute right-4 bottom-4 opacity-0 
                    group-hover:opacity-100 group-hover:translate-x-0 -translate-x-2
                    transition-all duration-300"
      >
        <ArrowLeft className="w-4 h-4 text-cyber-primary rotate-180" />
      </div>
    </button>
  );

  return (
    <div className="w-full min-h-screen">
      {/* Hero Section */}
      <div className="text-center pt-8 pb-12 px-4">
        {/* Title Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 border border-cyan-500/30 rounded-full bg-cyan-500/10 text-cyan-400 text-sm font-medium">
          <Image className="w-4 h-4" />
          <span>Image Tools</span>
        </div>
        
        {/* Main Heading */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4 leading-tight">
          <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400">
            Professional
          </span>
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400">
            Image Editing.
          </span>
        </h1>
        
        {/* Subtitle */}
        <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-4 leading-relaxed">
          Compress, resize, crop, and edit images instantly.
          <span className="text-white font-medium"> Powered by AI. </span>
          Fast and secure.
        </p>

        {/* Security Notice - Inline */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-cyan-300 text-sm">
          <span>🔒</span>
          <span>Most tools work locally. AI tools use secure Cloudflare Workers.</span>
        </div>
      </div>

      {/* Tools Grid */}
      <div className="max-w-5xl mx-auto px-4 pb-12 space-y-10">
        {/* Basic Tools Section */}
        <div>
          <div className="flex items-center gap-2 mb-5">
            <Zap className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Basic Tools</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {basicTools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        </div>

        {/* AI-Powered Tools Section */}
        <div>
          <div className="flex items-center gap-2 mb-5">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">AI-Powered</h2>
            <span className="px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 text-[10px] font-bold uppercase">
              New
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {aiTools.map((tool) => (
              <button
                key={tool.id}
                onClick={() => navigate(tool.id)}
                className="group relative p-6 rounded-2xl bg-gradient-to-br from-cyber-dark/80 to-cyber-panel/50 
                          border border-white/5 backdrop-blur-sm
                          hover:border-violet-500/30 transition-all duration-500
                          hover:shadow-[0_0_50px_rgba(139,92,246,0.15)]
                          text-left overflow-hidden"
              >
                {/* Animated gradient background */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${tool.color} opacity-0 
                              group-hover:opacity-[0.08] transition-opacity duration-500`}
                />
                
                {/* Sparkle decorations */}
                <div className="absolute top-4 right-4 opacity-30 group-hover:opacity-60 transition-opacity">
                  <Sparkles className="w-5 h-5 text-violet-400" />
                </div>
                
                {/* Badge */}
                {tool.badge && (
                  <div className={`absolute top-4 right-12 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${tool.badgeColor}`}>
                    {tool.badge}
                  </div>
                )}

                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div
                    className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${tool.color} 
                                text-white shadow-lg group-hover:shadow-xl
                                group-hover:scale-110 transition-all duration-300`}
                  >
                    {tool.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 pt-1">
                    <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-violet-300 transition-colors duration-300">
                      {tool.name}
                    </h3>
                    <p className="text-gray-500 text-sm">{tool.description}</p>
                  </div>

                  {/* Arrow indicator */}
                  <div
                    className="self-center opacity-0 group-hover:opacity-100 
                                group-hover:translate-x-0 -translate-x-2
                                transition-all duration-300"
                  >
                    <ArrowLeft className="w-5 h-5 text-violet-400 rotate-180" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const ImageTools: React.FC<ImageToolsProps> = () => {
  const navigate = useNavigate();
  const handleBackToMenu = () => navigate("/imagetools");

  return (
    <Routes>
      <Route index element={<ImageToolsMenu />} />
      <Route path="compress" element={<CompressImage onBack={handleBackToMenu} />} />
      <Route path="resize" element={<ResizeImage onBack={handleBackToMenu} />} />
      <Route path="crop" element={<CropImage onBack={handleBackToMenu} />} />
      <Route path="convert" element={<ConvertImage onBack={handleBackToMenu} />} />
      <Route path="rotate" element={<RotateImage onBack={handleBackToMenu} />} />
      <Route path="removebg" element={<RemoveBG onBack={handleBackToMenu} />} />
      <Route path="upscale" element={<UpscaleImage onBack={handleBackToMenu} />} />
      <Route path="scanner" element={<DocumentScanner onBack={handleBackToMenu} />} />
    </Routes>
  );
};
