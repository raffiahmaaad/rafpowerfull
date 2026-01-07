import React, { useState } from "react";
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  AlertCircle,
  Shield,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Turnstile } from "../tempmail/Turnstile";

interface RegisterPageProps {
  onSwitchToLogin: () => void;
  onSuccess: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({
  onSwitchToLogin,
  onSuccess,
}) => {
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [showTurnstile, setShowTurnstile] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 10) {
      setError(
        "Password must be at least 10 characters with uppercase, lowercase, number, and special character"
      );
      return;
    }

    // If Turnstile not shown yet, show it first
    if (!showTurnstile) {
      setShowTurnstile(true);
      return;
    }

    // If Turnstile shown but not verified yet
    if (!turnstileToken) {
      setError("Please complete the human verification");
      return;
    }

    setLoading(true);
    setError(null);

    const result = await register(
      email,
      password,
      name || undefined,
      turnstileToken
    );
    setLoading(false);

    if (result.success) {
      onSuccess();
    } else {
      setError(result.message || "Registration failed");
      setTurnstileToken(null);
      setShowTurnstile(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 sm:px-0 animate-fade-in-up">
      {/* Header */}
      <div className="text-center mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
          Create Account
        </h1>
        <p className="text-sm sm:text-base text-gray-400">
          Join GhostMail to manage your temp emails
        </p>
      </div>

      {/* Form */}
      <div className="bg-cyber-panel border border-white/10 rounded-xl sm:rounded-2xl p-5 sm:p-8 shadow-2xl">
        <form onSubmit={handleSubmit}>
          {/* Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Name (optional)
            </label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-cyber-dark border border-white/10 focus:border-cyber-primary rounded-xl pl-12 pr-4 py-3 text-white outline-none transition-colors"
                placeholder="Your name"
              />
            </div>
          </div>

          {/* Email */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-cyber-dark border border-white/10 focus:border-cyber-primary rounded-xl pl-12 pr-4 py-3 text-white outline-none transition-colors"
                placeholder="your@email.com"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-cyber-dark border border-white/10 focus:border-cyber-primary rounded-xl pl-12 pr-4 py-3 text-white outline-none transition-colors"
                placeholder="Min 10 chars, mixed case + number + symbol"
                required
              />
            </div>
          </div>

          {/* Turnstile Human Verification - Only show after first submit attempt */}
          {showTurnstile && (
            <div className="mb-4 animate-fade-in">
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                <Shield className="w-3.5 h-3.5" />
                <span>Human Verification</span>
              </div>
              <Turnstile
                onVerify={setTurnstileToken}
                onExpire={() => setTurnstileToken(null)}
                onError={() =>
                  setError("Verification failed. Please try again.")
                }
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-sm text-red-400">{error}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || (showTurnstile && !turnstileToken)}
            className={`w-full py-4 rounded-xl font-bold tracking-wide transition-all duration-300 flex items-center justify-center gap-3
              ${
                loading || (showTurnstile && !turnstileToken)
                  ? "bg-gray-600 cursor-not-allowed text-gray-300"
                  : "bg-cyber-primary hover:bg-[#4df4ff] hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] text-black"
              }`}
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Creating account...
              </>
            ) : (
              <>
                Create Account
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        {/* Login Link */}
        <p className="text-center mt-6 text-gray-500">
          Already have an account?{" "}
          <button
            onClick={onSwitchToLogin}
            className="text-cyber-primary hover:text-white transition-colors"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
};
