'use client'

import { useState, useEffect, useRef, useCallback, useLayoutEffect, useMemo, memo, forwardRef, useImperativeHandle } from 'react'
import { motion, AnimatePresence, useDragControls, PanInfo } from 'framer-motion'
import {
  ChatBubbleLeftIcon,
  XMarkIcon,
  TrashIcon,
  FilmIcon,
  ArrowDownIcon,
  ClipboardDocumentIcon,
  CheckIcon,
} from '@heroicons/react/24/outline'
import { ChevronUpIcon } from '@heroicons/react/24/solid'
import { useUIStore } from '@/store/store'

// Hàm lọc và làm sạch mã HTML từ Markdown để ngăn chặn lỗ hổng XSS
function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined') return html
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    // Loại bỏ các thẻ có nguy cơ bảo mật
    const dangerousTags = ['script', 'iframe', 'object', 'embed', 'form', 'link', 'style', 'meta']
    dangerousTags.forEach(tag => {
      doc.body.querySelectorAll(tag).forEach(el => el.remove())
    })
    // Loại bỏ các thuộc tính nguy hiểm (on*, javascript:)
    const allElements = doc.body.querySelectorAll('*')
    allElements.forEach(el => {
      Array.from(el.attributes).forEach(attr => {
        const name = attr.name.toLowerCase()
        const val = attr.value.trim().toLowerCase()
        if (name.startsWith('on')) {
          el.removeAttribute(attr.name)
        }
        if ((name === 'href' || name === 'src') && (val.startsWith('javascript:') || val.startsWith('data:text/html'))) {
          el.removeAttribute(attr.name)
        }
      })
      if (el.tagName === 'A') {
        el.setAttribute('target', '_blank')
        el.setAttribute('rel', 'noopener noreferrer')
        el.classList.add('text-rose-400', 'underline', 'hover:text-rose-300', 'font-medium')
      }
      if (el.tagName === 'IMG') {
        el.setAttribute('loading', 'lazy')
        el.classList.add('rounded-xl', 'my-2', 'max-w-full', 'shadow-md')
        // Tự động ẩn nếu ảnh poster bị 404 để tránh icon vỡ
        el.setAttribute('onerror', "this.style.display='none'")
      }
    })
    return doc.body.innerHTML
  } catch {
    return html
  }
}

// Bộ nhớ đệm (cache) kết quả parse Markdown + sanitize để tránh re-parse tốn CPU trên mỗi phím bấm
const markdownCache = new Map<string, string>()

interface ChatMessageItemProps {
  msg: { role: 'user' | 'assistant'; content: string }
  index: number
  isCopied: boolean
  onCopy: (content: string, index: number) => void
  renderMarkdown: (content: string) => string
}

const ChatMessageItem = memo(function ChatMessageItem({
  msg,
  index,
  isCopied,
  onCopy,
  renderMarkdown,
}: ChatMessageItemProps) {
  return (
    <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] sm:max-w-[80%] p-3.5 rounded-2xl shadow-md ${
          msg.role === 'user'
            ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-br-sm'
            : 'bg-gray-800/90 border border-gray-700/60 text-gray-100 rounded-bl-sm'
        } break-words`}
      >
        {msg.role === 'assistant' ? (
          <>
            <div 
              className="ai-response-content prose prose-invert max-w-none text-sm leading-relaxed prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-headings:my-2 prose-strong:text-white prose-strong:font-semibold" 
              dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} 
            />
            <div className="flex justify-end mt-2 -mb-0.5">
              <button
                type="button"
                onClick={() => onCopy(msg.content, index)}
                className="inline-flex items-center gap-1.5 text-xs text-gray-300 hover:text-white px-2.5 py-1 rounded-lg bg-gray-700/50 hover:bg-gray-700 border border-gray-600/40 transition-colors"
                aria-label="Sao chép câu trả lời"
              >
                {isCopied ? (
                  <>
                    <CheckIcon className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                    <span className="text-emerald-400 font-medium">Đã chép</span>
                  </>
                ) : (
                  <>
                    <ClipboardDocumentIcon className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
                    <span>Sao chép</span>
                  </>
                )}
              </button>
            </div>
          </>
        ) : (
          <span className="text-sm leading-relaxed">{msg.content}</span>
        )}
      </div>
    </div>
  )
})


export interface ChatInputHandle {
  setValue: (value: string) => void
  focus: () => void
}

interface ChatInputFormProps {
  onSendMessage: (text: string) => void
  isLoadingChat: boolean
  placeholder?: string
}

const ChatInputForm = memo(forwardRef<ChatInputHandle, ChatInputFormProps>(function ChatInputForm(
  { onSendMessage, isLoadingChat, placeholder = 'Hỏi về phim, diễn viên hoặc nhờ gợi ý phim...' },
  ref
) {
  const [inputMessage, setInputMessage] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useImperativeHandle(ref, () => ({
    setValue: (val: string) => {
      setInputMessage(val)
      inputRef.current?.focus({ preventScroll: true })
    },
    focus: () => {
      inputRef.current?.focus({ preventScroll: true })
    },
  }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputMessage.trim() || isLoadingChat) return
    onSendMessage(inputMessage)
    setInputMessage('')
    inputRef.current?.focus({ preventScroll: true })
  }

  return (
    <form onSubmit={handleSubmit} className="p-3.5 sm:p-4 border-t border-gray-800 bg-gray-900/60 backdrop-blur-md flex-shrink-0">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="flex-1 min-h-[44px] bg-gray-800/80 border border-gray-700/60 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/70 focus:border-red-500 placeholder-gray-400 transition-colors"
        />
        <button
          type="submit"
          disabled={isLoadingChat || !inputMessage.trim()}
          className="min-h-[44px] min-w-[70px] bg-gradient-to-r from-red-600 to-rose-600 text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:from-red-500 hover:to-rose-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-md hover:shadow-red-600/20 active:scale-95"
        >
          Gửi
        </button>
      </div>
    </form>
  )
}))

export default function FloatingChatbox() {
  const [isOpen, setIsOpen] = useState(false)
  const [snapPositions, setSnapPositions] = useState({
    bottomRight: { x: 0, y: 0 },
    middleRight: { x: 0, y: 0 },
    topRight: { x: 0, y: 0 },
    bottomLeft: { x: 0, y: 0 },
    middleLeft: { x: 0, y: 0 },
    topLeft: { x: 0, y: 0 },
  })
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [currentPosition, setCurrentPosition] = useState<'bottomRight' | 'middleRight' | 'topRight' | 'bottomLeft' | 'middleLeft' | 'topLeft'>('bottomRight')
  const [viewportHeight, setViewportHeight] = useState(0)
  const scrollPositionRef = useRef(0)
  const [documentHeight, setDocumentHeight] = useState(0)
  const [markedModule, setMarkedModule] = useState<{ parse: (s: string) => string } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const chatMessagesContainerRef = useRef<HTMLDivElement>(null)
  const chatContentRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<ChatInputHandle>(null)

  // Khởi tạo state an toàn tránh Hydration Mismatch
  const [isHydrated, setIsHydrated] = useState(false)
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([])
  const [isLoadingChat, setIsLoadingChat] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [showScrollToBottomBtn, setShowScrollToBottomBtn] = useState(false)
  const isAtBottomRef = useRef(true)

  const dragControls = useDragControls()
  const [showScrollTop, setShowScrollTop] = useState(false)
  const isChatDraggingRef = useRef(false)
  const isScrollTopDraggingRef = useRef(false)
  const { isAppModalOpen } = useUIStore()

  // Kiểm tra biến toàn cục khi xem phim full
  const isWatchingFullMovie = typeof window !== 'undefined' && (window as { isWatchingFullMovie?: boolean }).isWatchingFullMovie

  // Hydration sync: Nạp tin nhắn từ localStorage sau khi component mount trên client
  useEffect(() => {
    setIsHydrated(true)
    if (typeof window !== 'undefined') {
      try {
        const storedMessages = localStorage.getItem('ntn_chatMessages')
        if (storedMessages) {
          setMessages(JSON.parse(storedMessages))
        }
      } catch {}
    }
  }, [])

  // Lưu tin nhắn vào localStorage mỗi khi thay đổi (chỉ sau khi đã hydrate)
  useEffect(() => {
    if (isHydrated && typeof window !== 'undefined') {
      localStorage.setItem('ntn_chatMessages', JSON.stringify(messages))
    }
  }, [messages, isHydrated])

  // Lắng nghe phím Escape để đóng Pop-up xác nhận hoặc đóng Chatbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showClearConfirm) {
          setShowClearConfirm(false)
        } else if (isOpen) {
          setIsOpen(false)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, showClearConfirm])

  // Khóa scroll của body khi mở Chatbox để tránh bị cuộn trang nền trên mobile/desktop
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [isOpen])

  // Tự động focus vào ô nhập tin nhắn khi mở chatbox (trên desktop có trỏ chuột)
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        if (typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches) {
          chatInputRef.current?.focus()
        }
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Tính toán vị trí snap và cập nhật kích thước viewport
  useEffect(() => {
    const updateDimensions = () => {
      const windowWidth = window.innerWidth
      const windowHeight = window.innerHeight
      const docHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.offsetHeight,
        document.body.clientHeight,
        document.documentElement.clientHeight
      )
      
      setViewportHeight(windowHeight)
      setDocumentHeight(docHeight)
      
      setSnapPositions({
        bottomRight: { x: 0, y: 0 },
        middleRight: { x: 0, y: -windowHeight / 2 },
        topRight: { x: 0, y: -windowHeight + 100 },
        bottomLeft: { x: -windowWidth + 100, y: 0 },
        middleLeft: { x: -windowWidth + 100, y: -windowHeight / 2 },
        topLeft: { x: -windowWidth + 100, y: -windowHeight + 100 },
      })
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  // Theo dõi vị trí cuộn trang để ẩn/hiện nút Scroll To Top
  useEffect(() => {
    let ticking = false
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          scrollPositionRef.current = window.scrollY
          setShowScrollTop(window.scrollY > 20)
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Tự động snap xuống cuối khi cuộn hết trang
  useEffect(() => {
    if (currentPosition === 'bottomRight' || currentPosition === 'bottomLeft') return
    const maxScroll = documentHeight - viewportHeight
    if (maxScroll <= 0) return
    const scrollProgress = Math.min(scrollPositionRef.current / maxScroll, 1)
    if (scrollProgress >= 0.95) {
      setCurrentPosition(currentPosition.includes('Right') ? 'bottomRight' : 'bottomLeft')
    }
  }, [showScrollTop, currentPosition, documentHeight, viewportHeight])

  // Nạp module marked động khi mở chat để tối ưu kích thước bundle
  useEffect(() => {
    if (isOpen && !markedModule) {
      import('marked').then(mod => {
        setMarkedModule({ parse: (s: string) => mod.marked.parse(s) as string })
      })
    }
  }, [isOpen, markedModule])

  // Cuộn khung chat xuống đáy (chỉ cuộn container bên trong, không dùng scrollIntoView để tránh làm lệch khung modal)
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const container = chatMessagesContainerRef.current
    if (container) {
      if (behavior === 'smooth') {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
      } else {
        container.scrollTop = container.scrollHeight
      }
    }
    isAtBottomRef.current = true
    setShowScrollToBottomBtn(false)
  }, [])

  // Nhận diện trạng thái cuộn của người dùng: chỉ auto-scroll nếu đang ở gần đáy
  const handleContainerScroll = useCallback(() => {
    const container = chatMessagesContainerRef.current
    if (!container) return
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    const isAtBottom = distanceFromBottom < 100
    isAtBottomRef.current = isAtBottom
    setShowScrollToBottomBtn(!isAtBottom)
  }, [])

  // Cuộn thông minh khi có tin nhắn mới hoặc streaming (không ép cuộn nếu người dùng đang đọc phía trên)
  useLayoutEffect(() => {
    if (!isOpen) return
    if (isAtBottomRef.current) {
      scrollToBottom('auto')
      const raf = requestAnimationFrame(() => {
        if (isAtBottomRef.current) scrollToBottom('auto')
      })
      const t1 = setTimeout(() => {
        if (isAtBottomRef.current) scrollToBottom('auto')
      }, 60)
      return () => {
        cancelAnimationFrame(raf)
        clearTimeout(t1)
      }
    }
  }, [messages, isLoadingChat, streamingContent, isOpen, scrollToBottom])

  // MutationObserver bắt các thay đổi nở chiều cao của nội dung khi AI đang streaming
  useEffect(() => {
    if (!isOpen || !isLoadingChat) return
    const container = chatMessagesContainerRef.current
    if (!container) return

    const doScroll = () => {
      if (isAtBottomRef.current) {
        requestAnimationFrame(() => scrollToBottom('auto'))
      }
    }

    const mutObs = new MutationObserver(doScroll)
    mutObs.observe(container, { childList: true, subtree: true, characterData: true })

    return () => {
      mutObs.disconnect()
    }
  }, [isOpen, isLoadingChat, scrollToBottom])

  // Cuộn lại khi ảnh poster load xong
  const handleImageLoad = useCallback(() => {
    if (isAtBottomRef.current) {
      scrollToBottom('auto')
    }
  }, [scrollToBottom])

  // Xử lý kéo thả nút Floating Chat
  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const { point } = info
    const windowWidth = window.innerWidth
    const windowHeight = window.innerHeight
    const buttonSize = 80

    const constrainedPoint = {
      x: Math.max(buttonSize, Math.min(point.x, windowWidth - buttonSize)),
      y: Math.max(buttonSize, Math.min(point.y, windowHeight - buttonSize))
    }

    const distances = Object.entries(snapPositions).map(([key, pos]) => ({
      key,
      distance: Math.sqrt(
        Math.pow(constrainedPoint.x - (pos.x + windowWidth - 100), 2) +
        Math.pow(constrainedPoint.y - (pos.y + windowHeight - 100), 2)
      )
    }))

    const closest = distances.reduce((prev, curr) => 
      prev.distance < curr.distance ? prev : curr
    )

    setCurrentPosition(closest.key as keyof typeof snapPositions)
    setPosition(snapPositions[closest.key as keyof typeof snapPositions])
  }

  // Sao chép nội dung tin nhắn AI
  const handleCopyMessage = useCallback((content: string, index: number) => {
    navigator.clipboard?.writeText(content).then(() => {
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    }).catch(() => {})
  }, [])

  // Xóa toàn bộ lịch sử trò chuyện
  const handleConfirmClear = () => {
    setMessages([])
    setStreamingContent('')
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ntn_chatMessages')
    }
    setShowClearConfirm(false)
  }

  // Gợi ý câu hỏi theo khung giờ trong ngày (được memoize)
  const timeSuggestions = useMemo((): string[] => {
    if (!isHydrated) return ['🍿 Phim hành động đáng xem', '😂 Phim hài giải trí', '🔥 Phim hot tuần này']
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 11) {
      return ['☀️ Phim nhẹ nhàng cho buổi sáng', '🎞️ Phim hoạt hình vui vẻ', '📚 Phim tài liệu hay']
    }
    if (hour >= 11 && hour < 17) {
      return ['🍿 Phim hành động đáng xem', '😂 Phim hài giải trí', '🔥 Phim hot tuần này']
    }
    if (hour >= 17 && hour < 22) {
      return ['💑 Phim tình cảm lãng mạn', '🕵️ Phim trinh thám gay cấn', '🇰🇷 Phim bộ Hàn Quốc hay']
    }
    return ['👻 Phim kinh dị đêm khuya', '🌌 Phim khoa học viễn tưởng', '🧠 Phim tâm lý sâu sắc']
  }, [isHydrated])

  // Fallback non-streaming: gọi /api/chat trả JSON
  const fetchNonStreamReply = async (payload: { role: 'user' | 'assistant', content: string }[]): Promise<string> => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: payload })
    })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    const data = await response.json()
    if (data.choices?.[0]?.message?.content) return data.choices[0].message.content
    if (data.reply) return data.reply
    if (data.error) return `Thông báo từ AI: ${data.error}`
    if (data.message) return `${data.message}`
    return 'Hệ thống AI đang khởi động, vui lòng thử lại sau vài giây!'
  }

  // Streaming SSE: đọc từng chunk từ /api/chat/stream
  const fetchStreamReply = async (payload: { role: 'user' | 'assistant', content: string }[]): Promise<string | null> => {
    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: payload })
    })
    const contentType = response.headers.get('content-type') || ''
    if (!response.ok || !response.body || !contentType.includes('text/event-stream')) return null

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullText = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
      const events = buffer.split('\n\n')
      buffer = events.pop() || ''

      for (const event of events) {
        const dataLine = event.split('\n').find(line => line.startsWith('data: '))
        if (!dataLine) continue
        const jsonStr = dataLine.slice(6).trim()
        if (!jsonStr || jsonStr === '[DONE]') continue
        try {
          const parsed = JSON.parse(jsonStr)
          if (parsed.error) {
            if (!fullText) return null
            continue
          }
          if (parsed.text) {
            fullText += parsed.text
            setStreamingContent(fullText)
          }
        } catch {
          // Bỏ qua chunk JSON lỗi
        }
      }
    }
    return fullText || null
  }

  const handleSendMessage = useCallback(async (contentToSend: string) => {
    const trimmed = contentToSend.trim()
    if (!trimmed || isLoadingChat) return

    const newMessage: { role: 'user', content: string } = { role: 'user', content: trimmed }
    setMessages(prev => [...prev, newMessage])
    setIsLoadingChat(true)

    // Đưa tiêu điểm vào input và luôn cuộn xuống đáy khi user gửi tin
    chatInputRef.current?.focus()
    isAtBottomRef.current = true
    setShowScrollToBottomBtn(false)
    scrollToBottom('smooth')

    const payload = [...messages, newMessage]
    setStreamingContent('')

    try {
      let assistantMessageContent: string | null = null
      try {
        assistantMessageContent = await fetchStreamReply(payload)
      } catch (streamErr) {
        console.warn('[Chat] Stream lỗi, chuyển sang non-stream:', streamErr)
      }
      if (!assistantMessageContent) {
        assistantMessageContent = await fetchNonStreamReply(payload)
      }

      const assistantMessage: { role: 'assistant', content: string } = { 
        role: 'assistant', 
        content: assistantMessageContent 
      }
      setMessages(prev => [...prev, assistantMessage])
      if (isAtBottomRef.current) {
        setTimeout(() => scrollToBottom('auto'), 50)
      }

    } catch {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Không thể kết nối đến máy chủ AI vào lúc này. Vui lòng thử lại sau ít phút!' 
      }])
    } finally {
      setStreamingContent('')
      setIsLoadingChat(false)
    }
  }, [isLoadingChat, messages, scrollToBottom])

  // Render nội dung Markdown có qua sanitize an toàn XSS và được cache
  const renderMarkdown = useCallback((content: string) => {
    if (markdownCache.has(content)) {
      return markdownCache.get(content)!
    }
    const rawHtml = markedModule ? markedModule.parse(content) : content
    const cleanHtml = sanitizeHtml(rawHtml)
    if (markedModule && content.length > 0) {
      if (markdownCache.size > 200) {
        const firstKey = markdownCache.keys().next().value
        if (firstKey) markdownCache.delete(firstKey)
      }
      markdownCache.set(content, cleanHtml)
    }
    return cleanHtml
  }, [markedModule])

  return (
    <>
      {/* Nút Cuộn Lên Đầu Trang (Scroll to Top) */}
      {showScrollTop && !isWatchingFullMovie && !isOpen && !isAppModalOpen && (
        <motion.button
          drag
          dragMomentum={false}
          dragElastic={0.1}
          dragConstraints={typeof window !== 'undefined' ? {
            top: -(window.innerHeight - 120),
            left: -(window.innerWidth - 100),
            right: 0,
            bottom: 0
          } : undefined}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0 }}
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          onDragStart={() => {
            isScrollTopDraggingRef.current = true
          }}
          onDragEnd={() => {
            setTimeout(() => {
              isScrollTopDraggingRef.current = false
            }, 150)
          }}
          onClick={() => {
            if (isScrollTopDraggingRef.current) return
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          className="fixed bottom-24 right-6 z-[1001] cursor-move select-none flex items-center justify-center rounded-full shadow-lg hover:shadow-xl transition-shadow"
          style={{
            background: 'linear-gradient(135deg, #f59e42 0%, #f43f5e 100%)',
            width: 52,
            height: 52,
            boxShadow: '0 0 16px 4px #f43f5e55, 0 2px 16px rgba(0,0,0,0.18)',
            border: 'none',
            outline: 'none',
          }}
          aria-label="Lên đầu trang"
        >
          <motion.span
            animate={{ y: [0, -4, 0] }}
            transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
            className="flex items-center justify-center pointer-events-none"
          >
            <ChevronUpIcon className="w-7 h-7 text-white drop-shadow-lg" />
          </motion.span>
        </motion.button>
      )}

      {/* Floating Chat Button */}
      <AnimatePresence>
        {!isOpen && !isWatchingFullMovie && !isAppModalOpen && (
          <motion.button
            ref={buttonRef}
            initial={{ scale: 0, opacity: 0, ...position }}
            animate={{ 
              scale: 1, 
              opacity: 1,
              ...position
            }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onDragStart={() => {
              isChatDraggingRef.current = true
            }}
            onDragEnd={(event, info) => {
              handleDragEnd(event, info)
              setTimeout(() => {
                isChatDraggingRef.current = false
              }, 150)
            }}
            onClick={() => {
              if (isChatDraggingRef.current) return
              setIsOpen(true)
            }}
            drag
            dragControls={dragControls}
            dragMomentum={false}
            dragElastic={0.1}
            dragConstraints={typeof window !== 'undefined' ? {
              top: -(window.innerHeight - 100),
              left: -(window.innerWidth - 100),
              right: 0,
              bottom: 0
            } : undefined}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-6 right-6 z-[1000] bg-gradient-to-r from-red-600 via-rose-600 to-red-500 text-white p-4 rounded-full shadow-[0_4px_25px_rgba(225,29,72,0.4)] hover:shadow-[0_6px_30px_rgba(225,29,72,0.55)] transition-all duration-300 cursor-move border border-red-400/20"
            aria-label="Mở Trợ lý AI Phim Ảnh"
          >
            <ChatBubbleLeftIcon className="h-6 w-6 text-white" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chatbox Overlay Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/75 backdrop-blur-md z-[1050] flex items-center justify-center p-3 sm:p-5 overflow-hidden"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="chatbox-heading"
              initial={{ scale: 0.94, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 16 }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
              className="relative bg-gradient-to-b from-gray-900/98 via-gray-900/95 to-gray-950/98 border border-gray-700/70 rounded-2xl w-full max-w-2xl lg:max-w-3xl h-[620px] max-h-[calc(100vh-2.5rem)] flex flex-col shadow-[0_20px_70px_rgba(0,0,0,0.7)] overflow-hidden backdrop-blur-xl"
              onClick={e => e.stopPropagation()}
            >
              {/* Pop-up Xác nhận xóa lịch sử theo phong cách NTN Cinema */}
              <AnimatePresence>
                {showClearConfirm && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => setShowClearConfirm(false)}
                  >
                    <motion.div
                      role="alertdialog"
                      aria-modal="true"
                      aria-labelledby="confirm-clear-heading"
                      aria-describedby="confirm-clear-desc"
                      initial={{ scale: 0.88, opacity: 0, y: 12 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.88, opacity: 0, y: 12 }}
                      transition={{ type: "spring", duration: 0.28, bounce: 0.15 }}
                      className="relative bg-gradient-to-b from-gray-800 via-gray-850 to-gray-900 border border-gray-700/80 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center overflow-hidden"
                      onClick={e => e.stopPropagation()}
                    >
                      {/* Vệt sáng neon đỏ phía trên */}
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent blur-[1px]" />
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-red-500/20 blur-xl pointer-events-none" />

                      {/* Icon thùng rác phát sáng */}
                      <div className="flex justify-center mb-4">
                        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 shadow-[0_0_24px_rgba(239,68,68,0.25)] flex-shrink-0">
                          <TrashIcon className="h-7 w-7" aria-hidden="true" />
                        </div>
                      </div>

                      <h3 id="confirm-clear-heading" className="text-base font-bold text-white mb-2">
                        Xóa toàn bộ lịch sử trò chuyện?
                      </h3>
                      <p id="confirm-clear-desc" className="text-xs text-gray-300 leading-relaxed mb-6">
                        Tất cả tin nhắn trò chuyện và gợi ý phim đã lưu sẽ bị xóa vĩnh viễn khỏi thiết bị này.
                      </p>

                      <div className="flex gap-2.5">
                        <button
                          type="button"
                          onClick={() => setShowClearConfirm(false)}
                          className="flex-1 min-h-[40px] px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-300 hover:text-white bg-gray-700/60 hover:bg-gray-700 border border-gray-600/50 transition-all duration-200"
                        >
                          Hủy bỏ
                        </button>
                        <button
                          type="button"
                          onClick={handleConfirmClear}
                          className="flex-1 min-h-[40px] px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-lg shadow-red-600/30 transition-all duration-200 active:scale-95"
                        >
                          Xác nhận xóa
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Chatbox Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900/60 backdrop-blur-md flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-red-600 to-rose-500 flex items-center justify-center text-white shadow-md shadow-red-600/30 flex-shrink-0">
                    <FilmIcon className="w-5 h-5 text-white" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 id="chatbox-heading" className="text-base sm:text-lg font-bold bg-gradient-to-r from-red-400 via-rose-300 to-orange-300 text-transparent bg-clip-text">
                      Trợ lý AI Điện ảnh NTN
                    </h2>
                    <p className="text-xs text-gray-300/90 leading-tight">Chuyên tư vấn & gợi ý phim thông minh</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {messages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowClearConfirm(true)}
                      disabled={isLoadingChat}
                      className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                      aria-label="Xóa toàn bộ lịch sử trò chuyện"
                      title="Xóa toàn bộ lịch sử trò chuyện"
                    >
                      <TrashIcon className="h-5 w-5" aria-hidden="true" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                    aria-label="Đóng chat (phím Escape)"
                    title="Đóng chat (Esc)"
                  >
                    <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* Chat Messages Container */}
              <div 
                ref={chatMessagesContainerRef}
                onScroll={handleContainerScroll}
                onLoadCapture={handleImageLoad}
                style={{
                  overflowAnchor: 'none',
                  scrollbarGutter: 'stable',
                  overscrollBehavior: 'contain',
                }}
                className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 custom-scrollbar"
              >
                <div ref={chatContentRef} className="space-y-4">
                  {/* Màn hình Welcome khi chưa có tin nhắn */}
                  {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-red-600/20 to-rose-500/10 border border-red-500/30 flex items-center justify-center mb-3.5 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
                        <FilmIcon className="w-8 h-8 text-rose-400 animate-pulse" aria-hidden="true" />
                      </div>
                      <p className="text-base sm:text-lg font-bold text-gray-100 mb-1.5">Trợ lý Phim Ảnh NTN Stream</p>
                      <p className="text-xs sm:text-sm text-gray-400 max-w-sm mb-5 leading-relaxed">
                        Hãy hỏi tôi bất kỳ điều gì về phim lẻ, phim bộ, diễn viên, hoặc nhờ AI gợi ý theo tâm trạng của bạn!
                      </p>
                      <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                        {timeSuggestions.map((suggest, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => chatInputRef.current?.setValue(suggest.replace(/^[^\\s]+\\s/, ''))}
                            className="text-xs bg-gray-800/80 hover:bg-red-950/60 hover:border-red-500/60 border border-gray-700/70 text-gray-300 hover:text-white rounded-xl px-3.5 py-2 transition-all shadow-sm active:scale-95"
                          >
                            {suggest}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Danh sách tin nhắn (mỗi tin nhắn được memoize để không re-render khi gõ phím) */}
                  {messages.map((msg, index) => (
                    <ChatMessageItem
                      key={index}
                      msg={msg}
                      index={index}
                      isCopied={copiedIndex === index}
                      onCopy={handleCopyMessage}
                      renderMarkdown={renderMarkdown}
                    />
                  ))}

                  {/* Bong bóng đang streaming */}
                  {isLoadingChat && streamingContent && (
                    <div className="flex justify-start">
                      <div className="max-w-[85%] sm:max-w-[80%] p-3.5 rounded-2xl bg-gray-800/90 border border-gray-700/60 text-gray-100 rounded-bl-sm shadow-md break-words">
                        <div 
                          className="ai-response-content prose prose-invert max-w-none text-sm leading-relaxed prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-headings:my-2 prose-strong:text-white prose-strong:font-semibold" 
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(streamingContent) }} 
                        />
                        <span className="inline-block w-2 h-4 bg-rose-400 ml-1 align-middle animate-pulse rounded-sm" />
                      </div>
                    </div>
                  )}

                  {/* Typing Indicator lúc AI đang chuẩn bị phản hồi */}
                  {isLoadingChat && !streamingContent && (
                    <div className="flex justify-start items-center gap-2">
                      <div className="bg-gray-800/90 border border-gray-700/60 p-3 rounded-2xl flex items-center gap-3 shadow-md">
                        <div className="flex space-x-1.5">
                          <div className="w-2 h-2 bg-red-400 rounded-full animate-bounce" />
                          <div className="w-2 h-2 bg-rose-400 rounded-full animate-bounce delay-150" />
                          <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce delay-300" />
                        </div>
                        <span className="text-xs text-gray-300 font-medium">AI đang tìm kiếm phim...</span>
                      </div>
                    </div>
                  )}

                  {/* Sentinel Anchor để cuộn xuống đáy */}
                  <div ref={messagesEndRef} className="h-0 w-full invisible pointer-events-none" />
                </div>
              </div>

              {/* Nút Cuộn Xuống Đáy khi người dùng đang lướt lên trên */}
              <AnimatePresence>
                {showScrollToBottomBtn && (
                  <motion.button
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.9 }}
                    type="button"
                    onClick={() => scrollToBottom('smooth')}
                    className="absolute bottom-20 right-6 z-20 bg-gray-800/95 hover:bg-gray-700 text-white border border-gray-600/70 rounded-full px-3.5 py-1.5 shadow-2xl flex items-center gap-1.5 text-xs backdrop-blur-md transition-all active:scale-95"
                    aria-label="Cuộn xuống tin nhắn mới nhất"
                  >
                    <ArrowDownIcon className="w-3.5 h-3.5 text-rose-400 animate-bounce" aria-hidden="true" />
                    <span className="font-medium text-gray-200">Xuống dưới</span>
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Input Form (Cô lập state để hoàn toàn không re-render khung tin nhắn khi gõ phím) */}
              <ChatInputForm
                ref={chatInputRef}
                onSendMessage={handleSendMessage}
                isLoadingChat={isLoadingChat}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}