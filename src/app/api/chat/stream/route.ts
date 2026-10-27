// Stream API Route — Proxy SSE stream từ backend Render → frontend
import { NextRequest } from 'next/server'

const BACKEND_API_URL = process.env.NEXT_PUBLIC_API_URL 
  || process.env.API_URL 
  || (process.env.NODE_ENV === 'production' 
      ? 'https://server-nextjs-film.onrender.com/api' 
      : 'http://localhost:3001/api');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const backendStreamEndpoint = BACKEND_API_URL.endsWith('/api') 
      ? `${BACKEND_API_URL}/chatai/stream` 
      : `${BACKEND_API_URL}/api/chatai/stream`;

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000) // 60s timeout cho stream

    const backendResponse = await fetch(backendStreamEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!backendResponse.ok || !backendResponse.body) {
      return new Response(
        JSON.stringify({ error: 'Không thể kết nối stream AI.' }), 
        { status: backendResponse.status, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Pipe SSE stream trực tiếp từ backend → frontend
    return new Response(backendResponse.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    })

  } catch {
    return new Response(
      JSON.stringify({ error: 'Stream proxy error' }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
