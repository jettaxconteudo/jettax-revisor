export const config = { runtime: 'edge' };

export default async function handler(req) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return new Response(JSON.stringify({ error: 'not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
  // Only return key to same-origin requests
  const origin = req.headers.get('origin') || '';
  const referer = req.headers.get('referer') || '';
  if (!referer.includes('jettax-revisor.vercel.app') && !referer.includes('localhost')) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403, headers: { 'Content-Type': 'application/json' }
    });
  }
  return new Response(JSON.stringify({ k: key }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
