'use client'

import { useEffect, useState } from 'react'
import { useLocale } from 'next-intl'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  XMarkIcon, 
  ArrowDownTrayIcon, 
  ArrowPathIcon,
  SparklesIcon
} from '@heroicons/react/24/outline'
import { useUIStore } from '@/store/store'
import { FaApple, FaAndroid } from 'react-icons/fa'

export default function AppDownloadModal() {
  const { isAppModalOpen, setAppModalOpen, appModalActiveTab, setAppModalActiveTab } = useUIStore()
  const locale = useLocale()
  const isEn = locale === 'en'

  const [showComingSoon, setShowComingSoon] = useState(false)
  const [comingSoonMessage, setComingSoonMessage] = useState('')

  const handleComingSoon = (msg: string) => {
    setComingSoonMessage(msg)
    setShowComingSoon(true)
  }

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isAppModalOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isAppModalOpen])



  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl p-0 overflow-hidden select-none"
    >
      {/* Animated Glowing Ambient Orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-red-500/10 rounded-full mix-blend-screen filter blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-500/10 rounded-full mix-blend-screen filter blur-[150px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 15 }}
        transition={{ duration: 0.4 }}
        className="relative w-full h-full min-h-screen bg-gray-950/90 p-6 md:p-12 flex flex-col z-10 overflow-hidden"
      >
        {/* Main centered container */}
        <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col bg-gray-950/60 border border-gray-700/50 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-[0_0_50px_rgba(255,255,255,0.03),0_0_60px_rgba(239,68,68,0.04)] relative min-h-0 my-6 md:my-10">
          
          {/* Close Button - floats prominently on the corner of the card */}
          <motion.button
            onClick={() => setAppModalOpen(false)}
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.95 }}
            className="absolute -top-3 -right-3 md:-top-4 md:-right-4 p-3 rounded-full bg-gradient-to-tr from-red-600 to-rose-500 text-white border border-red-500/40 hover:from-red-500 hover:to-rose-400 shadow-[0_0_20px_rgba(239,68,68,0.45)] hover:shadow-[0_0_30px_rgba(239,68,68,0.7)] transition-all duration-300 cursor-pointer z-30 flex items-center justify-center"
            aria-label="Close modal"
          >
            <XMarkIcon className="h-6.5 w-6.5 stroke-[2.2]" />
          </motion.button>

           {/* Modal Header */}
          <div className="text-center mb-6 relative">
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-semibold uppercase tracking-widest mb-2.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
              <span>{isEn ? 'Mobile Application' : 'Ứng Dụng Di Động'}</span>
            </motion.div>
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-wide uppercase">
              {isEn ? 'Instructions' : 'Hướng Dẫn'}
            </h2>
          </div>

          {/* Tabs Bar */}
          <div className="flex justify-center mb-8 w-full shrink-0">
            <div className="flex space-x-1.5 p-1.5 bg-gray-900/60 border border-gray-800 rounded-2xl max-w-lg w-full">
              <button
                onClick={() => setAppModalActiveTab('ios')}
                className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-all duration-300 cursor-pointer ${
                  appModalActiveTab === 'ios'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <FaApple className="h-4 w-4" />
                <span>Apple iOS</span>
              </button>
              <button
                onClick={() => setAppModalActiveTab('android')}
                className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-all duration-300 cursor-pointer ${
                  appModalActiveTab === 'android'
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <FaAndroid className="h-4 w-4" />
                <span>Android</span>
              </button>
              <button
                onClick={() => setAppModalActiveTab('update')}
                className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-all duration-300 cursor-pointer ${
                  appModalActiveTab === 'update'
                    ? 'bg-red-600 text-white shadow-lg shadow-red-600/25'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <ArrowPathIcon className="h-4 w-4" />
                <span>{isEn ? 'Update' : 'Cập Nhật'}</span>
              </button>
            </div>
          </div>

          {/* Dynamic Content Frame */}
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto pr-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <AnimatePresence mode="wait">
              {appModalActiveTab === 'ios' && (
                <motion.div
                  key="ios-pane"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.25 }}
                  className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch flex-1 py-2 min-h-0"
                >
                  {/* Visual Left Block */}
                  <div className="md:col-span-5 flex flex-col items-center justify-center p-6 bg-gradient-to-br from-blue-600/10 to-transparent border border-blue-500/10 rounded-2xl">
                    <div className="w-16 h-16 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
                      <FaApple className="h-10 w-10 animate-bounce-slow" />
                    </div>
                    <h4 className="text-base font-bold text-white mb-2">{isEn ? 'Download iOS App' : 'Tải ứng dụng iOS'}</h4>
                    <p className="text-xs text-gray-500 text-center font-light leading-relaxed">
                      {isEn 
                        ? 'Supports all iOS devices. The download and installation process is completely free.' 
                        : 'Hỗ trợ tất cả các thiết bị IOS . Quá trình tải xuống và cài đặt hoàn toàn miễn phí.'}
                    </p>
                  </div>

                  {/* Guide Right Block */}
                  <div className="md:col-span-7 flex flex-col justify-between h-full space-y-6">
                    <div className="space-y-4">
                      <h5 className="text-sm font-bold text-gray-200 uppercase tracking-wide">
                        {isEn ? 'Steps to perform:' : 'Các bước thực hiện:'}
                      </h5>
                      <div className="space-y-3 text-sm text-gray-400 font-light">
                        <div className="flex items-start space-x-3.5">
                          <span className="flex items-center justify-center w-5.5 h-5.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-bold shrink-0">1</span>
                          <p>Tải ứng dụng hỗ trợ thử nghiệm chính thức <span className="text-white font-medium">TestFlight</span> từ App Store.</p>
                        </div>
                        <div className="flex items-start space-x-3.5">
                          <span className="flex items-center justify-center w-5.5 h-5.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-bold shrink-0">2</span>
                          <p>Nhập vào liên kết tải tệp iOS bên dưới để nhận lời mời cài đặt vào TestFlight.</p>
                        </div>
                        <div className="flex items-start space-x-3.5">
                          <span className="flex items-center justify-center w-5.5 h-5.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-bold shrink-0">3</span>
                          <p>Nhấn <span className="text-white font-medium">Cài đặt</span> ngay bên trong TestFlight để tải ứng dụng về máy và sử dụng.</p>
                        </div>
                      </div>
                    </div>

                    <motion.button
                      onClick={() => handleComingSoon(
                        isEn 
                          ? "The iOS download feature is being optimized and will be available in the near future!" 
                          : "Tính năng tải ứng dụng iOS đang được tối ưu hóa và sẽ sớm ra mắt trong thời gian tới!"
                      )}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full flex items-center justify-center space-x-2 py-3.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-xl font-semibold text-sm shadow-lg shadow-blue-500/20 cursor-pointer"
                    >
                      <ArrowDownTrayIcon className="h-4.5 w-4.5" />
                      <span>{isEn ? 'Start installation for iOS' : 'Bắt đầu cài đặt cho IOS'}</span>
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {appModalActiveTab === 'android' && (
                <motion.div
                  key="android-pane"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.25 }}
                  className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch flex-1 py-2 min-h-0"
                >
                  {/* Visual Left Block */}
                  <div className="md:col-span-5 flex flex-col items-center justify-center p-6 bg-gradient-to-br from-emerald-600/10 to-transparent border border-[#3DDC84]/10 rounded-2xl">
                    <div className="w-16 h-16 rounded-2xl bg-[#3DDC84]/20 flex items-center justify-center text-[#3DDC84] mb-4">
                      <FaAndroid className="h-10 w-10 animate-bounce-slow" />
                    </div>
                    <h4 className="text-base font-bold text-white mb-2">{isEn ? 'Download Android App' : 'Tải ứng dụng Android'}</h4>
                    <p className="text-xs text-gray-500 text-center font-light leading-relaxed">
                      {isEn 
                        ? 'Supports all Android devices. The download and installation process is completely free.' 
                        : 'Hỗ trợ tất cả các thiết bị Android . Quá trình tải xuống và cài đặt hoàn toàn miễn phí.'}
                    </p>
                  </div>

                  {/* Guide Right Block */}
                  <div className="md:col-span-7 flex flex-col justify-between h-full space-y-6">
                    <div className="space-y-4">
                      <h5 className="text-sm font-bold text-gray-200 uppercase tracking-wide">
                        {isEn ? 'Steps to perform:' : 'Các bước thực hiện:'}
                      </h5>
                      <div className="space-y-3 text-sm text-gray-400 font-light">
                        <div className="flex items-start space-x-3.5">
                          <span className="flex items-center justify-center w-5.5 h-5.5 rounded-full bg-[#3DDC84]/10 border border-[#3DDC84]/30 text-[#3DDC84] text-xs font-bold shrink-0">1</span>
                          <p>Nhấp vào nút bên dưới để tiến hành tải tệp cài đặt dạng <span className="text-white font-medium">APK</span> trực tiếp.</p>
                        </div>
                        <div className="flex items-start space-x-3.5">
                          <span className="flex items-center justify-center w-5.5 h-5.5 rounded-full bg-[#3DDC84]/10 border border-[#3DDC84]/30 text-[#3DDC84] text-xs font-bold shrink-0">2</span>
                          <p>Cho phép cài đặt từ <span className="text-white font-medium">Nguồn không xác định</span> trong mục cài đặt bảo mật của điện thoại.</p>
                        </div>
                        <div className="flex items-start space-x-3.5">
                          <span className="flex items-center justify-center w-5.5 h-5.5 rounded-full bg-[#3DDC84]/10 border border-[#3DDC84]/30 text-[#3DDC84] text-xs font-bold shrink-0">3</span>
                          <p>Mở tệp APK đã tải xuống từ thư mục Download, bấm cài đặt và mở ứng dụng lên.</p>
                        </div>
                      </div>
                    </div>

                    <motion.button
                      onClick={() => handleComingSoon(
                        isEn 
                          ? "The Android direct download (APK) feature is being finalized and will be available soon!" 
                          : "Tính năng tải ứng dụng Android (APK) đang được hoàn thiện và sẽ sớm khả dụng!"
                      )}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full flex items-center justify-center space-x-2 py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-xl font-semibold text-sm shadow-lg shadow-emerald-500/20 cursor-pointer"
                    >
                      <ArrowDownTrayIcon className="h-4.5 w-4.5" />
                      <span>{isEn ? 'Download Android file (.apk)' : 'Tải file ANDROID (.apk)'}</span>
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {appModalActiveTab === 'update' && (
                <motion.div
                  key="update-pane"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.25 }}
                  className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch flex-1 py-2 min-h-0"
                >
                  {/* Visual Left Block */}
                  <div className="md:col-span-5 flex flex-col items-center justify-center p-6 bg-gradient-to-br from-red-600/10 to-transparent border border-red-500/10 rounded-2xl">
                    <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center text-red-400 mb-4">
                      <ArrowPathIcon className="h-10 w-10 animate-spin-slow" />
                    </div>
                    <h4 className="text-base font-bold text-white mb-2">{isEn ? 'Update Application' : 'Cập nhật ứng dụng'}</h4>
                    <p className="text-xs text-gray-500 text-center font-light leading-relaxed">
                      {isEn 
                        ? 'Ensure you always experience the latest features and optimal security from MovieWorld.' 
                        : 'Đảm bảo bạn luôn được trải nghiệm các tính năng mới nhất cùng hệ thống bảo mật tối ưu từ MovieWorld.'}
                    </p>
                  </div>

                  {/* Guide Right Block */}
                  <div className="md:col-span-7 flex flex-col justify-between h-full space-y-6">
                    <div className="space-y-4">
                      <h5 className="text-sm font-bold text-gray-200 uppercase tracking-wide">
                        {isEn ? 'Steps to perform:' : 'Các bước thực hiện:'}
                      </h5>
                      <div className="space-y-3 text-sm text-gray-400 font-light">
                        <div className="flex items-start space-x-3.5">
                          <span className="flex items-center justify-center w-5.5 h-5.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold shrink-0">1</span>
                          <p>Mở ứng dụng trên điện thoại, hệ thống sẽ tự động quét và thông báo nếu có phiên bản mới.</p>
                        </div>
                        <div className="flex items-start space-x-3.5">
                          <span className="flex items-center justify-center w-5.5 h-5.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold shrink-0">2</span>
                          <p>Trong trường hợp không thấy thông báo, vào phần <span className="text-white font-medium">Hồ sơ &gt; Cài đặt</span> để chủ động chọn cập nhật.</p>
                        </div>
                        <div className="flex items-start space-x-3.5">
                          <span className="flex items-center justify-center w-5.5 h-5.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold shrink-0">3</span>
                          <p>Bấm xác nhận để tải và giải nén các tài nguyên bản vá mới nhất. Khuyến nghị tải bằng kết nối Wi-Fi.</p>
                        </div>
                      </div>
                    </div>

                    <motion.button
                      onClick={() => handleComingSoon(
                        isEn 
                          ? "The automatic update check system is being configured and will be active soon!" 
                          : "Hệ thống kiểm tra cập nhật tự động đang được thiết lập và sẽ sớm hoạt động!"
                      )}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full flex items-center justify-center space-x-2 py-3.5 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white rounded-xl font-semibold text-sm shadow-lg shadow-red-500/20 cursor-pointer"
                    >
                      <ArrowPathIcon className="h-4.5 w-4.5" />
                      <span>{isEn ? 'Check & Update Now' : 'Kiểm tra & Cập nhật ngay'}</span>
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Custom Coming Soon Popup overlay */}
      <AnimatePresence>
        {showComingSoon && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", duration: 0.3 }}
              className="w-full max-w-sm bg-gray-900/90 border border-gray-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden backdrop-blur-2xl flex flex-col items-center text-center select-none"
            >
              {/* Glow ambient background */}
              <div className="absolute -top-12 -right-12 w-24 h-24 bg-amber-500/10 rounded-full filter blur-xl" />
              <div className="absolute -bottom-12 -left-12 w-24 h-24 bg-orange-500/10 rounded-full filter blur-xl" />

              {/* Glowing Icon */}
              <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-500/20 to-orange-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 shadow-lg shadow-amber-500/5">
                <SparklesIcon className="w-7 h-7 animate-pulse" />
              </div>

              {/* Message content */}
              <h3 className="text-lg font-bold text-white mb-2 tracking-wide">
                {isEn ? 'Feature Coming Soon!' : 'Tính năng sắp ra mắt!'}
              </h3>
              <p className="text-xs text-gray-400 font-light leading-relaxed mb-6 px-2">
                {comingSoonMessage}
              </p>

              {/* Close popup button */}
              <button
                onClick={() => setShowComingSoon(false)}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white rounded-xl font-semibold text-xs tracking-wider uppercase transition-colors duration-150 shadow-lg shadow-orange-500/20 cursor-pointer active:scale-[0.98]"
              >
                {isEn ? 'Got it' : 'Đồng ý'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
