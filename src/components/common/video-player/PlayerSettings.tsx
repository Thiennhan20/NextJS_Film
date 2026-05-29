"use client";

import React, { useState, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { useTranslations } from "next-intl";
import {
  AUDIO_PRESETS,
  type AudioSettings,
} from "@/lib/audioUtils";

interface PlayerSettingsProps {
  show: boolean;
  onToggle: () => void;
  disabled?: boolean;

  // Speed
  speed: number;
  onSpeedChange: (speed: number) => void;

  // Quality
  qualities: Array<{ index: number; label: string }>;
  currentQuality: number;
  onQualityChange: (level: number) => void;

  // Container sizing for responsiveness
  containerWidth?: number;

  // Audio enhancement
  audioSettings?: AudioSettings;
  onAudioSettingsChange?: Dispatch<SetStateAction<AudioSettings>>;
}

type MenuView = "main" | "speed" | "quality" | "audio";

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
  );
}

const PlayerSettings: React.FC<PlayerSettingsProps> = ({
  show,
  onToggle,
  disabled = false,
  speed,
  onSpeedChange,
  qualities,
  currentQuality,
  onQualityChange,
  containerWidth = 0,
  audioSettings,
  onAudioSettingsChange,
}) => {
  const [menuView, setMenuView] = useState<MenuView>("main");
  const containerRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("Watch");
  const getAudioPresetLabel = (presetId: string) => t(`playerSettings.audioPresets.${presetId}`);


  // Reset to main view whenever settings popover is closed/opened
  useEffect(() => {
    if (!show) {
      setMenuView("main");
    }
  }, [show]);

  // Click outside listener to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (show) onToggle();
      }
    };
    if (show) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [show, onToggle]);

  // Determine responsiveness
  const isCompact = containerWidth > 0 && containerWidth < 460;

  // Determine active audio preset label
  const getActiveAudioLabel = (): string => {
    if (!audioSettings) return t("playerSettings.off");
    if (!audioSettings.enabled) return t("playerSettings.off");

    const matchedPreset = AUDIO_PRESETS.find((p) => isPresetActive(audioSettings, p.settings));
    if (matchedPreset) {
      const name = getAudioPresetLabel(matchedPreset.id);
      return name.length > 14 ? name.slice(0, 12) + "..." : name;
    }
    return t("playerSettings.off");
  };

  // Header Component for Submenus
  const renderHeader = (title: string) => (
    <div className="flex items-center mb-2 pb-1.5 border-b border-white/10" data-no-toggle>
      <button
        onClick={() => setMenuView("main")}
        className="p-1 rounded-lg bg-white/5 hover:bg-white/15 text-white transition-colors cursor-pointer"
        aria-label={t("playerSettings.back")}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <span className="text-xs sm:text-sm font-bold text-gray-200 select-none flex-1 text-center pr-6">
        {title}
      </span>
    </div>
  );

  return (
    <div className="relative font-sans" ref={containerRef}>
      {/* Settings Gear Button */}
      <button
        onClick={disabled ? undefined : onToggle}
        className={`p-1.5 sm:p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95 ${
          disabled ? "opacity-40 cursor-not-allowed" : ""
        }`}
        aria-label={t("settings")}
        title={disabled ? t("settingsDisabled") : t("settings")}
      >
        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {/* Settings Dropdown Wrapper */}
      {show && (
        <div
          className={`absolute bottom-full right-0 mb-3 bg-black/95 border border-white/10 rounded-xl shadow-2xl backdrop-blur-md transition-all duration-300 animate-fade-in z-50 overflow-hidden ${
            isCompact ? "p-2 w-[230px]" : "p-3 w-[270px] sm:w-[310px]"
          }`}
          data-no-toggle
        >
          {/* 1. MAIN SETTINGS VIEW */}
          {menuView === "main" && (
            <div
              className={`space-y-1 sm:space-y-1.5 ${
                isCompact ? "max-h-[130px] overflow-y-auto pr-1.5 player-scrollbar scroll-smooth" : ""
              }`}
            >
              {/* Option 1: Tốc độ phát (Speed) */}
              <button
                onClick={() => setMenuView("speed")}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg bg-white/0 hover:bg-white/5 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <svg
                    className="w-5 h-5 text-gray-300 shrink-0 group-hover:text-white transition-colors"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <circle cx="12" cy="12" r="9" strokeLinecap="round" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 12l3-3M12 7a5 5 0 00-5 5" />
                  </svg>
                  <span className="text-xs sm:text-sm font-semibold text-gray-200 group-hover:text-white transition-colors">
                    {t("playerSettings.playbackSpeed")}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-400 text-[10px] sm:text-xs">
                  <span className="group-hover:text-gray-300 transition-colors">
                    {speed === 1 ? t("playerSettings.normal") : `${speed.toFixed(2)}x`}
                  </span>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>

              {/* Option 2: Chất lượng (Quality) */}
              <button
                onClick={() => setMenuView("quality")}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg bg-white/0 hover:bg-white/5 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <svg
                    className="w-5 h-5 text-gray-300 shrink-0 group-hover:text-white transition-colors"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"
                    />
                  </svg>
                  <span className="text-xs sm:text-sm font-semibold text-gray-200 group-hover:text-white transition-colors">
                    {t("playerSettings.quality")}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-400 text-[10px] sm:text-xs">
                  <span className="group-hover:text-gray-300 transition-colors">
                    {currentQuality === -1
                      ? t("playerSettings.auto")
                      : qualities.find((q) => q.index === currentQuality)?.label || t("playerSettings.auto")}
                  </span>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>

              {/* Option 3: audio enhancement */}
              {audioSettings && onAudioSettingsChange && (
                <button
                  onClick={() => setMenuView("audio")}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg bg-white/0 hover:bg-white/5 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                    {/* Speaker / Audio SVG Icon */}
                    <svg
                      className="w-5 h-5 text-gray-300 shrink-0 group-hover:text-white transition-colors"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z"
                      />
                    </svg>
                    <span className="text-xs sm:text-sm font-semibold text-gray-200 group-hover:text-white transition-colors truncate">
                      {t("playerSettings.audio")}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-400 text-[10px] sm:text-xs">
                    <span className={`group-hover:text-gray-300 transition-colors truncate max-w-[80px] ${audioSettings.enabled ? 'text-amber-500' : ''}`}>
                      {getActiveAudioLabel()}
                    </span>
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              )}
            </div>
          )}

          {/* 2. PLAYBACK SPEED MENU */}
          {menuView === "speed" && (
            <div className="flex flex-col select-none">
              {renderHeader(t("playerSettings.playbackSpeed"))}

              {/* Numerical Speed Read-out */}
              <div
                className={`text-center font-mono font-bold tracking-wider text-[#e07a5f] sm:text-amber-500 ${
                  isCompact ? "text-sm mb-2" : "text-lg sm:text-xl mb-4"
                }`}
              >
                {speed.toFixed(2)}x
              </div>

              {/* Decrement Slider Increment Panel */}
              <div
                className={`flex items-center ${
                  isCompact ? "gap-1.5 px-0.5 mb-3" : "gap-3 px-1 mb-5"
                }`}
              >
                <button
                  onClick={() => onSpeedChange(Math.max(0.25, Math.round((speed - 0.05) * 100) / 100))}
                  className={`rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-90 transition-all cursor-pointer select-none ${
                    isCompact ? "w-6.5 h-6.5" : "w-8 h-8"
                  }`}
                  aria-label={t("playerSettings.decreaseSpeed")}
                >
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                  </svg>
                </button>

                <div className="flex-1 relative flex items-center">
                  <input
                    type="range"
                    min="0.25"
                    max="3.00"
                    step="0.05"
                    value={speed}
                    onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
                    className="w-full h-1.5 cursor-pointer appearance-none rounded-full"
                    style={{
                      background: `linear-gradient(to right, #ffffff 0%, #ffffff ${
                        ((speed - 0.25) / 2.75) * 100
                      }%, rgba(255,255,255,0.2) ${((speed - 0.25) / 2.75) * 100}%, rgba(255,255,255,0.2) 100%)`,
                      WebkitAppearance: "none",
                    }}
                  />
                </div>

                <button
                  onClick={() => onSpeedChange(Math.min(3.0, Math.round((speed + 0.05) * 100) / 100))}
                  className={`rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-90 transition-all cursor-pointer select-none ${
                    isCompact ? "w-6.5 h-6.5" : "w-8 h-8"
                  }`}
                  aria-label={t("playerSettings.increaseSpeed")}
                >
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>

              {/* Quick Preset Buttons */}
              <div
                className={`grid grid-cols-5 ${
                  isCompact ? "gap-1 mt-0.5" : "gap-1.5 mt-1"
                }`}
              >
                {[1.0, 1.25, 1.5, 2.0, 3.0].map((preset) => {
                  const isPresetActiveSpeed = Math.abs(speed - preset) < 0.01;
                  const isThree = preset === 3.0;

                  return (
                    <button
                      key={preset}
                      onClick={() => onSpeedChange(preset)}
                      className={`flex flex-col items-center justify-center rounded-lg transition-all cursor-pointer border ${
                        isCompact ? "py-1 px-0" : "py-1.5 px-0.5"
                      } ${
                        isPresetActiveSpeed
                          ? "bg-white/20 text-white border-white/20 font-bold"
                          : "bg-white/5 text-gray-300 border-transparent hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <span
                        className={`flex items-center gap-0.5 font-mono font-medium leading-none ${
                          isCompact ? "text-[8px] sm:text-[9px]" : "text-[10px] sm:text-xs"
                        }`}
                      >
                        {isThree && (
                          <span className="px-1 py-0.5 rounded text-[8px] bg-red-600 text-white font-bold leading-none shrink-0 scale-90 sm:scale-100">
                            P
                          </span>
                        )}
                        {preset.toFixed(preset === 1.0 ? 1 : 2).replace(".00", "").replace(".0", "")}
                      </span>
                      {preset === 1.0 && (
                        <span
                          className={`text-gray-400 font-semibold mt-0.5 leading-none ${
                            isCompact ? "text-[6px] sm:text-[7px]" : "text-[7px] sm:text-[8px]"
                          }`}
                        >
                          {t("playerSettings.normal")}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. HLS QUALITIES MENU */}
          {menuView === "quality" && (
            <div>
              {renderHeader(t("playerSettings.quality"))}
              <div
                className={`space-y-1 overflow-y-auto pr-1 player-scrollbar ${
                  isCompact ? "max-h-[96px]" : "max-h-[220px]"
                }`}
              >
                <button
                  onClick={() => onQualityChange(-1)}
                  className={`w-full flex items-center gap-2.5 rounded-lg text-left text-xs sm:text-sm transition-all cursor-pointer ${
                    isCompact ? "px-2 py-1.5" : "px-3 py-2"
                  } ${
                    currentQuality === -1 ? "text-white bg-white/10 font-bold" : "text-gray-300 hover:bg-white/5"
                  }`}
                >
                  <span className="w-4 h-4 flex items-center justify-center shrink-0">
                    {currentQuality === -1 && (
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span className="flex items-center gap-1 select-none">
                    {t("playerSettings.auto")}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* 4. AUDIO ENHANCEMENT MENU */}
          {menuView === "audio" && audioSettings && onAudioSettingsChange && (
            <div>
              {renderHeader(t("playerSettings.audio"))}

              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between px-2 py-1.5 mb-1.5 rounded-lg bg-white/5">
                <span className="text-xs sm:text-sm font-semibold text-gray-200">
                  {t("playerSettings.audioEnhancement")}
                </span>
                <button
                  onClick={() => onAudioSettingsChange((prev) => ({ ...prev, enabled: !prev.enabled }))}
                  className={`w-10 h-5.5 sm:w-11 sm:h-6 rounded-full relative cursor-pointer transition-colors duration-200 ${
                    audioSettings.enabled ? "bg-amber-600" : "bg-white/20"
                  }`}
                  aria-checked={audioSettings.enabled}
                  role="switch"
                >
                  <span
                    className={`w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-full bg-white absolute top-0.5 left-0.5 transition-transform duration-200 ${
                      audioSettings.enabled ? "translate-x-4.5 sm:translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Device Optimize Label */}
              <span className={`block text-[10px] sm:text-xs font-bold mb-1 px-1 ${audioSettings.enabled ? 'text-gray-300' : 'text-gray-500'}`}>
                {t("playerSettings.optimizeDevice")}
              </span>

              {/* Device Preset Grid */}
              <div
                className={`overflow-y-auto player-scrollbar ${
                  isCompact ? "max-h-[100px]" : "max-h-[150px]"
                }`}
              >
                <div className="flex flex-wrap gap-1.5">
                  {AUDIO_PRESETS.map((preset) => {
                    const isActive = audioSettings.enabled && isPresetActive(audioSettings, preset.settings);
                    const presetName = getAudioPresetLabel(preset.id);

                    return (
                      <button
                        key={preset.id}
                        disabled={!audioSettings.enabled}
                        onClick={() => onAudioSettingsChange({ ...preset.settings })}
                        className={`inline-flex items-center gap-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all border ${
                          isCompact ? "px-2 py-1" : "px-2.5 py-1.5"
                        } ${
                          isActive
                            ? "bg-amber-600/90 text-white border-amber-500 shadow-md shadow-amber-500/20"
                            : "bg-white/5 text-gray-300 border-white/5 hover:bg-white/10 hover:border-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
                        }`}
                      >
                        {/* Inline Device Icon */}
                        {preset.id === "default" && (
                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                          </svg>
                        )}
                        {preset.id === "tv" && (
                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 20.25h12m-7.5-3v3m3-3v3m-10.125-3h17.25c.621 0 1.125-.504 1.125-1.125V4.875c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125z" />
                          </svg>
                        )}
                        {preset.id === "laptop" && (
                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z" />
                          </svg>
                        )}
                        {preset.id === "headphones" && (
                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3C7.03 3 3 7.03 3 12v4.5c0 .83.67 1.5 1.5 1.5H6c.83 0 1.5-.67 1.5-1.5V14c0-.83-.67-1.5-1.5-1.5H4.5c0-4.14 3.36-7.5 7.5-7.5s7.5 3.36 7.5 7.5H18c-.83 0-1.5.67-1.5 1.5v2.5c0 .83.67 1.5 1.5 1.5h1.5c.83 0 1.5-.67 1.5-1.5V12c0-4.97-4.03-9-9-9z" />
                          </svg>
                        )}
                        {preset.id === "mobile" && (
                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                          </svg>
                        )}
                        {preset.id === "tiktokboost" && (
                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                          </svg>
                        )}
                        {preset.id === "external_speakers" && (
                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                          </svg>
                        )}
                        <span className="truncate">{presetName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

PlayerSettings.displayName = "PlayerSettings";
export default PlayerSettings;
