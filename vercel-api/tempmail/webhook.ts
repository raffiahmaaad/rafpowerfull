/**
 * VaultMail Tempmail API - Webhook Endpoint
 * Receives emails from Cloudflare Email Worker and stores in Upstash Redis
 */

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

// Helper: Extract email address from string like "Name <email@domain.com>"
function extractEmail(text: string): string | null {
  const match = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
  return match ? match[1].toLowerCase() : null;
}

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    
    let from, to, subject, text, html;

    if (contentType.includes('application/json')) {
      const body = await req.json();
      ({ from, to, subject, text, html } = body);
    } else if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      from = formData.get('from') as string;
      to = formData.get('to') as string || formData.get('recipient') as string;
      subject = formData.get('subject') as string;
      text = formData.get('text') as string || formData.get('body-plain') as string;
      html = formData.get('html') as string || formData.get('body-html') as string;
    } else {
      return new Response('Unsupported Content-Type', { status: 415 });
    }

    if (!to || !from) {
      return new Response('Missing parameters', { status: 400 });
    }

    const cleanTo = extractEmail(to);
    
    if (!cleanTo) {
      return new Response('Invalid recipient', { status: 400 });
    }

    const emailId = crypto.randomUUID();
    const emailData = {
      id: emailId,
      from,
      to,
      subject: subject || '(No Subject)',
      text: text || '',
      html: html || text || '',
      receivedAt: new Date().toISOString(),
      read: false
    };

    const key = `inbox:${cleanTo}`;
    
    // Check for custom retention settings
    const settingsKey = `settings:${cleanTo}`;
    const settingsRaw = await redis.get(settingsKey);
    let retention = 86400; // Default 24h

    if (settingsRaw) {
      try {
        if (typeof settingsRaw === 'string') {
          const s = JSON.parse(settingsRaw);
          if (s.retentionSeconds) retention = s.retentionSeconds;
        } else if (typeof settingsRaw === 'object') {
          const s = settingsRaw as any;
          if (s.retentionSeconds) retention = s.retentionSeconds;
        }
      } catch (e) {
        console.error("Failed to parse settings", e);
      }
    }
    
    // Store email in list (lpush = prepend, newest first)
    await redis.lpush(key, emailData);
    
    // Set expiry based on retention setting
    await redis.expire(key, retention);

    return new Response(JSON.stringify({ success: true, id: emailId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Webhook Error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
