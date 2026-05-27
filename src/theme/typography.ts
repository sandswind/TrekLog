import { Platform } from 'react-native';
const base = Platform.select({ ios: 'Helvetica Neue', android: 'Roboto', default: 'System' });
export const Typography = {
  displayXL:  { fontFamily: base, fontSize: 32, fontWeight: '700' as const, letterSpacing: 3, textTransform: 'uppercase' as const },
  displayLG:  { fontFamily: base, fontSize: 24, fontWeight: '700' as const, letterSpacing: 2.5, textTransform: 'uppercase' as const },
  displayMD:  { fontFamily: base, fontSize: 20, fontWeight: '700' as const, letterSpacing: 2, textTransform: 'uppercase' as const },
  stardate:   { fontFamily: base, fontSize: 14, fontWeight: '700' as const, letterSpacing: 2.5, textTransform: 'uppercase' as const },
  stardateXL: { fontFamily: base, fontSize: 22, fontWeight: '900' as const, letterSpacing: 3.5, textTransform: 'uppercase' as const },
  labelLG:    { fontFamily: base, fontSize: 16, fontWeight: '700' as const, letterSpacing: 1.8, textTransform: 'uppercase' as const },
  labelMD:    { fontFamily: base, fontSize: 13, fontWeight: '600' as const, letterSpacing: 1.5, textTransform: 'uppercase' as const },
  labelSM:    { fontFamily: base, fontSize: 11, fontWeight: '600' as const, letterSpacing: 1.2, textTransform: 'uppercase' as const },
  bodyLG:     { fontFamily: base, fontSize: 16, fontWeight: '400' as const, letterSpacing: 0.4 },
  bodyMD:     { fontFamily: base, fontSize: 14, fontWeight: '400' as const, letterSpacing: 0.3 },
  bodySM:     { fontFamily: base, fontSize: 12, fontWeight: '400' as const, letterSpacing: 0.2 },
  monoLG:     { fontFamily: Platform.select({ ios: 'Courier New', android: 'monospace' }), fontSize: 16, fontWeight: '700' as const, letterSpacing: 2 },
  monoMD:     { fontFamily: Platform.select({ ios: 'Courier New', android: 'monospace' }), fontSize: 13, fontWeight: '600' as const, letterSpacing: 1.5 },
  monoSM:     { fontFamily: Platform.select({ ios: 'Courier New', android: 'monospace' }), fontSize: 11, fontWeight: '400' as const, letterSpacing: 1 },
} as const;
