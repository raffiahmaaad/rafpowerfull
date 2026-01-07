import React, { useMemo, useState, useEffect } from 'react';
import { X, Clock, Mail, Trash2, ExternalLink, ArrowLeft, Bot, Sparkles } from 'lucide-react';
import DOMPurify from 'dompurify';
import toast from 'react-hot-toast';

interface Email {
    id: string;
    from: string;
    senderName?: string;
    to: string;
    subject: string;
    body: string;
    html: string;
    receivedAt: number;
    isSpam?: boolean;
}

interface GeminiSummary {
    summary: string;
    sentiment: 'Positive' | 'Neutral' | 'Urgent' | 'Negative';
    actionItems: string[];
}

interface EmailDetailProps {
    email: Email;
    onClose: () => void;
    onDelete?: (emailId: string) => void;
    isPanel?: boolean;
}

export const EmailDetail: React.FC<EmailDetailProps> = ({ email, onClose, onDelete, isPanel = false }) => {
    const [summary, setSummary] = useState<GeminiSummary | null>(null);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [lastAnalyzedId, setLastAnalyzedId] = useState<string>('');

    // Helper: Try to fix corrupted UTF-8 that was wrongly decoded as Latin-1/Windows-1252
    const tryFixCorruptedUTF8 = (text: string): string => {
        if (!text) return '';
        
        try {
            // Check if text contains Mojibake patterns (UTF-8 decoded as Latin-1)
            const hasMojibake = /[\xC2-\xDF][\x80-\xBF]|[\xE0-\xEF][\x80-\xBF]{2}|â€|Ã|Â/.test(text);
            
            if (hasMojibake) {
                // Convert string to bytes treating each char as a byte value
                const bytes = new Uint8Array(text.length);
                for (let i = 0; i < text.length; i++) {
                    bytes[i] = text.charCodeAt(i) & 0xFF;
                }
                
                // Try to decode as UTF-8
                const decoder = new TextDecoder('utf-8', { fatal: false });
                const decoded = decoder.decode(bytes);
                
                // If decoded result looks better (no replacement chars and has proper chars), use it
                if (decoded && !decoded.includes('\uFFFD') && decoded.length > 0) {
                    // Verify it actually improved - check for common English/readable chars
                    const readableChars = decoded.match(/[a-zA-Z0-9\s.,!?'"()-]/g);
                    if (readableChars && readableChars.length > decoded.length * 0.5) {
                        return decoded;
                    }
                }
            }
        } catch (e) {
            // Fallback to original
        }
        
        // Manual fixes for common patterns that TextDecoder might miss
        return text
            // Right single quote (U+2019) corrupted patterns
            .replace(/â€™/g, "'")
            .replace(/â€˜/g, "'")
            .replace(/â€œ/g, '"')
            .replace(/â€/g, '"')
            // Em/en dashes
            .replace(/â€"/g, '–')
            .replace(/â€"/g, '—')
            // Non-breaking space
            .replace(/Â /g, ' ')
            .replace(/Â·/g, '·')
            // Euro and trademark
            .replace(/â‚¬/g, '€')
            .replace(/â„¢/g, '™')
            // Copyright and registered
            .replace(/Â©/g, '©')
            .replace(/Â®/g, '®')
            // French accents
            .replace(/Ã©/g, 'é').replace(/Ã¨/g, 'è')
            .replace(/Ã /g, 'à').replace(/Ã¢/g, 'â')
            .replace(/Ã´/g, 'ô').replace(/Ã§/g, 'ç')
            .replace(/Ã®/g, 'î').replace(/Ã¯/g, 'ï')
            .replace(/Ã¼/g, 'ü').replace(/Ã¶/g, 'ö')
            // More apostrophe patterns
            .replace(/â€™t/g, "'t").replace(/â€™s/g, "'s")
            .replace(/â€™ll/g, "'ll").replace(/â€™re/g, "'re")
            .replace(/â€™ve/g, "'ve").replace(/â€™d/g, "'d")
            .replace(/â€™m/g, "'m")
            // Unicode right single quote
            .replace(/\u2019/g, "'")
            .replace(/\u201C/g, '"').replace(/\u201D/g, '"')
            // Handle specific broken text patterns
            .replace(/wasná[^a-z]*t/gi, "wasn't")
            .replace(/isná[^a-z]*t/gi, "isn't")
            .replace(/doná[^a-z]*t/gi, "don't")
            .replace(/doesná[^a-z]*t/gi, "doesn't")
            .replace(/cana[^a-z]*t/gi, "can't")
            .replace(/wona[^a-z]*t/gi, "won't")
            .replace(/youa[^a-z]*re/gi, "you're")
            .replace(/theya[^a-z]*re/gi, "they're")
            .replace(/Ia[^a-z]*m\b/gi, "I'm")
            .replace(/Ia[^a-z]*ve\b/gi, "I've")
            .replace(/Ia[^a-z]*ll\b/gi, "I'll")
            .replace(/Ia[^a-z]*d\b/gi, "I'd");
    };

    // Helper to detect and decode base64 content
    const decodeBase64 = (content: string): string => {
        if (!content) return '';

        // Check if content looks like base64 (starts with typical base64 characters, no HTML tags at start)
        const isBase64 = /^[A-Za-z0-9+/=\s]+$/.test(content.substring(0, 100)) &&
            !content.trim().startsWith('<') &&
            content.length > 50;

        if (isBase64) {
            try {
                const cleanBase64 = content.replace(/\s/g, '');
                const decoded = atob(cleanBase64);
                if (decoded.includes('<') || decoded.includes('\n')) {
                    return tryFixCorruptedUTF8(decoded);
                }
            } catch (e) {
                // Decode failed, use original
            }
        }
        return tryFixCorruptedUTF8(content);
    };

    // Decode body for display and analysis
    const decodedBody = useMemo(() => decodeBase64(email.body || ''), [email.body]);

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    const relativeTime = useMemo(() => {
        const now = Date.now();
        const diff = now - email.receivedAt;
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return new Date(email.receivedAt).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' });
    }, [email.receivedAt]);

    const extractSenderInfo = () => {
        // Helper function to extract domain and create clean email
        const extractCleanEmail = (rawEmail: string): string => {
            // Remove angle brackets if present
            const cleanRaw = rawEmail.replace(/[<>]/g, '');

            // Check if it looks like a system/automated email (UUID-style, bounce, etc)
            const emailParts = cleanRaw.split('@');
            if (emailParts.length >= 2) {
                const username = emailParts[0];
                const domain = emailParts[1];

                // Detect system emails: bounce, UUID-style, very long random strings
                const isSystemEmail =
                    username.includes('bounce') ||
                    username.includes('=') ||
                    /^[0-9a-f-]{20,}$/i.test(username) ||  // UUID-like
                    /^\d{5,}/.test(username) ||             // Starts with many digits
                    username.length > 30 ||                  // Very long username
                    /^[a-f0-9]{8,}-/.test(username);         // Hex prefix with dash

                if (isSystemEmail) {
                    return `no-reply@${domain}`;
                }
            }

            return cleanRaw;
        };

        // First check if senderName is provided
        if (email.senderName && email.senderName.trim()) {
            const emailMatch = email.from.match(/<([^>]+)>/);
            const rawEmail = emailMatch ? emailMatch[1] : email.from;
            return {
                name: email.senderName.trim(),
                email: extractCleanEmail(rawEmail)
            };
        }

        const from = email.from;

        // Handle "Name <email@domain.com>" format
        const matchWithBrackets = from.match(/^(.+?)\s*<([^>]+)>/);
        if (matchWithBrackets) {
            const name = matchWithBrackets[1].replace(/^["']|["']$/g, '').trim();
            const rawEmail = matchWithBrackets[2];

            // If name is clean (not a bounce address part)
            if (name && !name.startsWith('(') && !name.includes('=') && !name.includes('bounce')) {
                return { name, email: extractCleanEmail(rawEmail) };
            }
        }

        // Handle bounce emails like "bounce+123=user@domain.com"
        // Extract the domain to get service name
        if (from.includes('bounce') || from.includes('=')) {
            // Extract domain from the email
            const domainMatch = from.match(/@([^.>]+)/);
            if (domainMatch) {
                const serviceName = domainMatch[1]
                    .replace(/[._-]/g, ' ')
                    .replace(/\b\w/g, c => c.toUpperCase())
                    .trim();

                // Create clean email from domain
                const fullDomainMatch = from.match(/@([^>]+)/);
                const cleanEmail = fullDomainMatch ? `no-reply@${fullDomainMatch[1]}` : from;

                return { name: serviceName, email: cleanEmail };
            }
        }

        // Handle regular email addresses
        const emailMatch = from.match(/<([^>]+)>/) || [null, from];
        const emailAddr = emailMatch[1] || from;
        const emailParts = emailAddr.split('@');

        if (emailParts.length >= 2) {
            const username = emailParts[0];
            const domain = emailParts[1].split('.')[0];

            // If username looks like noreply, use domain as name
            if (/^(no-?reply|info|support|hello|contact|admin|notification)/i.test(username)) {
                const name = domain.replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
                return { name, email: extractCleanEmail(emailAddr) };
            }

            // Regular username
            if (!username.includes('+') && !username.includes('=')) {
                const readableName = username
                    .replace(/[._-]/g, ' ')
                    .replace(/\b\w/g, c => c.toUpperCase())
                    .trim();
                return { name: readableName || domain, email: extractCleanEmail(emailAddr) };
            }
        }

        return { name: 'Unknown Sender', email: extractCleanEmail(from) };
    };

    const senderInfo = extractSenderInfo();

    const getAvatarColor = (name: string) => {
        const colors = [
            'from-cyan-500 to-teal-400',
            'from-purple-500 to-pink-400',
            'from-green-500 to-emerald-400',
            'from-orange-500 to-yellow-400',
            'from-red-500 to-rose-400',
            'from-indigo-500 to-violet-400',
            'from-blue-500 to-cyan-400',
        ];
        const index = name.charCodeAt(0) % colors.length;
        return colors[index];
    };

    const handleDelete = () => {
        if (onDelete) {
            onDelete(email.id);
            // Toast is handled by parent component
        } else {
            toast.error('Delete not available');
        }
    };

    const handleOpenInNewTab = () => {
        const newWindow = window.open('', '_blank');
        if (newWindow) {
            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>${email.subject || 'Email'}</title>
                    <style>
                        * { box-sizing: border-box; }
                        body { 
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                            background: #f5f5f5; 
                            color: #1f2937; 
                            margin: 0;
                            display: flex;
                            justify-content: center;
                            min-height: 100vh;
                            padding: 40px 20px;
                        }
                        .container {
                            width: 100%;
                            max-width: 800px;
                            margin: 0 auto;
                        }
                        .header { 
                            background: white; 
                            padding: 30px; 
                            border-radius: 12px; 
                            margin-bottom: 20px; 
                            border: 1px solid #e5e7eb;
                            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                        }
                        .subject { 
                            font-size: 22px; 
                            font-weight: 600; 
                            margin-bottom: 20px; 
                            color: #111827;
                            letter-spacing: -0.3px;
                        }
                        .meta { 
                            color: #6b7280; 
                            font-size: 14px; 
                            display: flex;
                            flex-direction: column;
                            gap: 8px;
                        }
                        .meta-item { 
                            display: flex;
                            align-items: center;
                            gap: 8px;
                        }
                        .meta-label {
                            font-weight: 500;
                            color: #374151;
                            min-width: 50px;
                        }
                        .meta-value {
                            color: #1f2937;
                        }
                        .content { 
                            background: white; 
                            padding: 32px; 
                            border-radius: 12px; 
                            color: #1f2937;
                            border: 1px solid #e5e7eb;
                            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                            line-height: 1.7;
                            font-size: 15px;
                        }
                        .content a { color: #2563eb; text-decoration: none; }
                        .content a:hover { text-decoration: underline; }
                        .content img { max-width: 100%; height: auto; border-radius: 8px; margin: 16px 0; }
                        .content table { max-width: 100%; border-collapse: collapse; }
                        .content td, .content th { padding: 8px; }
                        hr { border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0; }
                        code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; color: #dc2626; font-family: monospace; font-size: 14px; }
                        pre { background: #f9fafb; padding: 16px; border-radius: 8px; overflow-x: auto; border: 1px solid #e5e7eb; }
                        blockquote { border-left: 4px solid #3b82f6; margin: 16px 0; padding-left: 16px; color: #4b5563; }

                        /* Mobile Responsiveness */
                        @media (max-width: 600px) {
                            body { padding: 16px 12px; }
                            .header { padding: 20px; }
                            .content { padding: 20px; }
                            .subject { font-size: 18px; }
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="subject">${email.subject || '(No Subject)'}</div>
                            <div class="meta">
                                <div class="meta-item">
                                    <span class="meta-label">From:</span>
                                    <span class="meta-value"><strong>${senderInfo.name}</strong> &lt;${senderInfo.email}&gt;</span>
                                </div>
                                <div class="meta-item">
                                    <span class="meta-label">To:</span>
                                    <span class="meta-value">${email.to}</span>
                                </div>
                                <div class="meta-item">
                                    <span class="meta-label">Date:</span>
                                    <span class="meta-value">${formatDate(email.receivedAt)}</span>
                                </div>
                            </div>
                        </div>
                        <div class="content">
                            ${tryFixCorruptedUTF8(email.html || '') || `<pre style="white-space: pre-wrap; font-family: inherit; margin: 0;">${tryFixCorruptedUTF8(email.body || '')}</pre>`}
                        </div>
                    </div>
                </body>
                </html>
            `;
            newWindow.document.write(htmlContent);
            newWindow.document.close();
        }
    };

    const runAnalysis = async () => {
        if (isSummarizing) return;
        setIsSummarizing(true);
        // Simulate API call - replace with real Gemini API
        await new Promise(resolve => setTimeout(resolve, 800));

        // Smart analysis based on email content
        const content = (decodedBody || '') + ' ' + (email.subject || '');

        // Extract verification codes - both numeric (4-8 digits) and alphanumeric (5-10 chars)
        // First try to find numeric codes
        const numericMatches = content.match(/\b(\d{4,8})\b/g);
        let otpCode = numericMatches ? numericMatches.find(code => {
            const num = parseInt(code);
            return num > 999 && num < 100000000 && !(num >= 1900 && num <= 2100);
        }) : null;

        // If no numeric code found, try alphanumeric patterns
        if (!otpCode) {
            // Common patterns: ABC123, A1B2C3, etc. (5-10 characters, must have both letters and numbers)
            const alphaNumericMatches = content.match(/\b([A-Z0-9]{5,10})\b/gi);
            if (alphaNumericMatches) {
                otpCode = alphaNumericMatches.find(code => {
                    // Must contain at least one letter and one number
                    const hasLetter = /[A-Za-z]/.test(code);
                    const hasNumber = /\d/.test(code);
                    // Exclude common words
                    const isNotWord = !/^(https?|email|gmail|yahoo|inbox|click|here)$/i.test(code);
                    return hasLetter && hasNumber && isNotWord;
                }) || null;
            }
        }

        // Detect email type
        const isVerification = /verif|code|confirm|otp|kode|masukkan/i.test(content);
        const isWelcome = /welcome|selamat datang|hi,|hello/i.test(content);
        const isPromo = /promo|discount|sale|off|%/i.test(content);
        const isAlert = /alert|warning|security|urgent|penting/i.test(content);

        // Extract time validity if mentioned
        const timeMatch = content.match(/(\d+)\s*(menit|minutes?|jam|hours?)/i);
        const validityTime = timeMatch ? `${timeMatch[1]} ${timeMatch[2]}` : '10 minutes';

        let summaryText = '';
        let sentiment: 'Positive' | 'Neutral' | 'Urgent' | 'Negative' = 'Neutral';
        let actions: string[] = [];

        if (isVerification && otpCode) {
            summaryText = `This email provides a one-time verification code (${otpCode}) for your account, which is valid for ${validityTime}. It advises against sharing the code.`;
            sentiment = 'Neutral';
            actions = [
                `Use the verification code ${otpCode} within ${validityTime}`,
                'Do not share the code with anyone',
                'Ignore this email if you did not request the code'
            ];
        } else if (isVerification) {
            summaryText = `This email contains verification information for your account. Please review the content for any required action.`;
            sentiment = 'Neutral';
            actions = [
                'Follow the verification instructions in the email',
                'Do not share any codes with anyone',
                'Contact support if you did not initiate this request'
            ];
        } else if (isWelcome) {
            summaryText = `This is a welcome email from ${senderInfo.name}. It likely contains onboarding information or getting started instructions.`;
            sentiment = 'Positive';
            actions = [
                'Review the welcome information',
                'Complete any required setup steps',
                'Save important account details'
            ];
        } else if (isPromo) {
            summaryText = `This email contains promotional content from ${senderInfo.name}. It may include special offers or discounts.`;
            sentiment = 'Neutral';
            actions = [
                'Review the promotional offer if interested',
                'Check the validity period of any discounts',
                'Unsubscribe if you no longer wish to receive promotions'
            ];
        } else if (isAlert) {
            summaryText = `This is a security or alert notification from ${senderInfo.name}. It may require your immediate attention.`;
            sentiment = 'Urgent';
            actions = [
                'Review the alert details immediately',
                'Take any recommended security actions',
                'Contact support if you notice suspicious activity'
            ];
        } else {
            summaryText = `This email from ${senderInfo.name} contains information regarding "${email.subject}". The sender is reaching out to provide details that may require your attention.`;
            sentiment = email.isSpam ? 'Urgent' : 'Neutral';
            actions = [
                'Review the email content carefully',
                'Respond if action is required',
                'Archive or delete after processing'
            ];
        }

        setSummary({
            summary: summaryText,
            sentiment: sentiment,
            actionItems: actions
        });
        setIsSummarizing(false);
    };

    // Auto-analyze when email changes
    useEffect(() => {
        if (email.id !== lastAnalyzedId) {
            // Reset summary and trigger new analysis
            setSummary(null);
            setLastAnalyzedId(email.id);
            runAnalysis();
        }
    }, [email.id]);

    // Helper: Fix common UTF-8 encoding issues (double-encoded UTF-8)
    const fixEncoding = (text: string): string => {
        if (!text) return '';
        return text
            // Smart quotes and apostrophes
            .replace(/â€™/g, "'").replace(/â€˜/g, "'")
            .replace(/â€œ/g, '"').replace(/â€/g, '"')
            // Dashes
            .replace(/â€"/g, '–').replace(/â€"/g, '—')
            // Spaces and dots
            .replace(/Â /g, ' ').replace(/Â·/g, '·')
            // Currency and symbols
            .replace(/â‚¬/g, '€').replace(/â„¢/g, '™')
            .replace(/Â©/g, '©').replace(/Â®/g, '®')
            // Accented characters
            .replace(/Ã©/g, 'é').replace(/Ã¨/g, 'è')
            .replace(/Ã /g, 'à').replace(/Ã¢/g, 'â')
            .replace(/Ã´/g, 'ô').replace(/Ã§/g, 'ç')
            // Common contractions with broken encoding
            .replace(/wasnâ€™t/g, "wasn't").replace(/isnâ€™t/g, "isn't")
            .replace(/donâ€™t/g, "don't").replace(/doesnâ€™t/g, "doesn't")
            .replace(/canâ€™t/g, "can't").replace(/wonâ€™t/g, "won't")
            .replace(/youâ€™re/g, "you're").replace(/theyâ€™re/g, "they're")
            .replace(/Iâ€™m/g, "I'm").replace(/Iâ€™ve/g, "I've")
            .replace(/Iâ€™ll/g, "I'll").replace(/Iâ€™d/g, "I'd")
            .replace(/â€™t/g, "'t").replace(/â€™s/g, "'s")
            .replace(/â€™ll/g, "'ll").replace(/â€™re/g, "'re")
            .replace(/â€™ve/g, "'ve").replace(/â€™d/g, "'d")
            // Alternative pattern with different broken sequences
            .replace(/wasn\u2019t/g, "wasn't").replace(/isn\u2019t/g, "isn't")
            .replace(/don\u2019t/g, "don't").replace(/doesn\u2019t/g, "doesn't");
    };

    // Extract style blocks and body content separately for proper rendering
    const { emailStyles, emailBody } = useMemo(() => {
        if (!email.html) return { emailStyles: '', emailBody: '' };
        const decodedHtml = decodeBase64(email.html);
        const fixedHtml = fixEncoding(decodedHtml);
        
        // Extract <style> blocks from the email HTML
        const styleMatches = fixedHtml.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
        const extractedStyles = styleMatches.join('\n');
        
        // Sanitize without WHOLE_DOCUMENT to get just the content
        const sanitized = DOMPurify.sanitize(fixedHtml, {
            ALLOWED_TAGS: [
                'style',  // Allow style blocks for email CSS
                'p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 
                'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code', 
                'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'colgroup', 'col',
                'div', 'span', 'hr', 'img', 'center', 'font', 'b', 'i', 's', 'strike', 'sub', 'sup',
                'section', 'article', 'header', 'footer', 'aside', 'nav', 'main',
                'figure', 'figcaption', 'picture', 'source',
                'address', 'cite', 'abbr', 'time', 'mark', 'small', 'del', 'ins',
                'dl', 'dt', 'dd', 'wbr'
            ],
            ALLOWED_ATTR: [
                'href', 'alt', 'title', 'class', 'id', 'name',
                'style', 'type', 'media',
                'target', 'rel',
                'src', 'srcset', 'sizes',
                'width', 'height', 
                'border', 'cellpadding', 'cellspacing', 
                'bgcolor', 'background', 'color', 
                'align', 'valign', 'colspan', 'rowspan',
                'dir', 'lang', 'role',
                'aria-label', 'aria-hidden'
            ],
            ALLOW_DATA_ATTR: false,
            ADD_ATTR: ['target'],
            FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'button', 'iframe', 'noscript', 'meta', 'link', 'base', 'html', 'head', 'body'],
            FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onsubmit', 'onchange', 'onkeyup', 'onkeydown']
        });
        
        return { emailStyles: extractedStyles, emailBody: sanitized };
    }, [email.html]);

    // Panel Mode - Full width content on right side
    if (isPanel) {
        return (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Main Content - Scrollable */}
                <div className="flex-1 overflow-y-auto px-6 py-6">
                    {/* Sender Info Row */}
                    <div className="flex items-start gap-3 mb-6">
                        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarColor(senderInfo.name)} flex items-center justify-center text-white font-bold text-base shadow-lg flex-shrink-0`}>
                            {senderInfo.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 flex-wrap">
                                <span className="text-white font-semibold">{senderInfo.name}</span>
                                <span className="text-gray-500 text-sm">&lt;{senderInfo.email}&gt;</span>
                            </div>
                            <div className="text-sm text-gray-400 mt-0.5">
                                {formatDate(email.receivedAt)}
                            </div>
                        </div>
                        <button
                            onClick={handleDelete}
                            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all flex-shrink-0"
                            title="Delete"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Subject */}
                    <h1 className="text-xl lg:text-2xl font-bold text-white-primary leading-tight mb-6">
                        {email.subject || '(No Subject)'}
                    </h1>

                    {/* Email Body - Using iframe for proper CSS isolation like Gmail */}
                    <div className="prose-container">
                        {emailBody ? (
                            <iframe
                                srcDoc={`
                                    <!DOCTYPE html>
                                    <html>
                                    <head>
                                        <meta charset="UTF-8">
                                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                        <style>
                                            body {
                                                font-family: 'Google Sans', Roboto, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                                                font-size: 14px;
                                                line-height: 1.6;
                                                color: #202124;
                                                margin: 0;
                                                padding: 32px;
                                                background: white;
                                                word-break: break-word;
                                            }
                                            img { max-width: 100%; height: auto; display: block; }
                                            a { color: #1a73e8; text-decoration: none; }
                                            a:hover { text-decoration: underline; }
                                            table { max-width: 100%; border-collapse: collapse; }
                                            td, th { padding: 8px; }
                                            p { margin: 0 0 16px 0; }
                                            blockquote { border-left: 3px solid #dadce0; margin: 16px 0; padding-left: 16px; color: #5f6368; }
                                            hr { border: 0; border-top: 1px solid #dadce0; margin: 16px 0; }
                                            * { box-sizing: border-box; }
                                        </style>
                                        ${emailStyles}
                                    </head>
                                    <body>${emailBody}</body>
                                    </html>
                                `}
                                className="w-full min-h-[400px] bg-white rounded-xl shadow-sm"
                                style={{ border: '1px solid #e5e7eb', borderRadius: '12px' }}
                                sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                                title="Email content"
                                onLoad={(e) => {
                                    const iframe = e.target as HTMLIFrameElement;
                                    if (iframe.contentDocument) {
                                        const height = iframe.contentDocument.body.scrollHeight;
                                        iframe.style.height = Math.max(400, height + 50) + 'px';
                                    }
                                }}
                            />
                        ) : (
                            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                                <pre className="text-gray-800 whitespace-pre-wrap font-sans text-[15px] leading-relaxed">
                                    {decodedBody || '(No content)'}
                                </pre>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Modal Mode - For mobile
    return (
        <div
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md overflow-y-auto"
            onClick={onClose}
        >
            <div className="min-h-full flex items-start justify-center p-2 sm:p-4">
                <div
                    className="w-full max-w-3xl bg-cyber-panel border border-cyber-primary/20 rounded-xl shadow-2xl overflow-hidden animate-fade-in-up my-2"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Mobile Header - Back button */}
                    <div className="px-4 py-3 bg-cyber-dark border-b border-cyber-primary/10 flex items-center justify-between">
                        <button
                            onClick={onClose}
                            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span className="text-sm">Back to Inbox</span>
                        </button>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={handleDelete}
                                className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                            <button
                                onClick={onClose}
                                className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 120px)' }}>
                        {/* Sender Info Row */}
                        <div className="flex items-start gap-3 mb-4">
                            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarColor(senderInfo.name)} flex items-center justify-center text-white font-bold text-sm shadow-lg flex-shrink-0`}>
                                {senderInfo.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-2 flex-wrap">
                                    <span className="text-white font-semibold text-sm">{senderInfo.name}</span>
                                    <span className="text-gray-500 text-xs truncate">&lt;{senderInfo.email}&gt;</span>
                                </div>
                                <div className="text-xs text-gray-400 mt-0.5">
                                    {formatDate(email.receivedAt)}
                                </div>
                            </div>
                        </div>

                        {/* Subject */}
                        <h1 className="text-lg sm:text-xl font-bold text-white leading-tight mb-4">
                            {email.subject || '(No Subject)'}
                        </h1>

                        {/* Email Body */}
                        <div className="prose-container">
                            {emailBody ? (
                                <iframe
                                    srcDoc={`
                                        <!DOCTYPE html>
                                        <html>
                                        <head>
                                            <meta charset="UTF-8">
                                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                            <style>
                                                body {
                                                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                                                    font-size: 14px;
                                                    line-height: 1.6;
                                                    color: #1f2937;
                                                    margin: 0;
                                                    padding: 16px;
                                                    background: white;
                                                    word-break: break-word;
                                                }
                                                img { max-width: 100%; height: auto; display: block; }
                                                a { color: #2563eb; text-decoration: none; }
                                                a:hover { text-decoration: underline; }
                                                table { max-width: 100%; border-collapse: collapse; }
                                                td, th { padding: 4px 8px; }
                                                p { margin: 0 0 12px 0; }
                                                * { box-sizing: border-box; }
                                            </style>
                                        </head>
                                        <body>${emailBody}</body>
                                        </html>
                                    `}
                                    className="w-full bg-white rounded-xl"
                                    style={{ border: '1px solid #e5e7eb', borderRadius: '12px', minHeight: '200px' }}
                                    sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                                    title="Email content"
                                    onLoad={(e) => {
                                        const iframe = e.target as HTMLIFrameElement;
                                        if (iframe.contentDocument) {
                                            const height = iframe.contentDocument.body.scrollHeight;
                                            iframe.style.height = Math.max(200, height + 20) + 'px';
                                        }
                                    }}
                                />
                            ) : (
                                <div className="bg-white border border-gray-200 rounded-xl p-4">
                                    <pre className="text-gray-800 whitespace-pre-wrap font-sans text-sm leading-relaxed m-0">
                                        {decodedBody || '(No content)'}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
