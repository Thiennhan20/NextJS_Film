'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatBubbleLeftEllipsisIcon as MessageCircle, UserIcon as User, PaperAirplaneIcon as Send, FaceSmileIcon as Smile, PhotoIcon as LucideImage } from '@heroicons/react/24/outline';
import Image from 'next/image';
import { useChatSocket, emojiCategories, quickEmojis } from '@/hooks/useChatSocket';

interface ChatProps {
  username: string;
  isVisible: boolean;
  isMobileLandscape?: boolean;
  onUserCountChange?: (count: number) => void;
}

export default function Chat({ username, isVisible, isMobileLandscape = false, onUserCountChange }: ChatProps) {
  const {
    chatMessages,
    newMessage,
    setNewMessage,
    showEmojiPicker,
    setShowEmojiPicker,
    isEditingUsername,
    setIsEditingUsername,
    tempUsername,
    setTempUsername,
    selectedEmojiCategory,
    setSelectedEmojiCategory,
    handleSendMessage,
    handleEmojiClick,
    handleImageUpload,
    handleUsernameChange,
    formatTime,
  } = useChatSocket({ username, onUserCountChange });

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);

  // Handle click outside để đóng emoji picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const emojiButton = document.querySelector('.emoji-button');
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node) &&
        emojiButton &&
        !emojiButton.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setShowEmojiPicker]);

  // Tự động cuộn khi có tin nhắn mới
  useEffect(() => {
    if (chatContainerRef.current) {
      const container = chatContainerRef.current;
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [chatMessages]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, delay: 0.4 }}
      className={isMobileLandscape ? `fixed inset-y-0 right-0 w-full h-full bg-gradient-to-b from-gray-900/95 to-black/95 backdrop-blur-xl rounded-l-none shadow-2xl transition-transform duration-300 transform landscape:w-full landscape:max-w-[80%] landscape:h-full landscape:inset-y-0 landscape:left-auto landscape:right-0 ${isVisible ? 'translate-x-0' : 'translate-x-full'}` : (isVisible ? 'lg:w-1/2 flex flex-col h-[calc(100vh-12rem)] lg:h-[calc(100vh-8rem)] bg-gradient-to-b from-gray-900/95 to-black/95 backdrop-blur-xl rounded-2xl border border-yellow-500/20 shadow-2xl' : 'hidden')}
    >
      {/* Chat Header */}
      <div className="bg-gradient-to-r from-yellow-600/20 to-yellow-500/10 backdrop-blur-lg p-3 sm:p-4 rounded-t-2xl border-b border-yellow-500/30">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-yellow-300 flex items-center gap-1 sm:gap-2">
            <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5" />
            Live Chat
          </h2>
          <div className="flex items-center gap-2 sm:gap-3">
            {isEditingUsername ? (
              <div className="flex items-center gap-1 sm:gap-2">
                <input
                  type="text"
                  value={tempUsername}
                  onChange={(e) => setTempUsername(e.target.value)}
                  placeholder="New username"
                  className="px-2 py-1 bg-gray-800/80 rounded-md text-xs sm:text-sm text-white border border-yellow-500/30 focus:border-yellow-500/50 focus:outline-none focus:ring-1 focus:ring-yellow-500/30"
                  onKeyDown={(e) => e.key === 'Enter' && handleUsernameChange()}
                />
                <button
                  onClick={handleUsernameChange}
                  className="px-2 py-1 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black rounded-md text-xs sm:text-sm font-medium hover:from-yellow-400 hover:to-yellow-500 transition-all duration-200 shadow-lg shadow-yellow-500/20"
                >
                  Save
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setTempUsername(username);
                  setIsEditingUsername(true);
                }}
                className="text-xs sm:text-sm text-yellow-300 hover:text-yellow-200 transition-colors duration-200 flex items-center gap-1 sm:gap-2"
              >
                <User className="h-3 w-3 sm:h-4 sm:w-4" />
                {username}
              </button>
            )}
            <div className="flex items-center gap-1 sm:gap-2 text-xs text-gray-400">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full animate-pulse" />
              {chatMessages.length} messages
            </div>
          </div>
        </div>
      </div>
    
      {/* Chat Messages */}
      <div
        ref={chatContainerRef}
        className="flex-grow overflow-y-auto p-3 sm:p-4 space-y-1.5 sm:space-y-2 scrollbar-hide hover:scrollbar-default relative"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        <AnimatePresence>
          {chatMessages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className={`flex items-start ${msg.sender === 'me' ? 'justify-end' : 'justify-start'} ${msg.type === 'system' ? 'text-center' : ''} ${showEmojiPicker && msg.type === 'system' ? 'hidden' : ''}`}
            >
              {msg.type === 'system' ? (
                <div className="relative w-full text-center text-white text-xs py-2">
                  <hr className="absolute top-1/2 left-0 right-0 border-t border-gray-500" />
                  <span className="relative z-10 px-2 bg-gray-900 rounded-xl py-1">{msg.text}</span>
                </div>
              ) : (
                <>
                  {msg.sender !== 'me' && (
                    <div className="flex-shrink-0">
                      <div className="w-5 sm:w-6 h-5 sm:h-6 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-xs sm:text-sm shadow-lg shadow-yellow-500/20 ring-2 ring-yellow-500/20">
                        {msg.avatar}
                      </div>
                    </div>
                  )}
  
                  <div className={`max-w-[75%] ${msg.sender === 'me' ? 'order-2' : ''}`}>
                    {msg.sender !== 'me' && (
                      <div className="flex items-center gap-0.5 mb-0.5">
                        <span className={`text-xs font-semibold ${msg.isVip ? 'text-yellow-400' : 'text-gray-300'}`}>
                          {msg.username}
                          {msg.isVip && <span className="text-yellow-400 ml-0.5">⭐</span>}
                        </span>
                        <span className="text-xs text-gray-500">{formatTime(msg.timestamp)}</span>
                      </div>
                    )}
  
                    <div
                      className={`rounded-xl px-2 py-1.5 ${
                        msg.sender === 'me'
                          ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-black shadow-md shadow-yellow-500/20 ring-1 ring-yellow-500/30'
                          : msg.type === 'emoji'
                          ? 'bg-transparent text-xl sm:text-2xl'
                          : 'bg-gradient-to-r from-gray-800/80 to-gray-700/80 text-white shadow-md backdrop-blur-sm ring-1 ring-gray-500/30'
                      } ${msg.type === 'emoji' ? 'text-center' : ''}`}
                    >
                      {msg.type === 'image' && (msg.imageUrl || msg.imageStatus === 'loading' || msg.imageStatus === 'error') ? (
                        <div className="relative">
                          {msg.imageUrl && (
                            <Image
                              src={msg.imageUrl}
                              alt="Shared image in chat"
                              width={120}
                              height={90}
                              className="max-w-full h-auto rounded-lg object-contain shadow-md ring-1 ring-gray-500/30"
                              sizes="(max-width: 768px) 100vw, 33vw"
                            />
                          )}
                          {(msg.imageStatus === 'loading' && msg.progress !== undefined && msg.progress < 100) && (
                            <div className="absolute inset-0 bg-gray-900/70 rounded-lg flex items-center justify-center">
                              <div className="flex flex-col items-center gap-2">
                                <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                                <span className="text-xs text-gray-400">{Math.round(msg.progress || 0)}%</span>
                              </div>
                            </div>
                          )}
                          {msg.imageStatus === 'error' && (
                            <div className="absolute inset-0 bg-red-900/70 rounded-lg flex items-center justify-center">
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-red-500">⚠️</span>
                                <span className="text-xs text-red-400">{msg.text || 'Lỗi tải ảnh'}</span>
                              </div>
                            </div>
                          )}
                          {(!msg.imageUrl && msg.imageStatus === 'loading') && (
                            <div className="w-[120px] h-[90px] bg-gray-700/50 rounded-lg flex items-center justify-center">
                              <div className="flex flex-col items-center gap-2">
                                <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                                <span className="text-xs text-gray-400">{Math.round(msg.progress || 0)}%</span>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className={`${msg.type === 'emoji' ? 'text-base sm:text-xl' : 'text-xs'} break-words`}>
                          {msg.text}
                          {msg.networkStatus && (
                            <span className={`ml-1 text-xs ${
                              msg.networkStatus === 'slow' ? 'text-yellow-500' : 'text-red-500'
                            }`}>
                              {msg.networkStatus === 'slow' ? '⚠️' : '❌'}
                            </span>
                          )}
                        </p>
                      )}
                      {msg.sender === 'me' && (
                        <div className="text-right text-xs text-black/70 mt-0.5">{formatTime(msg.timestamp)}</div>
                      )}
                    </div>
                  </div>
  
                  {msg.sender === 'me' && (
                    <div className="flex-shrink-0 order-3">
                      <div className="w-5 sm:w-6 h-5 sm:h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-xs sm:text-sm shadow-lg shadow-blue-500/20 ring-2 ring-blue-500/20">
                        {msg.avatar}
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={chatEndRef} />
      </div>
    
      {/* Chat Input */}
      <div className="bg-gradient-to-r from-gray-900/95 to-black/95 backdrop-blur-lg p-3 sm:p-4 rounded-b-2xl border-t border-yellow-500/20">
        <div className="flex flex-col gap-2">
          <textarea
            rows={2}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="w-full px-3 py-2 bg-gray-800/80 rounded-xl border border-yellow-500/20 focus:outline-none focus:ring-2 focus:ring-yellow-500/30 focus:border-yellow-500/40 text-white placeholder-gray-400 text-xs resize-none transition-all duration-300 backdrop-blur-sm shadow-md ring-1 ring-yellow-500/10 hover:border-yellow-500/40 hover:shadow-yellow-500/5 scrollbar-hide"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
  
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 sm:gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="emoji-button p-1.5 bg-gray-700/50 hover:bg-gray-600/50 text-yellow-400 rounded-lg transition-all duration-200 flex items-center justify-center border border-yellow-500/20 hover:border-yellow-500/40 shadow-md ring-1 ring-yellow-500/10 hover:shadow-yellow-500/10"
              >
                <Smile className="h-3 w-3" />
              </motion.button>
  
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 bg-gray-700/50 hover:bg-gray-600/50 text-yellow-400 rounded-lg transition-all duration-200 flex items-center justify-center border border-yellow-500/20 hover:border-yellow-500/40 shadow-md ring-1 ring-yellow-500/10 hover:shadow-yellow-500/10"
              >
                <LucideImage className="h-3 w-3" />
              </motion.button>
            </div>
  
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSendMessage}
              disabled={!newMessage.trim()}
              className="px-2 py-1 bg-gradient-to-r from-yellow-500/90 to-yellow-600/90 hover:from-yellow-400/90 hover:to-yellow-500/90 disabled:from-gray-600/50 disabled:to-gray-700/50 disabled:cursor-not-allowed text-black/90 font-medium rounded-lg transition-all duration-300 shadow-md shadow-yellow-500/10 flex items-center gap-1 ring-1 ring-yellow-500/20 hover:shadow-yellow-500/20 disabled:shadow-none text-xs sm:text-sm"
            >
              <span className="hidden sm:inline">Send</span>
              <Send className="h-3 w-3" />
            </motion.button>
          </div>
        </div>
  
        {/* Emoji Picker */}
        <AnimatePresence>
          {showEmojiPicker && (
            <motion.div
              ref={emojiPickerRef}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-full left-0 right-0 mb-2 bg-gray-800/95 rounded-xl p-3 sm:p-4 border border-yellow-500/20 shadow-xl z-10 backdrop-blur-xl ring-1 ring-yellow-500/20"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Emoji Categories */}
              <div className="flex gap-1 mb-3 overflow-x-auto pb-2 scrollbar-hide">
                {emojiCategories.map((category) => (
                  <motion.button
                    key={category.name}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setSelectedEmojiCategory(category.name)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-sm transition-all duration-200 ${
                      selectedEmojiCategory === category.name
                        ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                        : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 border border-transparent'
                    }`}
                  >
                    <span>{category.icon}</span>
                    <span className="hidden sm:inline">{category.name}</span>
                  </motion.button>
                ))}
              </div>

              {/* Emoji Grid */}
              <div className="grid grid-cols-6 sm:grid-cols-8 gap-1 sm:gap-2 max-h-[200px] overflow-y-auto scrollbar-hide hover:scrollbar-default pr-1">
                {quickEmojis
                  .filter((emoji) => emoji.category === selectedEmojiCategory)
                  .map((emoji) => (
                    <motion.button
                      key={emoji.name}
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleEmojiClick(emoji.emoji)}
                      className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gray-700/80 hover:bg-gray-600/80 flex items-center justify-center text-lg transition-all duration-200 border border-yellow-500/20 hover:border-yellow-500/40 ring-1 ring-yellow-500/10 hover:shadow-md hover:shadow-yellow-500/10"
                      title={emoji.name}
                    >
                      {emoji.emoji}
                    </motion.button>
                  ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageUpload}
        accept="image/*"
        className="hidden"
      />

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-default::-webkit-scrollbar {
          display: block;
          width: 6px;
          height: 6px;
        }
        .scrollbar-default::-webkit-scrollbar-track {
          background: #1f2937;
          border-radius: 10px;
        }
        .scrollbar-default::-webkit-scrollbar-thumb {
          background: #fbbf24;
          border-radius: 10px;
        }
        .scrollbar-default::-webkit-scrollbar-thumb:hover {
          background: #f59e0b;
        }
      `}</style>
    </motion.div>
  );
}
