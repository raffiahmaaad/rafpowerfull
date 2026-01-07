import React, { useState, useEffect, useCallback } from "react";
import {
  Copy,
  Mail,
  RefreshCw,
  Settings,
  History,
  Trash2,
  Clock,
  ChevronDown,
  X,
  Plus,
  Globe,
  ArrowLeft,
} from "lucide-react";
import toast from "react-hot-toast";
import { EmailDetail } from "./EmailDetail";
import { SettingsDialog } from "./SettingsDialog";

// Types
interface Email {
  id: string;
  from: string;
  subject: string;
  text: string;
  html: string;
  receivedAt: string;
  to: string;
}

// Retention options (VaultMail style)
export const RETENTION_OPTIONS = [
  { label: "30 Minutes", value: 1800 },
  { label: "1 Hour", value: 3600 },
  { label: "24 Hours", value: 86400 },
  { label: "3 Days", value: 259200 },
  { label: "1 Week", value: 604800 },
];

// Default domain
const DEFAULT_DOMAIN = "nexshoes.my.id";
const SYSTEM_DOMAINS = ["nexshoes.my.id"];

interface VaultMailInboxProps {
  onBack?: () => void;
}

export const VaultMailInbox: React.FC<VaultMailInboxProps> = ({ onBack }) => {
  const [address, setAddress] = useState<string>("");
  const [domain, setDomain] = useState<string>(DEFAULT_DOMAIN);
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [savedDomains, setSavedDomains] = useState<string[]>(SYSTEM_DOMAINS);
  const [history, setHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [retention, setRetention] = useState<number>(86400);

  // Load saved data from localStorage
  useEffect(() => {
    const savedDoms = localStorage.getItem("vaultmail_domains");
    const savedHist = localStorage.getItem("vaultmail_history");
    const savedRet = localStorage.getItem("vaultmail_retention");
    const savedAddr = localStorage.getItem("vaultmail_address");

    if (savedDoms) {
      setSavedDomains([
        ...new Set([...SYSTEM_DOMAINS, ...JSON.parse(savedDoms)]),
      ]);
    }
    if (savedHist) setHistory(JSON.parse(savedHist));
    if (savedRet) setRetention(parseInt(savedRet));

    if (savedAddr) {
      setAddress(savedAddr);
      const parts = savedAddr.split("@");
      if (parts[1]) setDomain(parts[1]);
    } else {
      generateAddress();
    }
  }, []);

  // Add to history
  const addToHistory = (addr: string) => {
    if (!addr.includes("@")) return;
    setHistory((prev) => {
      if (prev.includes(addr)) {
        return [addr, ...prev.filter((a) => a !== addr)];
      }
      const newHist = [addr, ...prev].slice(0, 10);
      localStorage.setItem("vaultmail_history", JSON.stringify(newHist));
      return newHist;
    });
  };

  // Generate pronounceable random address (VaultMail style)
  const generateAddress = () => {
    const vowels = "aeiou";
    const consonants = "bcdfghjklmnpqrstvwxyz";
    let name = "";
    const length = Math.floor(Math.random() * 5) + 8;

    for (let i = 0; i < length; i++) {
      const isVowel = i % 2 === 1;
      const set = isVowel ? vowels : consonants;
      name += set[Math.floor(Math.random() * set.length)];
    }

    const num = Math.floor(Math.random() * 9000) + 1000;
    const newAddress = `${name}-${num}@${domain}`;

    setAddress(newAddress);
    localStorage.setItem("vaultmail_address", newAddress);
    setEmails([]);
    setSelectedEmail(null);
    toast.success("New email created");
    addToHistory(newAddress);
  };

  // Copy address to clipboard
  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    toast.success("Copied to clipboard");
  };

  // Fetch emails from VaultMail API
  const fetchEmails = useCallback(async () => {
    if (!address) return;
    try {
      setLoading(true);
      const res = await fetch(
        `/api/tempmail/inbox?address=${encodeURIComponent(address)}`
      );
      const data = await res.json();
      if (data.emails) {
        setEmails(data.emails);
      }
    } catch (e) {
      console.error("Failed to fetch emails:", e);
    } finally {
      setLoading(false);
    }
  }, [address]);

  // Initial fetch and auto-refresh
  useEffect(() => {
    fetchEmails();
    const interval = setInterval(fetchEmails, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, [fetchEmails]);

  // Format time
  const formatTime = (timestamp: string) => {
    const now = Date.now();
    const time = new Date(timestamp).getTime();
    const diff = now - time;
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleString();
  };

  // Get clean preview text
  const getPreview = (email: Email) => {
    const text = email.text || "";
    return text.substring(0, 100) + (text.length > 100 ? "..." : "");
  };

  // Handle email delete
  const handleDeleteEmail = (emailId: string) => {
    setEmails((prev) => prev.filter((e) => e.id !== emailId));
    if (selectedEmail?.id === emailId) {
      setSelectedEmail(null);
    }
    toast.success("Email removed");
  };

  return (
    <div className="w-full max-w-6xl mx-auto h-[calc(100vh-120px)] flex flex-col md:flex-row rounded-2xl overflow-hidden border border-cyber-primary/20 shadow-[0_0_60px_rgba(0,240,255,0.05)] bg-cyber-black">
      {/* LEFT PANEL - Controls & Inbox */}
      <div className="w-full md:w-[380px] flex-shrink-0 bg-cyber-panel/80 backdrop-blur-sm flex flex-col border-r border-cyber-primary/10">
        {/* Header */}
        <div className="p-4 border-b border-cyber-primary/10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Mail className="w-5 h-5 text-cyber-primary" />
              VaultMail
            </h2>
            <div className="flex items-center gap-1">
              <span
                className={`h-2 w-2 rounded-full ${
                  loading ? "bg-yellow-400 animate-pulse" : "bg-green-400"
                }`}
              />
              <span className="text-[10px] text-cyber-primary uppercase tracking-wider">
                {loading ? "Syncing" : "Live"}
              </span>
            </div>
          </div>

          {/* Email Address Input */}
          <div className="flex gap-2 mb-3">
            <div className="flex-1 flex items-center bg-cyber-dark/80 rounded-lg border border-cyber-primary/20 px-3 py-2">
              <input
                type="text"
                value={address.split("@")[0]}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^a-zA-Z0-9._-]/g, "");
                  const newAddr = `${val}@${domain}`;
                  setAddress(newAddr);
                  localStorage.setItem("vaultmail_address", newAddr);
                }}
                onBlur={() => addToHistory(address)}
                className="flex-1 bg-transparent text-white text-sm font-mono outline-none"
                placeholder="username"
              />
              <span className="text-gray-500">@</span>
              <select
                value={domain}
                onChange={(e) => {
                  const newDomain = e.target.value;
                  setDomain(newDomain);
                  const currentUser = address.split("@")[0];
                  const newAddr = `${currentUser}@${newDomain}`;
                  setAddress(newAddr);
                  localStorage.setItem("vaultmail_address", newAddr);
                  addToHistory(newAddr);
                }}
                className="bg-transparent text-cyber-primary text-sm font-mono ml-1 outline-none cursor-pointer"
              >
                {savedDomains.map((d) => (
                  <option key={d} value={d} className="bg-cyber-dark">
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={copyAddress}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-cyber-primary/10 border border-cyber-primary/30 text-cyber-primary rounded-lg hover:bg-cyber-primary/20 transition-all text-sm font-medium"
            >
              <Copy className="w-4 h-4" /> Copy
            </button>
            <button
              onClick={generateAddress}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-cyber-dark/80 border border-cyber-primary/20 text-white rounded-lg hover:border-cyber-primary/40 transition-all text-sm font-medium"
            >
              <RefreshCw className="w-4 h-4" /> New
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 bg-cyber-dark/80 border border-cyber-primary/20 text-gray-400 rounded-lg hover:text-cyber-primary hover:border-cyber-primary/40 transition-all"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`relative p-2 bg-cyber-dark/80 border border-cyber-primary/20 text-gray-400 rounded-lg hover:text-cyber-primary hover:border-cyber-primary/40 transition-all ${
                showHistory ? "text-cyber-primary border-cyber-primary/40" : ""
              }`}
              title="History"
            >
              <History className="w-4 h-4" />
              {history.length > 0 && (
                <span className="absolute top-1 right-1 h-2 w-2 bg-cyber-primary rounded-full" />
              )}
            </button>
          </div>

          {/* Retention Info */}
          <div className="mt-3 text-center text-xs text-gray-500">
            Emails auto-delete after{" "}
            <span className="text-cyber-primary font-medium">
              {RETENTION_OPTIONS.find((o) => o.value === retention)?.label ||
                "24 Hours"}
            </span>
          </div>
        </div>

        {/* History Dropdown */}
        {showHistory && (
          <div className="absolute top-full right-0 mt-2 w-80 bg-cyber-dark border border-cyber-primary/20 rounded-xl shadow-2xl z-50">
            <div className="flex justify-between items-center px-4 py-3 border-b border-cyber-primary/10">
              <span className="text-xs font-bold tracking-wider uppercase text-gray-400">
                History
              </span>
              {history.length > 0 && (
                <button
                  onClick={() => {
                    setHistory([]);
                    localStorage.removeItem("vaultmail_history");
                  }}
                  className="text-[10px] uppercase font-bold text-red-400 hover:text-red-300"
                >
                  Clear All
                </button>
              )}
            </div>
            <div className="max-h-60 overflow-y-auto p-2">
              {history.length === 0 ? (
                <div className="p-6 text-center text-gray-500 text-sm">
                  No history
                </div>
              ) : (
                history.map((histAddr) => (
                  <div
                    key={histAddr}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 cursor-pointer group"
                    onClick={() => {
                      setAddress(histAddr);
                      const parts = histAddr.split("@");
                      if (parts[1]) setDomain(parts[1]);
                      localStorage.setItem("vaultmail_address", histAddr);
                      setShowHistory(false);
                    }}
                  >
                    <span className="flex-1 text-sm font-mono text-gray-300 truncate">
                      {histAddr}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const newHist = history.filter((h) => h !== histAddr);
                        setHistory(newHist);
                        localStorage.setItem(
                          "vaultmail_history",
                          JSON.stringify(newHist)
                        );
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Inbox List */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-2 flex items-center justify-between bg-cyber-dark/30 border-b border-cyber-primary/5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Inbox
              </span>
              {emails.length > 0 && (
                <span className="px-2 py-0.5 bg-cyber-primary/20 text-cyber-primary text-[10px] font-medium rounded-full">
                  {emails.length}
                </span>
              )}
            </div>
            <button
              onClick={fetchEmails}
              disabled={loading}
              className="p-1 text-gray-400 hover:text-cyber-primary transition-colors"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>

          {emails.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center justify-center h-full">
              <div className="w-14 h-14 bg-cyber-dark/50 rounded-2xl flex items-center justify-center mb-3 border border-cyber-primary/10">
                <Mail className="w-6 h-6 text-gray-500" />
              </div>
              <p className="text-gray-400 text-sm font-medium">
                Waiting for emails...
              </p>
              <p className="text-gray-600 text-xs mt-1">
                Messages will appear automatically
              </p>
            </div>
          ) : (
            emails.map((email) => (
              <div
                key={email.id}
                onClick={() => setSelectedEmail(email)}
                className={`px-4 py-3 border-b border-cyber-primary/5 cursor-pointer transition-all
                  ${
                    selectedEmail?.id === email.id
                      ? "bg-cyber-primary/10"
                      : "hover:bg-white/[0.02]"
                  }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1.5 w-2 h-2 rounded-full bg-cyber-primary shrink-0 shadow-[0_0_6px_rgba(0,240,255,0.5)]" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <span className="text-sm font-semibold text-white truncate">
                        {email.from}
                      </span>
                      <span className="text-[10px] text-gray-500 shrink-0">
                        {formatTime(email.receivedAt)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-200 truncate mb-1 font-medium">
                      {email.subject || "(No Subject)"}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {getPreview(email)}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT PANEL - Email Detail */}
      <div className="hidden md:flex flex-1 bg-cyber-black/50 backdrop-blur-sm">
        {selectedEmail ? (
          <div className="flex-1 flex flex-col h-full">
            <div className="px-6 py-3 border-b border-cyber-primary/10 bg-cyber-black/30">
              <button
                onClick={() => setSelectedEmail(null)}
                className="flex items-center gap-2 text-gray-400 hover:text-cyber-primary transition-colors text-sm font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Inbox
              </button>
            </div>
            <EmailDetail
              email={{
                id: selectedEmail.id,
                from: selectedEmail.from,
                to: selectedEmail.to || address,
                subject: selectedEmail.subject,
                body: selectedEmail.text,
                html: selectedEmail.html,
                receivedAt: new Date(selectedEmail.receivedAt).getTime(),
              }}
              onClose={() => setSelectedEmail(null)}
              onDelete={handleDeleteEmail}
              isPanel={true}
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <div className="p-4 rounded-full bg-cyber-dark/50 border border-cyber-primary/10 mb-4">
              <Mail className="w-8 h-8 text-gray-500" />
            </div>
            <p className="text-gray-400">Select an email to read</p>
          </div>
        )}
      </div>

      {/* Settings Dialog */}
      {showSettings && (
        <SettingsDialog
          open={showSettings}
          onOpenChange={setShowSettings}
          savedDomains={savedDomains}
          currentAddress={address}
          currentRetention={retention}
          onRetentionChange={(seconds) => {
            setRetention(seconds);
            localStorage.setItem("vaultmail_retention", seconds.toString());
          }}
          onUpdateDomains={(newDomains) => {
            const combined = [...new Set([...SYSTEM_DOMAINS, ...newDomains])];
            setSavedDomains(combined);
            localStorage.setItem(
              "vaultmail_domains",
              JSON.stringify(newDomains)
            );
          }}
        />
      )}
    </div>
  );
};
