import React from 'react';
import { Clock, LogOut, ArrowRight } from 'lucide-react';

interface InactivityWarningModalProps {
  isOpen: boolean;
  remainingTime: number; // dalam detik
  onStayLoggedIn: () => void;
  onLogoutNow: () => void;
  userType?: 'user' | 'admin';
}

export const InactivityWarningModal: React.FC<InactivityWarningModalProps> = ({
  isOpen,
  remainingTime,
  onStayLoggedIn,
  onLogoutNow,
  userType = 'user'
}) => {
  if (!isOpen) return null;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onStayLoggedIn}
      />
      
      {/* Modal */}
      <div className="relative bg-cyber-panel border border-white/10 rounded-2xl p-6 sm:p-8 max-w-md w-full mx-4 shadow-2xl animate-fade-in-up">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-red-500/10 rounded-full blur-2xl -ml-12 -mb-12 pointer-events-none" />
        
        <div className="relative z-10">
          {/* Icon */}
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
            <Clock className="w-8 h-8 text-amber-400 animate-pulse" />
          </div>
          
          {/* Title */}
          <h2 className="text-xl sm:text-2xl font-bold text-white text-center mb-2">
            Session Timeout Warning
          </h2>
          
          {/* Description */}
          <p className="text-gray-400 text-center mb-6">
            Kamu akan otomatis logout karena tidak ada aktivitas. 
            {userType === 'admin' ? ' Sesi admin' : ' Sesimu'} akan berakhir dalam:
          </p>
          
          {/* Countdown */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-red-500/10 border border-red-500/30 rounded-xl">
              <span className="text-3xl sm:text-4xl font-mono font-bold text-red-400">
                {formatTime(remainingTime)}
              </span>
            </div>
          </div>
          
          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onStayLoggedIn}
              className="flex-1 py-3 px-4 bg-cyber-primary text-black font-bold rounded-xl hover:bg-[#4df4ff] hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-all duration-300 flex items-center justify-center gap-2"
            >
              <ArrowRight className="w-5 h-5" />
              Stay Logged In
            </button>
            
            <button
              onClick={onLogoutNow}
              className="flex-1 py-3 px-4 bg-white/5 border border-white/10 text-gray-300 font-medium rounded-xl hover:bg-white/10 hover:text-white transition-all duration-300 flex items-center justify-center gap-2"
            >
              <LogOut className="w-5 h-5" />
              Logout Now
            </button>
          </div>
          
          {/* Tip */}
          <p className="text-xs text-gray-500 text-center mt-4">
            Gerakkan mouse atau tekan tombol apa saja untuk tetap login
          </p>
        </div>
      </div>
    </div>
  );
};
