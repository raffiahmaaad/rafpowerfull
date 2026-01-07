import React, { useState, useEffect } from 'react';
import {
    Settings, Mail, Shield, LogOut, ToggleLeft, ToggleRight,
    RefreshCw, Eye, Trash2, ArrowLeft, Inbox, AlertCircle,
    Users, Activity, Database, ChevronDown, ShieldAlert, Plus, X, Globe, Copy, Check, CheckCircle, Loader, ExternalLink,
    Wrench, Image, FileText, CreditCard, MapPin
} from 'lucide-react';
import toast from 'react-hot-toast';
import DOMPurify from 'dompurify';

const API_URL = import.meta.env.VITE_API_URL || 'https://ghostmail-worker.rafxyz.workers.dev';

interface Email {
    id: string;
    alias: string;
    email: string;
    userId: string | null;
    createdAt: number | null;
    expiresAt: number | null;
    source: 'database' | 'kv';
    isActive: boolean;
    recoveryToken?: string | null;
}

interface InboxEmail {
    id: string;
    from: string;
    to: string;
    subject: string;
    body: string;
    html: string;
    receivedAt: number;
}

interface Config {
    loginEnabled: boolean;
    registerEnabled: boolean;
}

interface User {
    id: string;
    email: string;
    name: string | null;
    created_at: number;
    email_count: number;
}

interface AdminPanelProps {
    onLogout: () => void;
}

interface PublicDomain {
    id: string;
    domain: string;
    is_active: number;
    created_at: number;
    isDefault?: boolean;
}

// Tools config types
type ToolAccess = 'public' | 'authenticated';
interface ToolConfigItem {
    enabled: boolean;
    access: ToolAccess;
    name: string;
    description: string;
    icon: string;
}
interface ToolsConfigState {
    tempmail: ToolConfigItem;
    imagetools: ToolConfigItem;
    pdftools: ToolConfigItem;
    cctools: ToolConfigItem;
    generators: ToolConfigItem;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onLogout }) => {
    const [activeTab, setActiveTab] = useState<'emails' | 'users' | 'config' | 'spam' | 'domains' | 'tools'>('emails');
    const [emails, setEmails] = useState<Email[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [config, setConfig] = useState<Config>({ loginEnabled: true, registerEnabled: true });
    const [loading, setLoading] = useState(true);
    const [selectedAlias, setSelectedAlias] = useState<string | null>(null);
    const [inboxEmails, setInboxEmails] = useState<InboxEmail[]>([]);
    const [inboxLoading, setInboxLoading] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [deleteUserConfirm, setDeleteUserConfirm] = useState<string | null>(null);
    const [defaultSpamKeywords, setDefaultSpamKeywords] = useState<string[]>([]);
    const [customSpamKeywords, setCustomSpamKeywords] = useState<string[]>([]);
    const [newKeyword, setNewKeyword] = useState('');
    const [addingKeyword, setAddingKeyword] = useState(false);

    // Public Domains state
    const [publicDomains, setPublicDomains] = useState<PublicDomain[]>([]);
    const [newDomain, setNewDomain] = useState('');
    const [addingDomain, setAddingDomain] = useState(false);
    const [verifyingDomainId, setVerifyingDomainId] = useState<string | null>(null);
    const [domainVerificationStatus, setDomainVerificationStatus] = useState<Record<string, 'pending' | 'verified' | 'failed'>>({});

    // Recovery modal state
    const [recoveryEmail, setRecoveryEmail] = useState<Email | null>(null);
    const [copiedField, setCopiedField] = useState<string | null>(null);

    // Tools config state
    const [toolsConfig, setToolsConfig] = useState<ToolsConfigState | null>(null);
    const [updatingTool, setUpdatingTool] = useState<string | null>(null);

    // Fetch emails
    const fetchEmails = async () => {
        try {
            const res = await fetch(`${API_URL}/api/admin/emails`, { credentials: 'include' });
            const data = await res.json();
            if (data.success) {
                setEmails(data.emails);
            } else {
                toast.error(data.message || 'Failed to fetch emails');
            }
        } catch (err) {
            toast.error('Failed to fetch emails');
        }
    };

    // Fetch config
    const fetchConfig = async () => {
        try {
            const res = await fetch(`${API_URL}/api/admin/config`, { credentials: 'include' });
            const data = await res.json();
            if (data.success) {
                setConfig(data.config);
            }
        } catch (err) {
            console.error('Failed to fetch config:', err);
        }
    };

    // Delete email alias
    const deleteEmail = async (alias: string) => {
        try {
            const res = await fetch(`${API_URL}/api/admin/emails/${alias}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`${alias} deleted successfully`);
                setEmails(emails.filter(e => e.alias !== alias));
                setDeleteConfirm(null);
            } else {
                toast.error(data.message || 'Failed to delete');
            }
        } catch (err) {
            toast.error('Failed to delete email');
        }
    };

    // Fetch inbox for specific alias
    const fetchInbox = async (alias: string) => {
        setInboxLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/emails/${alias}/inbox`, { credentials: 'include' });
            const data = await res.json();
            if (data.success) {
                setInboxEmails(data.emails);
                setSelectedAlias(alias);
            } else {
                toast.error(data.message || 'Failed to fetch inbox');
            }
        } catch (err) {
            toast.error('Failed to fetch inbox');
        } finally {
            setInboxLoading(false);
        }
    };

    // Update config
    const updateConfig = async (key: keyof Config, value: boolean) => {
        try {
            const res = await fetch(`${API_URL}/api/admin/config`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [key]: value }),
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                setConfig(data.config);
                toast.success(`${key === 'loginEnabled' ? 'Login' : 'Register'} ${value ? 'enabled' : 'disabled'}`);
            } else {
                toast.error(data.message || 'Failed to update config');
            }
        } catch (err) {
            toast.error('Failed to update config');
        }
    };

    // Fetch users
    const fetchUsers = async () => {
        try {
            const res = await fetch(`${API_URL}/api/admin/users`, { credentials: 'include' });
            const data = await res.json();
            if (data.success) {
                setUsers(data.users);
            }
        } catch (err) {
            console.error('Failed to fetch users:', err);
        }
    };

    // Delete user
    const deleteUser = async (userId: string) => {
        try {
            const res = await fetch(`${API_URL}/api/admin/users/${userId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                toast.success('User and all emails deleted');
                setUsers(users.filter(u => u.id !== userId));
                setDeleteUserConfirm(null);
                // Refresh emails list too
                fetchEmails();
            } else {
                toast.error(data.message || 'Failed to delete user');
            }
        } catch (err) {
            toast.error('Failed to delete user');
        }
    };

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            await Promise.all([fetchEmails(), fetchConfig(), fetchUsers()]);
            setLoading(false);
        };
        loadData();
    }, []); // Only run once on mount

    // Fetch spam keywords
    const fetchSpamKeywords = async () => {
        try {
            const res = await fetch(`${API_URL}/api/admin/spam-keywords`, { credentials: 'include' });
            const data = await res.json();
            if (data.success) {
                setDefaultSpamKeywords(data.defaultKeywords || []);
                setCustomSpamKeywords(data.customKeywords || []);
            }
        } catch (err) {
            console.error('Failed to fetch spam keywords:', err);
        }
    };

    // Add spam keyword
    const addSpamKeyword = async () => {
        if (!newKeyword.trim()) return;
        setAddingKeyword(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/spam-keywords`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keyword: newKeyword.trim() }),
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                setCustomSpamKeywords(data.customKeywords);
                setNewKeyword('');
                toast.success(`Keyword "${data.keyword}" added`);
            } else {
                toast.error(data.message || 'Failed to add keyword');
            }
        } catch (err) {
            toast.error('Failed to add keyword');
        } finally {
            setAddingKeyword(false);
        }
    };

    // Delete spam keyword
    const deleteSpamKeyword = async (keyword: string) => {
        try {
            const res = await fetch(`${API_URL}/api/admin/spam-keywords/${encodeURIComponent(keyword)}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                setCustomSpamKeywords(data.customKeywords);
                toast.success(`Keyword "${keyword}" deleted`);
            } else {
                toast.error(data.message || 'Failed to delete keyword');
            }
        } catch (err) {
            toast.error('Failed to delete keyword');
        }
    };

    // Load spam keywords when spam tab is opened
    useEffect(() => {
        if (activeTab === 'spam') {
            fetchSpamKeywords();
        }
    }, [activeTab]);

    // Public Domains Functions
    const fetchPublicDomains = async () => {
        try {
            const res = await fetch(`${API_URL}/api/admin/public-domains`, { credentials: 'include' });
            const data = await res.json();
            if (data.success) {
                setPublicDomains(data.domains || []);
            }
        } catch (err) {
            console.error('Failed to fetch public domains:', err);
        }
    };

    const addPublicDomain = async () => {
        if (!newDomain.trim()) return;
        setAddingDomain(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/public-domains`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ domain: newDomain.trim() }),
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                setPublicDomains([data.domain, ...publicDomains]);
                setNewDomain('');
                toast.success(`Domain "${data.domain.domain}" added`);
            } else {
                toast.error(data.message || 'Failed to add domain');
            }
        } catch (err) {
            toast.error('Failed to add domain');
        } finally {
            setAddingDomain(false);
        }
    };

    const toggleDomainActive = async (domain: PublicDomain) => {
        try {
            const res = await fetch(`${API_URL}/api/admin/public-domains/${domain.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: !domain.is_active }),
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                setPublicDomains(publicDomains.map(d =>
                    d.id === domain.id ? { ...d, is_active: d.is_active ? 0 : 1 } : d
                ));
                toast.success(`Domain ${domain.is_active ? 'disabled' : 'enabled'}`);
            } else {
                toast.error(data.message || 'Failed to update domain');
            }
        } catch (err) {
            toast.error('Failed to update domain');
        }
    };

    const deletePublicDomain = async (id: string, domainName: string) => {
        try {
            const res = await fetch(`${API_URL}/api/admin/public-domains/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                setPublicDomains(publicDomains.filter(d => d.id !== id));
                toast.success(`Domain "${domainName}" deleted`);
            } else {
                toast.error(data.message || 'Failed to delete domain');
            }
        } catch (err) {
            toast.error('Failed to delete domain');
        }
    };

    // Verify Domain DNS
    const verifyDomainDNS = async (domain: PublicDomain) => {
        setVerifyingDomainId(domain.id);
        setDomainVerificationStatus(prev => ({ ...prev, [domain.id]: 'pending' }));

        try {
            const res = await fetch(`${API_URL}/api/admin/public-domains/${domain.id}/verify`, {
                method: 'POST',
                credentials: 'include'
            });
            const data = await res.json();

            if (data.success && data.verified) {
                setDomainVerificationStatus(prev => ({ ...prev, [domain.id]: 'verified' }));
                toast.success(
                    <div className="text-sm">
                        <span className="font-bold block">Domain Verified</span>
                        <span className="text-xs opacity-90">MX records for {domain.domain} are valid.</span>
                    </div>
                );
            } else {
                setDomainVerificationStatus(prev => ({ ...prev, [domain.id]: 'failed' }));
                toast.error(
                    <div className="text-sm">
                        <span className="font-bold block">Verification Failed</span>
                        <span className="text-xs opacity-90">{data.message || 'MX records not found or invalid.'}</span>
                    </div>
                );
            }
        } catch (err) {
            setDomainVerificationStatus(prev => ({ ...prev, [domain.id]: 'failed' }));
            toast.error(
                <div className="text-sm">
                    <span className="font-bold block">Connection Error</span>
                    <span className="text-xs opacity-90">Failed to verify domain DNS.</span>
                </div>
            );
        } finally {
            setVerifyingDomainId(null);
        }
    };

    // Load domains when domains tab is opened
    useEffect(() => {
        if (activeTab === 'domains') {
            fetchPublicDomains();
        }
    }, [activeTab]);

    // Fetch tools config
    const fetchToolsConfig = async () => {
        try {
            const res = await fetch(`${API_URL}/api/admin/config/tools`, { credentials: 'include' });
            const data = await res.json();
            if (data.success) {
                setToolsConfig(data.config);
            }
        } catch (err) {
            console.error('Failed to fetch tools config:', err);
        }
    };

    // Update tool config
    const updateToolConfig = async (toolId: keyof ToolsConfigState, field: 'enabled' | 'access', value: boolean | ToolAccess) => {
        setUpdatingTool(toolId);
        try {
            const updatePayload = {
                [toolId]: {
                    [field]: value
                }
            };
            
            const res = await fetch(`${API_URL}/api/admin/config/tools`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatePayload),
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                // Refresh config
                await fetchToolsConfig();
                const toolName = toolsConfig?.[toolId]?.name || toolId;
                if (field === 'enabled') {
                    toast.success(`${toolName} ${value ? 'enabled' : 'disabled'}`);
                } else {
                    toast.success(`${toolName} access set to ${value === 'public' ? 'Public' : 'Login Required'}`);
                }
            } else {
                toast.error(data.message || 'Failed to update tool config');
            }
        } catch (err) {
            toast.error('Failed to update tool config');
        } finally {
            setUpdatingTool(null);
        }
    };

    // Load tools config when tools tab is opened
    useEffect(() => {
        if (activeTab === 'tools') {
            fetchToolsConfig();
        }
    }, [activeTab]);

    const formatDate = (timestamp: number | null) => {
        if (!timestamp) return '—';
        return new Date(timestamp).toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Stats
    const stats = {
        totalEmails: emails.length,
        activeEmails: emails.filter(e => e.isActive).length,
        totalUsers: users.length,
        anonymous: emails.filter(e => !e.userId).length
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#0a0a12] via-[#0d0d18] to-[#0a0a12] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-cyber-primary/30 border-t-cyber-primary rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-400 font-medium">Loading admin panel...</p>
                </div>
            </div>
        );
    }

    // Inbox View
    if (selectedAlias) {
        // Extract sender info helper
        const extractSenderInfo = (from: string) => {
            const matchWithBrackets = from.match(/^(.+?)\s*<([^>]+)>/);
            if (matchWithBrackets) {
                const name = matchWithBrackets[1].replace(/^["']|["']$/g, '').trim();
                return { name, email: matchWithBrackets[2] };
            }
            const emailParts = from.split('@');
            if (emailParts.length >= 2) {
                const username = emailParts[0];
                const readableName = username.replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
                return { name: readableName || username, email: from };
            }
            return { name: from, email: from };
        };

        // Avatar colors
        const getAvatarColor = (name: string) => {
            const colors = [
                'from-blue-500 to-cyan-400',
                'from-purple-500 to-pink-400',
                'from-green-500 to-emerald-400',
                'from-orange-500 to-amber-400',
                'from-red-500 to-rose-400',
                'from-indigo-500 to-violet-400'
            ];
            let hash = 0;
            for (let i = 0; i < name.length; i++) {
                hash = name.charCodeAt(i) + ((hash << 5) - hash);
            }
            return colors[Math.abs(hash) % colors.length];
        };

        return (
            <div className="min-h-screen bg-gradient-to-br from-[#0a0a12] via-[#0d0d18] to-[#0a0a12]">
                {/* Header */}
                <header className="bg-black/40 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50">
                    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setSelectedAlias(null)}
                                className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-all"
                            >
                                <ArrowLeft className="w-5 h-5 text-gray-400" />
                            </button>
                            <div>
                                <h1 className="text-lg font-bold text-white">Inbox</h1>
                                <p className="text-cyber-primary font-medium text-sm">{selectedAlias}@rafxyz.biz.id</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="px-3 py-1.5 bg-cyber-primary/20 text-cyber-primary text-sm font-medium rounded-lg">
                                {inboxEmails.length} messages
                            </span>
                        </div>
                    </div>
                </header>

                <div className="max-w-4xl mx-auto p-4 sm:p-6">
                    {/* Emails */}
                    {inboxEmails.length === 0 ? (
                        <div className="text-center py-20 bg-white/5 rounded-2xl border border-white/10">
                            <Inbox className="w-20 h-20 text-gray-700 mx-auto mb-4" />
                            <p className="text-gray-400 font-medium text-lg">No emails in this inbox</p>
                            <p className="text-gray-600 text-sm mt-2">Emails sent to this address will appear here</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {inboxEmails.map(email => {
                                const senderInfo = extractSenderInfo(email.from);
                                return (
                                    <div
                                        key={email.id}
                                        className="bg-gradient-to-b from-[#1a1a2e] to-[#16162a] border border-white/10 rounded-2xl overflow-hidden hover:border-cyber-primary/30 transition-all shadow-xl"
                                    >
                                        {/* Top Bar */}
                                        <div className="flex items-center justify-between px-5 py-3 bg-black/30 border-b border-white/5">
                                            <span className="px-2.5 py-1 bg-cyber-primary/20 text-cyber-primary text-xs font-medium rounded">
                                                INBOX
                                            </span>
                                            <span className="text-xs text-gray-500 font-medium">
                                                {formatDate(email.receivedAt)}
                                            </span>
                                        </div>

                                        {/* Subject */}
                                        <div className="px-6 pt-5 pb-3">
                                            <h2 className="text-xl font-semibold text-white leading-tight">
                                                {email.subject || '(No Subject)'}
                                            </h2>
                                        </div>

                                        {/* Sender Info */}
                                        <div className="px-6 pb-4 flex items-center gap-4">
                                            {/* Avatar */}
                                            <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${getAvatarColor(senderInfo.name)} flex items-center justify-center shrink-0 shadow-lg`}>
                                                <span className="text-white font-bold text-sm">
                                                    {senderInfo.name.charAt(0).toUpperCase()}
                                                </span>
                                            </div>

                                            {/* Details */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-xs text-gray-500">From:</span>
                                                    <span className="font-medium text-white">{senderInfo.name}</span>
                                                    <span className="text-sm text-gray-400">({senderInfo.email})</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* To field */}
                                        <div className="mx-6 mb-4 px-4 py-2.5 bg-black/20 rounded-lg border border-white/5 flex items-center gap-2 text-sm">
                                            <Mail className="w-4 h-4 text-gray-500" />
                                            <span className="text-gray-500">To:</span>
                                            <span className="text-gray-300">{email.to}</span>
                                        </div>

                                        {/* Divider */}
                                        <div className="mx-6 border-t border-white/5" />

                                        {/* Body */}
                                        <div className="p-6 max-h-80 overflow-y-auto">
                                            {email.html ? (
                                                <div
                                                    className="prose prose-invert prose-sm max-w-none 
                                                        prose-p:text-gray-300 prose-p:leading-relaxed prose-p:my-3
                                                        prose-a:text-cyber-primary prose-a:no-underline hover:prose-a:underline
                                                        prose-headings:text-white prose-headings:font-semibold
                                                        prose-strong:text-white prose-strong:font-semibold
                                                        prose-ul:text-gray-300 prose-ol:text-gray-300 prose-li:my-1
                                                        prose-blockquote:border-l-cyber-primary prose-blockquote:text-gray-400
                                                        prose-code:bg-black/30 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-cyber-primary"
                                                    dangerouslySetInnerHTML={{
                                                        __html: DOMPurify.sanitize(email.html, {
                                                            ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'div', 'span', 'hr'],
                                                            ALLOWED_ATTR: ['href', 'alt', 'title', 'class', 'style', 'target', 'rel'],
                                                            FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'button', 'iframe', 'img'],
                                                            FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'src']
                                                        })
                                                    }}
                                                />
                                            ) : (
                                                <div className="bg-black/20 rounded-lg p-5 border border-white/5">
                                                    <pre className="text-gray-300 whitespace-pre-wrap font-sans text-sm leading-relaxed">
                                                        {email.body || '(No content)'}
                                                    </pre>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0a0a12] via-[#0d0d18] to-[#0a0a12]">
            {/* Header */}
            <header className="bg-black/40 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-cyber-primary to-blue-500 rounded-xl flex items-center justify-center">
                            <Shield className="w-5 h-5 text-black" />
                        </div>
                        <div>
                            <h1 className="text-lg sm:text-xl font-bold text-white">Admin Panel</h1>
                            <p className="text-xs text-gray-500 font-medium hidden sm:block">GhostMail Control Center</p>
                        </div>
                    </div>
                    <button
                        onClick={onLogout}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl transition-all text-sm"
                    >
                        <LogOut className="w-4 h-4" />
                        Logout
                    </button>
                </div>
            </header>

            {/* Stats Cards - Consistent Cyan Theme */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-6 sm:mb-8">
                    <div className="bg-gradient-to-br from-cyan-500/20 to-cyan-600/5 border border-cyan-500/20 rounded-xl sm:rounded-2xl p-3 sm:p-5">
                        <Mail className="w-6 h-6 sm:w-8 sm:h-8 text-cyan-400 mb-2 sm:mb-3" />
                        <p className="text-xl sm:text-3xl font-bold text-white">{stats.totalEmails}</p>
                        <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider">Total Emails</p>
                    </div>
                    <div className="bg-gradient-to-br from-cyan-500/15 to-cyan-600/5 border border-cyan-500/15 rounded-xl sm:rounded-2xl p-3 sm:p-5">
                        <Activity className="w-6 h-6 sm:w-8 sm:h-8 text-cyan-400 mb-2 sm:mb-3" />
                        <p className="text-xl sm:text-3xl font-bold text-white">{stats.activeEmails}</p>
                        <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider">Active</p>
                    </div>
                    <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border border-cyan-500/10 rounded-xl sm:rounded-2xl p-3 sm:p-5">
                        <Users className="w-6 h-6 sm:w-8 sm:h-8 text-cyan-400 mb-2 sm:mb-3" />
                        <p className="text-xl sm:text-3xl font-bold text-white">{stats.totalUsers}</p>
                        <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider">Registered</p>
                    </div>
                    <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border border-cyan-500/10 rounded-xl sm:rounded-2xl p-3 sm:p-5">
                        <Users className="w-6 h-6 sm:w-8 sm:h-8 text-cyan-400 mb-2 sm:mb-3" />
                        <p className="text-xl sm:text-3xl font-bold text-white">{stats.anonymous}</p>
                        <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider">Anonymous</p>
                    </div>
                </div>

                {/* Tabs - Scrollable on mobile */}
                <div className="overflow-x-auto pb-2 mb-3">
                    <div className="flex gap-1.5 sm:gap-2 min-w-max">
                        <button
                            onClick={() => setActiveTab('emails')}
                            className={`px-2.5 sm:px-5 py-2 sm:py-3 rounded-lg sm:rounded-xl flex items-center gap-1 sm:gap-2 font-medium transition-all text-xs sm:text-base whitespace-nowrap ${activeTab === 'emails'
                                ? 'bg-cyber-primary text-black'
                                : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                }`}
                        >
                            <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            Emails
                        </button>
                        <button
                            onClick={() => setActiveTab('users')}
                            className={`px-2.5 sm:px-5 py-2 sm:py-3 rounded-lg sm:rounded-xl flex items-center gap-1 sm:gap-2 font-medium transition-all text-xs sm:text-base whitespace-nowrap ${activeTab === 'users'
                                ? 'bg-cyber-primary text-black'
                                : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                }`}
                        >
                            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            Users
                        </button>
                        <button
                            onClick={() => setActiveTab('config')}
                            className={`px-2.5 sm:px-5 py-2 sm:py-3 rounded-lg sm:rounded-xl flex items-center gap-1 sm:gap-2 font-medium transition-all text-xs sm:text-base whitespace-nowrap ${activeTab === 'config'
                                ? 'bg-cyber-primary text-black'
                                : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                }`}
                        >
                            <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            Config
                        </button>
                        <button
                            onClick={() => setActiveTab('spam')}
                            className={`px-2.5 sm:px-5 py-2 sm:py-3 rounded-lg sm:rounded-xl flex items-center gap-1 sm:gap-2 font-medium transition-all text-xs sm:text-base whitespace-nowrap ${activeTab === 'spam'
                                ? 'bg-cyber-primary text-black'
                                : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                }`}
                        >
                            <ShieldAlert className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            Spam
                        </button>
                        <button
                            onClick={() => setActiveTab('domains')}
                            className={`px-2.5 sm:px-5 py-2 sm:py-3 rounded-lg sm:rounded-xl flex items-center gap-1 sm:gap-2 font-medium transition-all text-xs sm:text-base whitespace-nowrap ${activeTab === 'domains'
                                ? 'bg-cyber-primary text-black'
                                : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                }`}
                        >
                            <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            Domains
                        </button>
                        <button
                            onClick={() => setActiveTab('tools')}
                            className={`px-2.5 sm:px-5 py-2 sm:py-3 rounded-lg sm:rounded-xl flex items-center gap-1 sm:gap-2 font-medium transition-all text-xs sm:text-base whitespace-nowrap ${activeTab === 'tools'
                                ? 'bg-cyber-primary text-black'
                                : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                }`}
                        >
                            <Wrench className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            Tools
                        </button>
                    </div>
                </div>

                {/* Content */}
                {activeTab === 'emails' && (
                    <div className="bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl overflow-hidden">
                        {/* Table Header */}
                        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-white/10">
                            <h2 className="font-semibold text-white">All Email Addresses</h2>
                            <button
                                onClick={fetchEmails}
                                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-gray-400 hover:text-white transition-all"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Refresh
                            </button>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-white/5">
                                        <th className="px-3 sm:px-6 py-3 sm:py-4">Email Address</th>
                                        <th className="px-3 sm:px-6 py-3 sm:py-4 hidden sm:table-cell">Type</th>
                                        <th className="px-3 sm:px-6 py-3 sm:py-4 hidden md:table-cell">Created</th>
                                        <th className="px-3 sm:px-6 py-3 sm:py-4">Status</th>
                                        <th className="px-3 sm:px-6 py-3 sm:py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {emails.map(email => (
                                        <tr key={email.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-3 sm:px-6 py-3 sm:py-4">
                                                <span className="text-white font-medium text-xs sm:text-sm break-all">{email.email}</span>
                                            </td>
                                            <td className="px-3 sm:px-6 py-3 sm:py-4 hidden sm:table-cell">
                                                <span className={`inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-medium ${email.userId
                                                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                                    : 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                                                    }`}>
                                                    {email.userId ? (
                                                        <><Users className="w-3 h-3" /> User</>
                                                    ) : (
                                                        <><Database className="w-3 h-3" /> Anonymous</>
                                                    )}
                                                </span>
                                            </td>
                                            <td className="px-3 sm:px-6 py-3 sm:py-4 text-gray-400 text-sm font-medium hidden md:table-cell">
                                                {formatDate(email.createdAt)}
                                            </td>
                                            <td className="px-3 sm:px-6 py-3 sm:py-4">
                                                {/* Check permanent: expiresAt > 50 years from now */}
                                                {email.expiresAt && email.expiresAt > Date.now() + (50 * 365 * 24 * 60 * 60 * 1000) ? (
                                                    <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                                        Permanent
                                                    </span>
                                                ) : email.isActive ? (
                                                    <div className="flex flex-col">
                                                        <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-medium bg-green-500/20 text-green-300 border border-green-500/30 w-fit">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                                            Active
                                                        </span>
                                                        {email.expiresAt && (
                                                            <span className="text-[10px] text-gray-500 mt-1">
                                                                Exp: {new Date(email.expiresAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-medium bg-red-500/20 text-red-300 border border-red-500/30">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                                                        Expired
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-2 sm:px-6 py-2 sm:py-4">
                                                <div className="flex items-center justify-end gap-1">
                                                    {/* Recovery Key Button */}
                                                    {email.recoveryToken && (
                                                        <button
                                                            onClick={() => setRecoveryEmail(email)}
                                                            className="p-1.5 sm:px-2 sm:py-1 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 rounded-lg text-xs font-medium transition-all"
                                                            title="View Recovery Key"
                                                        >
                                                            <Shield className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => fetchInbox(email.alias)}
                                                        className="p-1.5 sm:px-2 sm:py-1 bg-cyber-primary/10 hover:bg-cyber-primary/20 border border-cyber-primary/30 text-cyber-primary rounded-lg text-xs font-medium transition-all"
                                                        title="View Inbox"
                                                    >
                                                        <Eye className="w-3.5 h-3.5" />
                                                    </button>
                                                    {deleteConfirm === email.alias ? (
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => deleteEmail(email.alias)}
                                                                className="p-1.5 sm:px-2 sm:py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-medium transition-all"
                                                            >
                                                                <Check className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={() => setDeleteConfirm(null)}
                                                                className="p-1.5 sm:px-2 sm:py-1 bg-white/10 hover:bg-white/20 text-gray-400 rounded-lg text-xs font-medium transition-all"
                                                            >
                                                                <X className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => setDeleteConfirm(email.alias)}
                                                            className="p-1.5 sm:px-2 sm:py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-xs font-medium transition-all"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {emails.length === 0 && (
                            <div className="text-center py-12">
                                <Mail className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                                <p className="text-gray-500">No email addresses found</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'users' && (
                    <div className="bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl overflow-hidden">
                        {/* Table Header */}
                        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-white/10">
                            <h2 className="font-semibold text-white">Registered Users</h2>
                            <button
                                onClick={fetchUsers}
                                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-gray-400 hover:text-white transition-all"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Refresh
                            </button>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-white/5">
                                        <th className="px-3 sm:px-6 py-3 sm:py-4">Email</th>
                                        <th className="px-3 sm:px-6 py-3 sm:py-4 hidden sm:table-cell">Name</th>
                                        <th className="px-3 sm:px-6 py-3 sm:py-4 hidden md:table-cell">Registered</th>
                                        <th className="px-3 sm:px-6 py-3 sm:py-4">Emails</th>
                                        <th className="px-3 sm:px-6 py-3 sm:py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {users.map(user => (
                                        <tr key={user.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-3 sm:px-6 py-3 sm:py-4">
                                                <span className="text-white font-medium text-xs sm:text-sm break-all">{user.email}</span>
                                            </td>
                                            <td className="px-3 sm:px-6 py-3 sm:py-4 text-gray-400 hidden sm:table-cell">
                                                {user.name || '—'}
                                            </td>
                                            <td className="px-3 sm:px-6 py-3 sm:py-4 text-gray-400 text-sm font-medium hidden md:table-cell">
                                                {formatDate(user.created_at)}
                                            </td>
                                            <td className="px-3 sm:px-6 py-3 sm:py-4">
                                                <span className="px-2 sm:px-2.5 py-1 bg-blue-500/20 text-blue-300 text-xs font-medium rounded-lg">
                                                    {user.email_count}<span className="hidden sm:inline"> emails</span>
                                                </span>
                                            </td>
                                            <td className="px-3 sm:px-6 py-3 sm:py-4">
                                                <div className="flex items-center justify-end gap-1 sm:gap-2 flex-wrap">
                                                    {deleteUserConfirm === user.id ? (
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => deleteUser(user.id)}
                                                                className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-medium transition-all"
                                                            >
                                                                Confirm
                                                            </button>
                                                            <button
                                                                onClick={() => setDeleteUserConfirm(null)}
                                                                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-gray-400 rounded-lg text-xs font-medium transition-all"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => setDeleteUserConfirm(user.id)}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-xs font-medium transition-all"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                            Delete
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {users.length === 0 && (
                            <div className="text-center py-12">
                                <Users className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                                <p className="text-gray-500">No registered users found</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'config' && (
                    <div className="space-y-4 sm:space-y-6">
                        {/* Login Toggle */}
                        <div className="bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3 sm:gap-4">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-500/20 rounded-lg sm:rounded-xl flex items-center justify-center">
                                    <Users className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-white">User Login</h3>
                                    <p className="text-sm text-gray-500">Allow users to login to their accounts</p>
                                </div>
                            </div>
                            <button
                                onClick={() => updateConfig('loginEnabled', !config.loginEnabled)}
                                className={`relative w-14 h-8 rounded-full transition-all ${config.loginEnabled ? 'bg-green-500' : 'bg-gray-600'
                                    }`}
                            >
                                <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg transition-all ${config.loginEnabled ? 'left-7' : 'left-1'
                                    }`} />
                            </button>
                        </div>

                        {/* Register Toggle */}
                        <div className="bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3 sm:gap-4">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-500/20 rounded-lg sm:rounded-xl flex items-center justify-center">
                                    <Users className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-white">User Registration</h3>
                                    <p className="text-sm text-gray-500">Allow new users to create accounts</p>
                                </div>
                            </div>
                            <button
                                onClick={() => updateConfig('registerEnabled', !config.registerEnabled)}
                                className={`relative w-14 h-8 rounded-full transition-all ${config.registerEnabled ? 'bg-green-500' : 'bg-gray-600'
                                    }`}
                            >
                                <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg transition-all ${config.registerEnabled ? 'left-7' : 'left-1'
                                    }`} />
                            </button>
                        </div>

                        {/* Warning */}
                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-5 flex items-start gap-4">
                            <AlertCircle className="w-6 h-6 text-yellow-500 shrink-0" />
                            <div>
                                <p className="font-medium text-yellow-400">Important</p>
                                <p className="text-sm text-yellow-400/80 mt-1">
                                    Disabling login/register will prevent users from accessing their accounts.
                                    Anonymous email generation will still work.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'spam' && (
                    <div className="space-y-4 sm:space-y-6">
                        {/* Header with Add Input */}
                        <div className="bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6">
                            <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-yellow-500/20 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0">
                                    <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-white text-sm sm:text-base">Spam Filter Keywords</h3>
                                    <p className="text-xs sm:text-sm text-gray-500">
                                        Emails containing these keywords will not be forwarded to Gmail
                                    </p>
                                </div>
                            </div>

                            {/* Add Custom Keyword */}
                            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                                <input
                                    type="text"
                                    value={newKeyword}
                                    onChange={(e) => setNewKeyword(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && addSpamKeyword()}
                                    placeholder="Add new keyword (e.g., offer)"
                                    className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-black/30 border border-white/10 rounded-lg sm:rounded-xl text-white placeholder-gray-500 focus:border-yellow-500/50 focus:outline-none transition-all text-sm"
                                />
                                <button
                                    onClick={addSpamKeyword}
                                    disabled={addingKeyword || !newKeyword.trim()}
                                    className="px-4 sm:px-5 py-2.5 sm:py-3 bg-yellow-500 hover:bg-yellow-400 disabled:bg-yellow-500/50 text-black font-medium rounded-lg sm:rounded-xl flex items-center justify-center gap-2 transition-all text-sm"
                                >
                                    <Plus className="w-4 h-4" />
                                    Add
                                </button>
                            </div>
                        </div>

                        {/* Custom Keywords */}
                        <div className="bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl overflow-hidden">
                            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-white/10 flex items-center justify-between">
                                <h3 className="font-semibold text-white text-sm sm:text-base">Custom Keywords</h3>
                                <span className="px-2 sm:px-3 py-1 bg-yellow-500/20 text-yellow-400 text-xs sm:text-sm font-medium rounded-lg">
                                    {customSpamKeywords.length}
                                </span>
                            </div>
                            <div className="p-3 sm:p-4">
                                {customSpamKeywords.length === 0 ? (
                                    <p className="text-gray-500 text-center py-4">
                                        No custom keywords yet. Add a keyword above.
                                    </p>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {customSpamKeywords.map((keyword) => (
                                            <div
                                                key={keyword}
                                                className="flex items-center gap-2 px-3 py-2 bg-yellow-500/20 border border-yellow-500/30 rounded-lg group"
                                            >
                                                <span className="text-yellow-300 text-sm">{keyword}</span>
                                                <button
                                                    onClick={() => deleteSpamKeyword(keyword)}
                                                    className="text-yellow-500/50 hover:text-red-400 transition-colors"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Default Keywords (read-only) */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                                <div>
                                    <h3 className="font-semibold text-white">Default Keywords</h3>
                                    <p className="text-xs text-gray-500 mt-1">System defaults, cannot be removed</p>
                                </div>
                                <span className="px-3 py-1 bg-gray-500/20 text-gray-400 text-sm font-medium rounded-lg">
                                    {defaultSpamKeywords.length}
                                </span>
                            </div>
                            <div className="p-4 max-h-64 overflow-y-auto">
                                <div className="flex flex-wrap gap-2">
                                    {defaultSpamKeywords.map((keyword) => (
                                        <span
                                            key={keyword}
                                            className="px-3 py-1.5 bg-gray-500/10 border border-gray-500/20 text-gray-400 text-sm rounded-lg"
                                        >
                                            {keyword}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Info */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-start gap-4">
                            <AlertCircle className="w-6 h-6 text-cyan-400 shrink-0" />
                            <div>
                                <p className="font-medium text-white">How Spam Filter Works</p>
                                <p className="text-sm text-gray-400 mt-1">
                                    Emails with subject or sender containing the keywords above will:
                                </p>
                                <ul className="text-sm text-gray-500 mt-2 list-disc list-inside space-y-1">
                                    <li>Remain in the website inbox</li>
                                    <li>Display in the "Spam / Promotions" section</li>
                                    <li>NOT be forwarded to Gmail</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

                {/* Domains Tab Content */}
                {activeTab === 'domains' && (
                    <div className="space-y-4 sm:space-y-6">
                        {/* Add Domain Form */}
                        <div className="bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6">
                            <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
                                <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
                                Add Public Domain
                            </h3>
                            <p className="text-xs sm:text-sm text-gray-400 mb-3 sm:mb-4">
                                Add domains that will be available for users when generating random or custom email aliases.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                                <input
                                    type="text"
                                    value={newDomain}
                                    onChange={(e) => setNewDomain(e.target.value)}
                                    placeholder="example.com"
                                    className="flex-1 bg-cyber-dark border border-white/10 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-white placeholder-gray-500 focus:border-cyber-primary outline-none text-sm"
                                    onKeyPress={(e) => e.key === 'Enter' && addPublicDomain()}
                                />
                                <button
                                    onClick={addPublicDomain}
                                    disabled={addingDomain || !newDomain.trim()}
                                    className="px-4 sm:px-6 py-2.5 sm:py-3 bg-cyber-primary hover:bg-[#4df4ff] text-black font-bold rounded-lg sm:rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                                >
                                    {addingDomain ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                    <span className="hidden sm:inline">Add</span> Domain
                                </button>
                            </div>
                        </div>

                        {/* Domains List */}
                        <div className="bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl overflow-hidden">
                            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-white/10">
                                <h2 className="font-semibold text-white text-sm sm:text-base">Public Domains ({publicDomains.length})</h2>
                                <button
                                    onClick={fetchPublicDomains}
                                    className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg sm:rounded-xl text-xs sm:text-sm text-gray-400 hover:text-white transition-all"
                                >
                                    <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                    <span className="hidden sm:inline">Refresh</span>
                                </button>
                            </div>

                            {publicDomains.length === 0 ? (
                                <div className="p-12 text-center">
                                    <Globe className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                                    <p className="text-gray-400">No public domains configured</p>
                                    <p className="text-sm text-gray-500 mt-1">Add a domain above to get started. The default domain from environment will be used as fallback.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-white/5 text-left text-xs font-medium text-gray-400 uppercase">
                                                <th className="px-3 sm:px-6 py-3 sm:py-4">Domain</th>
                                                <th className="px-3 sm:px-6 py-3 sm:py-4">Status</th>
                                                <th className="px-3 sm:px-6 py-3 sm:py-4 hidden sm:table-cell">Added</th>
                                                <th className="px-3 sm:px-6 py-3 sm:py-4 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {publicDomains.map((domain) => (
                                                <tr key={domain.id} className="hover:bg-white/5 transition-colors">
                                                    <td className="px-3 sm:px-6 py-2 sm:py-4">
                                                        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                                                            <span className="text-white font-medium text-xs sm:text-sm break-all">{domain.domain}</span>
                                                            {domain.isDefault && (
                                                                <span className="px-1.5 sm:px-2 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] sm:text-xs rounded-full border border-blue-500/30">Default</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 sm:px-6 py-2 sm:py-4">
                                                        <button
                                                            onClick={() => toggleDomainActive(domain)}
                                                            className={`inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-medium transition-colors ${domain.is_active
                                                                ? 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30'
                                                                : 'bg-gray-500/20 text-gray-400 border border-gray-500/30 hover:bg-gray-500/30'
                                                                }`}
                                                        >
                                                            {domain.is_active ? (
                                                                <>
                                                                    <ToggleRight className="w-3 h-3 sm:w-4 sm:h-4" />
                                                                    <span className="hidden sm:inline">Active</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <ToggleLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                                                                    <span className="hidden sm:inline">Disabled</span>
                                                                </>
                                                            )}
                                                        </button>
                                                    </td>
                                                    <td className="px-3 sm:px-6 py-2 sm:py-4 text-gray-400 text-sm font-medium hidden sm:table-cell">
                                                        {formatDate(domain.created_at)}
                                                    </td>
                                                    <td className="px-3 sm:px-6 py-2 sm:py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {/* Verify DNS Button */}
                                                            <button
                                                                onClick={() => verifyDomainDNS(domain)}
                                                                disabled={verifyingDomainId === domain.id}
                                                                className={`p-1.5 sm:px-3 sm:py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${domainVerificationStatus[domain.id] === 'verified'
                                                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                                    : domainVerificationStatus[domain.id] === 'failed'
                                                                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                                                        : 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                                                    }`}
                                                                title="Verify DNS"
                                                            >
                                                                {verifyingDomainId === domain.id ? (
                                                                    <Loader className="w-3 h-3 animate-spin" />
                                                                ) : domainVerificationStatus[domain.id] === 'verified' ? (
                                                                    <CheckCircle className="w-3 h-3" />
                                                                ) : domainVerificationStatus[domain.id] === 'failed' ? (
                                                                    <AlertCircle className="w-3 h-3" />
                                                                ) : (
                                                                    <Shield className="w-3 h-3" />
                                                                )}
                                                                <span className="hidden sm:inline">
                                                                    {domainVerificationStatus[domain.id] === 'verified' ? 'Verified' :
                                                                        domainVerificationStatus[domain.id] === 'failed' ? 'Failed' : 'Verify'}
                                                                </span>
                                                            </button>
                                                            {/* Delete Button */}
                                                            {!domain.isDefault ? (
                                                                <button
                                                                    onClick={() => deletePublicDomain(domain.id, domain.domain)}
                                                                    className="p-1.5 sm:px-3 sm:py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                                                                    title="Delete"
                                                                >
                                                                    <Trash2 className="w-3 h-3" />
                                                                    <span className="hidden sm:inline">Delete</span>
                                                                </button>
                                                            ) : (
                                                                <span className="text-[10px] sm:text-xs text-gray-500">System</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Info */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-start gap-4">
                            <Globe className="w-6 h-6 text-cyan-400 shrink-0" />
                            <div>
                                <p className="font-medium text-white">How Public Domains Work</p>
                                <ul className="text-sm text-gray-400 mt-2 list-disc list-inside space-y-1">
                                    <li>Active domains will appear in the domain dropdown for all users</li>
                                    <li>Random mode picks a random domain from the active list</li>
                                    <li>The <strong className="text-cyan-400">Default</strong> domain is your system domain from environment</li>
                                    <li>Disabled domains won't appear in the dropdown but email routing still works</li>
                                </ul>
                            </div>
                        </div>

                        {/* Step-by-Step Guide */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6">
                            <p className="font-medium text-white text-lg">📋 How to Add a New Domain (Complete Guide)</p>

                            {/* Step 1 */}
                            <div className="bg-white/5 rounded-xl p-4">
                                <p className="font-semibold text-cyan-400 mb-2">1. Own a Domain</p>
                                <p className="text-sm text-gray-400">
                                    Purchase a domain from a registrar:
                                </p>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    <a href="https://dash.cloudflare.com" target="_blank" rel="noopener noreferrer" className="px-3 py-1 bg-cyan-500/10 text-cyan-400 rounded-lg text-xs hover:bg-cyan-500/20 border border-cyan-500/20">Cloudflare →</a>
                                    <a href="https://namecheap.com" target="_blank" rel="noopener noreferrer" className="px-3 py-1 bg-cyan-500/10 text-cyan-400 rounded-lg text-xs hover:bg-cyan-500/20 border border-cyan-500/20">Namecheap →</a>
                                    <a href="https://godaddy.com" target="_blank" rel="noopener noreferrer" className="px-3 py-1 bg-cyan-500/10 text-cyan-400 rounded-lg text-xs hover:bg-cyan-500/20 border border-cyan-500/20">GoDaddy →</a>
                                    <a href="https://niagahoster.co.id" target="_blank" rel="noopener noreferrer" className="px-3 py-1 bg-cyan-500/10 text-cyan-400 rounded-lg text-xs hover:bg-cyan-500/20 border border-cyan-500/20">Niagahoster →</a>
                                </div>
                            </div>

                            {/* Step 2 */}
                            <div className="bg-white/5 rounded-xl p-4">
                                <p className="font-semibold text-cyan-400 mb-2">2. Add Domain to Cloudflare</p>
                                <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
                                    <li>Login to <span className="font-medium bg-cyan-500/10 text-cyan-400 px-1 rounded">dash.cloudflare.com</span></li>
                                    <li>Click "Add a site" and enter your domain</li>
                                    <li>Select Free plan (or any plan)</li>
                                    <li>Update nameservers at your registrar to Cloudflare's nameservers</li>
                                </ul>
                            </div>

                            {/* Step 3: DNS Records */}
                            <div className="bg-white/5 rounded-xl p-4">
                                <p className="font-semibold text-cyan-400 mb-3">3. Add DNS Records</p>
                                <p className="text-sm text-gray-400 mb-4">Add the following DNS records in Cloudflare DNS settings:</p>

                                <div className="space-y-4">
                                    {/* SPF Record Card */}
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-8 h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                                                <span className="text-sm">📝</span>
                                            </div>
                                            <div>
                                                <p className="font-semibold text-white text-sm">TXT Record</p>
                                                <p className="text-xs text-gray-500">SPF - Anti Spam Protection</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-black/30 rounded-lg p-3">
                                                <p className="text-xs text-gray-500 mb-1">Type</p>
                                                <div className="flex items-center justify-between">
                                                    <p className="text-white font-medium font-bold">TXT</p>
                                                </div>
                                            </div>
                                            <div className="bg-black/30 rounded-lg p-3">
                                                <p className="text-xs text-gray-500 mb-1">Name / Host</p>
                                                <div className="flex items-center justify-between">
                                                    <p className="text-white font-medium font-bold">@</p>
                                                </div>
                                            </div>
                                            <div className="col-span-2 bg-black/30 rounded-lg p-3">
                                                <p className="text-xs text-gray-500 mb-1">Value</p>
                                                <div className="flex items-center justify-between gap-2">
                                                    <code className="text-cyan-400 text-sm font-medium break-all">v=spf1 include:_spf.mx.cloudflare.net ~all</code>
                                                    <button
                                                        onClick={() => { navigator.clipboard.writeText('v=spf1 include:_spf.mx.cloudflare.net ~all'); toast.success('SPF value copied!'); }}
                                                        className="p-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 rounded-lg transition-colors shrink-0"
                                                    >
                                                        <Copy className="w-4 h-4 text-cyan-400" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* MX Records Card */}
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-8 h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                                                <span className="text-sm">📬</span>
                                            </div>
                                            <div>
                                                <p className="font-semibold text-white text-sm">MX Records</p>
                                                <p className="text-xs text-gray-500">Email Routing - Add all 3 records</p>
                                            </div>
                                        </div>
                                        <div className="bg-black/30 rounded-xl overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="bg-white/5 border-b border-white/10">
                                                        <th className="text-left py-3 px-4 text-gray-400 font-medium text-xs uppercase tracking-wide">Type</th>
                                                        <th className="text-left py-3 px-4 text-gray-400 font-medium text-xs uppercase tracking-wide">Name</th>
                                                        <th className="text-left py-3 px-4 text-gray-400 font-medium text-xs uppercase tracking-wide">Priority</th>
                                                        <th className="text-left py-3 px-4 text-gray-400 font-medium text-xs uppercase tracking-wide">Mail Server</th>
                                                        <th className="text-right py-3 px-4 text-gray-400 font-medium text-xs uppercase tracking-wide">Copy</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    <tr className="hover:bg-white/5 transition-colors">
                                                        <td className="py-3 px-4"><span className="bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded font-medium text-xs">MX</span></td>
                                                        <td className="py-3 px-4 text-white font-medium">@</td>
                                                        <td className="py-3 px-4"><span className="bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded font-medium text-xs">55</span></td>
                                                        <td className="py-3 px-4 text-cyan-400 font-medium">route1.mx.cloudflare.net</td>
                                                        <td className="py-3 px-4 text-right">
                                                            <button
                                                                onClick={() => { navigator.clipboard.writeText('route1.mx.cloudflare.net'); toast.success('Copied!'); }}
                                                                className="p-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 rounded-lg transition-colors"
                                                            >
                                                                <Copy className="w-3 h-3 text-cyan-400" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                    <tr className="hover:bg-white/5 transition-colors">
                                                        <td className="py-3 px-4"><span className="bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded font-medium text-xs">MX</span></td>
                                                        <td className="py-3 px-4 text-white font-medium">@</td>
                                                        <td className="py-3 px-4"><span className="bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded font-medium text-xs">75</span></td>
                                                        <td className="py-3 px-4 text-cyan-400 font-medium">route2.mx.cloudflare.net</td>
                                                        <td className="py-3 px-4 text-right">
                                                            <button
                                                                onClick={() => { navigator.clipboard.writeText('route2.mx.cloudflare.net'); toast.success('Copied!'); }}
                                                                className="p-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 rounded-lg transition-colors"
                                                            >
                                                                <Copy className="w-3 h-3 text-cyan-400" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                    <tr className="hover:bg-white/5 transition-colors">
                                                        <td className="py-3 px-4"><span className="bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded font-medium text-xs">MX</span></td>
                                                        <td className="py-3 px-4 text-white font-medium">@</td>
                                                        <td className="py-3 px-4"><span className="bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded font-medium text-xs">95</span></td>
                                                        <td className="py-3 px-4 text-cyan-400 font-medium">route3.mx.cloudflare.net</td>
                                                        <td className="py-3 px-4 text-right">
                                                            <button
                                                                onClick={() => { navigator.clipboard.writeText('route3.mx.cloudflare.net'); toast.success('Copied!'); }}
                                                                className="p-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 rounded-lg transition-colors"
                                                            >
                                                                <Copy className="w-3 h-3 text-cyan-400" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Step 4: Email Routing */}
                            <div className="bg-white/5 rounded-xl p-4">
                                <p className="font-semibold text-cyan-400 mb-2">4. Setup Email Routing in Cloudflare</p>
                                <ol className="text-sm text-gray-400 space-y-2 list-decimal list-inside">
                                    <li>Open <span className="font-medium bg-cyan-500/10 text-cyan-400 px-1 rounded border border-cyan-500/20">Cloudflare Dashboard</span> → select your domain</li>
                                    <li>Click <span className="font-medium bg-cyan-500/10 text-cyan-400 px-1 rounded border border-cyan-500/20">Email → Email Routing</span></li>
                                    <li>Go to <span className="font-medium bg-cyan-500/10 text-cyan-400 px-1 rounded border border-cyan-500/20">Routing rules</span> tab</li>
                                    <li>In <strong>Catch-all address</strong> section, click <span className="font-medium bg-cyan-500/10 text-cyan-400 px-1 rounded border border-cyan-500/20">Edit</span></li>
                                    <li>Select action: <span className="font-medium bg-cyan-500/10 text-cyan-400 px-1 rounded border border-cyan-500/20">Send to a Worker</span></li>
                                    <li>Select destination: <span className="font-medium bg-cyan-500/10 text-cyan-400 px-1 rounded border border-cyan-500/20">ghostmail-worker</span></li>
                                    <li>Make sure status is: <span className="text-cyan-400 font-bold">Active ✓</span></li>
                                    <li>Click <span className="font-medium bg-cyan-500/10 text-cyan-400 px-1 rounded border border-cyan-500/20">Save</span></li>
                                </ol>
                            </div>

                            {/* Step 5: Email Forwarding (Optional) */}
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                <p className="font-semibold text-cyan-400 mb-2">5. Setup Email Forwarding (Optional)</p>
                                <p className="text-sm text-gray-400 mb-3">Forward to Gmail: To receive copies of emails in your personal inbox:</p>
                                <ol className="text-sm text-gray-400 space-y-2 list-decimal list-inside">
                                    <li><strong>Add Gmail to Cloudflare's verified destination list:</strong>
                                        <ul className="mt-1 ml-6 space-y-1 list-disc text-gray-500">
                                            <li>Go to Cloudflare Dashboard → your domain</li>
                                            <li>Click <span className="font-medium bg-cyan-500/10 text-cyan-400 px-1 rounded border border-cyan-500/20">Email → Email Routing → Destination addresses</span></li>
                                            <li>Click "Add destination address" and add your Gmail</li>
                                            <li>Check your Gmail and click the verification link from Cloudflare</li>
                                        </ul>
                                    </li>
                                    <li>Emails will be stored in GhostMail AND forwarded to your Gmail</li>
                                </ol>
                            </div>

                            {/* Step 6: Add to GhostMail */}
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                <p className="font-semibold text-cyan-400 mb-2">6. Add Domain to GhostMail</p>
                                <p className="text-sm text-gray-400">
                                    Enter the domain in the form above and click <strong className="text-white">"Add Domain"</strong>. The domain will be available for all users!
                                </p>
                            </div>

                            {/* Tips */}
                            <div className="bg-gray-500/10 rounded-xl p-4">
                                <p className="font-semibold text-gray-300 mb-2">💡 Tips</p>
                                <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
                                    <li>If asked for TTL, use <span className="font-medium bg-gray-500/20 px-1 rounded">3600</span> or "Auto"</li>
                                    <li>For Name/Host, <span className="font-medium bg-gray-500/20 px-1 rounded">@</span> means root domain</li>
                                    <li>If registrar doesn't accept "@", try leaving it empty</li>
                                    <li>DNS propagation can take 5 minutes to 24 hours</li>
                                </ul>
                            </div>

                            <p className="text-xs text-blue-400/60">
                                Domain must have Email Routing configured in Cloudflare before emails will work!
                            </p>
                        </div>
                    </div>
                )}

                {/* Tools Tab Content */}
                {activeTab === 'tools' && (
                    <div className="space-y-4 sm:space-y-6">
                        {/* Header */}
                        <div className="bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6">
                            <div className="flex items-center gap-3 sm:gap-4 mb-4">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-500/20 rounded-lg sm:rounded-xl flex items-center justify-center">
                                    <Wrench className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-white text-sm sm:text-base">Tools Configuration</h3>
                                    <p className="text-xs sm:text-sm text-gray-500">
                                        Enable/disable tools and set access requirements
                                    </p>
                                </div>
                            </div>
                            
                            {/* Legend */}
                            <div className="flex flex-wrap gap-4 text-xs sm:text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                    <span className="text-gray-400">Enabled (Public)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                    <span className="text-gray-400">Enabled (Login Required)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-gray-500"></div>
                                    <span className="text-gray-400">Disabled</span>
                                </div>
                            </div>
                        </div>

                        {/* Tools List */}
                        {toolsConfig ? (
                            <div className="space-y-3">
                                {(Object.keys(toolsConfig) as (keyof ToolsConfigState)[]).map((toolId) => {
                                    const tool = toolsConfig[toolId];
                                    const isUpdating = updatingTool === toolId;
                                    
                                    // Get icon component
                                    const IconComponent = 
                                        tool.icon === 'mail' ? Mail :
                                        tool.icon === 'image' ? Image :
                                        tool.icon === 'file-text' ? FileText :
                                        tool.icon === 'credit-card' ? CreditCard :
                                        tool.icon === 'map-pin' ? MapPin : Wrench;
                                    
                                    return (
                                        <div
                                            key={toolId}
                                            className={`bg-white/5 border rounded-xl sm:rounded-2xl p-4 sm:p-6 transition-all ${
                                                !tool.enabled 
                                                    ? 'border-gray-500/30 opacity-60' 
                                                    : tool.access === 'authenticated'
                                                    ? 'border-yellow-500/30'
                                                    : 'border-green-500/30'
                                            }`}
                                        >
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                {/* Tool Info */}
                                                <div className="flex items-center gap-3 sm:gap-4">
                                                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center ${
                                                        !tool.enabled 
                                                            ? 'bg-gray-500/20' 
                                                            : tool.access === 'authenticated'
                                                            ? 'bg-yellow-500/20'
                                                            : 'bg-green-500/20'
                                                    }`}>
                                                        <IconComponent className={`w-5 h-5 sm:w-6 sm:h-6 ${
                                                            !tool.enabled 
                                                                ? 'text-gray-400' 
                                                                : tool.access === 'authenticated'
                                                                ? 'text-yellow-400'
                                                                : 'text-green-400'
                                                        }`} />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-white text-sm sm:text-base">{tool.name}</h4>
                                                        <p className="text-xs sm:text-sm text-gray-500">{tool.description}</p>
                                                    </div>
                                                </div>

                                                {/* Controls */}
                                                <div className="flex items-center gap-3 sm:gap-4">
                                                    {/* Access Level Toggle */}
                                                    {tool.enabled && (
                                                        <button
                                                            onClick={() => updateToolConfig(
                                                                toolId, 
                                                                'access', 
                                                                tool.access === 'public' ? 'authenticated' : 'public'
                                                            )}
                                                            disabled={isUpdating}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                                                                tool.access === 'public'
                                                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30'
                                                                    : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30'
                                                            }`}
                                                        >
                                                            {tool.access === 'public' ? (
                                                                <>
                                                                    <Globe className="w-3 h-3" />
                                                                    Public
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Users className="w-3 h-3" />
                                                                    Login Required
                                                                </>
                                                            )}
                                                        </button>
                                                    )}

                                                    {/* Enable/Disable Toggle */}
                                                    <button
                                                        onClick={() => updateToolConfig(toolId, 'enabled', !tool.enabled)}
                                                        disabled={isUpdating}
                                                        className={`relative w-14 h-8 rounded-full transition-all ${
                                                            isUpdating ? 'opacity-50 cursor-wait' : ''
                                                        } ${tool.enabled ? 'bg-green-500' : 'bg-gray-600'}`}
                                                    >
                                                        <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg transition-all ${
                                                            tool.enabled ? 'left-7' : 'left-1'
                                                        }`} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-12 bg-white/5 border border-white/10 rounded-2xl">
                                <Loader className="w-8 h-8 text-gray-600 mx-auto mb-4 animate-spin" />
                                <p className="text-gray-500">Loading tools configuration...</p>
                            </div>
                        )}

                        {/* Info */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-start gap-4">
                            <AlertCircle className="w-6 h-6 text-cyan-400 shrink-0" />
                            <div>
                                <p className="font-medium text-white">How Tool Access Works</p>
                                <ul className="text-sm text-gray-400 mt-2 list-disc list-inside space-y-1">
                                    <li><strong className="text-green-400">Public</strong> - Anyone can use the tool without logging in</li>
                                    <li><strong className="text-yellow-400">Login Required</strong> - Only logged-in users can access the tool</li>
                                    <li><strong className="text-gray-400">Disabled</strong> - Tool shows a 404 page to everyone</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

                {/* Recovery Key Modal */}
                {recoveryEmail && (
                    <div
                        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
                        onClick={() => setRecoveryEmail(null)}
                    >
                        <div
                            className="bg-gradient-to-b from-[#1a1a2e] to-[#16162a] border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-yellow-500/20 rounded-lg">
                                        <Shield className="w-5 h-5 text-yellow-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-white font-semibold">Recovery Key Details</h3>
                                        <p className="text-xs text-gray-500">Admin access to recovery information</p>
                                    </div>
                                </div>
                                <button onClick={() => setRecoveryEmail(null)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                                    <X className="w-5 h-5 text-gray-400" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-6 space-y-4">
                                {/* Email Address */}
                                <h4 className="text-center text-cyber-primary font-medium mb-4">{recoveryEmail.email}</h4>

                                {/* Email Field */}
                                <div>
                                    <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">Email</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={recoveryEmail.email}
                                            readOnly
                                            className="flex-1 bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-gray-300 font-medium text-sm"
                                        />
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(recoveryEmail.email);
                                                setCopiedField('email');
                                                setTimeout(() => setCopiedField(null), 2000);
                                                toast.success('Email copied!');
                                            }}
                                            className="p-3 bg-cyber-primary/20 hover:bg-cyber-primary/30 border border-cyber-primary/30 rounded-lg transition-colors"
                                        >
                                            {copiedField === 'email' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-cyber-primary" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Token Field */}
                                <div>
                                    <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">Recovery Token</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={recoveryEmail.recoveryToken || 'No token available'}
                                            readOnly
                                            className="flex-1 bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-yellow-400 font-medium text-sm truncate"
                                        />
                                        <button
                                            onClick={() => {
                                                if (recoveryEmail.recoveryToken) {
                                                    navigator.clipboard.writeText(recoveryEmail.recoveryToken);
                                                    setCopiedField('token');
                                                    setTimeout(() => setCopiedField(null), 2000);
                                                    toast.success('Token copied!');
                                                }
                                            }}
                                            className="p-3 bg-cyber-primary/20 hover:bg-cyber-primary/30 border border-cyber-primary/30 rounded-lg transition-colors"
                                            disabled={!recoveryEmail.recoveryToken}
                                        >
                                            {copiedField === 'token' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-cyber-primary" />}
                                        </button>
                                    </div>
                                </div>

                                {/* URL Field */}
                                <div>
                                    <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">Quick Access URL</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={recoveryEmail.recoveryToken ? `https://raf-tools.vercel.app/tempmail/recover?token=${recoveryEmail.recoveryToken}` : 'No URL available'}
                                            readOnly
                                            className="flex-1 bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-gray-300 font-medium text-sm truncate"
                                        />
                                        <button
                                            onClick={() => {
                                                if (recoveryEmail.recoveryToken) {
                                                    const url = `https://raf-tools.vercel.app/tempmail/recover?token=${recoveryEmail.recoveryToken}`;
                                                    window.open(url, '_blank');
                                                }
                                            }}
                                            className="p-3 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded-lg transition-colors"
                                            disabled={!recoveryEmail.recoveryToken}
                                            title="Open in new tab"
                                        >
                                            <ExternalLink className="w-4 h-4 text-green-400" />
                                        </button>
                                    </div>
                                </div>

                                {/* Status */}
                                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500">Status:</span>
                                        <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-medium ${recoveryEmail.isActive
                                            ? 'bg-green-500/20 text-green-300'
                                            : 'bg-red-500/20 text-red-300'
                                            }`}>
                                            {recoveryEmail.isActive ? 'Active' : 'Expired'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500">Type:</span>
                                        <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-medium ${recoveryEmail.userId
                                            ? 'bg-purple-500/20 text-purple-300'
                                            : 'bg-yellow-500/20 text-yellow-300'
                                            }`}>
                                            {recoveryEmail.userId ? 'Registered User' : 'Anonymous'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 bg-black/20 border-t border-white/5">
                                <button
                                    onClick={() => setRecoveryEmail(null)}
                                    className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
