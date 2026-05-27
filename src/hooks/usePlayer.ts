import { useState, useRef, useCallback, useEffect } from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';

export type PlayerState = 'idle'|'loading'|'playing'|'paused'|'finished';

export function usePlayer() {
  const soundRef = useRef<Audio.Sound|null>(null);
  const [state, setState] = useState<PlayerState>('idle');
  const [positionSecs, setPositionSecs] = useState(0);
  const [durationSecs, setDurationSecs] = useState(0);

  useEffect(() => () => { soundRef.current?.unloadAsync().catch(()=>{}); }, []);

  const onPlaybackStatus = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    setPositionSecs(status.positionMillis/1000);
    if (status.durationMillis) setDurationSecs(status.durationMillis/1000);
    if (status.didJustFinish) { setState('finished'); soundRef.current?.setPositionAsync(0); }
  };

  const load = useCallback(async (uri: string) => {
    setState('loading');
    try {
      await soundRef.current?.unloadAsync();
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay:false }, onPlaybackStatus);
      soundRef.current = sound; setState('paused');
    } catch(e) { setState('idle'); }
  }, []);

  const play  = useCallback(async () => { await soundRef.current?.playAsync();  setState('playing'); }, []);
  const pause = useCallback(async () => { await soundRef.current?.pauseAsync(); setState('paused');  }, []);
  const seekTo = useCallback(async (secs: number) => { await soundRef.current?.setPositionAsync(secs*1000); }, []);
  const unload = useCallback(async () => {
    await soundRef.current?.unloadAsync(); soundRef.current=null;
    setState('idle'); setPositionSecs(0); setDurationSecs(0);
  }, []);

  return { state, positionSecs, durationSecs, progress: durationSecs>0?positionSecs/durationSecs:0, load, play, pause, seekTo, unload };
}
