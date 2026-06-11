import { NextRequest, NextResponse } from 'next/server';

/**
 * Auth Proxy API Route
 * 
 * Safari có vấn đề với cookies được set qua Vercel rewrite proxy.
 * Route này proxy các auth request trực tiếp qua Next.js server,
 * đảm bảo Set-Cookie headers được forward chính xác tới browser.
 * 
 * Next.js API routes có priority cao hơn rewrites, nên route này
 * sẽ override rewrite cho /api/auth/* trên production.
 */

const BACKEND_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://server-nextjs-firm.onrender.com'
  : 'http://localhost:3001';

// Headers không nên forward từ backend response
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'te',
  'trailer',
  'upgrade',
  'proxy-authorization',
  'proxy-authenticate',
]);

async function proxyRequest(request: NextRequest, params: { path: string[] }) {
  const path = params.path.join('/');
  const { searchParams } = new URL(request.url);
  const queryString = searchParams.toString();
  const targetUrl = `${BACKEND_BASE_URL}/api/auth/${path}${queryString ? `?${queryString}` : ''}`;

  try {
    // Build headers to forward
    const forwardHeaders = new Headers();
    forwardHeaders.set('Content-Type', request.headers.get('content-type') || 'application/json');
    
    // Forward important headers
    const userAgent = request.headers.get('user-agent');
    if (userAgent) forwardHeaders.set('user-agent', userAgent);
    
    const acceptLang = request.headers.get('accept-language');
    if (acceptLang) forwardHeaders.set('accept-language', acceptLang);

    // Forward client IP
    const forwardedFor = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
    if (forwardedFor) forwardHeaders.set('x-forwarded-for', forwardedFor);
    
    // Forward cookies from client to backend
    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) forwardHeaders.set('cookie', cookieHeader);

    // Forward Authorization header
    const authHeader = request.headers.get('authorization');
    if (authHeader) forwardHeaders.set('authorization', authHeader);

    // Build fetch options
    const fetchOptions: RequestInit = {
      method: request.method,
      headers: forwardHeaders,
      signal: AbortSignal.timeout(30000), // 30s timeout (Render cold start)
    };

    // Forward body for POST/PUT/PATCH/DELETE
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      try {
        const body = await request.text();
        if (body) fetchOptions.body = body;
      } catch {
        // No body to forward
      }
    }

    // Make request to backend
    const backendResponse = await fetch(targetUrl, fetchOptions);

    // Read response body
    const responseBody = await backendResponse.text();

    // Create Next.js response
    const response = new NextResponse(responseBody, {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
    });

    // Forward Set-Cookie headers first (special handling required)
    // fetch() API merges multiple Set-Cookie into one string via forEach,
    // so we use getSetCookie() to get each cookie separately
    const setCookies = backendResponse.headers.getSetCookie?.() 
      || backendResponse.headers.get('set-cookie')?.split(/,(?=\s*\w+=)/) 
      || [];
    
    for (const cookie of setCookies) {
      if (cookie.trim()) {
        response.headers.append('set-cookie', cookie.trim());
      }
    }

    // Forward other response headers (except hop-by-hop and set-cookie)
    backendResponse.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (!HOP_BY_HOP_HEADERS.has(lowerKey) && lowerKey !== 'set-cookie') {
        response.headers.set(key, value);
      }
    });

    // Ensure correct content type
    response.headers.set('content-type', backendResponse.headers.get('content-type') || 'application/json');

    return response;
  } catch (error) {
    console.error(`Auth proxy error [${request.method} /api/auth/${path}]:`, error);
    return NextResponse.json(
      { message: 'Auth service unavailable' },
      { status: 502 }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const params = await context.params;
  return proxyRequest(request, params);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const params = await context.params;
  return proxyRequest(request, params);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const params = await context.params;
  return proxyRequest(request, params);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const params = await context.params;
  return proxyRequest(request, params);
}
