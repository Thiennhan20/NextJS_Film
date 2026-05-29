'use client'

import { useState, useEffect, type Dispatch, type SetStateAction } from 'react'
import {
  ChevronDown,
  Power,
  SlidersHorizontal,
  Tv,
  Laptop,
  Headphones,
  Smartphone,
  Speaker,
  Sparkles,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  AUDIO_PRESETS,
  type AudioSettings,
} from '@/lib/audioUtils'

const PRESET_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  default: Sparkles,
  tv: Tv,
  laptop: Laptop,
  headphones: Headphones,
  mobile: Smartphone,
  tiktokboost: Sparkles,
  external_speakers: Speaker,
}

function isPresetActive(settings: AudioSettings, presetSettings: AudioSettings) {
  return (
    settings.subFrequency === presetSettings.subFrequency &&
    settings.subGain === presetSettings.subGain &&
    settings.bassFrequency === presetSettings.bassFrequency &&
    settings.bassGain === presetSettings.bassGain &&
    settings.midFrequency === presetSettings.midFrequency &&
    settings.midGain === presetSettings.midGain &&
    settings.highMidFrequency === presetSettings.highMidFrequency &&
    settings.highMidGain === presetSettings.highMidGain &&
    settings.trebleFrequency === presetSettings.trebleFrequency &&
    settings.trebleGain === presetSettings.trebleGain &&
    settings.saturationAmount === presetSettings.saturationAmount &&
    settings.outputGain === presetSettings.outputGain &&
    settings.compressorThreshold === presetSettings.compressorThreshold &&
    settings.compressorKnee === presetSettings.compressorKnee &&
    settings.compressorRatio === presetSettings.compressorRatio &&
    settings.compressorAttack === presetSettings.compressorAttack &&
    settings.compressorRelease === presetSettings.compressorRelease &&
    settings.limiterThreshold === presetSettings.limiterThreshold &&
    settings.limiterKnee === presetSettings.limiterKnee &&
    settings.limiterRatio === presetSettings.limiterRatio &&
    settings.limiterAttack === presetSettings.limiterAttack &&
    settings.limiterRelease === presetSettings.limiterRelease
  )
}

async function detectBestPresetId(): Promise<string> {
  if (typeof window === 'undefined') return 'default';

  const ua = navigator.userAgent.toLowerCase();

  // 1. Detect Smart TV
  const isTV =
    ua.includes('smarttv') ||
    ua.includes('tizen') ||
    ua.includes('webos') ||
    ua.includes('appletv') ||
    ua.includes('playstation') ||
    ua.includes('xbox') ||
    ua.includes('googletv') ||
    ua.includes('chromecast') ||
    (ua.includes('android') && !ua.includes('mobile'));
  if (isTV) return 'tv';

  // 2. Detect Headphones (Jack or Bluetooth connected output devices)
  try {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasHeadphones = devices.some(device => {
        if (device.kind !== 'audiooutput') return false;
        const label = device.label.toLowerCase();
        return (
          label.includes('headphone') ||
          label.includes('earphone') ||
          label.includes('airpods') ||
          label.includes('bluetooth') ||
          label.includes('hands-free')
        );
      });
      if (hasHeadphones) return 'headphones';
    }
  } catch (error) {
    console.warn('Media devices enumeration failed:', error);
  }

  // 3. Detect Phone or Tablet (by user-agent or dimensions)
  const isMobile =
    /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua) ||
    window.innerWidth < 768;
  if (isMobile) return 'mobile';

  // 4. Default baseline for laptops / desktops
  return 'laptop';
}



interface AudioEnhancementControlsProps {
  settings: AudioSettings
  onSettingsChange: Dispatch<SetStateAction<AudioSettings>>
  className?: string
}

export default function AudioEnhancementControls({
  settings,
  onSettingsChange,
  className = '',
}: AudioEnhancementControlsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const t = useTranslations('Watch')
  const getAudioPresetLabel = (presetId: string) => t(`playerSettings.audioPresets.${presetId}`)

  // Auto device detection and connection tracking
  useEffect(() => {
    let active = true

    async function applyDetectedPreset() {
      const bestPresetId = await detectBestPresetId()
      if (!active) return

      const matchedPreset = AUDIO_PRESETS.find(p => p.id === bestPresetId)
      if (matchedPreset) {
        onSettingsChange(prev => {
          return { ...prev, ...matchedPreset.settings }
        })
      }
    }

    applyDetectedPreset()

    // Listen for connection / disconnection of audio devices
    const handleDeviceChange = () => {
      applyDetectedPreset()
    }

    if (typeof window !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)
    }

    return () => {
      active = false
      if (typeof window !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.removeEventListener) {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange)
      }
    }
  }, [onSettingsChange])

  const toggleDefaultEnhancement = () => {
    onSettingsChange(prev => ({ ...prev, enabled: !prev.enabled }))
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        aria-expanded={isOpen}
        className="inline-flex items-center gap-2 rounded-md bg-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-100 transition-colors hover:bg-gray-600"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        <span>{t('playerSettings.editAudio')}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="mt-3 rounded-lg border border-white/10 bg-gray-950/80 p-3 shadow-xl shadow-black/20">
          <div className="mb-3">
            <button
              type="button"
              onClick={toggleDefaultEnhancement}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                settings.enabled
                  ? 'bg-red-600 text-white hover:bg-red-500'
                  : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
              }`}
            >
              <Power className="h-3.5 w-3.5" />
              {settings.enabled ? t('playerSettings.disableAudioEnhancement') : t('playerSettings.enableAudioEnhancement')}
            </button>
          </div>

          <div className="border-t border-white/5 pt-3">
            <span className="mb-2 block text-xs font-bold text-gray-300">
              {t('playerSettings.optimizeDevice')}
            </span>
            <div className="flex flex-wrap gap-2">
              {AUDIO_PRESETS.map(preset => {
                const IconComponent = PRESET_ICONS[preset.id] || Sparkles
                const isActive = isPresetActive(settings, preset.settings)
                return (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={!settings.enabled}
                    onClick={() => onSettingsChange({ ...preset.settings })}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-all border ${
                      isActive
                        ? 'bg-red-600/90 text-white border-red-500 shadow-md shadow-red-500/20'
                        : 'bg-white/5 text-gray-300 border-white/5 hover:bg-white/10 hover:border-white/10 disabled:opacity-40 disabled:cursor-not-allowed'
                    }`}
                  >
                    <IconComponent className="h-3.5 w-3.5" />
                    <span>{getAudioPresetLabel(preset.id)}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
