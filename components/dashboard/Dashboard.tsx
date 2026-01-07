import React, { useState, useEffect, useMemo } from "react";
import {
  Mail,
  Globe,
  User,
  LogOut,
  Menu,
  X,
  Plus,
  RefreshCw,
  Search,
  ExternalLink,
  Check,
  AlertCircle,
  ArrowRight,
  Trash2,
  Lock,
  Shield,
  Eye,
  EyeOff,
  Copy,
  Edit2,
  Info,
  StickyNote,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { VaultProvider } from "../../context/VaultContext";
import { PasswordVault } from "../vault/PasswordVault";
import toast from "react-hot-toast";

import { AliasData } from "../../types";

interface EmailAddress {
  id: string;
  alias: string;
  domain: string;
  full_email: string;
  recovery_token: string;
  expires_at: number;
  created_at: number;
  note?: string;
}

interface Domain {
  id: string;
  domain: string;
  verified: number;
  destination_email: string;
  created_at: number;
}

interface DashboardProps {
  onLogout: () => void;
  onGenerateEmail: () => void;
  onConnectSession?: (data: AliasData) => void;
}

const API_URL =
  import.meta.env.VITE_API_URL || "https://ghostmail-worker.rafxyz.workers.dev";

export const Dashboard: React.FC<DashboardProps> = ({
  onLogout,
  onGenerateEmail,
  onConnectSession,
}) => {
  const { user, token, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<
    "emails" | "domains" | "profile" | "vault"
  >("emails");
  const [emails, setEmails] = useState<EmailAddress[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState<string>("all");

  // Sorting state
  const [sortBy, setSortBy] = useState<"domain" | "created_at" | "email">(
    "created_at"
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Note saving state (used in modal)
  const [savingNote, setSavingNote] = useState(false);

  const [activeEmail, setActiveEmail] = useState<EmailAddress | null>(null);

  // Domain handling
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [destinationEmail, setDestinationEmail] = useState("");
  const [addingDomain, setAddingDomain] = useState(false);

  // Delete email handling
  const [deletingEmailId, setDeletingEmailId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [emailToDelete, setEmailToDelete] = useState<EmailAddress | null>(null);

  const handleDeleteEmail = async (email: EmailAddress) => {
    if (!token) return;

    setDeletingEmailId(email.id);
    try {
      const res = await fetch(`${API_URL}/api/user/emails/${email.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (data.success) {
        toast.success("Email deleted successfully");
        setEmails(emails.filter((e) => e.id !== email.id));
        setShowDeleteConfirm(false);
        setEmailToDelete(null);
      } else {
        toast.error(data.message || "Failed to delete email");
      }
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Failed to delete email");
    } finally {
      setDeletingEmailId(null);
    }
  };

  const confirmDelete = (email: EmailAddress, e: React.MouseEvent) => {
    e.stopPropagation();
    setEmailToDelete(email);
    setShowDeleteConfirm(true);
  };

  const [editingDomain, setEditingDomain] = useState<Domain | null>(null);
  const [editDestinationEmail, setEditDestinationEmail] = useState("");
  const [showDeleteDomainConfirm, setShowDeleteDomainConfirm] = useState(false);
  const [domainToDelete, setDomainToDelete] = useState<Domain | null>(null);
  const [savingDomain, setSavingDomain] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [regeneratingToken, setRegeneratingToken] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();

      if (data.success) {
        toast.success("Password changed successfully!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(data.message || "Failed to change password");
      }
    } catch (err) {
      console.error("Password change error:", err);
      toast.error("Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleRegenerateToken = async () => {
    if (!token || !activeEmail) return;

    setRegeneratingToken(true);
    try {
      const res = await fetch(
        `${API_URL}/api/user/emails/${activeEmail.id}/regenerate-token`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();

      if (data.success) {
        toast.success("Access token regenerated successfully!");
        // Update the active email with new token
        const newToken = data.recovery_token;
        setActiveEmail({ ...activeEmail, recovery_token: newToken });
        // Update emails list
        setEmails(
          emails.map((e) =>
            e.id === activeEmail.id ? { ...e, recovery_token: newToken } : e
          )
        );
      } else {
        toast.error(data.message || "Failed to regenerate token");
      }
    } catch (err) {
      console.error("Regenerate token error:", err);
      toast.error("Failed to regenerate token");
    } finally {
      setRegeneratingToken(false);
    }
  };

  const handleEditDomain = (domain: Domain) => {
    setEditingDomain(domain);
    setEditDestinationEmail(domain.destination_email || "");
  };

  const handleSaveDomain = async () => {
    if (!token || !editingDomain) return;
    setSavingDomain(true);
    try {
      const res = await fetch(
        `${API_URL}/api/user/domains/${editingDomain.id}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            destinationEmail: editDestinationEmail || null,
          }),
        }
      );
      const data = await res.json();
      if (data.success) {
        toast.success("Domain updated successfully");
        setDomains(
          domains.map((d) =>
            d.id === editingDomain.id
              ? { ...d, destination_email: editDestinationEmail || null }
              : d
          )
        );
        setEditingDomain(null);
      } else {
        toast.error(data.message || "Failed to update domain");
      }
    } catch (err) {
      toast.error("Error updating domain");
    } finally {
      setSavingDomain(false);
    }
  };

  const handleDeleteDomain = async () => {
    if (!token || !domainToDelete) return;
    try {
      const res = await fetch(
        `${API_URL}/api/user/domains/${domainToDelete.id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      if (data.success) {
        toast.success("Domain deleted successfully");
        setDomains(domains.filter((d) => d.id !== domainToDelete.id));
        setShowDeleteDomainConfirm(false);
        setDomainToDelete(null);
      } else {
        toast.error(data.message || "Failed to delete domain");
      }
    } catch (err) {
      toast.error("Error deleting domain");
    }
  };

  const confirmDeleteDomain = (domain: Domain) => {
    setDomainToDelete(domain);
    setShowDeleteDomainConfirm(true);
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);

    try {
      if (activeTab === "emails") {
        const res = await fetch(`${API_URL}/api/user/emails`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) setEmails(data.emails || []);
      } else if (activeTab === "domains") {
        const res = await fetch(`${API_URL}/api/user/domains`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) setDomains(data.domains || []);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  // Verification Modal
  const [verifyingDomain, setVerifyingDomain] = useState<Domain | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleVerifyClick = (domain: Domain) => {
    setVerifyingDomain(domain);
  };

  const handleCheckVerification = async () => {
    if (!verifyingDomain) return;
    setIsVerifying(true);

    try {
      const res = await fetch(
        `${API_URL}/api/user/domains/${verifyingDomain.id}/verify`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();

      if (data.success && data.verified) {
        // Update local state
        setDomains(
          domains.map((d) =>
            d.id === verifyingDomain.id ? { ...d, verified: 1 } : d
          )
        );
        toast.success(
          "Domain verified successfully! You can now receive emails."
        );
        setVerifyingDomain(null);
      } else {
        toast.error(
          data.message || "Verification failed. Records not found yet."
        );
      }
    } catch (error) {
      console.error("Verification error:", error);
      toast.error("Verification check failed. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain) return;

    setAddingDomain(true);
    try {
      const res = await fetch(`${API_URL}/api/user/domains`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          domain: newDomain,
          destinationEmail: destinationEmail || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Domain added successfully");
        const newDomainObj = data.domain;
        setDomains([newDomainObj, ...domains]);
        setShowAddDomain(false);
        setNewDomain("");
        setDestinationEmail("");
        // Automatically open verification modal
        setVerifyingDomain(newDomainObj);
      } else {
        toast.error(data.message || "Failed to add domain");
      }
    } catch (err) {
      toast.error("Error adding domain");
    } finally {
      setAddingDomain(false);
    }
  };

  const handleLogout = () => {
    logout();
    onLogout();
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });
  };

  // Get unique domains for filter dropdown
  const uniqueDomains = useMemo(() => {
    const domains = [...new Set(emails.map((e) => e.domain))];
    return domains.sort();
  }, [emails]);

  const filteredEmails = emails.filter((e) => {
    const matchesSearch = e.full_email
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesDomain = domainFilter === "all" || e.domain === domainFilter;
    return matchesSearch && matchesDomain;
  });

  // Sorted emails based on current sort settings
  const sortedEmails = useMemo(() => {
    return [...filteredEmails].sort((a, b) => {
      let comparison = 0;
      if (sortBy === "domain") {
        comparison = a.domain.localeCompare(b.domain);
      } else if (sortBy === "email") {
        comparison = a.full_email.localeCompare(b.full_email);
      } else {
        comparison = a.created_at - b.created_at;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [filteredEmails, sortBy, sortOrder]);

  // Toggle sort function
  const toggleSort = (column: "domain" | "created_at" | "email") => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  // Get sort icon for column
  const getSortIcon = (column: "domain" | "created_at" | "email") => {
    if (sortBy !== column)
      return <ChevronsUpDown className="w-3 h-3 ml-1 opacity-50" />;
    return sortOrder === "asc" ? (
      <ChevronUp className="w-3 h-3 ml-1" />
    ) : (
      <ChevronDown className="w-3 h-3 ml-1" />
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  return (
    <div className="flex min-h-screen bg-cyber-black">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* DNS Verification Modal */}
      {verifyingDomain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl bg-cyber-panel border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-white/10 flex items-center justify-between shrink-0">
              <h3 className="text-xl font-semibold text-white">
                Verify Domain: {verifyingDomain.domain}
              </h3>
              <button
                onClick={() => setVerifyingDomain(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Introduction */}
              <div className="flex items-start gap-3 p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                <AlertCircle className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-cyan-300 font-semibold mb-1">
                    What do you need to do?
                  </p>
                  <p className="text-xs text-gray-300">
                    Add the following DNS records to your domain registrar
                    (where you purchased your domain). This proves domain
                    ownership and enables email routing.
                  </p>
                </div>
              </div>

              {/* Step-by-Step Guide */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  📋 Verification Steps
                </h4>

                <div className="bg-cyber-dark/50 rounded-lg p-4 border border-white/5">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-6 h-6 rounded-full bg-cyber-primary text-black text-xs font-bold flex items-center justify-center">
                      1
                    </span>
                    <span className="text-sm text-white font-medium">
                      Login to Domain Registrar
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 ml-9">
                    Open the website where you purchased your domain:
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2 ml-9">
                    <a
                      href="https://dash.cloudflare.com"
                      target="_blank"
                      rel="noopener"
                      className="px-2 py-1 bg-white/5 text-cyan-400 text-xs rounded hover:bg-white/10 transition-colors"
                    >
                      Cloudflare →
                    </a>
                    <a
                      href="https://www.namecheap.com/myaccount"
                      target="_blank"
                      rel="noopener"
                      className="px-2 py-1 bg-white/5 text-cyan-400 text-xs rounded hover:bg-white/10 transition-colors"
                    >
                      Namecheap →
                    </a>
                    <a
                      href="https://dcc.godaddy.com"
                      target="_blank"
                      rel="noopener"
                      className="px-2 py-1 bg-white/5 text-cyan-400 text-xs rounded hover:bg-white/10 transition-colors"
                    >
                      GoDaddy →
                    </a>
                    <a
                      href="https://niagahoster.co.id"
                      target="_blank"
                      rel="noopener"
                      className="px-2 py-1 bg-white/5 text-cyan-400 text-xs rounded hover:bg-white/10 transition-colors"
                    >
                      Niagahoster →
                    </a>
                  </div>
                </div>

                <div className="bg-cyber-dark/50 rounded-lg p-4 border border-white/5">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-6 h-6 rounded-full bg-cyber-primary text-black text-xs font-bold flex items-center justify-center">
                      2
                    </span>
                    <span className="text-sm text-white font-medium">
                      Open DNS Settings / DNS Management
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 ml-9">
                    Look for "DNS", "DNS Records", "DNS Management", or
                    "Advanced DNS" menu. Usually found in domain settings.
                  </p>
                </div>

                <div className="bg-cyber-dark/50 rounded-lg p-4 border border-white/5">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-6 h-6 rounded-full bg-cyber-primary text-black text-xs font-bold flex items-center justify-center">
                      3
                    </span>
                    <span className="text-sm text-white font-medium">
                      Add the Following DNS Records
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 ml-9">
                    See the records table below and add them one by one.
                  </p>
                </div>

                <div className="bg-cyber-dark/50 rounded-lg p-4 border border-white/5">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-6 h-6 rounded-full bg-cyber-primary text-black text-xs font-bold flex items-center justify-center">
                      4
                    </span>
                    <span className="text-sm text-white font-medium">
                      Setup Email Routing in Cloudflare
                    </span>
                  </div>
                  <div className="ml-9 space-y-2">
                    <p className="text-xs text-gray-300">
                      <strong className="text-cyan-400">IMPORTANT:</strong>{" "}
                      After adding DNS records, you need to setup Email Routing
                      in Cloudflare Dashboard:
                    </p>
                    <ol className="text-xs text-gray-400 space-y-1.5 list-decimal list-inside">
                      <li>
                        Open{" "}
                        <a
                          href="https://dash.cloudflare.com"
                          target="_blank"
                          rel="noopener"
                          className="text-cyan-400 hover:underline"
                        >
                          Cloudflare Dashboard
                        </a>{" "}
                        → select your domain
                      </li>
                      <li>
                        Click{" "}
                        <span className="text-white font-medium">Email</span> →{" "}
                        <span className="text-white font-medium">
                          Email Routing
                        </span>
                      </li>
                      <li>
                        Go to{" "}
                        <span className="text-white font-medium">
                          Routing rules
                        </span>{" "}
                        tab
                      </li>
                      <li>
                        In{" "}
                        <span className="text-white font-medium">
                          Catch-all address
                        </span>{" "}
                        section, click{" "}
                        <span className="text-cyan-400">Edit</span>
                      </li>
                      <li>
                        Select action:{" "}
                        <span className="text-cyan-400 font-medium">
                          Send to a Worker
                        </span>
                      </li>
                      <li>
                        Select destination:{" "}
                        <span className="text-cyber-primary font-medium">
                          ghostmail-worker
                        </span>
                      </li>
                      <li>
                        Make sure status is:{" "}
                        <span className="text-cyan-400 font-medium">
                          Active
                        </span>{" "}
                        ✓
                      </li>
                      <li>
                        Click{" "}
                        <span className="text-white font-medium">Save</span>
                      </li>
                    </ol>
                  </div>
                </div>

                <div className="bg-cyber-dark/50 rounded-lg p-4 border border-white/5">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-6 h-6 rounded-full bg-cyber-primary text-black text-xs font-bold flex items-center justify-center">
                      5
                    </span>
                    <span className="text-sm text-white font-medium">
                      Setup Email Forwarding (Optional)
                    </span>
                  </div>
                  <div className="ml-9 space-y-2">
                    <p className="text-xs text-gray-300">
                      <strong className="text-cyan-400">
                        Forward to Gmail:
                      </strong>{" "}
                      To receive copies of emails in your personal inbox:
                    </p>
                    <ol className="text-xs text-gray-400 space-y-1.5 list-decimal list-inside">
                      <li>
                        <strong className="text-cyan-400">IMPORTANT:</strong>{" "}
                        First, add your Gmail to Cloudflare's verified
                        destination list:
                        <ul className="ml-4 mt-1 space-y-1 list-disc list-inside text-gray-500">
                          <li>
                            Go to{" "}
                            <a
                              href="https://dash.cloudflare.com"
                              target="_blank"
                              rel="noopener"
                              className="text-cyan-400 hover:underline"
                            >
                              Cloudflare Dashboard
                            </a>{" "}
                            → your domain
                          </li>
                          <li>
                            Click <span className="text-white">Email</span> →{" "}
                            <span className="text-white">Email Routing</span> →{" "}
                            <span className="text-white">
                              Destination addresses
                            </span>
                          </li>
                          <li>
                            Click{" "}
                            <span className="text-cyan-400">
                              "Add destination address"
                            </span>{" "}
                            and add your Gmail
                          </li>
                          <li>
                            Check your Gmail and click the verification link
                            from Cloudflare
                          </li>
                        </ul>
                      </li>
                      <li>
                        After verification, click{" "}
                        <span className="text-cyber-primary font-medium">
                          Edit
                        </span>{" "}
                        on your domain in the Domain Management page
                      </li>
                      <li>
                        Enter your personal email address (e.g.,{" "}
                        <span className="text-cyan-400 font-medium">
                          yourname@gmail.com
                        </span>
                        )
                      </li>
                      <li>
                        Click{" "}
                        <span className="text-white font-medium">
                          Save Changes
                        </span>
                      </li>
                      <li>
                        All emails to your custom domain will be forwarded to
                        your Gmail!
                      </li>
                    </ol>
                    <p className="text-xs text-gray-500 mt-2">
                      Note: Emails are stored in GhostMail AND forwarded to your
                      Gmail.
                    </p>
                  </div>
                </div>
              </div>

              {/* DNS Records */}
              <div className="space-y-4">
                {/* TXT Record 1 - Ownership */}
                <div className="border border-cyber-primary/30 rounded-lg overflow-hidden">
                  <div className="bg-cyber-primary/10 px-4 py-2 border-b border-cyber-primary/30">
                    <span className="text-sm font-semibold text-cyber-primary">
                      📝 Record 1: TXT (Ownership Verification)
                    </span>
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                      <span className="text-xs text-gray-500">Type:</span>
                      <span className="text-sm text-white font-medium bg-cyber-dark px-2 py-1 rounded">
                        TXT
                      </span>
                    </div>
                    <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                      <span className="text-xs text-gray-500">Name/Host:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white font-medium bg-cyber-dark px-2 py-1 rounded flex-1">
                          @
                        </span>
                        <button
                          onClick={() => copyToClipboard("@")}
                          className="p-1.5 bg-cyber-primary/20 text-cyber-primary rounded hover:bg-cyber-primary/30 transition-colors text-xs"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-[80px_1fr] gap-2 items-start">
                      <span className="text-xs text-gray-500 pt-1">Value:</span>
                      <div className="flex items-start gap-2">
                        <span className="text-sm text-cyber-primary font-medium bg-cyber-dark px-2 py-1 rounded flex-1 break-all">
                          ghostmail-verify={user?.id}
                        </span>
                        <button
                          onClick={() =>
                            copyToClipboard(`ghostmail-verify=${user?.id}`)
                          }
                          className="p-1.5 bg-cyber-primary/20 text-cyber-primary rounded hover:bg-cyber-primary/30 transition-colors text-xs shrink-0"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* TXT Record 2 - SPF */}
                <div className="border border-cyan-500/30 rounded-lg overflow-hidden">
                  <div className="bg-cyan-500/10 px-4 py-2 border-b border-cyan-500/30">
                    <span className="text-sm font-semibold text-cyan-400">
                      📝 Record 2: TXT (SPF - Anti Spam)
                    </span>
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                      <span className="text-xs text-gray-500">Type:</span>
                      <span className="text-sm text-white font-medium bg-cyber-dark px-2 py-1 rounded">
                        TXT
                      </span>
                    </div>
                    <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                      <span className="text-xs text-gray-500">Name/Host:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white font-medium bg-cyber-dark px-2 py-1 rounded flex-1">
                          @
                        </span>
                        <button
                          onClick={() => copyToClipboard("@")}
                          className="p-1.5 bg-cyan-500/10 text-cyan-400 rounded hover:bg-cyan-500/20 transition-colors text-xs"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-[80px_1fr] gap-2 items-start">
                      <span className="text-xs text-gray-500 pt-1">Value:</span>
                      <div className="flex items-start gap-2">
                        <span className="text-sm text-white font-medium bg-cyber-dark px-2 py-1 rounded flex-1 break-all">
                          v=spf1 include:_spf.mx.cloudflare.net ~all
                        </span>
                        <button
                          onClick={() =>
                            copyToClipboard(
                              "v=spf1 include:_spf.mx.cloudflare.net ~all"
                            )
                          }
                          className="p-1.5 bg-cyan-500/10 text-cyan-400 rounded hover:bg-cyan-500/20 transition-colors text-xs shrink-0"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* MX Records */}
                <div className="border border-cyan-500/30 rounded-lg overflow-hidden">
                  <div className="bg-cyan-500/10 px-4 py-2 border-b border-cyan-500/30">
                    <span className="text-sm font-semibold text-cyan-400">
                      📝 Record 3-5: MX (Email Routing)
                    </span>
                  </div>
                  <div className="p-4 space-y-4">
                    <p className="text-xs text-gray-400">
                      Add all 3 MX records below (all are required):
                    </p>

                    {/* MX Record 1 */}
                    <div className="space-y-2 p-3 bg-cyber-dark/30 rounded-lg border border-white/5">
                      <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                        <span className="text-xs text-gray-500">Type:</span>
                        <span className="text-sm text-white font-medium bg-cyber-dark px-2 py-1 rounded">
                          MX
                        </span>
                      </div>
                      <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                        <span className="text-xs text-gray-500">Name:</span>
                        <span className="text-sm text-white font-medium bg-cyber-dark px-2 py-1 rounded">
                          @
                        </span>
                      </div>
                      <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                        <span className="text-xs text-gray-500">Priority:</span>
                        <span className="text-sm text-cyan-400 font-medium bg-cyber-dark px-2 py-1 rounded">
                          55
                        </span>
                      </div>
                      <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                        <span className="text-xs text-gray-500">Value:</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-white font-medium bg-cyber-dark px-2 py-1 rounded flex-1">
                            route1.mx.cloudflare.net
                          </span>
                          <button
                            onClick={() =>
                              copyToClipboard("route1.mx.cloudflare.net")
                            }
                            className="p-1.5 bg-cyan-500/20 text-cyan-400 rounded hover:bg-cyan-500/30 transition-colors text-xs shrink-0"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* MX Record 2 */}
                    <div className="space-y-2 p-3 bg-cyber-dark/30 rounded-lg border border-white/5">
                      <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                        <span className="text-xs text-gray-500">Type:</span>
                        <span className="text-sm text-white font-medium bg-cyber-dark px-2 py-1 rounded">
                          MX
                        </span>
                      </div>
                      <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                        <span className="text-xs text-gray-500">Name:</span>
                        <span className="text-sm text-white font-medium bg-cyber-dark px-2 py-1 rounded">
                          @
                        </span>
                      </div>
                      <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                        <span className="text-xs text-gray-500">Priority:</span>
                        <span className="text-sm text-cyan-400 font-medium bg-cyber-dark px-2 py-1 rounded">
                          75
                        </span>
                      </div>
                      <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                        <span className="text-xs text-gray-500">Value:</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-white font-medium bg-cyber-dark px-2 py-1 rounded flex-1">
                            route2.mx.cloudflare.net
                          </span>
                          <button
                            onClick={() =>
                              copyToClipboard("route2.mx.cloudflare.net")
                            }
                            className="p-1.5 bg-cyan-500/20 text-cyan-400 rounded hover:bg-cyan-500/30 transition-colors text-xs shrink-0"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* MX Record 3 */}
                    <div className="space-y-2 p-3 bg-cyber-dark/30 rounded-lg border border-white/5">
                      <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                        <span className="text-xs text-gray-500">Type:</span>
                        <span className="text-sm text-white font-medium bg-cyber-dark px-2 py-1 rounded">
                          MX
                        </span>
                      </div>
                      <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                        <span className="text-xs text-gray-500">Name:</span>
                        <span className="text-sm text-white font-medium bg-cyber-dark px-2 py-1 rounded">
                          @
                        </span>
                      </div>
                      <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                        <span className="text-xs text-gray-500">Priority:</span>
                        <span className="text-sm text-cyan-400 font-medium bg-cyber-dark px-2 py-1 rounded">
                          95
                        </span>
                      </div>
                      <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                        <span className="text-xs text-gray-500">Value:</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-white font-medium bg-cyber-dark px-2 py-1 rounded flex-1">
                            route3.mx.cloudflare.net
                          </span>
                          <button
                            onClick={() =>
                              copyToClipboard("route3.mx.cloudflare.net")
                            }
                            className="p-1.5 bg-cyan-500/20 text-cyan-400 rounded hover:bg-cyan-500/30 transition-colors text-xs shrink-0"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tips */}
              <div className="bg-cyber-dark/50 rounded-lg p-4 border border-white/5">
                <h4 className="text-sm font-semibold text-white mb-2">
                  💡 Tips
                </h4>
                <ul className="text-xs text-white/80 space-y-1 list-disc list-inside">
                  <li>If asked for TTL, use 3600 or "Auto"</li>
                  <li>For Name/Host, "@" means root domain (main domain)</li>
                  <li>If registrar doesn't accept "@", try leaving it empty</li>
                  <li>DNS propagation can take 5 minutes to 24 hours</li>
                </ul>
              </div>

              {/* Troubleshooting */}
              <details className="bg-cyber-dark/30 rounded-lg border border-white/5">
                <summary className="px-4 py-3 text-sm font-medium text-gray-300 cursor-pointer hover:text-white transition-colors">
                  ❓ Verification Failed? See Troubleshooting
                </summary>
                <div className="px-4 pb-4 text-xs text-gray-400 space-y-2">
                  <p>
                    <strong className="text-white">
                      1. Make sure records are saved
                    </strong>{" "}
                    - Some registrars require clicking Save/Apply
                  </p>
                  <p>
                    <strong className="text-white">
                      2. Wait for DNS propagation
                    </strong>{" "}
                    - Check at{" "}
                    <a
                      href="https://dnschecker.org"
                      target="_blank"
                      rel="noopener"
                      className="text-cyber-primary hover:underline"
                    >
                      dnschecker.org
                    </a>
                  </p>
                  <p>
                    <strong className="text-white">
                      3. Check value format
                    </strong>{" "}
                    - No extra spaces or characters
                  </p>
                  <p>
                    <strong className="text-white">
                      4. Check for conflicts
                    </strong>{" "}
                    - Delete old MX records if any
                  </p>
                </div>
              </details>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/10 bg-cyber-dark/50 shrink-0">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-400">Status:</span>
                {isVerifying ? (
                  <span className="flex items-center gap-2 text-cyan-400 text-sm font-medium">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Checking DNS...
                  </span>
                ) : (
                  <span className="text-sm font-medium text-gray-500">
                    Waiting for verification
                  </span>
                )}
              </div>
              <button
                onClick={handleCheckVerification}
                disabled={isVerifying}
                className="w-full py-3 bg-cyber-primary hover:bg-[#4df4ff] text-black font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isVerifying ? "Verifying..." : "✓ Check Verification Now"}
              </button>
              <p className="text-center mt-2 text-xs text-gray-500">
                After adding records, wait a few minutes then click the button
                above.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && emailToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-cyber-panel border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-400" />
                Delete Email
              </h3>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setEmailToDelete(null);
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                <p className="text-sm text-red-300">
                  This action cannot be undone. All emails in this inbox will be
                  permanently deleted.
                </p>
              </div>

              <p className="text-center text-gray-300">
                Are you sure you want to delete <br />
                <span className="text-cyber-primary font-medium">
                  {emailToDelete.full_email}
                </span>
                ?
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setEmailToDelete(null);
                  }}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors border border-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteEmail(emailToDelete)}
                  disabled={deletingEmailId === emailToDelete.id}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {deletingEmailId === emailToDelete.id ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Domain Modal */}
      {editingDomain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-cyber-panel border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-cyber-primary" />
                Edit Domain
              </h3>
              <button
                onClick={() => setEditingDomain(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Domain
                </label>
                <div className="px-4 py-3 bg-cyber-dark border border-white/10 rounded-lg text-gray-300 font-medium">
                  {editingDomain.domain}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Forward Emails To
                </label>
                <input
                  type="email"
                  value={editDestinationEmail}
                  onChange={(e) => setEditDestinationEmail(e.target.value)}
                  placeholder="your.email@gmail.com"
                  className="w-full px-4 py-3 bg-cyber-dark border border-white/10 rounded-lg text-white font-medium text-sm focus:border-cyber-primary outline-none transition-colors"
                />
                <p className="text-xs text-gray-500 mt-2">
                  All emails sent to @{editingDomain.domain} will be forwarded
                  to this address.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setEditingDomain(null)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors border border-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveDomain}
                  disabled={savingDomain}
                  className="flex-1 py-3 bg-cyber-primary hover:bg-cyber-primary/80 text-black font-bold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {savingDomain ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Domain Confirmation Modal */}
      {showDeleteDomainConfirm && domainToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-cyber-panel border border-white/10 rounded-xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-400" />
                Delete Domain
              </h3>
              <button
                onClick={() => {
                  setShowDeleteDomainConfirm(false);
                  setDomainToDelete(null);
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                <p className="text-sm text-red-300">
                  This will remove the domain from your account. You'll need to
                  re-add and re-verify it if you want to use it again.
                </p>
              </div>

              <p className="text-center text-gray-300">
                Are you sure you want to delete <br />
                <span className="text-cyber-primary font-medium">
                  {domainToDelete.domain}
                </span>
                ?
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowDeleteDomainConfirm(false);
                    setDomainToDelete(null);
                  }}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors border border-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteDomain}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-[#1a1a2e] to-[#13131f] border-r border-white/5 transform transition-transform duration-300 flex flex-col
        ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Logo */}
        <div className="h-16 px-5 border-b border-white/5 flex items-center">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-lg font-bold">
                <span className="text-white">RAF</span>
                <span className="text-cyan-400">MAIL</span>
              </h1>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-6">
          {/* Email Section */}
          <div>
            <div className="flex items-center gap-2 px-3 mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400"></div>
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Email
              </span>
            </div>
            <div className="space-y-1">
              <button
                onClick={() => {
                  setActiveTab("emails");
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeTab === "emails"
                    ? "bg-cyan-500/10 text-cyan-400 shadow-sm"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Mail className="w-4 h-4" />
                Email Addresses
              </button>
              <button
                onClick={() => {
                  setActiveTab("domains");
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeTab === "domains"
                    ? "bg-cyan-500/10 text-cyan-400 shadow-sm"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Globe className="w-4 h-4" />
                Domain Management
              </button>
            </div>
          </div>

          {/* Security Section */}
          <div>
            <div className="flex items-center gap-2 px-3 mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Security
              </span>
            </div>
            <button
              onClick={() => {
                setActiveTab("vault");
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === "vault"
                  ? "bg-emerald-500/10 text-emerald-400 shadow-sm"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Shield className="w-4 h-4" />
              Password Vault
            </button>
          </div>

          {/* Account Section */}
          <div>
            <div className="flex items-center gap-2 px-3 mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400"></div>
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Account
              </span>
            </div>
            <button
              onClick={() => {
                setActiveTab("profile");
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === "profile"
                  ? "bg-cyan-500/10 text-cyan-400 shadow-sm"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <User className="w-4 h-4" />
              Profile
            </button>
          </div>
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-white/5">
          <div className="p-3 bg-white/5 rounded-xl mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user?.name || user?.email?.split("@")[0]}
                </p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Top Bar */}
        <header className="h-16 bg-gradient-to-b from-[#1a1a2e] to-[#16162a] border-b border-white/5 flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-gray-400 hover:text-white"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold text-white">
              {activeTab === "emails"
                ? "Created Email Addresses"
                : activeTab === "domains"
                ? "Domain Management"
                : activeTab === "vault"
                ? "Password Vault"
                : "Profile"}
            </h2>
          </div>

          {activeTab === "emails" && (
            <button
              onClick={onGenerateEmail}
              className="flex items-center gap-2 px-4 py-2 bg-cyber-primary hover:bg-[#4df4ff] text-black font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Create New Email</span>
            </button>
          )}

          {activeTab === "domains" && (
            <button
              onClick={() => setShowAddDomain(true)}
              className="flex items-center gap-2 px-4 py-2 bg-cyber-primary hover:bg-[#4df4ff] text-black font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Custom Domain</span>
            </button>
          )}
        </header>

        {/* Content Area */}
        <div className="flex-1 p-4 sm:p-6 overflow-auto">
          {activeTab === "emails" && (
            <>
              {/* Stats + Search + Domain Filter */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 sm:mb-6">
                <p className="text-sm text-gray-400">
                  Total:{" "}
                  <span className="text-white font-medium">
                    {emails.length}
                  </span>
                  {domainFilter !== "all" && (
                    <span className="text-gray-500 ml-2">
                      (showing {filteredEmails.length})
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {/* Domain Filter Dropdown */}
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                    <select
                      value={domainFilter}
                      onChange={(e) => setDomainFilter(e.target.value)}
                      className="appearance-none bg-cyber-dark border border-white/10 rounded-lg pl-9 pr-8 py-2 text-sm text-white focus:border-cyber-primary outline-none cursor-pointer hover:border-white/20 transition-colors min-w-[140px]"
                    >
                      <option value="all">All Domains</option>
                      {uniqueDomains.map((domain) => (
                        <option key={domain} value={domain}>
                          {domain}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                  </div>
                  {/* Search Box */}
                  <div className="relative flex-1 sm:flex-none">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full sm:w-48 bg-cyber-dark border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:border-cyber-primary outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="bg-cyber-panel border border-white/10 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-cyber-dark/50">
                      <tr>
                        <th className="text-left text-xs font-medium text-gray-400 uppercase px-3 sm:px-4 py-3 hidden sm:table-cell">
                          #
                        </th>
                        <th
                          className="text-left text-xs font-medium text-gray-400 uppercase px-3 sm:px-4 py-3 cursor-pointer hover:text-cyan-400 transition-colors"
                          onClick={() => toggleSort("email")}
                        >
                          <span className="inline-flex items-center">
                            Email address
                            {getSortIcon("email")}
                          </span>
                        </th>
                        <th
                          className="text-left text-xs font-medium text-gray-400 uppercase px-3 sm:px-4 py-3 hidden md:table-cell cursor-pointer hover:text-cyan-400 transition-colors"
                          onClick={() => toggleSort("domain")}
                        >
                          <span className="inline-flex items-center">
                            Domain
                            {getSortIcon("domain")}
                          </span>
                        </th>
                        <th
                          className="text-left text-xs font-medium text-gray-400 uppercase px-3 sm:px-4 py-3 hidden md:table-cell cursor-pointer hover:text-cyan-400 transition-colors"
                          onClick={() => toggleSort("created_at")}
                        >
                          <span className="inline-flex items-center">
                            Date Created
                            {getSortIcon("created_at")}
                          </span>
                        </th>
                        <th className="text-left text-xs font-medium text-gray-400 uppercase px-3 sm:px-4 py-3 hidden lg:table-cell">
                          Note
                        </th>
                        <th className="text-left text-xs font-medium text-gray-400 uppercase px-3 sm:px-4 py-3">
                          Status
                        </th>
                        <th className="text-right text-xs font-medium text-gray-400 uppercase px-3 sm:px-4 py-3">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {loading ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="px-4 py-8 text-center text-gray-500"
                          >
                            Loading...
                          </td>
                        </tr>
                      ) : sortedEmails.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="px-4 py-8 text-center text-gray-500"
                          >
                            No email addresses yet. Click "Create New Email" to
                            get started!
                          </td>
                        </tr>
                      ) : (
                        sortedEmails.map((email, idx) => (
                          <tr
                            key={email.id}
                            onClick={() =>
                              onConnectSession?.({
                                email: email.full_email,
                                expiresAt: email.expires_at,
                                recoveryToken: email.recovery_token,
                              })
                            }
                            className="hover:bg-white/5 transition-colors cursor-pointer"
                          >
                            <td className="px-3 sm:px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">
                              {idx + 1}
                            </td>
                            <td className="px-3 sm:px-4 py-3">
                              <span className="text-cyber-primary hover:text-white transition-colors font-medium text-xs sm:text-sm break-all">
                                {email.full_email}
                              </span>
                            </td>
                            <td className="px-3 sm:px-4 py-3 text-sm text-gray-400 hidden md:table-cell">
                              <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded text-xs">
                                {email.domain}
                              </span>
                            </td>
                            <td className="px-3 sm:px-4 py-3 text-sm text-gray-400 hidden md:table-cell">
                              {formatDate(email.created_at)}
                            </td>
                            <td className="px-3 sm:px-4 py-3 text-sm hidden lg:table-cell">
                              <div className="flex items-center gap-2">
                                {email.note ? (
                                  <span
                                    className="text-gray-300 text-xs truncate max-w-[150px]"
                                    title={email.note}
                                  >
                                    {email.note}
                                  </span>
                                ) : (
                                  <span className="text-gray-500 text-xs italic">
                                    No note
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {/* Check if permanent (100 years = > 50 years from now) */}
                              {email.expires_at >
                              Date.now() + 50 * 365 * 24 * 60 * 60 * 1000 ? (
                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs border border-emerald-500/20">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  Permanent
                                </span>
                              ) : email.expires_at > Date.now() ? (
                                <div className="flex flex-col">
                                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-xs border border-cyan-500/20 w-fit">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                    Active
                                  </span>
                                  <span className="text-[10px] text-gray-500 mt-1">
                                    Expires:{" "}
                                    {new Date(email.expires_at).toLocaleString(
                                      "en-GB",
                                      {
                                        day: "2-digit",
                                        month: "2-digit",
                                        year: "2-digit",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      }
                                    )}
                                  </span>
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500/10 text-red-400 text-xs border border-red-500/20">
                                  Expired
                                </span>
                              )}
                            </td>
                            <td className="px-3 sm:px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveEmail(email);
                                  }}
                                  className="p-2 text-gray-400 hover:text-cyan-400 hover:bg-white/5 rounded-lg transition-colors"
                                  title="View Details & Edit Note"
                                >
                                  <Info className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => confirmDelete(email, e)}
                                  className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                  title="Delete email"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {activeTab === "domains" && (
            <div className="space-y-6">
              {/* Add Domain Form */}
              {showAddDomain && (
                <div className="bg-cyber-panel border border-white/10 rounded-xl p-6 animate-fade-in-up">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">
                      Add New Domain
                    </h3>
                    <button
                      onClick={() => setShowAddDomain(false)}
                      className="p-1 hover:bg-white/10 rounded text-gray-400"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <form onSubmit={handleAddDomain} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        Domain Name
                      </label>
                      <input
                        type="text"
                        value={newDomain}
                        onChange={(e) => setNewDomain(e.target.value)}
                        placeholder="example.com"
                        className="w-full bg-cyber-dark border border-white/10 rounded-lg px-4 py-3 text-white focus:border-cyber-primary outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        Forwarding Email (Optional)
                      </label>
                      <input
                        type="email"
                        value={destinationEmail}
                        onChange={(e) => setDestinationEmail(e.target.value)}
                        placeholder="your@real-email.com"
                        className="w-full bg-cyber-dark border border-white/10 rounded-lg px-4 py-3 text-white focus:border-cyber-primary outline-none"
                      />
                    </div>
                    <div className="bg-cyber-primary/5 border border-cyber-primary/20 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-cyber-primary mt-0.5" />
                        <div>
                          <p className="text-sm text-cyber-primary font-semibold mb-1">
                            DNS Configuration Required
                          </p>
                          <p className="text-xs text-gray-400 leading-relaxed">
                            After adding your domain, you'll need to configure
                            your DNS records to point to our servers. We'll
                            provide the MX and TXT records in the next step.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowAddDomain(false)}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors border border-white/10"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={addingDomain}
                        className="flex items-center gap-2 px-6 py-2 bg-cyber-primary hover:bg-[#4df4ff] text-black font-medium rounded-lg transition-colors disabled:opacity-50"
                      >
                        {addingDomain ? "Adding..." : "Add Domain"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Domains List */}
              <div className="bg-cyber-panel border border-white/10 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-cyber-dark/50">
                      <tr>
                        <th className="text-left text-xs font-medium text-gray-400 uppercase px-3 sm:px-6 py-3 sm:py-4">
                          Domain
                        </th>
                        <th className="text-left text-xs font-medium text-gray-400 uppercase px-3 sm:px-6 py-3 sm:py-4">
                          Status
                        </th>
                        <th className="text-left text-xs font-medium text-gray-400 uppercase px-3 sm:px-6 py-3 sm:py-4 hidden md:table-cell">
                          Destination
                        </th>
                        <th className="text-left text-xs font-medium text-gray-400 uppercase px-3 sm:px-6 py-3 sm:py-4 hidden lg:table-cell">
                          Added
                        </th>
                        <th className="text-right text-xs font-medium text-gray-400 uppercase px-3 sm:px-6 py-3 sm:py-4">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {domains.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-6 py-12 text-center text-gray-500"
                          >
                            <Globe className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>No custom domains added yet.</p>
                          </td>
                        </tr>
                      ) : (
                        domains.map((domain) => (
                          <tr
                            key={domain.id}
                            className="hover:bg-white/5 transition-colors"
                          >
                            <td className="px-3 sm:px-6 py-3 sm:py-4">
                              <span className="font-medium text-white text-sm break-all">
                                {domain.domain}
                              </span>
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4">
                              {domain.verified ? (
                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-xs border border-cyan-500/20">
                                  Verified
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-xs border border-cyan-500/20">
                                  Pending
                                </span>
                              )}
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-gray-400 hidden md:table-cell">
                              {domain.destination_email || "-"}
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-gray-400 hidden lg:table-cell">
                              {formatDate(domain.created_at)}
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => handleEditDomain(domain)}
                                  className="p-2 text-gray-400 hover:text-cyan-400 hover:bg-white/5 rounded-lg transition-all"
                                  title="Edit destination email"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => confirmDeleteDomain(domain)}
                                  className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                  title="Delete domain"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleVerifyClick(domain)}
                                  className="p-2 text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all"
                                  title="Verify DNS"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "profile" && (
            <div className="max-w-xl space-y-6">
              {/* Profile Header Card */}
              <div className="bg-gradient-to-b from-[#1a1a2e] to-[#16162a] border border-white/10 rounded-2xl overflow-hidden">
                {/* Profile Banner */}
                <div className="h-20 bg-cyber-dark/19"></div>

                {/* Avatar & Info */}
                <div className="px-6 pb-6">
                  <div className="flex items-end gap-4 -mt-10">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center border-4 border-[#16162a] shadow-lg">
                      <User className="w-10 h-10 text-white" />
                    </div>
                    <div className="pb-2">
                      <h3 className="text-xl font-bold text-white">
                        {user?.name || user?.email?.split("@")[0]}
                      </h3>
                      <p className="text-sm text-gray-400">{user?.email}</p>
                    </div>
                  </div>
                </div>

                {/* Info Grid */}
                <div className="px-6 pb-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white/5 rounded-xl">
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Email
                      </label>
                      <p className="text-sm text-white font-medium truncate">
                        {user?.email}
                      </p>
                    </div>
                    <div className="p-4 bg-white/5 rounded-xl">
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Display Name
                      </label>
                      <p className="text-sm text-white font-medium">
                        {user?.name || "-"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 p-4 bg-white/5 rounded-xl">
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Account ID
                    </label>
                    <p className="text-xs text-gray-400 font-medium">
                      {user?.id}
                    </p>
                  </div>
                </div>
              </div>

              {/* Change Password Section */}
              <div className="bg-gradient-to-b from-[#1a1a2e] to-[#16162a] border border-white/10 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                    <Lock className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">
                      Security
                    </h3>
                    <p className="text-xs text-gray-500">
                      Update your password
                    </p>
                  </div>
                </div>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2">
                      Current Password
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full bg-[#0f0f1a] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-cyan-500 outline-none pr-12 transition-colors"
                        placeholder="Enter current password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowCurrentPassword(!showCurrentPassword)
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-cyan-400 transition-colors"
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full bg-[#0f0f1a] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-cyan-500 outline-none pr-12 transition-colors"
                        placeholder="Min 6 characters"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-cyan-400 transition-colors"
                      >
                        {showNewPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-[#0f0f1a] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-cyan-500 outline-none transition-colors"
                      placeholder="Confirm new password"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={
                      changingPassword ||
                      !currentPassword ||
                      !newPassword ||
                      !confirmPassword
                    }
                    className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {changingPassword ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        Update Password
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Password Vault Tab */}
          {activeTab === "vault" && (
            <VaultProvider>
              <PasswordVault />
            </VaultProvider>
          )}
        </div>

        {/* Email Details / Recovery Modal */}
        {activeEmail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-md bg-gradient-to-b from-[#1a1a2e] to-[#16162a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="p-5 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">
                      Email Access
                    </h3>
                    <p className="text-xs text-gray-400">
                      Recovery & session details
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveEmail(null)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-5 space-y-5">
                {/* Email Address Highlight */}
                <div className="text-center py-3 px-4 bg-cyan-500/10 border border-cyan-500/20 rounded-xl">
                  <p className="text-lg font-semibold text-cyan-400">
                    {activeEmail.full_email}
                  </p>
                </div>

                {/* Fields */}
                <div className="space-y-4">
                  {/* Email Field */}
                  <div>
                    <label className="text-xs font-medium text-gray-400 mb-2 block">
                      Email Address
                    </label>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={activeEmail.full_email}
                        className="flex-1 bg-[#0f0f1a] border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-300 outline-none"
                      />
                      <button
                        onClick={() => copyToClipboard(activeEmail.full_email)}
                        className="p-3 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-cyan-400 rounded-xl transition-all"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Token Field */}
                  <div>
                    <label className="text-xs font-medium text-gray-400 mb-2 block">
                      Recovery Token
                    </label>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={activeEmail.recovery_token}
                        className="flex-1 bg-[#0f0f1a] border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-300 outline-none"
                      />
                      <button
                        onClick={() =>
                          copyToClipboard(activeEmail.recovery_token)
                        }
                        className="p-3 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-cyan-400 rounded-xl transition-all"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Note Section */}
                <div>
                  <label className="text-xs font-medium text-gray-400 mb-2 block">
                    Note
                  </label>
                  <div className="space-y-2">
                    <textarea
                      defaultValue={activeEmail.note || ""}
                      placeholder="Add a note to remember what this email is used for..."
                      maxLength={500}
                      className="w-full bg-[#0f0f1a] border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-300 outline-none resize-none h-20 focus:border-cyan-500/50 transition-colors"
                      id={`note-textarea-${activeEmail.id}`}
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500">
                        Max 500 characters
                      </p>
                      <button
                        onClick={async () => {
                          const textarea = document.getElementById(
                            `note-textarea-${activeEmail.id}`
                          ) as HTMLTextAreaElement;
                          const newNote = textarea?.value || "";
                          if (!token) return;

                          setSavingNote(true);
                          try {
                            const res = await fetch(
                              `${API_URL}/api/user/emails/${activeEmail.id}/note`,
                              {
                                method: "PUT",
                                headers: {
                                  Authorization: `Bearer ${token}`,
                                  "Content-Type": "application/json",
                                },
                                body: JSON.stringify({ note: newNote }),
                              }
                            );
                            const data = await res.json();

                            if (data.success) {
                              toast.success("Note saved!");
                              setEmails(
                                emails.map((e) =>
                                  e.id === activeEmail.id
                                    ? { ...e, note: newNote || undefined }
                                    : e
                                )
                              );
                              setActiveEmail({
                                ...activeEmail,
                                note: newNote || undefined,
                              });
                            } else {
                              toast.error(
                                data.message || "Failed to save note"
                              );
                            }
                          } catch (err) {
                            toast.error("Failed to save note");
                          } finally {
                            setSavingNote(false);
                          }
                        }}
                        disabled={savingNote}
                        className="px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {savingNote ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <StickyNote className="w-3 h-3" />
                            Save Note
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Action Buttons - Side by Side */}
                <div className="pt-2 grid grid-cols-2 gap-3">
                  <button
                    onClick={handleRegenerateToken}
                    disabled={regeneratingToken}
                    className="py-3 px-4 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${
                        regeneratingToken ? "animate-spin" : ""
                      }`}
                    />
                    {regeneratingToken ? "Regenerating..." : "Change Token"}
                  </button>
                  <button
                    onClick={() =>
                      onConnectSession?.({
                        email: activeEmail.full_email,
                        expiresAt: activeEmail.expires_at,
                        recoveryToken: activeEmail.recovery_token,
                      })
                    }
                    className="py-3 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium rounded-xl text-sm transition-all flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Connect
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
