import { useState, useRef, useCallback, useEffect } from 'react';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

export type RecorderState = 'idle'|'recording'|'paused'|'stopped';
export interface RecorderResult { uri: string; durationSecs: number; }

const BAR_COUNT = 40;
const RECORDING_OPTIONS: Audio.RecordingOptions = {
  android: { extension:'.m4a', outputFormat: Audio.AndroidOutputFormat.MPEG_4, audioEncoder: Audio.AndroidAudioEncoder.AAC, sampleRate:44100, numberOfChannels:1, bitRate:64000 },
  ios: { extension:'.m4a', outputFormat: Audio.IOSOutputFormat.MPEG4AAC, audioQuality: Audio.IOSAudioQuality.HIGH, sampleRate:44100, numberOfChannels:1, bitRate:64000, linearPCMBitDepth:16, linearPCMIsBigEndian:false, linearPCMIsFloat:false },
  web: { mimeType:'audio/webm', bitsPerSecond:64000 },
};

export function useRecorder() {
  const recordingRef = useRef<Audio.Recording|null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const startTimeRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);
  const [state, setState] = useState<RecorderState>('idle');
  const [durationSecs, setDurationSecs] = useState(0);
  const [amplitudes, setAmplitudes] = useState<number[]>(Array(BAR_COUNT).fill(0.05));

  useEffect(() => () => { clearInterval(timerRef.current!); recordingRef.current?.stopAndUnloadAsync().catch(()=>{}); }, []);

  const startTimer = () => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(async () => {
      const elapsed = elapsedRef.current + (Date.now()-startTimeRef.current)/1000;
      setDurationSecs(elapsed);
      if (recordingRef.current) {
        try {
          const status = await recordingRef.current.getStatusAsync();
          if (status.isRecording && 'metering' in status && status.metering !== undefined) {
            const db = status.metering as number;
            const normalized = Math.min(1, Math.max(0, (db+60)/60));
            setAmplitudes(prev => prev.map((_,i) => {
              const spread = Math.abs(i-BAR_COUNT/2)/(BAR_COUNT/2);
              return Math.min(1,Math.max(0.05, normalized*(1-spread*0.4)+(Math.random()-0.5)*0.3*normalized));
            }));
          }
        } catch(_){}
      }
    }, 100);
  };

  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current=null; elapsedRef.current+=(Date.now()-startTimeRef.current)/1000; }
  };

  const start = useCallback(async () => {
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) return;
    await Audio.setAudioModeAsync({ allowsRecordingIOS:true, playsInSilentModeIOS:true, shouldDuckAndroid:true });
    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync({ ...RECORDING_OPTIONS, isMeteringEnabled:true });
    await recording.startAsync();
    recordingRef.current = recording;
    elapsedRef.current = 0; setDurationSecs(0); setState('recording'); startTimer();
  }, []);

  const pause = useCallback(async () => {
    if (state !== 'recording') return;
    await recordingRef.current?.pauseAsync();
    stopTimer(); setState('paused'); setAmplitudes(Array(BAR_COUNT).fill(0.05));
  }, [state]);

  const resume = useCallback(async () => {
    if (state !== 'paused') return;
    await recordingRef.current?.startAsync();
    setState('recording'); startTimer();
  }, [state]);

  const stop = useCallback(async (): Promise<RecorderResult|null> => {
    if (!recordingRef.current || state==='idle') return null;
    stopTimer();
    await recordingRef.current.stopAndUnloadAsync();
    const uri = recordingRef.current.getURI();
    const finalDuration = elapsedRef.current;
    recordingRef.current = null; setState('stopped'); setAmplitudes(Array(BAR_COUNT).fill(0.05));
    if (!uri) return null;
    return { uri, durationSecs: finalDuration };
  }, [state]);

  const discard = useCallback(async () => {
    stopTimer();
    try { await recordingRef.current?.stopAndUnloadAsync(); const uri=recordingRef.current?.getURI(); if(uri) await FileSystem.deleteAsync(uri,{idempotent:true}); } catch(_){}
    recordingRef.current=null; elapsedRef.current=0; setState('idle'); setDurationSecs(0); setAmplitudes(Array(BAR_COUNT).fill(0.05));
  }, []);

  return { state, durationSecs, amplitudes, start, pause, resume, stop, discard };
}
