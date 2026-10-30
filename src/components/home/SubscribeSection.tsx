'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'

export default function SubscribeSection() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const t = useTranslations('HomePage')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setTimeout(() => setSubmitted(false), 2000)
  }

  return (
    <section className="py-16 px-2 sm:px-4 bg-gradient-to-b from-black to-gray-900">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-2xl sm:text-4xl font-bold mb-4 text-white tracking-tight">{t('subscribeTitle')}
        </h2>
        <p className="text-gray-400 mb-8">{t('subscribeDesc')}</p>
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 items-center justify-center">
          <input
            type="email"
            required
            placeholder={t('subscribePlaceholder')}
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="px-4 py-3 rounded-full bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-green-400 w-full sm:w-auto min-w-[200px]"
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="submit"
            className="bg-green-500 hover:bg-green-600 text-white px-8 py-3 rounded-full font-semibold shadow-lg transition-all"
          >
            {t('subscribeButton')}
          </motion.button>
        </form>
        {submitted && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 text-green-400 font-semibold"
          >
            {t('subscribeSuccess')}
          </motion.div>
        )}
      </div>
    </section>
  )
}


