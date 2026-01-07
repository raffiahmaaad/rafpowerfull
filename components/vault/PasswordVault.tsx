import React, { useState, useEffect } from "react";
import {
  Lock,
  Unlock,
  Plus,
  Search,
  Eye,
  EyeOff,
  Copy,
  Edit2,
  Trash2,
  Globe,
  Key,
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  X,
  Check,
  Clock,
  Star,
  StarOff,
  Settings,
} from "lucide-react";
import { useVault } from "../../context/VaultContext";
import {
  generateStrongPassword,
  calculatePasswordStrength,
  type VaultEntry,
} from "../../lib/vault-crypto";
import toast from "react-hot-toast";

// Password Strength Indicator
const PasswordStrengthMeter: React.FC<{ password: string }> = ({
  password,
}) => {
  const { score, label, suggestions } = calculatePasswordStrength(password);

  const getColor = () => {
    if (score < 20) return "bg-red-500";
    if (score < 40) return "bg-orange-500";
    if (score < 60) return "bg-yellow-500";
    if (score < 80) return "bg-green-500";
    return "bg-emerald-500";
  };

  return (
    <div className="mt-2">
      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${getColor()}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span
          className={`text-xs ${
            score < 40
              ? "text-red-400"
              : score < 60
              ? "text-yellow-400"
              : "text-green-400"
          }`}
        >
          {label}
        </span>
        <span className="text-xs text-gray-500">{score}%</span>
      </div>
      {suggestions.length > 0 && score < 80 && (
        <p className="text-xs text-gray-500 mt-1">{suggestions[0]}</p>
      )}
    </div>
  );
};

// Secondary Password Verification Modal with Rate Limiting
const SecondaryPasswordModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  description?: string;
}> = ({
  isOpen,
  onClose,
  onSuccess,
  title = "Verify Secondary Password",
  description = "Enter your secondary password to proceed",
}) => {
  const { verifySecondaryPassword } = useVault();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Rate limiting state
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutUntil) {
      const interval = setInterval(() => {
        const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
        if (remaining <= 0) {
          setLockoutUntil(null);
          setLockoutRemaining(0);
          setFailedAttempts(0);
        } else {
          setLockoutRemaining(remaining);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [lockoutUntil]);

  const handleVerify = async () => {
    // Check if locked out
    if (lockoutUntil && Date.now() < lockoutUntil) {
      setError(`Too many attempts. Wait ${lockoutRemaining}s`);
      return;
    }

    if (!password) {
      setError("Please enter your secondary password");
      return;
    }

    setLoading(true);
    setError("");

    const isValid = await verifySecondaryPassword(password);
    setLoading(false);

    if (isValid) {
      setPassword("");
      setFailedAttempts(0);
      onSuccess();
      onClose();
    } else {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);

      if (newAttempts >= 3) {
        // Lock out for 30 seconds
        setLockoutUntil(Date.now() + 30000);
        setLockoutRemaining(30);
        setError("Too many failed attempts. Locked for 30 seconds.");
      } else {
        setError(`Incorrect password. ${3 - newAttempts} attempts remaining.`);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-cyber-panel border border-white/10 rounded-xl p-6 max-w-sm w-full">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">{title}</h3>
            <p className="text-xs text-gray-400">{description}</p>
          </div>
        </div>

        <input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError("");
          }}
          placeholder="Enter secondary password"
          className="w-full bg-cyber-dark border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-amber-500 outline-none mb-3"
          onKeyDown={(e) => e.key === "Enter" && handleVerify()}
          autoFocus
        />

        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-white/10 rounded-lg text-gray-400 hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleVerify}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 rounded-lg text-black font-medium transition-colors disabled:opacity-50"
          >
            {loading ? "Verifying..." : "Verify"}
          </button>
        </div>
      </div>
    </div>
  );
};

// Setup Secondary Password Modal
const SetupSecondaryPasswordModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const { setupSecondaryPassword } = useVault();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Strong password validation (same as main password)
  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 10) return "Must be at least 10 characters";
    if (pwd.length > 128) return "Must be 128 characters or less";
    if (!/[A-Z]/.test(pwd)) return "Must contain uppercase letter";
    if (!/[a-z]/.test(pwd)) return "Must contain lowercase letter";
    if (!/[0-9]/.test(pwd)) return "Must contain a number";
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(pwd))
      return "Must contain special character";
    return null;
  };

  const handleSetup = async () => {
    const validationError = validatePassword(password);
    if (validationError) {
      toast.error(`Secondary password: ${validationError}`);
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    const success = await setupSecondaryPassword(password);
    setLoading(false);

    if (success) {
      toast.success("Secondary password created!");
      setPassword("");
      setConfirmPassword("");
      onClose();
    } else {
      toast.error("Failed to create secondary password");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-cyber-panel border border-white/10 rounded-xl p-6 max-w-sm w-full">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">
              Setup Secondary Password
            </h3>
            <p className="text-xs text-gray-400">
              Extra security for sensitive actions
            </p>
          </div>
        </div>

        <p className="text-sm text-gray-400 mb-4">
          This password will be required when viewing, copying, or editing
          passwords.
        </p>

        <div className="space-y-3 mb-4">
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Secondary password (min 6 chars)"
              className="w-full bg-cyber-dark border border-white/10 rounded-lg px-4 py-3 pr-10 text-white placeholder-gray-500 focus:border-emerald-500 outline-none"
            />
            <button
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          <input
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm secondary password"
            className="w-full bg-cyber-dark border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-emerald-500 outline-none"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-white/10 rounded-lg text-gray-400 hover:bg-white/5 transition-colors"
          >
            Skip for Now
          </button>
          <button
            onClick={handleSetup}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-black font-medium transition-colors disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
};

// Vault Settings Modal - Change Master Password & Secondary Password
const VaultSettingsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const {
    changeMasterPassword,
    changeSecondaryPassword,
    hasSecondaryPassword,
  } = useVault();
  const [activeTab, setActiveTab] = useState<"master" | "secondary">("master");

  // Master Password State
  const [currentMaster, setCurrentMaster] = useState("");
  const [newMaster, setNewMaster] = useState("");
  const [confirmMaster, setConfirmMaster] = useState("");

  // Secondary Password State
  const [currentSecondary, setCurrentSecondary] = useState("");
  const [newSecondary, setNewSecondary] = useState("");
  const [confirmSecondary, setConfirmSecondary] = useState("");

  const [loading, setLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  // Validate password complexity
  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 10) return "Must be at least 10 characters";
    if (pwd.length > 128) return "Must be 128 characters or less";
    if (!/[A-Z]/.test(pwd)) return "Must contain uppercase letter";
    if (!/[a-z]/.test(pwd)) return "Must contain lowercase letter";
    if (!/[0-9]/.test(pwd)) return "Must contain a number";
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(pwd))
      return "Must contain special character";
    return null;
  };

  const handleChangeMaster = async () => {
    const error = validatePassword(newMaster);
    if (error) {
      toast.error(`New password: ${error}`);
      return;
    }
    if (newMaster !== confirmMaster) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    const success = await changeMasterPassword(currentMaster, newMaster);
    setLoading(false);

    if (success) {
      toast.success("Master password changed successfully!");
      setCurrentMaster("");
      setNewMaster("");
      setConfirmMaster("");
      onClose();
    } else {
      toast.error("Failed to change master password. Check current password.");
    }
  };

  const handleChangeSecondary = async () => {
    const error = validatePassword(newSecondary);
    if (error) {
      toast.error(`New password: ${error}`);
      return;
    }
    if (newSecondary !== confirmSecondary) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    const success = await changeSecondaryPassword(
      currentSecondary,
      newSecondary
    );
    setLoading(false);

    if (success) {
      toast.success("Secondary password changed successfully!");
      setCurrentSecondary("");
      setNewSecondary("");
      setConfirmSecondary("");
      onClose();
    } else {
      toast.error(
        "Failed to change secondary password. Check current password."
      );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-cyber-panel border border-white/10 rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center">
              <Settings className="w-5 h-5 text-cyan-400" />
            </div>
            <h3 className="font-semibold text-white">Vault Settings</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab("master")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "master"
                ? "bg-cyan-500 text-black"
                : "bg-white/5 text-gray-400 hover:bg-white/10"
            }`}
          >
            Master Password
          </button>
          <button
            onClick={() => setActiveTab("secondary")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "secondary"
                ? "bg-amber-500 text-black"
                : "bg-white/5 text-gray-400 hover:bg-white/10"
            }`}
          >
            Secondary Password
          </button>
        </div>

        {/* Toggle show passwords */}
        <label className="flex items-center gap-2 text-sm text-gray-400 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={showPasswords}
            onChange={(e) => setShowPasswords(e.target.checked)}
            className="w-4 h-4 rounded"
          />
          Show passwords
        </label>

        {activeTab === "master" && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Current Master Password
              </label>
              <input
                type={showPasswords ? "text" : "password"}
                value={currentMaster}
                onChange={(e) => setCurrentMaster(e.target.value)}
                placeholder="Enter current password"
                className="w-full bg-cyber-dark border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-cyan-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                New Master Password
              </label>
              <input
                type={showPasswords ? "text" : "password"}
                value={newMaster}
                onChange={(e) => setNewMaster(e.target.value)}
                placeholder="10+ chars, mixed case, number, symbol"
                className="w-full bg-cyber-dark border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-cyan-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Confirm New Password
              </label>
              <input
                type={showPasswords ? "text" : "password"}
                value={confirmMaster}
                onChange={(e) => setConfirmMaster(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full bg-cyber-dark border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-cyan-500 outline-none"
              />
            </div>
            <button
              onClick={handleChangeMaster}
              disabled={
                loading || !currentMaster || !newMaster || !confirmMaster
              }
              className="w-full py-3 bg-cyan-500 hover:bg-cyan-600 rounded-lg text-black font-medium transition-colors disabled:opacity-50 mt-4"
            >
              {loading ? "Changing..." : "Change Master Password"}
            </button>
          </div>
        )}

        {activeTab === "secondary" && (
          <div className="space-y-3">
            {!hasSecondaryPassword ? (
              <div className="text-center py-8">
                <ShieldAlert className="w-12 h-12 text-amber-400 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">
                  No secondary password set. Setup one first from the vault main
                  screen.
                </p>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Current Secondary Password
                  </label>
                  <input
                    type={showPasswords ? "text" : "password"}
                    value={currentSecondary}
                    onChange={(e) => setCurrentSecondary(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full bg-cyber-dark border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    New Secondary Password
                  </label>
                  <input
                    type={showPasswords ? "text" : "password"}
                    value={newSecondary}
                    onChange={(e) => setNewSecondary(e.target.value)}
                    placeholder="10+ chars, mixed case, number, symbol"
                    className="w-full bg-cyber-dark border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type={showPasswords ? "text" : "password"}
                    value={confirmSecondary}
                    onChange={(e) => setConfirmSecondary(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full bg-cyber-dark border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-amber-500 outline-none"
                  />
                </div>
                <button
                  onClick={handleChangeSecondary}
                  disabled={
                    loading ||
                    !currentSecondary ||
                    !newSecondary ||
                    !confirmSecondary
                  }
                  className="w-full py-3 bg-amber-500 hover:bg-amber-600 rounded-lg text-black font-medium transition-colors disabled:opacity-50 mt-4"
                >
                  {loading ? "Changing..." : "Change Secondary Password"}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Setup Vault Component
const VaultSetup: React.FC = () => {
  const { setupVault } = useVault();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const handleSetup = async () => {
    if (password.length < 12) {
      toast.error("Master password must be at least 12 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (!acknowledged) {
      toast.error("Please acknowledge that you understand the warning");
      return;
    }

    setLoading(true);
    const success = await setupVault(password);
    setLoading(false);

    if (success) {
      toast.success("Vault created successfully!");
    } else {
      toast.error("Failed to create vault");
    }
  };

  const strength = calculatePasswordStrength(password);

  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Shield className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">
          Create Your Vault
        </h2>
        <p className="text-gray-400">
          Set up a master password to protect your passwords
        </p>
      </div>

      <div className="bg-cyber-dark/50 border border-white/10 rounded-xl p-6 space-y-4">
        {/* Master Password */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Master Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter a strong master password"
              className="w-full bg-cyber-dark border border-white/10 rounded-lg px-4 py-3 pr-12 text-white placeholder-gray-500 focus:border-cyber-primary outline-none"
            />
            <button
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
          <PasswordStrengthMeter password={password} />
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Confirm Password
          </label>
          <input
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter your master password"
            className="w-full bg-cyber-dark border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-cyber-primary outline-none"
          />
          {confirmPassword && password !== confirmPassword && (
            <p className="text-red-400 text-xs mt-1">Passwords do not match</p>
          )}
        </div>

        {/* Warning */}
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-red-400 font-medium text-sm mb-1">
                IMPORTANT
              </h4>
              <p className="text-red-300/80 text-xs">
                If you forget your master password, your data CANNOT be
                recovered. We use zero-knowledge encryption - only you can
                decrypt your passwords.
              </p>
              <label className="flex items-center gap-2 mt-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="w-4 h-4 rounded border-red-500/50 bg-transparent checked:bg-red-500"
                />
                <span className="text-xs text-red-300">
                  I understand and accept this risk
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Create Button */}
        <button
          onClick={handleSetup}
          disabled={
            loading ||
            password.length < 12 ||
            password !== confirmPassword ||
            !acknowledged ||
            strength.score < 40
          }
          className="w-full py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Shield className="w-5 h-5" />
              Create Secure Vault
            </>
          )}
        </button>
      </div>
    </div>
  );
};

// Unlock Vault Component
const VaultUnlock: React.FC = () => {
  const { unlockVault, error } = useVault();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleUnlock = async () => {
    if (!password) return;

    setLoading(true);
    const success = await unlockVault(password);
    setLoading(false);

    if (!success) {
      toast.error("Invalid master password");
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Lock className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Unlock Vault</h2>
        <p className="text-gray-400">
          Enter your master password to access your passwords
        </p>
      </div>

      <div className="bg-cyber-dark/50 border border-white/10 rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Master Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
              placeholder="Enter your master password"
              className="w-full bg-cyber-dark border border-white/10 rounded-lg px-4 py-3 pr-12 text-white placeholder-gray-500 focus:border-cyber-primary outline-none"
              autoFocus
            />
            <button
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
          {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
        </div>

        <button
          onClick={handleUnlock}
          disabled={loading || !password}
          className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Unlock className="w-5 h-5" />
              Unlock Vault
            </>
          )}
        </button>
      </div>
    </div>
  );
};

// Password Entry Form (Add/Edit)
const EntryForm: React.FC<{
  entry?: VaultEntry;
  onSave: (entry: Omit<VaultEntry, "id" | "createdAt" | "updatedAt">) => void;
  onCancel: () => void;
}> = ({ entry, onSave, onCancel }) => {
  const [name, setName] = useState(entry?.name || "");
  const [username, setUsername] = useState(entry?.username || "");
  const [password, setPassword] = useState(entry?.password || "");
  const [url, setUrl] = useState(entry?.url || "");
  const [notes, setNotes] = useState(entry?.notes || "");
  const [showPassword, setShowPassword] = useState(false);

  const handleGeneratePassword = () => {
    const newPassword = generateStrongPassword(20, {
      uppercase: true,
      lowercase: true,
      numbers: true,
      symbols: true,
    });
    setPassword(newPassword);
    setShowPassword(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !password) {
      toast.error("Name and password are required");
      return;
    }

    onSave({
      type: "login",
      name,
      username,
      password,
      url,
      notes,
      favorite: entry?.favorite,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Name *
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Google Account"
          className="w-full bg-cyber-dark border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-cyber-primary outline-none"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Username / Email
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="username@example.com"
          className="w-full bg-cyber-dark border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-cyber-primary outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Password *
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full bg-cyber-dark border border-white/10 rounded-lg px-4 py-2.5 pr-12 text-white placeholder-gray-500 focus:border-cyber-primary outline-none"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          <button
            type="button"
            onClick={handleGeneratePassword}
            className="px-3 py-2.5 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors"
            title="Generate strong password"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <PasswordStrengthMeter password={password} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Website URL
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          className="w-full bg-cyber-dark border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-cyber-primary outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional notes (encrypted)"
          rows={3}
          className="w-full bg-cyber-dark border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-cyber-primary outline-none resize-none"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          <Check className="w-4 h-4" />
          {entry ? "Update" : "Save"}
        </button>
      </div>
    </form>
  );
};

// Password Entry Card
const EntryCard: React.FC<{
  entry: VaultEntry;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  onRequireSecondaryPassword?: (action: () => void) => void;
  hasSecondaryPassword?: boolean;
}> = ({
  entry,
  onEdit,
  onDelete,
  onToggleFavorite,
  onRequireSecondaryPassword,
  hasSecondaryPassword,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState<"username" | "password" | null>(null);

  // Wrap action with secondary password if enabled
  const protectedAction = (action: () => void) => {
    if (hasSecondaryPassword && onRequireSecondaryPassword) {
      onRequireSecondaryPassword(action);
    } else {
      action();
    }
  };

  const handleShowPassword = () => {
    protectedAction(() => setShowPassword(!showPassword));
  };

  const handleCopyPassword = () => {
    protectedAction(async () => {
      if (!entry.password) return;
      await navigator.clipboard.writeText(entry.password);
      setCopied("password");
      toast.success("Password copied!");
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const handleEdit = () => {
    protectedAction(onEdit);
  };

  const handleCopyUsername = async () => {
    if (!entry.username) return;
    await navigator.clipboard.writeText(entry.username);
    setCopied("username");
    toast.success("Username copied!");
    setTimeout(() => setCopied(null), 2000);
  };

  const getFaviconUrl = (url?: string) => {
    if (!url) return null;
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    } catch {
      return null;
    }
  };

  const favicon = getFaviconUrl(entry.url);

  return (
    <div className="bg-cyber-dark/50 border border-white/10 rounded-xl p-4 hover:border-cyan-500/30 transition-colors group">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="w-10 h-10 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
          {favicon ? (
            <img src={favicon} alt="" className="w-5 h-5" />
          ) : (
            <Globe className="w-5 h-5 text-cyan-400" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-white truncate">{entry.name}</h3>
            <button
              onClick={onToggleFavorite}
              className="text-gray-500 hover:text-yellow-400 transition-colors"
            >
              {entry.favorite ? (
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              ) : (
                <StarOff className="w-4 h-4" />
              )}
            </button>
          </div>

          {entry.username && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-gray-400 truncate">
                {entry.username}
              </span>
              <button
                onClick={handleCopyUsername}
                className="text-gray-500 hover:text-cyan-400 transition-colors"
              >
                {copied === "username" ? (
                  <Check className="w-3.5 h-3.5 text-green-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          )}

          {/* Password */}
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 font-mono text-sm bg-black/30 rounded px-2 py-1 flex items-center gap-2">
              <Key className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-gray-300">
                {showPassword ? entry.password : "••••••••••••"}
              </span>
            </div>
            <button
              onClick={handleShowPassword}
              className="text-gray-500 hover:text-white transition-colors"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={handleCopyPassword}
              className="text-gray-500 hover:text-cyan-400 transition-colors"
            >
              {copied === "password" ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleEdit}
            className="p-1.5 text-gray-500 hover:text-cyan-400 hover:bg-cyan-500/10 rounded transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Main Vault Content Component
const VaultContent: React.FC = () => {
  const {
    vaultData,
    lockVault,
    addEntry,
    updateEntry,
    deleteEntry,
    autoLockRemaining,
    resetActivity,
    hasSecondaryPassword,
  } = useVault();
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<VaultEntry | null>(null);

  // Secondary password modal state
  const [showSecondaryModal, setShowSecondaryModal] = useState(false);
  const [showSetupSecondaryModal, setShowSetupSecondaryModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // 1-minute session window after successful verification
  const [secondarySessionUntil, setSecondarySessionUntil] = useState<
    number | null
  >(null);
  const [sessionRemaining, setSessionRemaining] = useState(0);

  // Session countdown timer
  useEffect(() => {
    if (secondarySessionUntil) {
      const interval = setInterval(() => {
        const remaining = Math.ceil(
          (secondarySessionUntil - Date.now()) / 1000
        );
        if (remaining <= 0) {
          setSecondarySessionUntil(null);
          setSessionRemaining(0);
        } else {
          setSessionRemaining(remaining);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [secondarySessionUntil]);

  // Show setup prompt if no secondary password is set
  useEffect(() => {
    if (vaultData && !hasSecondaryPassword) {
      // Delay to not interrupt initial render
      const timer = setTimeout(() => {
        setShowSetupSecondaryModal(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [vaultData, hasSecondaryPassword]);

  // Handler to request secondary password before action
  const handleRequireSecondaryPassword = (action: () => void) => {
    // Check if within session window (1 minute after last verification)
    if (secondarySessionUntil && Date.now() < secondarySessionUntil) {
      // Session active - execute action directly
      action();
      return;
    }

    // Session expired or not started - require verification
    setPendingAction(() => action);
    setShowSecondaryModal(true);
  };

  // When secondary password verified
  const handleSecondaryPasswordSuccess = () => {
    // Start 1-minute session window
    setSecondarySessionUntil(Date.now() + 60000);
    setSessionRemaining(60);

    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  // Reset activity on any interaction
  useEffect(() => {
    const handleActivity = () => resetActivity();
    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keydown", handleActivity);
    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
    };
  }, [resetActivity]);

  const filteredEntries =
    vaultData?.entries.filter(
      (e) =>
        e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.url?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.notes?.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

  // Sort: favorites first, then by name
  const sortedEntries = [...filteredEntries].sort((a, b) => {
    if (a.favorite && !b.favorite) return -1;
    if (!a.favorite && b.favorite) return 1;
    return a.name.localeCompare(b.name);
  });

  const handleSave = async (
    entryData: Omit<VaultEntry, "id" | "createdAt" | "updatedAt">
  ) => {
    let success: boolean;
    if (editingEntry) {
      success = await updateEntry(editingEntry.id, entryData);
    } else {
      success = await addEntry(entryData);
    }

    if (success) {
      toast.success(editingEntry ? "Password updated!" : "Password saved!");
      setShowForm(false);
      setEditingEntry(null);
    } else {
      toast.error("Failed to save password");
    }
  };

  const handleDelete = async (entry: VaultEntry) => {
    if (!confirm(`Delete "${entry.name}"? This cannot be undone.`)) return;

    const success = await deleteEntry(entry.id);
    if (success) {
      toast.success("Password deleted");
    } else {
      toast.error("Failed to delete");
    }
  };

  const handleToggleFavorite = async (entry: VaultEntry) => {
    await updateEntry(entry.id, { favorite: !entry.favorite });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Password Vault</h2>
            <p className="text-xs text-gray-500">
              {vaultData?.entries.length || 0} passwords stored
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Auto-lock timer */}
          {autoLockRemaining && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Clock className="w-3.5 h-3.5" />
              <span>
                Locks in {Math.floor(autoLockRemaining / 60)}:
                {(autoLockRemaining % 60).toString().padStart(2, "0")}
              </span>
            </div>
          )}

          <button
            onClick={() => setShowSettingsModal(true)}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-white/10 rounded-lg hover:border-white/20 transition-colors flex items-center gap-1.5"
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>

          <button
            onClick={lockVault}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-white/10 rounded-lg hover:border-white/20 transition-colors flex items-center gap-1.5"
          >
            <Lock className="w-4 h-4" />
            Lock
          </button>

          <button
            onClick={() => {
              setEditingEntry(null);
              setShowForm(true);
            }}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Password
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search passwords..."
          className="w-full bg-cyber-dark border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-gray-500 focus:border-cyber-primary outline-none"
        />
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-cyber-panel border border-white/10 rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                {editingEntry ? "Edit Password" : "Add New Password"}
              </h3>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingEntry(null);
                }}
                className="text-gray-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <EntryForm
              entry={editingEntry || undefined}
              onSave={handleSave}
              onCancel={() => {
                setShowForm(false);
                setEditingEntry(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Password List */}
      {sortedEntries.length === 0 ? (
        <div className="text-center py-12">
          <Key className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">
            {searchQuery ? "No passwords found" : "No passwords yet"}
          </h3>
          <p className="text-gray-500 text-sm">
            {searchQuery
              ? "Try a different search term"
              : 'Click "Add Password" to store your first password securely'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedEntries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              onEdit={() => {
                setEditingEntry(entry);
                setShowForm(true);
              }}
              onDelete={() => handleDelete(entry)}
              onToggleFavorite={() => handleToggleFavorite(entry)}
              hasSecondaryPassword={hasSecondaryPassword}
              onRequireSecondaryPassword={handleRequireSecondaryPassword}
            />
          ))}
        </div>
      )}

      {/* Secondary Password Modals */}
      <SecondaryPasswordModal
        isOpen={showSecondaryModal}
        onClose={() => {
          setShowSecondaryModal(false);
          setPendingAction(null);
        }}
        onSuccess={handleSecondaryPasswordSuccess}
      />
      <SetupSecondaryPasswordModal
        isOpen={showSetupSecondaryModal}
        onClose={() => setShowSetupSecondaryModal(false)}
      />
      <VaultSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </div>
  );
};

// Main Password Vault Component
export const PasswordVault: React.FC = () => {
  const { isLoading, hasVault, isUnlocked } = useVault();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (!hasVault) {
    return <VaultSetup />;
  }

  if (!isUnlocked) {
    return <VaultUnlock />;
  }

  return <VaultContent />;
};

export default PasswordVault;
