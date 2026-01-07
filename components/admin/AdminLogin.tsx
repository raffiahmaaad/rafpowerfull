import React, { useState } from 'react';
import { User, Lock, ArrowRight, AlertCircle, Shield } from 'lucide-react';
import { Turnstile } from '../tempmail/Turnstile';

interface AdminLoginProps {
    onSuccess: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onSuccess }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
    const [showTurnstile, setShowTurnstile] = useState(false);

    const API_URL = import.meta.env.VITE_API_URL || 'https://ghostmail-worker.rafxyz.workers.dev';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Show Turnstile on first submit
        if (!showTurnstile) {
            setShowTurnstile(true);
            return;
        }

        // Check if verified
        if (!turnstileToken) {
            setError('Please complete the human verification');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`${API_URL}/api/admin/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, turnstileToken }),
                credentials: 'include'
            });

            const data = await res.json();
            if (data.success) {
                onSuccess();
            } else {
                setError(data.message || 'Login failed');
                // Reset Turnstile on error
                setTurnstileToken(null);
                setShowTurnstile(false);
            }
        } catch (err) {
            setError('Connection failed. Please check your network.');
            setTurnstileToken(null);
            setShowTurnstile(false);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md mx-auto px-4 sm:px-0 animate-fade-in-up">
            <div className="text-center mb-6 sm:mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Admin Portal</h1>
                <p className="text-sm sm:text-base text-gray-400">Restricted access only</p>
            </div>

            <div className="bg-cyber-panel border border-white/10 rounded-xl sm:rounded-2xl p-5 sm:p-8 shadow-2xl relative overflow-hidden">
                {/* Background decorative elements */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none hidden sm:block"></div>

                <form onSubmit={handleSubmit} className="relative z-10">
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-400 mb-2">Username</label>
                        <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full bg-cyber-dark border border-white/10 focus:border-red-500/50 rounded-xl pl-12 pr-4 py-3 text-white outline-none transition-colors"
                                placeholder="username"
                                required
                            />
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-400 mb-2">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-cyber-dark border border-white/10 focus:border-red-500/50 rounded-xl pl-12 pr-4 py-3 text-white outline-none transition-colors"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    {/* Turnstile Human Verification */}
                    {showTurnstile && (
                        <div className="mb-4 animate-fade-in">
                            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                                <Shield className="w-3.5 h-3.5" />
                                <span>Human Verification Required</span>
                            </div>
                            <Turnstile
                                onVerify={setTurnstileToken}
                                onExpire={() => setTurnstileToken(null)}
                                onError={() => setError('Verification failed. Please try again.')}
                            />
                        </div>
                    )}

                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-red-400" />
                            <span className="text-sm text-red-400">{error}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || (showTurnstile && !turnstileToken)}
                        className={`w-full py-4 rounded-xl font-bold tracking-wide transition-all duration-300 flex items-center justify-center gap-3
              ${loading || (showTurnstile && !turnstileToken)
                                ? 'bg-gray-600 cursor-not-allowed text-gray-300'
                                : 'bg-cyber-primary hover:bg-[#4df4ff] hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] text-black'
                            }`}
                    >
                        {loading ? 'Authenticating...' : (
                            <>
                                Access Panel
                                <ArrowRight className="w-5 h-5" />
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};
