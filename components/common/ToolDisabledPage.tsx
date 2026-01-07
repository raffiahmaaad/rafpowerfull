import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldOff, Lock, ArrowLeft, LogIn, Home, Sparkles, Shield, AlertTriangle, ExternalLink } from 'lucide-react';

interface ToolDisabledPageProps {
  reason: 'disabled' | 'login_required';
  toolName?: string;
}

export const ToolDisabledPage: React.FC<ToolDisabledPageProps> = ({ reason, toolName }) => {
  const navigate = useNavigate();
  const isDisabled = reason === 'disabled';

  // Use cyan/blue for login required, red for disabled
  const accentColor = isDisabled ? 'red' : 'cyan';

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-8 sm:py-12 relative overflow-hidden">
      {/* Background - same as other pages */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] sm:w-[900px] sm:h-[900px] rounded-full blur-[120px] sm:blur-[180px] opacity-20 bg-gradient-to-br from-cyan-500 via-blue-600 to-purple-600" />
      </div>

      <div className="relative w-full max-w-md sm:max-w-lg">
        {/* Main Card */}
        <div className="relative bg-[#0d0d14]/90 backdrop-blur-2xl border border-white/[0.08] rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl">
          
          {/* Top gradient accent */}
          <div className={`h-0.5 sm:h-1 w-full ${
            isDisabled 
              ? 'bg-gradient-to-r from-red-600/0 via-red-500 to-red-600/0' 
              : 'bg-gradient-to-r from-cyan-600/0 via-cyan-400 to-cyan-600/0'
          }`} />

          <div className="px-6 py-10 sm:px-12 sm:py-14 text-center">
            {/* Status Badge */}
            <div className="flex justify-center mb-8">
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest ${
                isDisabled 
                  ? 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20' 
                  : 'bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/20'
              }`}>
                {isDisabled ? (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Service Unavailable</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-3.5 h-3.5" />
                    <span>Authentication Required</span>
                  </>
                )}
              </div>
            </div>

            {/* Icon */}
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 mx-auto mb-8">
              {/* Icon glow */}
              <div className={`absolute inset-0 rounded-2xl blur-2xl opacity-40 ${
                isDisabled ? 'bg-red-500' : 'bg-cyan-500'
              }`} />
              {/* Icon container */}
              <div className={`relative w-full h-full rounded-2xl flex items-center justify-center border ${
                isDisabled 
                  ? 'bg-gradient-to-br from-red-500/15 to-red-600/5 border-red-500/25' 
                  : 'bg-gradient-to-br from-cyan-500/15 to-cyan-600/5 border-cyan-500/25'
              }`}>
                {isDisabled ? (
                  <ShieldOff className="w-12 h-12 sm:w-14 sm:h-14 text-red-400" strokeWidth={1.5} />
                ) : (
                  <Lock className="w-12 h-12 sm:w-14 sm:h-14 text-cyan-400" strokeWidth={1.5} />
                )}
              </div>
            </div>

            {/* Error Code */}
            <div className={`text-7xl sm:text-8xl font-black tracking-tighter mb-4 select-none ${
              isDisabled 
                ? 'bg-gradient-to-b from-red-400/50 to-red-900/20 bg-clip-text text-transparent' 
                : 'bg-gradient-to-b from-cyan-400/50 to-cyan-900/20 bg-clip-text text-transparent'
            }`}>
              {isDisabled ? '503' : '401'}
            </div>

            {/* Title */}
            <h1 className={`text-2xl sm:text-3xl font-bold mb-4 ${
              isDisabled ? 'text-red-400' : 'text-cyan-400'
            }`}>
              {isDisabled ? 'Tool Not Available' : 'Login Required'}
            </h1>

            {/* Description */}
            <p className="text-gray-400 text-sm sm:text-base leading-relaxed mb-10 max-w-sm mx-auto">
              {isDisabled ? (
                <>
                  <span className="text-white font-medium">{toolName || 'This tool'}</span> is temporarily disabled by the administrator.
                </>
              ) : (
                <>
                  <span className="text-white font-medium">{toolName || 'This tool'}</span> requires you to sign in to continue.
                </>
              )}
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => navigate(-1)}
                className="group flex items-center justify-center gap-2 px-6 py-3.5 bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 hover:border-white/20 text-white rounded-xl font-medium transition-all duration-200"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                Go Back
              </button>

              {isDisabled ? (
                <Link
                  to="/"
                  className="group flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Home className="w-4 h-4" />
                  Back to Home
                </Link>
              ) : (
                <Link
                  to="/login"
                  className="group flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <LogIn className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  Sign In
                </Link>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 sm:px-12 py-4 bg-black/30 border-t border-white/[0.05]">
            <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
              <span className="font-medium text-gray-400">RafTools</span>
              <span className="text-gray-700">•</span>
              <Link 
                to="/" 
                className="flex items-center gap-1 text-gray-500 hover:text-cyan-400 transition-colors"
              >
                Explore other tools
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToolDisabledPage;
