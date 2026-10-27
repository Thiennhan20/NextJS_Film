// Backend API Route - src/app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Helper chuẩn hóa URL Backend: Trên production (Vercel) luôn kết nối trực tiếp đến Render backend
function getBackendApiUrl(): string {
  if (process.env.NODE_ENV === 'production' || !!process.env.VERCEL) {
    return 'https://server-nextjs-film.onrender.com/api';
  }
  let envUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
  envUrl = envUrl.trim().replace(/\/+$/, '');
  if (!envUrl.endsWith('/api')) envUrl += '/api';
  return envUrl;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { messages } = body

    // 1. Phản hồi nhanh cho câu hỏi về tác giả / người tạo web
    const lastMessage = messages?.[messages.length - 1]?.content?.toLowerCase();
    if (lastMessage) {
      if (
        lastMessage.includes("ai") && 
        (lastMessage.includes("tạo ra web") || 
        lastMessage.includes("làm ra web") || 
        lastMessage.includes("người tạo"))
      ) {
        return NextResponse.json({
          choices: [{
            message: {
              content: "Trang web NTN Stream được sáng lập và phát triển bởi Nguyễn Thiện Nhân (22 tuổi) 🚀."
            }
          }]
        });
      } else if (lastMessage.includes("nguyễn thiện nhân") || lastMessage.includes("thiện nhân")) {
        return NextResponse.json({
          choices: [{
            message: {
              content: "Nguyễn Thiện Nhân (22 tuổi) là nhà phát triển sáng lập nên nền tảng xem phim NTN Stream."
            }
          }]
        });
      }
    }

    // Validate input
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Invalid messages format" },
        { status: 400 }
      )
    }

    // 2. Chuyển tiếp (Proxy) tới Backend Render
    const backendBaseUrl = getBackendApiUrl();
    const backendChatEndpoint = `${backendBaseUrl}/chat`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s cho Render cold start

    let debugErr = '';
    try {
      const backendResponse = await fetch(backendChatEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (backendResponse.ok) {
        const data = await backendResponse.json();
        const replyText = data.reply || data.choices?.[0]?.message?.content;
        if (replyText) {
          return NextResponse.json({
            choices: [{
              message: {
                role: 'assistant',
                content: replyText
              }
            }]
          });
        }
      } else {
        const errText = await backendResponse.text();
        debugErr = `HTTP ${backendResponse.status}: ${errText.slice(0, 200)}`;
      }
    } catch (backendErr: unknown) {
      clearTimeout(timeoutId);
      debugErr = backendErr instanceof Error ? backendErr.message : String(backendErr);
      console.warn("⚠️ [ChatRoute] Backend AI Render tạm thời chưa phản hồi:", debugErr);
    }

    // 3. Phản hồi nếu máy chủ backend chưa trả lời thành công
    return NextResponse.json({
      choices: [{
        message: {
          role: 'assistant',
          content: `Trợ lý AI đang kết nối máy chủ (${backendChatEndpoint} - ${debugErr || 'No reply'}). Vui lòng thử lại sau giây lát! 🎬🍿`
        }
      }]
    });

  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}