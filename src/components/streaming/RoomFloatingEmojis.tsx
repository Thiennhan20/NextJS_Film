'use client';

import React, { useState, useRef, useImperativeHandle, forwardRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface RoomFloatingEmojisRef {
  trigger: (emoji: string) => void;
}

export interface RoomFloatingEmojisProps {
  className?: string;
}

const RoomFloatingEmojisComponent = forwardRef<RoomFloatingEmojisRef, RoomFloatingEmojisProps>((props, ref) => {
  const [floatingEmojis, setFloatingEmojis] = useState<{ id: number; emoji: string; x: number }[]>([]);
  const emojiIdRef = useRef(0);

  useImperativeHandle(ref, () => ({
    trigger(emoji: string) {
      const id = ++emojiIdRef.current;
      setFloatingEmojis(prev => {
        // Giới hạn tối đa 8 emoji cùng bay, loại bỏ emoji cũ nhất nếu vượt quá
        const trimmed = prev.length >= 8 ? prev.slice(prev.length - 7) : prev;
        return [...trimmed, { id, emoji, x: Math.random() * 80 + 10 }];
      });
      setTimeout(() => {
        setFloatingEmojis(prev => prev.filter(e => e.id !== id));
      }, 5500);
    }
  }), []);

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden z-50 select-none"
      style={{ willChange: 'transform', contain: 'layout style paint' }}
    >
      <AnimatePresence>
        {floatingEmojis.map(({ id, emoji, x }) => (
          <motion.div
            key={id}
            initial={{ opacity: 0, y: 0, scale: 0, rotate: 0 }}
            animate={{
              opacity: [0, 1, 1, 0.8, 0],
              scale: [0, 1.4, 1.1, 1.2, 1, 0],
              y: [0, -50, -100, -150, -200, -250, -300],
              x: [0, Math.sin(id) * 30, Math.sin(id + 1) * -35, Math.sin(id + 2) * 25, Math.sin(id + 3) * -20, 0],
              rotate: [0, -10, 10, -5, 5, 0],
            }}
            exit={{ opacity: 0, scale: 0.3 }}
            transition={{
              duration: 5,
              ease: [0.25, 0.1, 0.25, 1],
              opacity: { duration: 5, times: [0, 0.05, 0.8, 0.9, 1] },
              scale: { duration: 5, times: [0, 0.05, 0.15, 0.8, 0.9, 1] },
              y: { duration: 5, ease: 'easeOut' },
              x: { duration: 5, ease: 'easeInOut' },
              rotate: { duration: 5, ease: 'easeInOut' },
            }}
            className="absolute bottom-6 text-4xl pointer-events-none select-none filter drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
            style={{ left: `${x}%`, willChange: 'transform, opacity' }}
          >
            {emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
});

RoomFloatingEmojisComponent.displayName = 'RoomFloatingEmojis';

export const RoomFloatingEmojis = memo(RoomFloatingEmojisComponent);
