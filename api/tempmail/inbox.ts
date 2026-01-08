/**
 * VaultMail Tempmail API - Inbox Endpoint
 * Fetches emails from Upstash Redis for a given address
 */

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '',
});

// CORS headers for cross-origin requests (localhost development)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

  if (req.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address');

  if (!address) {
    return new Response(JSON.stringify({ error: 'Address required' }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const key = `inbox:${address.toLowerCase()}`;
    const emails = await redis.lrange(key, 0, -1);
    
    return new Response(JSON.stringify({ emails: emails || [] }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('Inbox Error:', error);
    return new Response(JSON.stringify({ emails: [] }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}
