interface MediaPageLoadingProps {
  label: string
  fullScreen?: boolean
}

export default function MediaPageLoading({ label, fullScreen = false }: MediaPageLoadingProps) {
  return (
    <div
      data-testid="media-page-loading"
      className={`flex flex-col items-center justify-center ${fullScreen ? 'min-h-screen bg-black' : 'py-24'}`}
      role="status"
      aria-live="polite"
    >
      <div
        data-testid="media-loading-spinner"
        className="h-16 w-16 animate-spin rounded-full border-4 border-red-500 border-t-transparent [animation-duration:1.5s]"
        aria-hidden="true"
      />
      <p className="mt-4 text-lg text-gray-400">{label}</p>
    </div>
  )
}
