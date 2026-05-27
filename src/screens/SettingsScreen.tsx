/**
 * SettingsScreen V3 — LCARS computer console style
 *
 * Sections:
 *  1. AI CORE          — OpenAI key input + test connection + AI toggle
 *  2. ABOUT            — version, stardate, repo link
 *  3. Decorative LCARS chrome panels throughout
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Switch, Alert, Animated, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Circle, Line } from 'react-native-svg';

import { Colors, Typography, Spacing, Radius } from '../theme';
import { StarField }       from '../components/StarField';
import { LcarsHeader }     from '../components/LcarsHeader';
import { LcarsPanel }      from '../components/LcarsPanel';
import { LcarsStatusBar }  from '../components/LcarsStatusBar';
import { LcarsButton }     from '../components/LcarsButton';
import { useSounds }       from '../hooks/useSounds';
import {
  getOpenAIKey, setOpenAIKey,
  getAIEnabled, setAIEnabled,
  testOpenAIKey,
} from '../hooks/useAITitle';
import { toStardate, formatEarthDate } from '../utils/stardate';

// ── AI Status indicator ───────────────────────────────────────────────────────
type KeyStatus = 'unknown' | 'testing' | 'valid' | 'invalid';

const StatusPip: React.FC<{ status: KeyStatus }> = ({ status }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (status === 'testing') {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 400, useNativeDriver: true }),
      ])).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [status]);

  const color =
    status === 'valid'   ? Colors.success :
    status === 'invalid' ? Colors.medicalRed :
    status === 'testing' ? Colors.lcarsGold :
    Colors.textMuted;

  const label =
    status === 'valid'   ? 'KEY VERIFIED' :
    status === 'invalid' ? 'KEY REJECTED' :
    status === 'testing' ? 'TESTING...' :
    'NOT CONFIGURED';

  return (
    <View style={pip.row}>
      <Animated.View style={[pip.dot, { backgroundColor: color, opacity: pulseAnim }]} />
      <Text style={[pip.label, { color }]}>{label}</Text>
    </View>
  );
};
const pip = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot:   { width: 10, height: 10, borderRadius: 5 },
  label: { ...Typography.monoSM, letterSpacing: 1.5 },
});

// ── Decorative LCARS circuit graphic ─────────────────────────────────────────
const CircuitGraphic: React.FC<{ color: string }> = ({ color }) => (
  <Svg width={120} height={60} viewBox="0 0 120 60">
    <Line x1="0"  y1="30" x2="30" y2="30" stroke={color} strokeWidth={1.5} opacity={0.6} />
    <Line x1="30" y1="30" x2="30" y2="10" stroke={color} strokeWidth={1.5} opacity={0.6} />
    <Line x1="30" y1="10" x2="60" y2="10" stroke={color} strokeWidth={1.5} opacity={0.6} />
    <Circle cx="60" cy="10" r="4" fill={color} opacity={0.8} />
    <Line x1="60" y1="10" x2="90" y2="10" stroke={color} strokeWidth={1.5} opacity={0.6} />
    <Line x1="90" y1="10" x2="90" y2="50" stroke={color} strokeWidth={1.5} opacity={0.6} />
    <Line x1="90" y1="50" x2="120" y2="50" stroke={color} strokeWidth={1.5} opacity={0.6} />
    <Line x1="30" y1="30" x2="60" y2="30" stroke={color} strokeWidth={1.5} opacity={0.4} />
    <Circle cx="60" cy="30" r="3" fill="none" stroke={color} strokeWidth={1.5} opacity={0.5} />
    <Line x1="60" y1="30" x2="60" y2="50" stroke={color} strokeWidth={1.5} opacity={0.4} />
    <Circle cx="60" cy="50" r="3" fill={color} opacity={0.6} />
  </Svg>
);

// ── Row toggle ────────────────────────────────────────────────────────────────
const ToggleRow: React.FC<{
  label: string; sublabel?: string; value: boolean;
  onToggle: (v: boolean) => void; color?: string;
}> = ({ label, sublabel, value, onToggle, color = Colors.lcarsOrange }) => (
  <View style={toggle.row}>
    <View style={toggle.left}>
      <Text style={toggle.label}>{label}</Text>
      {sublabel && <Text style={toggle.sub}>{sublabel}</Text>}
    </View>
    <Switch
      value={value}
      onValueChange={onToggle}
      trackColor={{ false: Colors.borderDim, true: `${color}55` }}
      thumbColor={value ? color : Colors.textMuted}
    />
  </View>
);
const toggle = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  left:  { flex: 1 },
  label: { ...Typography.labelMD, color: Colors.textPrimary },
  sub:   { ...Typography.bodySM, color: Colors.textMuted, marginTop: 2 },
});

// ── Main Screen ───────────────────────────────────────────────────────────────
export const SettingsScreen: React.FC = () => {
  const { play } = useSounds();

  // ── state ──────────────────────────────────────────────────────────────────
  const [apiKey,       setApiKeyState]  = useState('');
  const [keyMasked,    setKeyMasked]    = useState(true);
  const [keyStatus,    setKeyStatus]    = useState<KeyStatus>('unknown');
  const [aiEnabled,    setAiEnabledState] = useState(true);
  const [isTesting,    setIsTesting]    = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Load saved settings on mount
  useEffect(() => {
    const load = async () => {
      const [k, enabled] = await Promise.all([getOpenAIKey(), getAIEnabled()]);
      setApiKeyState(k);
      setAiEnabledState(enabled);
      if (k && k.length > 20) setKeyStatus('unknown');
    };
    load();
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  // ── handlers ───────────────────────────────────────────────────────────────
  const handleSaveKey = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    play('datastream');
    await setOpenAIKey(apiKey);
    setKeyStatus('unknown');
    Alert.alert('KEY SAVED', 'API key has been stored on this device.');
  };

  const handleTestKey = async () => {
    if (!apiKey || apiKey.length < 20) {
      Alert.alert('INVALID KEY', 'Please enter a valid OpenAI API key first.');
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    play('beep');
    setIsTesting(true);
    setKeyStatus('testing');
    const result = await testOpenAIKey(apiKey);
    setKeyStatus(result.ok ? 'valid' : 'invalid');
    setIsTesting(false);
    if (!result.ok) {
      Alert.alert('CONNECTION FAILED', result.error ?? 'Could not reach OpenAI API.');
    }
  };

  const handleToggleAI = async (val: boolean) => {
    play('beep');
    setAiEnabledState(val);
    await setAIEnabled(val);
  };

  const handleClearKey = () => {
    Alert.alert(
      'CLEAR API KEY',
      'Remove stored OpenAI key from this device?',
      [
        { text: 'CANCEL', style: 'cancel' },
        { text: 'CLEAR', style: 'destructive', onPress: async () => {
            play('error');
            setApiKeyState('');
            setKeyStatus('unknown');
            await setOpenAIKey('');
          },
        },
      ],
      { userInterfaceStyle: 'dark' }
    );
  };

  const maskedKey = apiKey.length > 8
    ? apiKey.slice(0, 4) + '••••••••••••' + apiKey.slice(-4)
    : apiKey;

  return (
    <View style={styles.root}>
      <StarField />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>

          <LcarsHeader
            title="COMPUTER — SETTINGS"
            subtitle="SYSTEM CONFIGURATION — V3"
            accentColor={Colors.lcarsPurple}
          />

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scroll}
          >

            {/* ── AI Core section ── */}
            <LcarsPanel
              label="▸ AI CORE — TITLE GENERATION"
              accentColor={Colors.lcarsPurple}
              style={styles.panel}
            >
              {/* Circuit graphic */}
              <View style={styles.circuitRow}>
                <CircuitGraphic color={Colors.lcarsPurple} />
                <View style={styles.circuitInfo}>
                  <Text style={styles.circuitTitle}>NEURAL NET INTERFACE</Text>
                  <Text style={styles.circuitSub}>OpenAI GPT-4o-mini</Text>
                  <Text style={styles.circuitSub}>Model: gpt-4o-mini · Tokens: 40</Text>
                </View>
              </View>

              {/* AI enabled toggle */}
              <View style={[styles.divider, { borderColor: Colors.lcarsPurple }]} />
              <ToggleRow
                label="AI TITLE GENERATION"
                sublabel="Auto-generate titles using GPT after recording"
                value={aiEnabled}
                onToggle={handleToggleAI}
                color={Colors.lcarsPurple}
              />

              {/* Key status */}
              <View style={[styles.divider, { borderColor: Colors.borderDim }]} />
              <View style={styles.statusRow}>
                <Text style={styles.statusRowLabel}>API STATUS</Text>
                <StatusPip status={keyStatus} />
              </View>

              {/* Key input */}
              <Text style={styles.fieldLabel}>OPENAI API KEY</Text>
              <View style={[styles.keyInputRow, { borderColor: Colors.lcarsPurple }]}>
                <TextInput
                  style={styles.keyInput}
                  value={keyMasked ? maskedKey : apiKey}
                  onChangeText={text => { setApiKeyState(text); setKeyStatus('unknown'); }}
                  onFocus={() => setKeyMasked(false)}
                  onBlur={() => setKeyMasked(true)}
                  placeholder="sk-proj-••••••••••••••••••••"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry={false}
                />
                <TouchableOpacity onPress={() => setKeyMasked(v => !v)} style={styles.eyeBtn}>
                  <Text style={[styles.eyeIcon, { color: Colors.lcarsPurple }]}>
                    {keyMasked ? '👁' : '🙈'}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.keyHint}>
                Your key is stored locally on this device only.{'\n'}
                Never shared with any server other than OpenAI.
              </Text>

              {/* Action buttons */}
              <View style={styles.keyActions}>
                <LcarsButton
                  label="⚡ TEST"
                  onPress={handleTestKey}
                  color={Colors.lcarsPeriwinkle}
                  variant="ghost"
                  size="sm"
                  disabled={isTesting || apiKey.length < 20}
                  style={{ flex: 1 }}
                />
                <LcarsButton
                  label="✓ SAVE KEY"
                  onPress={handleSaveKey}
                  color={Colors.lcarsPurple}
                  size="sm"
                  disabled={apiKey.length < 20}
                  style={{ flex: 1 }}
                />
                <LcarsButton
                  label="✕"
                  onPress={handleClearKey}
                  color={Colors.medicalRed}
                  variant="ghost"
                  size="sm"
                  style={{ width: 44 }}
                />
              </View>
            </LcarsPanel>

            {/* ── How it works ── */}
            <LcarsPanel
              label="▸ HOW AI TITLES WORK"
              accentColor={Colors.lcarsPeriwinkle}
              style={styles.panel}
            >
              {[
                ['1', 'Record your log entry', Colors.lcarsOrange],
                ['2', 'Whisper transcribes your voice to text', Colors.lcarsGold],
                ['3', 'GPT-4o-mini reads the transcript', Colors.lcarsPurple],
                ['4', 'A Starfleet-style title is generated', Colors.success],
                ['5', 'You can edit the title manually anytime', Colors.lcarsPeriwinkle],
              ].map(([n, desc, col]) => (
                <View key={n} style={styles.stepRow}>
                  <View style={[styles.stepNum, { backgroundColor: col as string }]}>
                    <Text style={styles.stepNumText}>{n}</Text>
                  </View>
                  <Text style={styles.stepDesc}>{desc as string}</Text>
                </View>
              ))}
            </LcarsPanel>

            {/* ── About ── */}
            <LcarsPanel
              label="▸ ABOUT TREKLOG"
              accentColor={Colors.lcarsGold}
              style={styles.panel}
            >
              <View style={styles.aboutGrid}>
                {[
                  ['APP',      'TrekLog'],
                  ['VERSION',  'V3.0.0'],
                  ['STARDATE', toStardate()],
                  ['EARTH',    formatEarthDate()],
                  ['ENGINE',   'Expo SDK 56'],
                  ['AI MODEL', 'GPT-4o-mini'],
                  ['STT',      'OpenAI Whisper'],
                  ['DB',       'expo-sqlite'],
                ].map(([k, v]) => (
                  <View key={k} style={styles.aboutItem}>
                    <Text style={styles.aboutKey}>{k}</Text>
                    <Text style={styles.aboutVal}>{v}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={styles.repoBtn}
                onPress={() => Linking.openURL('https://github.com/sandswind/TrekLog')}
              >
                <Text style={styles.repoBtnText}>⌘ VIEW ON GITHUB</Text>
              </TouchableOpacity>
            </LcarsPanel>

            {/* ── Bottom LCARS chrome ── */}
            <View style={styles.bottomChrome}>
              {([
                [Colors.lcarsPurple, 3], [Colors.lcarsPeriwinkle, 1],
                [Colors.lcarsGold, 2],   [Colors.lcarsOrange, 1],
                [Colors.lcarsTan, 2],
              ] as [string, number][]).map(([c, flex], i) => (
                <View key={i} style={[styles.chromeBlock, { backgroundColor: c, flex }]} />
              ))}
            </View>

          </ScrollView>

          <LcarsStatusBar
            stardate={`SD ${toStardate()}`}
            status={aiEnabled ? 'AI CORE — ONLINE' : 'AI CORE — OFFLINE'}
          />
        </Animated.View>
      </SafeAreaView>
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.deepSpace },
  safe:   { flex: 1 },
  scroll: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 40 },
  panel:  { marginBottom: 0 },

  // Circuit graphic row
  circuitRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm },
  circuitInfo:  { flex: 1 },
  circuitTitle: { ...Typography.labelMD, color: Colors.lcarsPurple },
  circuitSub:   { ...Typography.monoSM, color: Colors.textMuted, marginTop: 2 },

  divider: { borderTopWidth: 1, marginVertical: Spacing.sm },

  // Status row
  statusRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  statusRowLabel: { ...Typography.labelSM, color: Colors.textMuted },

  // Key input
  fieldLabel: { ...Typography.labelSM, color: Colors.textMuted, marginBottom: 6 },
  keyInputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderRadius: Radius.md,
    backgroundColor: Colors.spaceDark,
    paddingLeft: Spacing.md, height: 48,
  },
  keyInput: { flex: 1, ...Typography.monoSM, color: Colors.textPrimary, letterSpacing: 1 },
  eyeBtn:   { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  eyeIcon:  { fontSize: 16 },
  keyHint:  { ...Typography.bodySM, color: Colors.textMuted, marginTop: 8, lineHeight: 18 },
  keyActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },

  // How it works steps
  stepRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  stepNum:    { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepNumText:{ ...Typography.labelSM, color: Colors.black, fontSize: 11 },
  stepDesc:   { ...Typography.bodyMD, color: Colors.textSecondary, flex: 1 },

  // About grid
  aboutGrid:  { flexDirection: 'row', flexWrap: 'wrap' },
  aboutItem:  { width: '50%', paddingVertical: 6, paddingRight: 8 },
  aboutKey:   { ...Typography.labelSM, color: Colors.textMuted },
  aboutVal:   { ...Typography.monoSM, color: Colors.textSecondary, marginTop: 2 },
  repoBtn: {
    marginTop: Spacing.md, borderWidth: 1, borderColor: Colors.lcarsGold,
    borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center',
  },
  repoBtnText: { ...Typography.labelMD, color: Colors.lcarsGold },

  // Bottom chrome
  bottomChrome: {
    flexDirection: 'row', height: 10, gap: 2,
    borderRadius: Radius.xs, overflow: 'hidden', marginTop: Spacing.md,
  },
  chromeBlock: { borderRadius: 2 },
});
