import { Audio } from 'expo-av';
import { useEffect, useRef } from 'react';

type SoundName = 'beep'|'ding'|'datastream'|'error'|'powerup'|'pause';

const SOUND_FILES: Record<SoundName, any> = {
  beep:       require('../../assets/sounds/beep.wav'),
  ding:       require('../../assets/sounds/ding.wav'),
  datastream: require('../../assets/sounds/datastream.wav'),
  error:      require('../../assets/sounds/error.wav'),
  powerup:    require('../../assets/sounds/powerup.wav'),
  pause:      require('../../assets/sounds/pause.wav'),
};

export function useSounds() {
  const soundRefs = useRef<Partial<Record<SoundName, Audio.Sound>>>({});

  useEffect(() => {
    Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
    const loadAll = async () => {
      for (const [name, file] of Object.entries(SOUND_FILES)) {
        try {
          const { sound } = await Audio.Sound.createAsync(file, { volume: 0.8 });
          soundRefs.current[name as SoundName] = sound;
        } catch (e) { console.warn(`Failed to load sound: ${name}`, e); }
      }
    };
    loadAll();
    return () => { Object.values(soundRefs.current).forEach(s => s?.unloadAsync()); };
  }, []);

  const play = async (name: SoundName) => {
    try {
      const sound = soundRefs.current[name];
      if (sound) { await sound.setPositionAsync(0); await sound.playAsync(); }
    } catch (e) { console.warn(`Failed to play sound: ${name}`, e); }
  };

  return { play };
}
