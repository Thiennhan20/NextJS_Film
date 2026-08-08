'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'

interface LogoProps {
  isScrolled?: boolean;
  variant?: 'header' | 'footer' | 'compact';
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ 
  isScrolled = false, 
  variant = 'header',
  className = ''
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // Compact variant for collapsed header
  if (variant === 'compact') {
    return (
      <Link href="/" className={`relative group flex items-center gap-2 cursor-pointer ${className}`}>
        <motion.div
          className="relative flex items-center gap-2"
          onHoverStart={() => setIsHovered(true)}
          onHoverEnd={() => setIsHovered(false)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          {/* Glow Effect Background */}
          <motion.div
            className="absolute inset-0 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
            style={{
              background: isScrolled 
                ? 'linear-gradient(135deg, #f59e0b, #ef4444, #ec4899)'
                : 'linear-gradient(135deg, #3b82f6, #8b5cf6, #06b6d4)'
            }}
            animate={{
              scale: isHovered ? 1.2 : 1,
            }}
            transition={{ duration: 0.3 }}
          />

          {/* Main Logo Container */}
          <motion.div
            className={`relative flex items-center justify-center px-2 py-1 rounded-xl backdrop-blur-sm border transition-all duration-500 ${
              isScrolled 
                ? 'bg-white/90 hover:bg-white border-gray-200 shadow-lg' 
                : 'bg-black/50 hover:bg-black/70 border-white/20 shadow-xl'
            }`}
            animate={{
              boxShadow: isHovered 
                ? isScrolled 
                  ? '0 20px 40px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(249, 115, 22, 0.3)'
                  : '0 20px 40px -12px rgba(59, 130, 246, 0.4), 0 0 0 1px rgba(59, 130, 246, 0.3)'
                : isScrolled
                  ? '0 8px 20px -3px rgba(0, 0, 0, 0.1)'
                  : '0 15px 30px -4px rgba(0, 0, 0, 0.5)'
            }}
          >
            {/* Logo Icon */}
            <motion.div 
              className="relative w-4 h-4"
              animate={{
                rotate: isHovered ? 360 : 0,
              }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
            >
              {/* Animated Ring Background */}
              <motion.div
                className="absolute inset-0 rounded-full border-2 opacity-30"
                style={{
                  borderColor: isScrolled ? '#f59e0b' : '#3b82f6'
                }}
                animate={{
                  rotate: isHovered ? -360 : 0,
                  scale: isHovered ? 1.3 : 1,
                }}
                transition={{ duration: 1.2, ease: "easeInOut" }}
              />
              
              {/* Main Icon */}
              <motion.div
                className={`w-full h-full rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  isScrolled 
                    ? 'bg-gradient-to-br from-orange-400 to-red-500 text-white' 
                    : 'bg-gradient-to-br from-blue-400 to-purple-500 text-white'
                }`}
                whileHover={{ 
                  scale: 1.1,
                  rotate: 5,
                }}
                animate={{
                  background: isHovered 
                    ? isScrolled
                      ? 'linear-gradient(135deg, #f97316, #dc2626, #be185d)'
                      : 'linear-gradient(135deg, #2563eb, #7c3aed, #0891b2)'
                    : isScrolled
                      ? 'linear-gradient(135deg, #fb923c, #ef4444)'
                      : 'linear-gradient(135deg, #60a5fa, #a78bfa)'
                }}
              >
                NTN
              </motion.div>

              {/* Floating Particles */}
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  className={`absolute w-1 h-1 rounded-full ${
                    isScrolled ? 'bg-orange-400' : 'bg-blue-400'
                  }`}
                  style={{
                    top: `${20 + i * 25}%`,
                    left: `${75 + i * 15}%`,
                  }}
                  animate={{
                    y: isHovered ? [-8, -15, -8] : [0, -3, 0],
                    opacity: isHovered ? [0.3, 1, 0.3] : [0.6, 0.3, 0.6],
                    scale: isHovered ? [1, 1.5, 1] : [0.8, 1, 0.8],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.3,
                  }}
                />
              ))}
            </motion.div>

            {/* Shine Effect */}
            <motion.div
              className="absolute inset-0 rounded-xl opacity-0 pointer-events-none"
              style={{
                background: 'linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.3) 50%, transparent 70%)',
              }}
              animate={{
                opacity: isHovered ? [0, 1, 0] : 0,
                x: isHovered ? [-80, 80] : 0,
              }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
            />
          </motion.div>

          {/* Floating Elements */}
          {[...Array(4)].map((_, i) => (
            <motion.div
              key={i}
              className={`absolute w-1.5 h-1.5 rounded-full opacity-20 ${
                isScrolled ? 'bg-orange-400' : 'bg-blue-400'
              }`}
              style={{
                top: `${20 + (i % 2) * 60}%`,
                left: `${-15 + (i % 2) * 130}%`,
              }}
              animate={{
                y: isHovered ? [0, -20, 0] : [0, -8, 0],
                x: isHovered ? [0, Math.sin(i) * 15, 0] : [0, Math.sin(i) * 3, 0],
                opacity: isHovered ? [0.2, 0.6, 0.2] : [0.1, 0.3, 0.1],
                scale: isHovered ? [1, 1.5, 1] : [0.8, 1.2, 0.8],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                delay: i * 0.4,
                ease: "easeInOut",
              }}
            />
          ))}
        </motion.div>
      </Link>
    );
  }

  // Footer variant có style đơn giản hơn
  if (variant === 'footer') {
    return (
      <Link href="/" className={`relative group flex items-center gap-2 cursor-pointer ${className}`}>
        <motion.div
          className="relative flex items-center gap-3"
          onHoverStart={() => setIsHovered(true)}
          onHoverEnd={() => setIsHovered(false)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          {/* Glow Effect Background */}
          <motion.div
            className="absolute inset-0 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #ef4444, #ec4899)'
            }}
            animate={{
              scale: isHovered ? 1.2 : 1,
            }}
            transition={{ duration: 0.3 }}
          />

          {/* Main Logo Container */}
          <motion.div
            className="relative flex items-center justify-center px-3 py-2 rounded-xl backdrop-blur-sm border transition-all duration-500 bg-black/50 hover:bg-black/70 border-white/20 shadow-xl"
            animate={{
              boxShadow: isHovered 
                ? '0 20px 40px -12px rgba(59, 130, 246, 0.4), 0 0 0 1px rgba(59, 130, 246, 0.3)'
                : '0 15px 30px -4px rgba(0, 0, 0, 0.5)'
            }}
          >
            {/* Logo Icon */}
            <motion.div 
              className="relative w-5 h-5 sm:w-6 sm:h-6"
              animate={{
                rotate: isHovered ? 360 : 0,
              }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
            >
              {/* Animated Ring Background */}
              <motion.div
                className="absolute inset-0 rounded-full border-2 opacity-30"
                style={{
                  borderColor: '#3b82f6'
                }}
                animate={{
                  rotate: isHovered ? -360 : 0,
                  scale: isHovered ? 1.3 : 1,
                }}
                transition={{ duration: 1.2, ease: "easeInOut" }}
              />
              
              {/* Main Icon */}
              <motion.div
                className="w-full h-full rounded-full flex items-center justify-center text-sm sm:text-base font-bold transition-all duration-300 bg-gradient-to-br from-blue-400 to-purple-500 text-white"
                whileHover={{ 
                  scale: 1.1,
                  rotate: 5,
                }}
                animate={{
                  background: isHovered 
                    ? 'linear-gradient(135deg, #2563eb, #7c3aed, #0891b2)'
                    : 'linear-gradient(135deg, #60a5fa, #a78bfa)'
                }}
              >
                NTN
              </motion.div>

              {/* Floating Particles */}
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-1 h-1 rounded-full bg-blue-400"
                  style={{
                    top: `${20 + i * 25}%`,
                    left: `${75 + i * 15}%`,
                  }}
                  animate={{
                    y: isHovered ? [-8, -15, -8] : [0, -3, 0],
                    opacity: isHovered ? [0.3, 1, 0.3] : [0.6, 0.3, 0.6],
                    scale: isHovered ? [1, 1.5, 1] : [0.8, 1, 0.8],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.3,
                  }}
                />
              ))}
            </motion.div>

            {/* Shine Effect */}
            <motion.div
              className="absolute inset-0 rounded-xl opacity-0 pointer-events-none"
              style={{
                background: 'linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.3) 50%, transparent 70%)',
              }}
              animate={{
                opacity: isHovered ? [0, 1, 0] : 0,
                x: isHovered ? [-80, 80] : 0,
              }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
            />
          </motion.div>

          {/* Floating Elements */}
          {[...Array(4)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full opacity-20 bg-blue-400"
              style={{
                top: `${20 + (i % 2) * 60}%`,
                left: `${-15 + (i % 2) * 130}%`,
              }}
              animate={{
                y: isHovered ? [0, -20, 0] : [0, -8, 0],
                x: isHovered ? [0, Math.sin(i) * 15, 0] : [0, Math.sin(i) * 3, 0],
                opacity: isHovered ? [0.2, 0.6, 0.2] : [0.1, 0.3, 0.1],
                scale: isHovered ? [1, 1.5, 1] : [0.8, 1.2, 0.8],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                delay: i * 0.4,
                ease: "easeInOut",
              }}
            />
          ))}
        </motion.div>
      </Link>
    );
  }

  // Header variant với logic phức tạp hơn
  return (
    <Link href="/" className={`relative group flex items-center gap-2 cursor-pointer ${className}`}>
      <motion.div
        className="relative flex items-center gap-3"
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        {/* Glow Effect Background */}
        <motion.div
          className="absolute inset-0 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{
            background: isScrolled 
              ? 'linear-gradient(135deg, #f59e0b, #ef4444, #ec4899)'
              : 'linear-gradient(135deg, #3b82f6, #8b5cf6, #06b6d4)'
          }}
          animate={{
            scale: isHovered ? 1.2 : 1,
          }}
          transition={{ duration: 0.3 }}
        />

        {/* Main Logo Container */}
        <motion.div
          className="relative flex h-10 items-center justify-center px-3.5 rounded-full transition-colors duration-300 bg-white/10 hover:bg-white/20 border border-white/15 shadow-sm"
          animate={{
            boxShadow: isHovered 
              ? '0 10px 25px -5px rgba(239, 68, 68, 0.4)'
              : 'none'
          }}
        >
          {/* Logo Icon */}
          <motion.div 
            className="relative w-5 h-5 sm:w-6 sm:h-6"
            animate={{
              rotate: isHovered ? 360 : 0,
            }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
          >
            {/* Animated Ring Background */}
            <motion.div
              className="absolute inset-0 rounded-full border-2 opacity-30 borderColor-red-500"
              style={{
                borderColor: '#ef4444'
              }}
              animate={{
                rotate: isHovered ? -360 : 0,
                scale: isHovered ? 1.3 : 1,
              }}
              transition={{ duration: 1.2, ease: "easeInOut" }}
            />
            
            {/* Main Icon */}
            <motion.div
              className="w-full h-full rounded-full flex items-center justify-center text-sm sm:text-base font-bold transition-all duration-300 bg-gradient-to-br from-red-500 to-amber-500 text-white"
              whileHover={{ 
                scale: 1.1,
                rotate: 5,
              }}
              animate={{
                background: isHovered 
                  ? 'linear-gradient(135deg, #f97316, #dc2626, #be185d)'
                  : 'linear-gradient(135deg, #fb923c, #ef4444)'
              }}
            >
              NTN
            </motion.div>

            {/* Floating Particles */}
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                className={`absolute w-1 h-1 rounded-full ${
                  isScrolled ? 'bg-orange-400' : 'bg-blue-400'
                }`}
                style={{
                  top: `${20 + i * 25}%`,
                  left: `${75 + i * 15}%`,
                }}
                animate={{
                  y: isHovered ? [-8, -15, -8] : [0, -3, 0],
                  opacity: isHovered ? [0.3, 1, 0.3] : [0.6, 0.3, 0.6],
                  scale: isHovered ? [1, 1.5, 1] : [0.8, 1, 0.8],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.3,
                }}
              />
            ))}
          </motion.div>

          {/* Shine Effect */}
          <motion.div
            className="absolute inset-0 rounded-xl opacity-0 pointer-events-none"
            style={{
              background: 'linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.3) 50%, transparent 70%)',
            }}
            animate={{
              opacity: isHovered ? [0, 1, 0] : 0,
              x: isHovered ? [-80, 80] : 0,
            }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
          />
        </motion.div>

        {/* Floating Elements */}
        {[...Array(4)].map((_, i) => (
          <motion.div
            key={i}
            className={`absolute w-1.5 h-1.5 rounded-full opacity-20 ${
              isScrolled ? 'bg-orange-400' : 'bg-blue-400'
            }`}
            style={{
              top: `${20 + (i % 2) * 60}%`,
              left: `${-15 + (i % 2) * 130}%`,
            }}
            animate={{
              y: isHovered ? [0, -20, 0] : [0, -8, 0],
              x: isHovered ? [0, Math.sin(i) * 15, 0] : [0, Math.sin(i) * 3, 0],
              opacity: isHovered ? [0.2, 0.6, 0.2] : [0.1, 0.3, 0.1],
              scale: isHovered ? [1, 1.5, 1] : [0.8, 1.2, 0.8],
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              delay: i * 0.4,
              ease: "easeInOut",
            }}
          />
        ))}
      </motion.div>
    </Link>
  );
};

export default Logo; 