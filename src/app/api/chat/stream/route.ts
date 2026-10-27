// Stream API Route — Proxy SSE stream từ backend Render → frontend với graceful fallback
import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

// Helper chuẩn hóa URL Backend: Trên production (Vercel) tuyệt đối không dùng localhost
function getBackendApiUrl(): string {
  const isProd = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
  let envUrl = process.env.BACKEND_API_URL || process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '';

  if (isProd) {
    if (!envUrl || envUrl.includes('localhost') || envUrl.includes('127.0.0.1')) {
      return 'https://server-nextjs-film.onrender.com/api';
    }
  } else {
    if (!envUrl) {
      return 'http://localhost:3001/api';
    }
  }

  envUrl = envUrl.trim().replace(/\/+$/, '');
  if (!envUrl.endsWith('/api')) {
    envUrl = `${envUrl}/api`;
  }
  return envUrl;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { messages } = body || {}

    // 1. Phản hồi nhanh cho câu hỏi về tác giả / người tạo web
    const lastMessage = messages?.[messages.length - 1]?.content?.toLowerCase();
    let quickReply = '';
    if (lastMessage) {
      if (
        lastMessage.includes("ai") && 
        (lastMessage.includes("tạo ra web") || 
        lastMessage.includes("làm ra web") || 
        lastMessage.includes("người tạo"))
      ) {
        quickReply = "Trang web NTN Stream được sáng lập và phát triển bởi Nguyễn Thiện Nhân (22 tuổi) 🚀.";
      } else if (lastMessage.includes("nguyễn thiện nhân") || lastMessage.includes("thiện nhân")) {
        quickReply = "Nguyễn Thiện Nhân (22 tuổi) là nhà phát triển sáng lập nên nền tảng xem phim NTN Stream.";
      }
    }

    if (quickReply) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: quickReply })}\n\n`));
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        }
      });
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        }
      });
    }

    // 2. Thử kết nối tới backend SSE stream
    const backendBaseUrl = getBackendApiUrl();
    const backendStreamEndpoint = `${backendBaseUrl}/chatai/stream`;

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 12000) // 12s timeout

    try {
      const backendResponse = await fetch(backendStreamEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      const contentType = backendResponse.headers.get('content-type') || ''
      if (backendResponse.ok && backendResponse.body && contentType.includes('text/event-stream')) {
        return new Response(backendResponse.body, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          }
        })
      }
    } catch {
      // Backend stream lỗi hoặc timeout -> tự động fallback sang non-stream bên dưới
    } finally {
      clearTimeout(timeoutId)
    }

    // 3. Graceful Fallback: Gọi non-stream và stream từng từ qua SSE về client
    // Giúp loại bỏ 100% lỗi đỏ 500 trên Vercel và vẫn giữ hiệu ứng gõ chữ thời gian thực
    const backendChatEndpoint = `${backendBaseUrl}/chat`;

    let replyText = '';
    try {
      const chatRes = await fetch(backendChatEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (chatRes.ok) {
        const data = await chatRes.json();
        replyText = data.reply || data.choices?.[0]?.message?.content || '';
      }
    } catch {}

    if (!replyText) {
      replyText = 'Trợ lý AI đang cập nhật dữ liệu phim ảnh. Bạn vui lòng đợi giây lát rồi thử lại nhé! 🎬🍿';
    }

    const encoder = new TextEncoder();
    const words = replyText.match(/\S+|\s+/g) || [replyText];
    const simulatedStream = new ReadableStream({
      async start(controller) {
        for (const w of words) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: w })}\n\n`));
          await new Promise(r => setTimeout(r, 20));
        }
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
      }
    });

    return new Response(simulatedStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    });

  } catch {
    const encoder = new TextEncoder();
    const fallbackStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: 'Hệ thống AI đang bảo trì. Vui lòng thử lại sau!' })}\n\n`));
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
      }
    });
    return new Response(fallbackStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    });
  }
}
