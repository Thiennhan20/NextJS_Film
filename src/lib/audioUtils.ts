// audioUtils.ts
// Web Audio helpers for the inline server 1 movie player.

export interface AudioNodes {
  audioCtx: AudioContext;
  source: MediaElementAudioSourceNode;
  subFilter: BiquadFilterNode;
  bassFilter: BiquadFilterNode;
  midFilter: BiquadFilterNode;
  highMidFilter: BiquadFilterNode;
  trebleFilter: BiquadFilterNode;
  saturator: WaveShaperNode;
  compressor: DynamicsCompressorNode;
  gain: GainNode;
  limiter: DynamicsCompressorNode; // Hard brickwall safety limiter
}

export interface AudioSettings {
  enabled: boolean;
  subFrequency: number;
  subGain: number;
  bassFrequency: number;
  bassGain: number;
  midFrequency: number;
  midGain: number;
  highMidFrequency: number;
  highMidGain: number;
  trebleFrequency: number;
  trebleGain: number;
  saturationAmount: number;
  compressorThreshold: number;
  compressorKnee: number;
  compressorRatio: number;
  compressorAttack: number;
  compressorRelease: number;
  outputGain: number;
  limiterThreshold: number;
  limiterKnee: number;
  limiterRatio: number;
  limiterAttack: number;
  limiterRelease: number;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  enabled: true,
  subFrequency: 40,
  subGain: 6,
  bassFrequency: 150,
  bassGain: 4,
  midFrequency: 1000,
  midGain: 2,
  highMidFrequency: 4000,
  highMidGain: 3,
  trebleFrequency: 12000,
  trebleGain: 4,
  saturationAmount: 0,
  compressorThreshold: -30,
  compressorKnee: 20,
  compressorRatio: 2.5,
  compressorAttack: 0.01,
  compressorRelease: 0.25,
  outputGain: 1.3,
  limiterThreshold: -0.5,
  limiterKnee: 0,
  limiterRatio: 20,
  limiterAttack: 0,
  limiterRelease: 0.1,
};

export interface AudioPreset {
  id: string;
  settings: AudioSettings;
}

export const AUDIO_PRESETS: AudioPreset[] = [
  {
    id: 'default',
    settings: DEFAULT_AUDIO_SETTINGS,
  },
  {
    id: 'tv',
    settings: {
      enabled: true,
      subFrequency: 40,
      subGain: 0,
      bassFrequency: 150,
      bassGain: 3,
      midFrequency: 1000,
      midGain: 5,
      highMidFrequency: 4000,
      highMidGain: 6,
      trebleFrequency: 12000,
      trebleGain: 3,
      saturationAmount: 0,
      compressorThreshold: -25,
      compressorKnee: 15,
      compressorRatio: 2.0,
      compressorAttack: 0.01,
      compressorRelease: 0.25,
      outputGain: 1.2,
      limiterThreshold: -0.5,
      limiterKnee: 0,
      limiterRatio: 20,
      limiterAttack: 0,
      limiterRelease: 0.1,
    },
  },
  {
    id: 'laptop',
    settings: {
      enabled: true,
      subFrequency: 40,
      subGain: -6,
      bassFrequency: 150,
      bassGain: 2,
      midFrequency: 1000,
      midGain: 6,
      highMidFrequency: 4000,
      highMidGain: 4,
      trebleFrequency: 12000,
      trebleGain: 2,
      saturationAmount: 0,
      compressorThreshold: -20,
      compressorKnee: 10,
      compressorRatio: 2.0,
      compressorAttack: 0.01,
      compressorRelease: 0.25,
      outputGain: 1.35,
      limiterThreshold: -0.5,
      limiterKnee: 0,
      limiterRatio: 20,
      limiterAttack: 0,
      limiterRelease: 0.1,
    },
  },
  {
    id: 'headphones',
    settings: {
      enabled: true,
      subFrequency: 40,
      subGain: 5,
      bassFrequency: 150,
      bassGain: 3,
      midFrequency: 1000,
      midGain: 1,
      highMidFrequency: 4000,
      highMidGain: 3,
      trebleFrequency: 12000,
      trebleGain: 4,
      saturationAmount: 0,
      compressorThreshold: -28,
      compressorKnee: 20,
      compressorRatio: 2.0,
      compressorAttack: 0.01,
      compressorRelease: 0.25,
      outputGain: 1.0,
      limiterThreshold: -0.5,
      limiterKnee: 0,
      limiterRatio: 20,
      limiterAttack: 0,
      limiterRelease: 0.1,
    },
  },
  {
    id: 'mobile',
    settings: {
      enabled: true,
      subFrequency: 40,
      subGain: -10,
      bassFrequency: 150,
      bassGain: 0,
      midFrequency: 1000,
      midGain: 8,
      highMidFrequency: 4000,
      highMidGain: 6,
      trebleFrequency: 12000,
      trebleGain: 3,
      saturationAmount: 0,
      compressorThreshold: -18,
      compressorKnee: 8,
      compressorRatio: 2.0,
      compressorAttack: 0.01,
      compressorRelease: 0.25,
      outputGain: 1.25,
      limiterThreshold: -0.5,
      limiterKnee: 0,
      limiterRatio: 20,
      limiterAttack: 0,
      limiterRelease: 0.1,
    },
  },
  {
    id: 'tiktokboost',
    settings: {
      enabled: true,
      subFrequency: 90,
      subGain: 1,
      bassFrequency: 125,
      bassGain: 6,
      midFrequency: 1200,
      midGain: 2,
      highMidFrequency: 3200,
      highMidGain: 6,
      trebleFrequency: 9000,
      trebleGain: 3,
      saturationAmount: 0.12,
      compressorThreshold: -32,
      compressorKnee: 8,
      compressorRatio: 4.5,
      compressorAttack: 0.003,
      compressorRelease: 0.18,
      outputGain: 1.35,
      limiterThreshold: -1,
      limiterKnee: 0,
      limiterRatio: 30,
      limiterAttack: 0,
      limiterRelease: 0.08,
    },
  },
  {
    id: 'external_speakers',
    settings: {
      enabled: true,
      subFrequency: 40,
      subGain: 8,
      bassFrequency: 150,
      bassGain: 5,
      midFrequency: 1000,
      midGain: 2,
      highMidFrequency: 4000,
      highMidGain: 4,
      trebleFrequency: 12000,
      trebleGain: 6,
      saturationAmount: 0,
      compressorThreshold: -26,
      compressorKnee: 15,
      compressorRatio: 3.0,
      compressorAttack: 0.01,
      compressorRelease: 0.25,
      outputGain: 1.25,
      limiterThreshold: -0.5,
      limiterKnee: 0,
      limiterRatio: 20,
      limiterAttack: 0,
      limiterRelease: 0.1,
    },
  },
];

export async function detectBestPresetId(): Promise<string> {
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

const NEUTRAL_AUDIO_SETTINGS: AudioSettings = {
  enabled: true,
  subFrequency: 40,
  subGain: 0,
  bassFrequency: 150,
  bassGain: 0,
  midFrequency: 1000,
  midGain: 0,
  highMidFrequency: 4000,
  highMidGain: 0,
  trebleFrequency: 12000,
  trebleGain: 0,
  saturationAmount: 0,
  compressorThreshold: 0,
  compressorKnee: 0,
  compressorRatio: 1,
  compressorAttack: 0,
  compressorRelease: 0.25,
  outputGain: 1,
  limiterThreshold: -0.5,
  limiterKnee: 0,
  limiterRatio: 20,
  limiterAttack: 0,
  limiterRelease: 0.1,
};

function setAudioParam(param: AudioParam, value: number, audioCtx: AudioContext) {
  try {
    param.cancelScheduledValues(audioCtx.currentTime);
    param.setTargetAtTime(value, audioCtx.currentTime, 0.015);
  } catch {
    param.value = value;
  }
}

function createSaturationCurve(amount: number) {
  const samples = 512;
  const curve = new Float32Array(samples);
  const drive = Math.max(0, Math.min(amount, 1)) * 8;

  for (let i = 0; i < samples; i += 1) {
    const x = (i * 2) / (samples - 1) - 1;
    curve[i] = drive > 0 ? ((1 + drive) * x) / (1 + drive * Math.abs(x)) : x;
  }

  return curve;
}

export function applyAudioSettings(nodes: AudioNodes, settings: AudioSettings) {
  const values = settings.enabled ? settings : NEUTRAL_AUDIO_SETTINGS;

  setAudioParam(nodes.subFilter.frequency, values.subFrequency, nodes.audioCtx);
  setAudioParam(nodes.subFilter.gain, values.subGain, nodes.audioCtx);
  setAudioParam(nodes.bassFilter.frequency, values.bassFrequency, nodes.audioCtx);
  setAudioParam(nodes.bassFilter.gain, values.bassGain, nodes.audioCtx);
  setAudioParam(nodes.midFilter.frequency, values.midFrequency, nodes.audioCtx);
  setAudioParam(nodes.midFilter.gain, values.midGain, nodes.audioCtx);
  setAudioParam(nodes.highMidFilter.frequency, values.highMidFrequency, nodes.audioCtx);
  setAudioParam(nodes.highMidFilter.gain, values.highMidGain, nodes.audioCtx);
  setAudioParam(nodes.trebleFilter.frequency, values.trebleFrequency, nodes.audioCtx);
  setAudioParam(nodes.trebleFilter.gain, values.trebleGain, nodes.audioCtx);
  nodes.saturator.curve = createSaturationCurve(values.saturationAmount);
  setAudioParam(nodes.compressor.threshold, values.compressorThreshold, nodes.audioCtx);
  setAudioParam(nodes.compressor.knee, values.compressorKnee, nodes.audioCtx);
  setAudioParam(nodes.compressor.ratio, values.compressorRatio, nodes.audioCtx);
  setAudioParam(nodes.compressor.attack, values.compressorAttack, nodes.audioCtx);
  setAudioParam(nodes.compressor.release, values.compressorRelease, nodes.audioCtx);
  setAudioParam(nodes.gain.gain, values.outputGain, nodes.audioCtx);
  setAudioParam(nodes.limiter.threshold, values.limiterThreshold, nodes.audioCtx);
  setAudioParam(nodes.limiter.knee, values.limiterKnee, nodes.audioCtx);
  setAudioParam(nodes.limiter.ratio, values.limiterRatio, nodes.audioCtx);
  setAudioParam(nodes.limiter.attack, values.limiterAttack, nodes.audioCtx);
  setAudioParam(nodes.limiter.release, values.limiterRelease, nodes.audioCtx);
}

export async function setupAudioNodes(
  video: HTMLVideoElement,
  settings: AudioSettings = DEFAULT_AUDIO_SETTINGS
): Promise<AudioNodes> {
  const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  const source = audioCtx.createMediaElementSource(video);

  const subFilter = audioCtx.createBiquadFilter();
  subFilter.type = 'peaking';
  subFilter.frequency.value = 40;
  subFilter.Q.value = 1;

  const bassFilter = audioCtx.createBiquadFilter();
  bassFilter.type = 'peaking';
  bassFilter.frequency.value = 150;
  bassFilter.Q.value = 1;

  const midFilter = audioCtx.createBiquadFilter();
  midFilter.type = 'peaking';
  midFilter.frequency.value = 1000;
  midFilter.Q.value = 1;

  const highMidFilter = audioCtx.createBiquadFilter();
  highMidFilter.type = 'peaking';
  highMidFilter.frequency.value = 4000;
  highMidFilter.Q.value = 1;

  const trebleFilter = audioCtx.createBiquadFilter();
  trebleFilter.type = 'peaking';
  trebleFilter.frequency.value = 12000;
  trebleFilter.Q.value = 1;

  const saturator = audioCtx.createWaveShaper();
  saturator.oversample = '2x';

  const compressor = audioCtx.createDynamicsCompressor();
  const gain = audioCtx.createGain();

  // Create safety brickwall limiter node at the end of the Web Audio chain
  const limiter = audioCtx.createDynamicsCompressor();
  limiter.threshold.value = -0.5; // Ceil at -0.5dB to prevent digital clipping
  limiter.knee.value = 0;         // Hard knee for strict clipping prevention
  limiter.ratio.value = 20;       // Infinite compression ratio (brickwall)
  limiter.attack.value = 0;       // Instantaneous peak catching
  limiter.release.value = 0.1;    // Quick smooth release

  const nodes = { audioCtx, source, subFilter, bassFilter, midFilter, highMidFilter, trebleFilter, saturator, compressor, gain, limiter };

  applyAudioSettings(nodes, settings);

  source
    .connect(subFilter)
    .connect(bassFilter)
    .connect(midFilter)
    .connect(highMidFilter)
    .connect(trebleFilter)
    .connect(saturator)
    .connect(compressor)
    .connect(gain)
    .connect(limiter) // Chain the limiter right before output
    .connect(audioCtx.destination);

  return nodes;
}

export function cleanupAudioNodes(nodes: Partial<AudioNodes>) {
  try {
    nodes.audioCtx?.close();
  } catch {}

  if (nodes) {
    Object.keys(nodes).forEach(key => {
      // @ts-expect-error: set to null for cleanup
      nodes[key] = null;
    });
  }
}
