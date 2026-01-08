/**
 * VaultMail Tempmail API - Settings Endpoint
 * Updates retention settings in Upstash Redis
 */

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '',
});

// CORS headers for cross-origin requests (localhost development)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const { address, retentionSeconds } = await req.json();

    if (!address || !retentionSeconds) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Save retention setting for this address
    await redis.set(`settings:${address.toLowerCase()}`, JSON.stringify({
      retentionSeconds: parseInt(retentionSeconds)
    }));

    // Keep settings alive for 7 days
    await redis.expire(`settings:${address.toLowerCase()}`, 604800);

    // Update TTL for existing inbox if it exists
    const inboxKey = `inbox:${address.toLowerCase()}`;
    const exists = await redis.exists(inboxKey);
    if (exists) {
      await redis.expire(inboxKey, parseInt(retentionSeconds));
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('Settings Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}
