import React, { useState, useEffect } from "react";
import { X, Trash2, Plus, Globe, Clock, Settings } from "lucide-react";
import toast from "react-hot-toast";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  savedDomains: string[];
  onUpdateDomains: (domains: string[]) => void;
  currentAddress: string;
  currentRetention: number;
  onRetentionChange?: (seconds: number) => void;
}

const SYSTEM_DOMAINS = ["nexshoes.my.id"];

export const RETENTION_OPTIONS = [
  { label: "30 Minutes", value: 1800 },
  { label: "1 Hour", value: 3600 },
  { label: "24 Hours", value: 86400 },
  { label: "3 Days", value: 259200 },
  { label: "1 Week", value: 604800 },
];

export const SettingsDialog: React.FC<SettingsDialogProps> = ({
  open,
  onOpenChange,
  savedDomains,
  onUpdateDomains,
  currentAddress,
  currentRetention,
  onRetentionChange,
}) => {
  const [activeTab, setActiveTab] = useState<"retention" | "domains">(
    "retention"
  );
  const [newDomain, setNewDomain] = useState("");
  const [retention, setRetention] = useState<number>(currentRetention);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRetention(currentRetention);
  }, [currentRetention]);

  const handleAddDomain = (e: React.FormEvent) => {
    e.preventDefault();
    const domain = newDomain.trim();
    if (
      domain &&
      !savedDomains.includes(domain) &&
      !SYSTEM_DOMAINS.includes(domain)
    ) {
      onUpdateDomains([
        ...savedDomains.filter((d) => !SYSTEM_DOMAINS.includes(d)),
        domain,
      ]);
      setNewDomain("");
      toast.success("Domain added");
    }
  };

  const handleDeleteDomain = (domain: string) => {
    onUpdateDomains(
      savedDomains.filter((d) => d !== domain && !SYSTEM_DOMAINS.includes(d))
    );
    toast.success("Domain removed");
  };

  const handleRetentionSave = async (seconds: number) => {
    setRetention(seconds);
    setSaving(true);
    try {
      await fetch("/api/tempmail/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: currentAddress,
          retentionSeconds: seconds,
        }),
      });
      localStorage.setItem("vaultmail_retention", seconds.toString());
      toast.success("Retention updated");
      if (onRetentionChange) onRetentionChange(seconds);
    } catch (e) {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const customDomains = savedDomains.filter((d) => !SYSTEM_DOMAINS.includes(d));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-lg z-10 animate-fade-in-up">
        <div className="rounded-2xl shadow-2xl border border-cyber-primary/20 bg-cyber-dark flex flex-col max-h-[85vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-cyber-primary/10 bg-cyber-panel/50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-cyber-primary/10 flex items-center justify-center border border-cyber-primary/20">
                <Settings className="h-5 w-5 text-cyber-primary" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Settings</h3>
                <p className="text-xs text-gray-500">
                  Manage preferences & domains
                </p>
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex p-2 gap-2 bg-cyber-black/30 border-b border-cyber-primary/10">
            <button
              onClick={() => setActiveTab("retention")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium rounded-lg transition-all ${
                activeTab === "retention"
                  ? "bg-cyber-primary/10 text-cyber-primary border border-cyber-primary/30"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Clock className="w-4 h-4" />
              Retention
            </button>
            <button
              onClick={() => setActiveTab("domains")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium rounded-lg transition-all ${
                activeTab === "domains"
                  ? "bg-cyber-primary/10 text-cyber-primary border border-cyber-primary/30"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Globe className="w-4 h-4" />
              Domains
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto custom-scrollbar bg-cyber-dark">
            {activeTab === "retention" ? (
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-cyber-primary/10 to-purple-500/10 rounded-xl p-5 border border-cyber-primary/10">
                  <h4 className="text-sm font-semibold text-white mb-2">
                    Inbox Lifespan
                  </h4>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Configure how long emails persist in your inbox. Shorter
                    duration improves privacy.
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-500 ml-1">
                    Duration Selection
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {RETENTION_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => handleRetentionSave(opt.value)}
                        disabled={saving}
                        className={`group relative flex items-center justify-between p-4 rounded-xl border transition-all duration-200 ${
                          retention === opt.value
                            ? "bg-cyber-primary/10 border-cyber-primary/50 text-white"
                            : "bg-white/[0.02] border-white/5 text-gray-400 hover:bg-white/[0.05] hover:border-white/10"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                              retention === opt.value
                                ? "border-cyber-primary"
                                : "border-white/20 group-hover:border-white/40"
                            }`}
                          >
                            {retention === opt.value && (
                              <div className="w-2 h-2 rounded-full bg-cyber-primary" />
                            )}
                          </div>
                          <span className="font-medium">{opt.label}</span>
                        </div>
                        {retention === opt.value && (
                          <span className="text-[10px] font-bold px-2 py-1 rounded bg-cyber-primary/20 text-cyber-primary">
                            ACTIVE
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* System Domains */}
                <div className="space-y-3">
                  <h4 className="text-xs uppercase font-bold text-gray-500 tracking-wider">
                    System Domains
                  </h4>
                  <div className="grid gap-2">
                    {SYSTEM_DOMAINS.map((domain) => (
                      <div
                        key={domain}
                        className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5"
                      >
                        <span className="font-mono text-sm text-gray-300">
                          {domain}
                        </span>
                        <span className="text-xs bg-cyber-primary/10 text-cyber-primary px-2 py-1 rounded">
                          Default
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Custom Domains */}
                <div className="space-y-3">
                  <h4 className="text-xs uppercase font-bold text-gray-500 tracking-wider">
                    Custom Domains
                  </h4>

                  <form onSubmit={handleAddDomain} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter new domain..."
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value)}
                      className="flex-1 px-3 py-2 bg-cyber-black/50 border border-cyber-primary/20 rounded-lg text-sm text-white placeholder-gray-500 outline-none focus:border-cyber-primary/50"
                    />
                    <button
                      type="submit"
                      disabled={!newDomain.trim()}
                      className="p-2 bg-cyber-primary/20 border border-cyber-primary/30 text-cyber-primary rounded-lg hover:bg-cyber-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </form>

                  <div className="grid gap-2">
                    {customDomains.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4 italic">
                        No custom domains added.
                      </p>
                    ) : (
                      customDomains.map((domain) => (
                        <div
                          key={domain}
                          className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5 group hover:bg-white/10 transition-colors"
                        >
                          <span className="font-mono text-sm text-gray-300">
                            {domain}
                          </span>
                          <button
                            onClick={() => handleDeleteDomain(domain)}
                            className="h-8 w-8 flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
