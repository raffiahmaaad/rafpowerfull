import React from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import {
  FileText,
  Layers,
  Scissors,
  Image,
  FileImage,
  RotateCw,
  Minimize2,
  Droplet,
  Hash,
  Lock,
  Unlock,
  ArrowLeft,
  Zap,
  Shield,
  FileOutput,
  FilePlus,
  Trash2,
  Copy,
  FileCheck,
  FileCode,
  FileType,
} from "lucide-react";
import { MergePDF } from "./MergePDF";
import { SplitPDF } from "./SplitPDF";
import { JPGtoPDF } from "./JPGtoPDF";
import { PDFtoJPG } from "./PDFtoJPG";
import { RotatePDF } from "./RotatePDF";
import { CompressPDF } from "./CompressPDF";
import { WatermarkPDF } from "./WatermarkPDF";
import { PageNumbersPDF } from "./PageNumbersPDF";
import { ProtectPDF } from "./ProtectPDF";
import { UnlockPDF } from "./UnlockPDF";
import { RemovePagesPDF } from "./RemovePagesPDF";
import { ExtractPagesPDF } from "./ExtractPagesPDF";
import { OrganizePDF } from "./OrganizePDF";
import { HTMLtoPDF } from "./HTMLtoPDF";
import { WORDtoPDF } from "./WORDtoPDF";

type ToolType =
  | "merge"
  | "split"
  | "jpgtopdf"
  | "pdftojpg"
  | "rotate"
  | "compress"
  | "watermark"
  | "pagenumbers"
  | "protect"
  | "unlock"
  | "removepages"
  | "extractpages"
  | "organize"
  | "htmltopdf"
  | "wordtopdf";

interface Tool {
  id: ToolType;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  badge?: string;
  badgeColor?: string;
}

const organizeTools: Tool[] = [
  {
    id: "merge",
    name: "Merge PDF",
    description: "Combine multiple PDFs into one file",
    icon: <Layers className="w-6 h-6" />,
    color: "from-red-500 to-rose-600",
  },
  {
    id: "split",
    name: "Split PDF",
    description: "Split PDF into multiple documents",
    icon: <Scissors className="w-6 h-6" />,
    color: "from-orange-500 to-amber-600",
  },
  {
    id: "removepages",
    name: "Remove Pages",
    description: "Delete unwanted pages from PDF",
    icon: <Trash2 className="w-6 h-6" />,
    color: "from-red-600 to-pink-600",
  },
  {
    id: "extractpages",
    name: "Extract Pages",
    description: "Extract specific pages to new PDF",
    icon: <FileOutput className="w-6 h-6" />,
    color: "from-blue-500 to-cyan-600",
  },
  {
    id: "organize",
    name: "Organize PDF",
    description: "Reorder, rotate and delete pages",
    icon: <Copy className="w-6 h-6" />,
    color: "from-violet-500 to-purple-600",
  },
];

const optimizeTools: Tool[] = [
  {
    id: "compress",
    name: "Compress PDF",
    description: "Reduce file size while maintaining quality",
    icon: <Minimize2 className="w-6 h-6" />,
    color: "from-emerald-500 to-teal-600",
    badge: "Popular",
    badgeColor: "bg-emerald-500/20 text-emerald-400",
  },
];

const convertToTools: Tool[] = [
  {
    id: "jpgtopdf",
    name: "JPG to PDF",
    description: "Convert images to PDF document",
    icon: <FilePlus className="w-6 h-6" />,
    color: "from-yellow-500 to-orange-600",
  },
  {
    id: "wordtopdf",
    name: "WORD to PDF",
    description: "Convert text documents to PDF",
    icon: <FileType className="w-6 h-6" />,
    color: "from-blue-600 to-blue-800",
  },
  {
    id: "htmltopdf",
    name: "HTML to PDF",
    description: "Convert HTML content to PDF",
    icon: <FileCode className="w-6 h-6" />,
    color: "from-orange-500 to-red-600",
  },
];

const convertFromTools: Tool[] = [
  {
    id: "pdftojpg",
    name: "PDF to JPG",
    description: "Convert PDF pages to images",
    icon: <FileImage className="w-6 h-6" />,
    color: "from-pink-500 to-rose-600",
  },
];

const editTools: Tool[] = [
  {
    id: "rotate",
    name: "Rotate PDF",
    description: "Rotate PDF pages to any angle",
    icon: <RotateCw className="w-6 h-6" />,
    color: "from-blue-500 to-indigo-600",
  },
  {
    id: "pagenumbers",
    name: "Add Page Numbers",
    description: "Insert page numbers on PDF",
    icon: <Hash className="w-6 h-6" />,
    color: "from-cyan-500 to-blue-600",
  },
  {
    id: "watermark",
    name: "Add Watermark",
    description: "Add text or image watermark",
    icon: <Droplet className="w-6 h-6" />,
    color: "from-purple-500 to-pink-600",
  },
];

const securityTools: Tool[] = [
  {
    id: "unlock",
    name: "Unlock PDF",
    description: "Remove PDF password protection",
    icon: <Unlock className="w-6 h-6" />,
    color: "from-amber-500 to-yellow-600",
  },
  {
    id: "protect",
    name: "Protect PDF",
    description: "Add password protection to PDF",
    icon: <Lock className="w-6 h-6" />,
    color: "from-rose-500 to-red-600",
  },
];

interface PDFToolsProps {
  onBack: () => void;
}

const PDFToolsMenu: React.FC = () => {
  const navigate = useNavigate();

  const ToolCard = ({ tool }: { tool: Tool }) => (
    <button
      key={tool.id}
      onClick={() => navigate(tool.id)}
      className="group relative p-5 rounded-2xl bg-gradient-to-br from-cyber-dark/80 to-cyber-panel/50 
                border border-white/5 backdrop-blur-sm
                hover:border-rose-500/30 transition-all duration-500
                hover:shadow-[0_0_40px_rgba(244,63,94,0.1)]
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
        className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${tool.color} 
                    text-white mb-4 shadow-lg group-hover:shadow-xl
                    group-hover:scale-110 transition-all duration-300`}
      >
        {tool.icon}
      </div>

      {/* Content */}
      <h3 className="text-base font-semibold text-white mb-1 group-hover:text-rose-400 transition-colors duration-300">
        {tool.name}
      </h3>
      <p className="text-gray-500 text-xs leading-relaxed">{tool.description}</p>

      {/* Arrow indicator */}
      <div
        className="absolute right-4 bottom-4 opacity-0 
                    group-hover:opacity-100 group-hover:translate-x-0 -translate-x-2
                    transition-all duration-300"
      >
        <ArrowLeft className="w-4 h-4 text-rose-400 rotate-180" />
      </div>
    </button>
  );

  const ToolSection = ({ title, icon, tools, iconColor }: { 
    title: string; 
    icon: React.ReactNode; 
    tools: Tool[];
    iconColor: string;
  }) => (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <div className={iconColor}>{icon}</div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">{title}</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {tools.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="w-full min-h-screen">
      {/* Hero Section */}
      <div className="text-center pt-8 pb-12 px-4">
        {/* Title Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 border border-rose-500/30 rounded-full bg-rose-500/10 text-rose-400 text-sm font-medium">
          <FileText className="w-4 h-4" />
          <span>PDF Tools</span>
        </div>
        
        {/* Main Heading */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4 leading-tight">
          <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400">
            Professional
          </span>
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-red-400 to-orange-400">
            PDF Editing.
          </span>
        </h1>
        
        {/* Subtitle */}
        <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-4 leading-relaxed">
          All the PDF tools you need in one place.
          <span className="text-white font-medium"> 100% browser-based. </span>
          No uploads, no servers.
        </p>

        {/* Privacy Notice - Inline */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-rose-500/10 border border-rose-500/20 rounded-full text-rose-300 text-sm">
          <span>🔒</span>
          <span>All processing happens locally in your browser</span>
        </div>
      </div>

      {/* Tools Grid */}
      <div className="max-w-5xl mx-auto px-4 pb-12 space-y-8">
        {/* Organize PDF Section */}
        <ToolSection 
          title="Organize PDF" 
          icon={<Layers className="w-4 h-4" />}
          iconColor="text-rose-400"
          tools={organizeTools} 
        />

        {/* Optimize PDF Section */}
        <ToolSection 
          title="Optimize PDF" 
          icon={<Zap className="w-4 h-4" />}
          iconColor="text-emerald-400"
          tools={optimizeTools} 
        />

        {/* Convert to PDF Section */}
        <ToolSection 
          title="Convert to PDF" 
          icon={<FilePlus className="w-4 h-4" />}
          iconColor="text-yellow-400"
          tools={convertToTools} 
        />

        {/* Convert from PDF Section */}
        <ToolSection 
          title="Convert from PDF" 
          icon={<FileImage className="w-4 h-4" />}
          iconColor="text-pink-400"
          tools={convertFromTools} 
        />

        {/* Edit PDF Section */}
        <ToolSection 
          title="Edit PDF" 
          icon={<FileCheck className="w-4 h-4" />}
          iconColor="text-blue-400"
          tools={editTools} 
        />

        {/* PDF Security Section */}
        <ToolSection 
          title="PDF Security" 
          icon={<Shield className="w-4 h-4" />}
          iconColor="text-amber-400"
          tools={securityTools} 
        />
      </div>
    </div>
  );
};

export const PDFTools: React.FC<PDFToolsProps> = () => {
  const navigate = useNavigate();
  const handleBackToMenu = () => navigate("/pdftools");

  return (
    <Routes>
      <Route index element={<PDFToolsMenu />} />
      <Route path="merge" element={<MergePDF onBack={handleBackToMenu} />} />
      <Route path="split" element={<SplitPDF onBack={handleBackToMenu} />} />
      <Route path="jpgtopdf" element={<JPGtoPDF onBack={handleBackToMenu} />} />
      <Route path="pdftojpg" element={<PDFtoJPG onBack={handleBackToMenu} />} />
      <Route path="rotate" element={<RotatePDF onBack={handleBackToMenu} />} />
      <Route path="compress" element={<CompressPDF onBack={handleBackToMenu} />} />
      <Route path="watermark" element={<WatermarkPDF onBack={handleBackToMenu} />} />
      <Route path="pagenumbers" element={<PageNumbersPDF onBack={handleBackToMenu} />} />
      <Route path="protect" element={<ProtectPDF onBack={handleBackToMenu} />} />
      <Route path="unlock" element={<UnlockPDF onBack={handleBackToMenu} />} />
      <Route path="removepages" element={<RemovePagesPDF onBack={handleBackToMenu} />} />
      <Route path="extractpages" element={<ExtractPagesPDF onBack={handleBackToMenu} />} />
      <Route path="organize" element={<OrganizePDF onBack={handleBackToMenu} />} />
      <Route path="htmltopdf" element={<HTMLtoPDF onBack={handleBackToMenu} />} />
      <Route path="wordtopdf" element={<WORDtoPDF onBack={handleBackToMenu} />} />
    </Routes>
  );
};
