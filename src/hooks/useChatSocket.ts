import { useEffect, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import imageCompression from 'browser-image-compression';

export type Message = {
  id: string;
  sender: 'me' | 'other' | 'system';
  username: string;
  text: string;
  timestamp: Date;
  type: 'message' | 'emoji' | 'gift' | 'image' | 'system';
  avatar?: string;
  isVip?: boolean;
  imageUrl?: string;
  imageStatus?: 'loading' | 'success' | 'error';
  networkStatus?: 'good' | 'slow' | 'poor';
  progress?: number;
};

export type Emoji = {
  emoji: string;
  name: string;
  category: string;
};

export const emojiCategories = [
  { name: 'Faces', icon: '😀' },
  { name: 'Love', icon: '❤️' },
  { name: 'Animals', icon: '🐶' },
  { name: 'Food', icon: '🍕' },
  { name: 'Activities', icon: '⚽' },
  { name: 'Travel', icon: '✈️' },
  { name: 'Objects', icon: '💡' },
  { name: 'Symbols', icon: '✨' },
];

export const quickEmojis: Emoji[] = [
  // Faces
  { emoji: '😀', name: 'smile', category: 'Faces' },
  { emoji: '😂', name: 'laugh', category: 'Faces' },
  { emoji: '😊', name: 'blush', category: 'Faces' },
  { emoji: '🥰', name: 'love', category: 'Faces' },
  { emoji: '😎', name: 'cool', category: 'Faces' },
  { emoji: '🤔', name: 'thinking', category: 'Faces' },
  { emoji: '😴', name: 'sleepy', category: 'Faces' },
  { emoji: '🤗', name: 'hug', category: 'Faces' },
  { emoji: '🤫', name: 'shush', category: 'Faces' },
  { emoji: '🤓', name: 'nerd', category: 'Faces' },
  { emoji: '😇', name: 'angel', category: 'Faces' },
  { emoji: '🤠', name: 'cowboy', category: 'Faces' },
  { emoji: '🥺', name: 'pleading', category: 'Faces' },
  { emoji: '😤', name: 'triumph', category: 'Faces' },
  { emoji: '🤪', name: 'zany', category: 'Faces' },
  { emoji: '😷', name: 'mask', category: 'Faces' },
  { emoji: '🤡', name: 'clown', category: 'Faces' },
  { emoji: '👻', name: 'ghost', category: 'Faces' },
  { emoji: '🤖', name: 'robot', category: 'Faces' },
  { emoji: '👽', name: 'alien', category: 'Faces' },
  { emoji: '🤩', name: 'star eyes', category: 'Faces' },
  { emoji: '🥳', name: 'party', category: 'Faces' },
  { emoji: '🤯', name: 'mind blown', category: 'Faces' },
  { emoji: '🤢', name: 'nauseated', category: 'Faces' },
  { emoji: '🤮', name: 'vomiting', category: 'Faces' },
  { emoji: '🤧', name: 'sneezing', category: 'Faces' },

  // Love
  { emoji: '❤️', name: 'heart', category: 'Love' },
  { emoji: '💕', name: 'hearts', category: 'Love' },
  { emoji: '💖', name: 'sparkling heart', category: 'Love' },
  { emoji: '💝', name: 'heart with ribbon', category: 'Love' },
  { emoji: '💓', name: 'beating heart', category: 'Love' },
  { emoji: '💗', name: 'growing heart', category: 'Love' },
  { emoji: '💘', name: 'heart with arrow', category: 'Love' },
  { emoji: '💞', name: 'revolving hearts', category: 'Love' },
  { emoji: '💟', name: 'heart decoration', category: 'Love' },
  { emoji: '💌', name: 'love letter', category: 'Love' },
  { emoji: '💋', name: 'kiss mark', category: 'Love' },

  // Animals
  { emoji: '🐶', name: 'dog', category: 'Animals' },
  { emoji: '🐱', name: 'cat', category: 'Animals' },
  { emoji: '🐼', name: 'panda', category: 'Animals' },
  { emoji: '🦁', name: 'lion', category: 'Animals' },
  { emoji: '🐯', name: 'tiger', category: 'Animals' },
  { emoji: '🦊', name: 'fox', category: 'Animals' },
  { emoji: '🦒', name: 'giraffe', category: 'Animals' },
  { emoji: '🐨', name: 'koala', category: 'Animals' },
  { emoji: '🦘', name: 'kangaroo', category: 'Animals' },
  { emoji: '🦥', name: 'sloth', category: 'Animals' },
  { emoji: '🦦', name: 'otter', category: 'Animals' },
  { emoji: '🦨', name: 'skunk', category: 'Animals' },
  { emoji: '🦡', name: 'badger', category: 'Animals' },
  { emoji: '🦫', name: 'beaver', category: 'Animals' },

  // Food
  { emoji: '🍕', name: 'pizza', category: 'Food' },
  { emoji: '🍔', name: 'hamburger', category: 'Food' },
  { emoji: '🍟', name: 'fries', category: 'Food' },
  { emoji: '🍦', name: 'ice cream', category: 'Food' },
  { emoji: '🍩', name: 'doughnut', category: 'Food' },
  { emoji: '🍪', name: 'cookie', category: 'Food' },
  { emoji: '🍫', name: 'chocolate', category: 'Food' },
  { emoji: '🍷', name: 'wine', category: 'Food' },
  { emoji: '🍜', name: 'noodles', category: 'Food' },
  { emoji: '🍣', name: 'sushi', category: 'Food' },
  { emoji: '🍱', name: 'bento box', category: 'Food' },
  { emoji: '🍙', name: 'rice ball', category: 'Food' },
  { emoji: '🍘', name: 'rice cracker', category: 'Food' },
  { emoji: '🍡', name: 'dango', category: 'Food' },
  { emoji: '🍧', name: 'shaved ice', category: 'Food' },
  { emoji: '🍨', name: 'ice cream', category: 'Food' },

  // Activities
  { emoji: '⚽', name: 'soccer', category: 'Activities' },
  { emoji: '🎮', name: 'game', category: 'Activities' },
  { emoji: '🎲', name: 'dice', category: 'Activities' },
  { emoji: '🎯', name: 'target', category: 'Activities' },
  { emoji: '🎨', name: 'art', category: 'Activities' },
  { emoji: '🎭', name: 'theater', category: 'Activities' },
  { emoji: '🎪', name: 'circus', category: 'Activities' },
  { emoji: '🎬', name: 'movie', category: 'Activities' },
  { emoji: '🎤', name: 'microphone', category: 'Activities' },
  { emoji: '🎧', name: 'headphones', category: 'Activities' },
  { emoji: '🎼', name: 'musical score', category: 'Activities' },
  { emoji: '🎹', name: 'piano', category: 'Activities' },
  { emoji: '🎸', name: 'guitar', category: 'Activities' },
  { emoji: '🎺', name: 'trumpet', category: 'Activities' },
  { emoji: '🎻', name: 'violin', category: 'Activities' },
  { emoji: '🎷', name: 'saxophone', category: 'Activities' },

  // Travel
  { emoji: '✈️', name: 'airplane', category: 'Travel' },
  { emoji: '🚗', name: 'car', category: 'Travel' },
  { emoji: '🚂', name: 'train', category: 'Travel' },
  { emoji: '🚢', name: 'ship', category: 'Travel' },
  { emoji: '🗺️', name: 'map', category: 'Travel' },
  { emoji: '🗽', name: 'statue', category: 'Travel' },
  { emoji: '🗼', name: 'tower', category: 'Travel' },
  { emoji: '🏰', name: 'castle', category: 'Travel' },
  { emoji: '🏯', name: 'Japanese castle', category: 'Travel' },
  { emoji: '🏟️', name: 'stadium', category: 'Travel' },
  { emoji: '🎡', name: 'ferris wheel', category: 'Travel' },
  { emoji: '🎢', name: 'roller coaster', category: 'Travel' },
  { emoji: '🎠', name: 'carousel horse', category: 'Travel' },
  { emoji: '⛱️', name: 'umbrella on ground', category: 'Travel' },
  { emoji: '🏖️', name: 'beach with umbrella', category: 'Travel' },
  { emoji: '⛰️', name: 'mountain', category: 'Travel' },

  // Objects
  { emoji: '💡', name: 'light bulb', category: 'Objects' },
  { emoji: '📱', name: 'phone', category: 'Objects' },
  { emoji: '💻', name: 'laptop', category: 'Objects' },
  { emoji: '⌚', name: 'watch', category: 'Objects' },
  { emoji: '📷', name: 'camera', category: 'Objects' },
  { emoji: '🎥', name: 'movie camera', category: 'Objects' },
  { emoji: '🎧', name: 'headphones', category: 'Objects' },
  { emoji: '🎸', name: 'guitar', category: 'Objects' },
  { emoji: '📚', name: 'books', category: 'Objects' },
  { emoji: '📖', name: 'open book', category: 'Objects' },
  { emoji: '📝', name: 'memo', category: 'Objects' },
  { emoji: '✏️', name: 'pencil', category: 'Objects' },
  { emoji: '🖌️', name: 'paintbrush', category: 'Objects' },
  { emoji: '🎨', name: 'artist palette', category: 'Objects' },
  { emoji: '🎭', name: 'performing arts', category: 'Objects' },
  { emoji: '🎪', name: 'circus tent', category: 'Objects' },

  // Symbols
  { emoji: '✨', name: 'sparkles', category: 'Symbols' },
  { emoji: '💫', name: 'dizzy', category: 'Symbols' },
  { emoji: '⭐', name: 'star', category: 'Symbols' },
  { emoji: '🌟', name: 'glowing star', category: 'Symbols' },
  { emoji: '💯', name: 'hundred', category: 'Symbols' },
  { emoji: '🔥', name: 'fire', category: 'Symbols' },
  { emoji: '💪', name: 'strong', category: 'Symbols' },
  { emoji: '🙌', name: 'praise', category: 'Symbols' },
  { emoji: '👑', name: 'crown', category: 'Symbols' },
  { emoji: '💎', name: 'gem stone', category: 'Symbols' },
  { emoji: '🏆', name: 'trophy', category: 'Symbols' },
  { emoji: '🎖️', name: 'medal', category: 'Symbols' },
  { emoji: '🏅', name: 'sports medal', category: 'Symbols' },
  { emoji: '🎗️', name: 'reminder ribbon', category: 'Symbols' },
  { emoji: '🎯', name: 'direct hit', category: 'Symbols' },
  { emoji: '🎲', name: 'game die', category: 'Symbols' },
];

interface UseChatSocketProps {
  username: string;
  onUserCountChange?: (count: number) => void;
}

export const useChatSocket = ({ username, onUserCountChange }: UseChatSocketProps) => {
  const [chatMessages, setChatMessages] = useState<Message[]>(() => {
    if (typeof window !== 'undefined') {
      const savedMessages = sessionStorage.getItem('chatMessages');
      if (savedMessages) {
        const parsedMessages: Message[] = JSON.parse(savedMessages);
        return parsedMessages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
      }
    }
    return [];
  });
  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [tempUsername, setTempUsername] = useState('');
  const [selectedEmojiCategory, setSelectedEmojiCategory] = useState('Faces');
  const [networkStatus, setNetworkStatus] = useState<'good' | 'slow' | 'poor'>('good');

  const socketRef = useRef<Socket | null>(null);

  // Initialize Socket.IO
  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || (process.env.NODE_ENV === 'development'
      ? 'http://localhost:3001'
      // : 'https://server-nextjs-firm.onrender.com/' // Old US Oregon
      : 'https://server-nextjs-film.onrender.com/'); // New Singapore

    socketRef.current = io(socketUrl, {
      transports: ['websocket'],
      withCredentials: true,
    });

    socketRef.current.on('connect', () => {
      socketRef.current?.emit('user_join', username);
    });

    socketRef.current.on('chat_message', (message) => {
      setChatMessages(prev => {
        // If it's our own image message being echoed back by the server
        if (message.type === 'image' && message.username === username) {
          // Try to find a pending loading image message sent by 'me' with the same image data
          const existingLoadingImageIndex = prev.findIndex(msg =>
            msg.sender === 'me' &&
            msg.type === 'image' &&
            msg.imageStatus === 'loading' &&
            msg.imageUrl === message.content // Match by image data (base64 string)
          );

          if (existingLoadingImageIndex !== -1) {
            // Update the existing loading message with the server's confirmed details
            return prev.map((msg, index) =>
              index === existingLoadingImageIndex
                ? {
                  ...msg,
                  id: message.id || msg.id, // Use server ID, fallback to client temp ID
                  imageStatus: 'success',
                  progress: 100,
                  timestamp: new Date(message.timestamp)
                }
                : msg
            );
          }
        }

        // If not our own image update, or no matching loading message found, add as new
        const newMessage: Message = {
          id: message.id || Date.now().toString(),
          sender: message.type === 'system' ? 'system' : message.username === username ? 'me' : 'other',
          username: message.username || '',
          text: message.content,
          timestamp: new Date(message.timestamp),
          type: message.type === 'image' ? 'image' : message.type === 'system' ? 'system' : message.content.length <= 2 ? 'emoji' : 'message',
          avatar: message.username === username ? '👤' : ['🎬', '🍿', '🎭', '🎥', '🎪'][Math.floor(Math.random() * 5)],
          imageUrl: message.type === 'image' ? message.content : undefined,
        };
        return [...prev, newMessage];
      });
    });

    socketRef.current.on('user_join', (username: string) => {
      const systemJoinMessage: Message = {
        id: Date.now().toString(),
        sender: 'system',
        username: '', // System messages don't have a username display
        text: `${username} đã tham gia phòng chat`,
        timestamp: new Date(),
        type: 'system',
      };
      setChatMessages((prev) => [...prev, systemJoinMessage]);
    });

    socketRef.current.on('user_leave', (username: string) => {
      const systemLeaveMessage: Message = {
        id: Date.now().toString(),
        sender: 'system',
        username: '', // System messages don't have a username display
        text: `${username} đã rời phòng chat`,
        timestamp: new Date(),
        type: 'system',
      };
      setChatMessages((prev) => [...prev, systemLeaveMessage]);
    });

    socketRef.current.on('user_list', (users: string[]) => {
      setOnlineUsers(users.length);
      onUserCountChange?.(users.length);
    });

    socketRef.current.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [username, onUserCountChange]);

  // Save messages to sessionStorage whenever they change
  useEffect(() => {
    sessionStorage.setItem('chatMessages', JSON.stringify(chatMessages));
  }, [chatMessages]);

  // Monitor network status
  useEffect(() => {
    const checkNetworkStatus = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nav = navigator as any;
      if ('connection' in nav && nav.connection) {
        const connection = nav.connection;
        if (connection.effectiveType === '4g') {
          setNetworkStatus('good');
        } else if (connection.effectiveType === '3g') {
          setNetworkStatus('slow');
        } else {
          setNetworkStatus('poor');
        }
      }
    };

    checkNetworkStatus();
    window.addEventListener('online', checkNetworkStatus);
    window.addEventListener('offline', () => setNetworkStatus('poor'));

    return () => {
      window.removeEventListener('online', checkNetworkStatus);
      window.removeEventListener('offline', () => setNetworkStatus('poor'));
    };
  }, []);

  // Add network status message
  useEffect(() => {
    if (networkStatus !== 'good') {
      const networkMessage: Message = {
        id: Date.now().toString(),
        sender: 'system',
        username: '',
        text: networkStatus === 'slow'
          ? 'Mạng chậm, có thể ảnh hưởng đến việc gửi tin nhắn và hình ảnh'
          : 'Kết nối mạng yếu, vui lòng kiểm tra lại kết nối',
        timestamp: new Date(),
        type: 'system',
        networkStatus: networkStatus
      };
      setChatMessages(prev => [...prev, networkMessage]);
    }
  }, [networkStatus]);

  const handleSendMessage = () => {
    if (newMessage.trim() && socketRef.current) {
      socketRef.current.emit('chat_message', newMessage);
      setNewMessage('');
    }
  };

  const handleEmojiClick = (emoji: string) => {
    setNewMessage((prev) => prev + emoji);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && socketRef.current) {
      if (file.size > 10 * 1024 * 1024) {
        alert('File quá lớn. Vui lòng chọn file nhỏ hơn 10MB.');
        return;
      }

      const tempMessageId = Date.now().toString(); // Generate unique ID for this message early

      // Add a placeholder message immediately
      setChatMessages(prev => [...prev, {
        id: tempMessageId,
        sender: 'me',
        username: username,
        text: 'Loading image...',
        timestamp: new Date(),
        type: 'image',
        imageStatus: 'loading',
        avatar: '👤',
        progress: 0 // Initialize progress
      }]);

      try {
        const options = {
          maxSizeMB: 1,
          useWebWorker: true,
          onProgress: (progress: number) => {
            // Update the specific message's progress
            setChatMessages(prev => prev.map(msg =>
              msg.id === tempMessageId
                ? { ...msg, progress: progress }
                : msg
            ));
          }
        };

        const compressedFile = await imageCompression(file, options);
        const reader = new FileReader();

        reader.onload = (e) => {
          const imageData = e.target?.result as string;

          // Update the message to include imageUrl now that it's available
          setChatMessages(prev => prev.map(msg =>
            msg.id === tempMessageId
              ? { ...msg, imageUrl: imageData }
              : msg
          ));

          socketRef.current?.emit('image_message', imageData, (response: { success: boolean }) => {
            if (!response.success) { // Only handle explicit failure from server
              setChatMessages(prev => prev.map(msg =>
                msg.id === tempMessageId
                  ? { ...msg, imageStatus: 'error', text: 'Không thể tải ảnh lên (server rejected)', progress: 0 }
                  : msg
              ));
              console.error('Server rejected image upload for ID:', tempMessageId);
            }
            // DO NOT set to success here. Let the broadcast handle it.
          });
        };

        reader.onerror = () => {
          setChatMessages(prev => prev.map(msg =>
            msg.id === tempMessageId
              ? { ...msg, imageStatus: 'error', text: 'Lỗi khi đọc file ảnh', progress: 0 }
              : msg
          ));
        };

        reader.readAsDataURL(compressedFile);
      } catch (error) {
        console.error('Lỗi khi nén hình ảnh:', error);
        setChatMessages(prev => prev.map(msg =>
          msg.id === tempMessageId
            ? { ...msg, imageStatus: 'error', text: 'Không thể nén hình ảnh', progress: 0 }
            : msg
        ));
      }
    }
  };

  const handleUsernameChange = () => {
    if (tempUsername.trim()) {
      socketRef.current?.emit('user_join', tempUsername.trim());
      setIsEditingUsername(false);
    }
  };

  const formatTime = (date: Date) => {
    // Ensure date is a Date object, though it should be after parsing from sessionStorage
    if (!(date instanceof Date)) {
      date = new Date(date);
    }
    return date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return {
    chatMessages,
    newMessage,
    setNewMessage,
    showEmojiPicker,
    setShowEmojiPicker,
    onlineUsers,
    isEditingUsername,
    setIsEditingUsername,
    tempUsername,
    setTempUsername,
    selectedEmojiCategory,
    setSelectedEmojiCategory,
    networkStatus,
    handleSendMessage,
    handleEmojiClick,
    handleImageUpload,
    handleUsernameChange,
    formatTime,
    socketRef,
  };
};
