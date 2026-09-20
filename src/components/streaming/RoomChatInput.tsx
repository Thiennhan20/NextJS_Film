'use client';

import React, { useState, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaceSmileIcon as Smile, PaperAirplaneIcon as Send } from '@heroicons/react/24/outline';

const EMOJIS = ['👍', '❤️', '🔥', '😂', '😮', '😢', '🎉', '👏', '🍿', '🚀', '💯', '✨', '🥰', '😍', '🤩', '😎'];

interface RoomChatInputProps {
  onSendMessage: (text: string) => void;
  onSendEmoji: (emoji: string) => void;
  placeholder?: string;
}

function RoomChatInputComponent({ onSendMessage, onSendEmoji, placeholder = 'Type a message...' }: RoomChatInputProps) {
  const [chatInput, setChatInput] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);
  const [rateLimitNotice, setRateLimitNotice] = useState('');

  const lastSentTimeRef = useRef(0);
  const emojiTimestampsRef = useRef<number[]>([]);
  const noticeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showNotice = (msg: string) => {
    setRateLimitNotice(msg);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => {
      setRateLimitNotice('');
    }, 2000);
  };

  const handleSend = () => {
    const trimmed = chatInput.trim();
    if (!trimmed) return;

    const now = Date.now();
    // Cooldown 800ms between messages
    if (now - lastSentTimeRef.current < 800) {
      showNotice('Gửi tin nhắn quá nhanh, vui lòng đợi giây lát ⏳');
      return;
    }

    lastSentTimeRef.current = now;
    onSendMessage(trimmed);
    setChatInput('');
  };

  const handleEmojiSelect = (emoji: string) => {
    const now = Date.now();
    // Keep timestamps within last 2 seconds
    emojiTimestampsRef.current = emojiTimestampsRef.current.filter(t => now - t < 2000);

    // Max 4 emojis per 2 seconds
    if (emojiTimestampsRef.current.length >= 4) {
      showNotice('Thả cảm xúc từ từ thôi nhé! 😊');
      return;
    }

    emojiTimestampsRef.current.push(now);
    onSendEmoji(emoji);
    setShowEmojis(false);
  };

  return (
    <>
      {/* Emoji Bar — Absolute Popover nổi lên trên tin nhắn */}
      <AnimatePresence>
        {showEmojis && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute bottom-12 left-2 right-2 z-50 bg-gray-950/95 border border-gray-800 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.7)] p-2 max-h-[150px] overflow-y-auto chat-scrollbar"
          >
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5 justify-items-center">
              {EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleEmojiSelect(emoji)}
                  className="text-xl hover:scale-125 active:scale-95 transition-transform p-1 rounded hover:bg-white/10"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Input Field */}
      <div className="px-2 sm:px-3 py-1.5 sm:py-2 border-t border-gray-800/80 shrink-0">
        {/* Subtle Rate Limit Notice */}
        <AnimatePresence>
          {rateLimitNotice && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="text-[10px] sm:text-[11px] text-amber-400 font-medium px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/25 rounded-md mb-1.5 text-center flex items-center justify-center gap-1 shadow-sm"
            >
              <span>{rateLimitNotice}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-1 sm:gap-1.5">
          <button
            type="button"
            onClick={() => setShowEmojis(prev => !prev)}
            className={`p-1 sm:p-1.5 rounded-lg transition-colors shrink-0 ${
              showEmojis ? 'bg-yellow-500/20 text-yellow-400' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
            }`}
            aria-label="Toggle emoji picker"
          >
            <Smile className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={placeholder}
            className="flex-grow bg-gray-800/50 border border-gray-700/40 rounded-full px-3 py-1 sm:py-1.5 text-base text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-yellow-500/30 focus:border-yellow-500/30 transition-all"
            maxLength={500}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!chatInput.trim()}
            className="p-1 sm:p-1.5 bg-yellow-500 text-black rounded-full hover:bg-yellow-400 disabled:bg-gray-700 disabled:text-gray-500 transition-colors shrink-0"
            aria-label="Send message"
          >
            <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>
        </div>
      </div>
    </>
  );
}

export const RoomChatInput = memo(RoomChatInputComponent);
