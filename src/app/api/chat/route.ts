// Backend API Route - src/app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server'

// URL Express backend (ưu tiên biến môi trường, fallback production Render / local)
const BACKEND_API_URL = process.env.NEXT_PUBLIC_API_URL 
  || process.env.API_URL 
  || (process.env.NODE_ENV === 'production' 
      ? 'https://server-nextjs-film.onrender.com/api' 
      : 'http://localhost:3001/api');

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

    // 2. Chuyển tiếp (Proxy) tới Backend Render (chứa Vertex AI Gemini 2.5)
    // Giúp giảm tải 100% thời gian xử lý AI trên Vercel CPU
    try {
      // Chuẩn hóa endpoint: nếu BACKEND_API_URL đã có /api thì gọi /chat hoặc /chatai/chat
      const backendChatEndpoint = BACKEND_API_URL.endsWith('/api') 
        ? `${BACKEND_API_URL}/chat` 
        : `${BACKEND_API_URL}/api/chat`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s cho Render cold start

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
      }
    } catch (backendErr) {
      console.warn("⚠️ [ChatRoute] Backend AI Render tạm thời chưa phản hồi, thử fallback...", backendErr);
    }

    // 3. Phản hồi thân thiện nếu máy chủ backend đang khởi động (không fallback sang model khác)
    return NextResponse.json({
      choices: [{
        message: {
          role: 'assistant',
          content: 'Trợ lý AI (Gemini 3.7 Flash) đang khởi động kết nối trên máy chủ. Bạn vui lòng đợi khoảng 10-15 giây rồi gửi lại tin nhắn nhé! 🎬🍿'
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