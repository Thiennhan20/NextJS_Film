'use client'

type FrameLoadingPlaceholderProps = {
  variant?: 'poster-row' | 'top-five' | 'landscape-row' | 'hero'
  minHeight?: string
  cardCount?: number
}

const DEFAULT_MIN_HEIGHT = {
  'poster-row': 'clamp(330px, 37vw, 430px)',
  'top-five': 'clamp(430px, 48vw, 560px)',
  'landscape-row': 'clamp(250px, 30vw, 360px)',
  hero: 'clamp(560px, 62vw, 680px)',
}

export default function FrameLoadingPlaceholder({
  variant = 'poster-row',
  minHeight = DEFAULT_MIN_HEIGHT[variant],
  cardCount = variant === 'top-five' ? 5 : 8,
}: FrameLoadingPlaceholderProps) {
  if (variant === 'hero') {
    return (
      <section aria-hidden="true" className="mb-10 px-2 sm:mb-12 sm:px-3" style={{ minHeight }}>
        <div className="mx-auto max-w-7xl">
          <div className="mb-4 flex items-center gap-3 px-1 sm:mb-6">
            <div className="h-6 w-1.5 rounded-full bg-gray-800 sm:h-8" />
            <div className="h-7 w-48 rounded bg-gray-800 sm:w-64" />
          </div>
          <div className="h-[500px] rounded-2xl bg-gray-900 sm:rounded-3xl md:h-[550px]" />
        </div>
      </section>
    )
  }

  if (variant === 'landscape-row') {
    return (
      <section aria-hidden="true" className="bg-gradient-to-b from-gray-900 to-black px-2 py-6 sm:px-3 sm:py-8 md:py-10" style={{ minHeight }}>
        <div className="mx-auto max-w-7xl">
          <div className="mb-4 flex items-center gap-3 px-3 sm:mb-6">
            <div className="h-6 w-1.5 rounded-full bg-gray-800 sm:h-8" />
            <div className="h-7 w-56 rounded bg-gray-800 sm:w-72" />
          </div>
          <div className="flex gap-3 overflow-hidden px-3 pb-4 pt-2 sm:gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="shrink-0" style={{ width: 'clamp(280px, 30vw, 400px)' }}>
                <div className="aspect-video rounded-xl bg-gray-800" />
                <div className="mt-2.5 h-4 w-4/5 rounded bg-gray-800" />
                <div className="mt-2 h-3 w-1/2 rounded bg-gray-900" />
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (variant === 'top-five') {
    return (
      <section aria-hidden="true" className="mb-10 sm:mb-12" style={{ minHeight }}>
        <div className="mb-4 flex items-center gap-3 px-3">
          <div className="h-6 w-1.5 rounded-full bg-gray-800 sm:h-8" />
          <div className="h-7 w-56 rounded bg-gray-800 sm:w-72" />
        </div>
        <div className="flex gap-4 overflow-hidden px-3 pb-6 pt-6 md:grid md:grid-cols-5">
          {Array.from({ length: cardCount }).map((_, index) => (
            <div key={index} className="flex w-[250px] min-w-[250px] shrink-0 flex-col md:w-auto md:min-w-0">
              <div className="mb-4 aspect-[2/3] rounded-xl bg-gray-900" />
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="h-12 w-9 shrink-0 rounded bg-gray-800 md:h-14 md:w-11" />
                <div className="mt-2 h-10 w-1 shrink-0 rounded-full bg-gray-800" />
                <div className="flex-1 pt-1">
                  <div className="h-4 w-4/5 rounded bg-gray-800" />
                  <div className="mt-2 h-3 w-2/3 rounded bg-gray-900" />
                  <div className="mt-2 h-3 w-1/2 rounded bg-gray-900" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section aria-hidden="true" className="mb-10 sm:mb-12" style={{ minHeight }}>
      <div className="mb-4 flex items-center gap-3 px-3">
        <div className="h-6 w-1.5 rounded-full bg-gray-800 sm:h-8" />
        <div className="h-7 w-44 rounded bg-gray-800 sm:w-60" />
      </div>
      <div className="flex gap-3 overflow-hidden px-3 pb-4 pt-2 sm:gap-4">
        {Array.from({ length: cardCount }).map((_, index) => (
          <div key={index} className="w-[140px] min-w-[140px] max-w-[180px] shrink-0 sm:w-[160px] sm:min-w-[160px] md:w-[180px] md:min-w-[180px]">
            <div className="aspect-[2/3] rounded-xl bg-gray-900" />
            <div className="mt-3 h-4 w-4/5 rounded bg-gray-800" />
            <div className="mt-2 h-3 w-1/2 rounded bg-gray-900" />
          </div>
        ))}
      </div>
    </section>
  )
}
