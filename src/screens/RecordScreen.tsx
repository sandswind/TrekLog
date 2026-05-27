/**
 * RecordScreen V2 — LCARS recording interface with live STT captions
 *
 * New in V2:
 *  - useSpeechToText integration: live caption banner while recording,
 *    Whisper transcription on save
 *  - TranscriptPanel: scrolling live-caption area with blinking cursor
 *  - Whisper processing indicator during save
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Alert, TextInput, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Line } from 'react-native-svg';

import { Colors, Typography, Spacing, Radius } from '../theme';
import { StarField }          from '../components/StarField';
import { LcarsHeader }        from '../components/LcarsHeader';
import { LcarsStatusBar }     from '../components/LcarsStatusBar';
import { LcarsButton }        from '../components/LcarsButton';
import { LcarsPanel }         from '../components/LcarsPanel';
import { WaveformVisualizer } from '../components/WaveformVisualizer';
import { LogTypeSelector }    from '../components/LogTypeSelector';
import { useRecorder }        from '../hooks/useRecorder';
import { useSpeechToText }    from '../hooks/useSpeechToText';
import { useLogStore }        from '../store/useLogStore';
import { useSounds }          from '../hooks/useSounds';
import { LogType }            from '../db/schema';
import { formatEarthDate, formatDuration, toStardate } from '../utils/stardate';

// ── Constants ─────────────────────────────────────────────────────────────────
const LOG_TYPE_COLORS: Record<LogType, string> = {
  captain: Colors.captainYellow,
  personal: Colors.personalBlue,
  medical: Colors.medicalRed,
};
const LOG_LABELS: Record<LogType, string> = {
  captain: "CAPTAIN'S LOG",
  personal: 'PERSONAL LOG',
  medical: 'MEDICAL LOG',
};

// ── Sub-components ────────────────────────────────────────────────────────────

/** Pulsing record button orb */
const RecordOrb: React.FC<{
  isRecording: boolean; isPaused: boolean; onPress: () => void; color: string;
}> = ({ isRecording, isPaused, onPress, color }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isRecording && !isPaused) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.96, duration: 700, useNativeDriver: true }),
      ])).start();
      Animated.loop(
        Animated.timing(ringAnim, { toValue: 1, duration: 2000, useNativeDriver: true })
      ).start();
    } else {
      pulseAnim.stopAnimation();
      ringAnim.stopAnimation();
      Animated.spring(pulseAnim, { toValue: 1, useNativeDriver: true }).start();
      ringAnim.setValue(0);
    }
  }, [isRecording, isPaused]);

  const orbColor = isRecording && !isPaused ? Colors.lcarsPink : color;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <Animated.View style={[
        styles.orbRing,
        { borderColor: orbColor, opacity: ringAnim.interpolate({ inputRange: [0,0.5,1], outputRange: [0.8,0.2,0.8] }) },
      ]} />
      <Animated.View style={[
        styles.orb,
        { backgroundColor: orbColor, transform: [{ scale: pulseAnim }] },
      ]}>
        <Text style={styles.orbIcon}>{isRecording && !isPaused ? '⏸' : isPaused ? '▶' : '●'}</Text>
        <Text style={styles.orbLabel}>{isRecording && !isPaused ? 'PAUSE' : isPaused ? 'RESUME' : 'RECORD'}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

/** Radial level meter (sci-fi HUD element) */
const RadialMeter: React.FC<{ value: number; color: string; size?: number }> = ({ value, color, size = 100 }) => {
  const r = (size / 2) - 6;
  const circumference = 2 * Math.PI * r;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={size/2} cy={size/2} r={r} stroke={Colors.borderDim} strokeWidth={3} fill="none"
        strokeDasharray={`${circumference*0.75} ${circumference*0.25}`}
        strokeDashoffset={circumference*0.125} strokeLinecap="round" />
      <Circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={3} fill="none"
        strokeDasharray={`${circumference*0.75*value} ${circumference - circumference*0.75*value}`}
        strokeDashoffset={circumference*0.125} strokeLinecap="round"
        rotation={-135} origin={`${size/2}, ${size/2}`} />
      {[0, 0.25, 0.5, 0.75, 1].map((tick, i) => {
        const angle = -135 + tick * 270;
        const rad = (angle * Math.PI) / 180;
        const x1 = size/2 + (r-8) * Math.cos(rad);
        const y1 = size/2 + (r-8) * Math.sin(rad);
        const x2 = size/2 + (r+2) * Math.cos(rad);
        const y2 = size/2 + (r+2) * Math.sin(rad);
        return <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={1.5} opacity={0.6} />;
      })}
    </Svg>
  );
};

/**
 * Live caption panel — shown while recording.
 * Displays interim STT text with a blinking cursor and a scrolling transcript.
 */
const TranscriptPanel: React.FC<{
  interim: string;
  transcript: string;
  isProcessing: boolean;
  accentColor: string;
}> = ({ interim, transcript, isProcessing, accentColor }) => {
  const cursorAnim  = useRef(new Animated.Value(1)).current;
  const scrollRef   = useRef<ScrollView>(null);

  // Blinking cursor animation
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(cursorAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      Animated.timing(cursorAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
    ])).start();
  }, []);

  // Auto-scroll to bottom when transcript grows
  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [transcript, interim]);

  return (
    <LcarsPanel
      label="VOICE TRANSCRIPT — LIVE"
      accentColor={accentColor}
      style={styles.transcriptPanel}
      noPad
    >
      <ScrollView
        ref={scrollRef}
        style={styles.transcriptScroll}
        contentContainerStyle={styles.transcriptContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Processing indicator */}
        {isProcessing && (
          <View style={styles.processingRow}>
            <View style={[styles.processingDot, { backgroundColor: accentColor }]} />
            <Text style={[styles.processingText, { color: accentColor }]}>
              COMPUTER PROCESSING... WHISPER ANALYSIS ACTIVE
            </Text>
          </View>
        )}

        {/* Finalised transcript */}
        {transcript.length > 0 && (
          <Text style={styles.transcriptFinal}>{transcript}</Text>
        )}

        {/* Live interim text */}
        {interim.length > 0 && !isProcessing && (
          <View style={styles.interimRow}>
            <Text style={[styles.transcriptInterim, { color: accentColor }]}>
              {interim}
            </Text>
            <Animated.Text style={[styles.cursor, { opacity: cursorAnim, color: accentColor }]}>
              █
            </Animated.Text>
          </View>
        )}

        {/* Placeholder when idle */}
        {transcript.length === 0 && interim.length === 0 && !isProcessing && (
          <Text style={styles.transcriptPlaceholder}>
            AWAITING VOICE INPUT...{'\n'}
            Whisper transcription will appear here after saving.
          </Text>
        )}
      </ScrollView>

      {/* Bottom status row */}
      <View style={[styles.transcriptFooter, { borderTopColor: accentColor }]}>
        <View style={[styles.sttDot, {
          backgroundColor: isProcessing ? Colors.lcarsGold : interim ? Colors.success : Colors.textMuted,
        }]} />
        <Text style={styles.sttStatus}>
          {isProcessing ? 'WHISPER API ACTIVE' : interim ? 'STT RECEIVING' : 'STT STANDBY'}
        </Text>
        {transcript.length > 0 && (
          <Text style={styles.charCount}>{transcript.length} CHARS</Text>
        )}
      </View>
    </LcarsPanel>
  );
};

// ── Main Screen ───────────────────────────────────────────────────────────────

export const RecordScreen: React.FC = () => {
  const navigation  = useNavigation();
  const { addLog, selectedType } = useLogStore();
  const { play }    = useSounds();
  const recorder    = useRecorder();
  const stt         = useSpeechToText();

  const [logType, setLogType]   = useState<LogType>(selectedType);
  const [tags, setTags]         = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const accentColor  = LOG_TYPE_COLORS[logType];
  const isRecording  = recorder.state === 'recording';
  const isPaused     = recorder.state === 'paused';
  const hasStarted   = isRecording || isPaused;
  const avgAmp       = recorder.amplitudes.slice(15, 25).reduce((a, b) => a + b, 0) / 10;
  const isProcessing = stt.state === 'processing';

  // ── Sync recorder ↔ STT ────────────────────────────────────────────────────
  useEffect(() => {
    if (isRecording) {
      stt.startListening();
    } else if (isPaused) {
      stt.stopListening();
    }
  }, [isRecording, isPaused]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleRecordToggle = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!hasStarted) {
      play('ding');
      stt.reset();
      await recorder.start();
    } else if (isRecording) {
      play('pause');
      await recorder.pause();
    } else if (isPaused) {
      play('beep');
      await recorder.resume();
    }
  };

  const handleStop = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    play('datastream');
    stt.stopListening();

    const result = await recorder.stop();
    if (!result) return;

    setIsSaving(true);
    try {
      // Run Whisper transcription (no-ops if key is placeholder)
      const finalTranscript = await stt.transcribeAudio(result.uri);

      const parsedTags = tags
        .split(/[,，\s]+/)
        .map(t => t.trim().replace(/^#/, ''))
        .filter(Boolean);

      await addLog({
        logType,
        audioUri: result.uri,
        durationSecs: result.durationSecs,
        tags: parsedTags,
        transcript: finalTranscript || undefined,
      });

      navigation.goBack();
    } catch (e) {
      Alert.alert('SAVE FAILED', 'Unable to save log entry. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    play('error');
    Alert.alert(
      'DISCARD RECORDING',
      'This log entry will be lost. Are you certain, Captain?',
      [
        { text: 'CANCEL', style: 'cancel' },
        { text: 'DISCARD', style: 'destructive', onPress: async () => {
            stt.reset();
            await recorder.discard();
            navigation.goBack();
          },
        },
      ],
      { userInterfaceStyle: 'dark' }
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <StarField />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

            {/* ── Header ── */}
            <LcarsHeader
              title={LOG_LABELS[logType]}
              subtitle="NEW ENTRY — RECORD MODE"
              accentColor={accentColor}
            />

            {/* ── Stardate block ── */}
            <View style={[styles.stardateBlock, { borderColor: accentColor }]}>
              <View style={[styles.sdPill, { backgroundColor: accentColor }]}>
                <Text style={styles.sdPillText}>SD</Text>
              </View>
              <View style={styles.sdInfo}>
                <Text style={[styles.sdNumber, { color: accentColor }]}>{toStardate()}</Text>
                <Text style={styles.sdEarth}>{formatEarthDate()}</Text>
              </View>
              <View style={styles.sdBadge}>
                <Text style={styles.sdBadgeText}>SUPPLEMENTAL</Text>
              </View>
            </View>

            {/* ── Log type selector (only before recording) ── */}
            {!hasStarted && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>LOG CLASSIFICATION</Text>
                <LogTypeSelector selected={logType} onChange={setLogType} />
              </View>
            )}

            {/* ── HUD ── */}
            <View style={styles.hudRow}>
              <RadialMeter value={avgAmp} color={accentColor} size={90} />
              <View style={styles.hudCenter}>
                <WaveformVisualizer
                  isActive={isRecording}
                  amplitudes={recorder.amplitudes}
                  color={accentColor}
                  height={70}
                />
                <Text style={[styles.timer, { color: accentColor }]}>
                  {formatDuration(recorder.durationSecs)}
                </Text>
                {hasStarted && (
                  <View style={styles.stateRow}>
                    <View style={[styles.recDot, {
                      backgroundColor: isRecording ? Colors.lcarsPink : Colors.lcarsGold,
                    }]} />
                    <Text style={styles.stateText}>
                      {isRecording ? 'RECORDING IN PROGRESS' : 'TRANSMISSION PAUSED'}
                    </Text>
                  </View>
                )}
              </View>
              <View style={{ transform: [{ scaleX: -1 }] }}>
                <RadialMeter value={avgAmp * 0.8} color={Colors.lcarsPeriwinkle} size={90} />
              </View>
            </View>

            {/* ── Record orb ── */}
            <View style={styles.orbContainer}>
              <RecordOrb
                isRecording={isRecording}
                isPaused={isPaused}
                onPress={handleRecordToggle}
                color={accentColor}
              />
            </View>

            {/* ── Live transcript panel (shown after recording starts) ── */}
            {hasStarted && (
              <View style={styles.section}>
                <TranscriptPanel
                  interim={stt.interim}
                  transcript={stt.transcript}
                  isProcessing={isProcessing}
                  accentColor={accentColor}
                />
              </View>
            )}

            {/* ── Save / Discard ── */}
            {hasStarted && (
              <View style={styles.actionRow}>
                <LcarsButton
                  label="✕  DISCARD"
                  onPress={handleDiscard}
                  color={Colors.lcarsPink}
                  variant="ghost"
                  size="md"
                  style={{ flex: 1 }}
                />
                <LcarsButton
                  label={isSaving ? (isProcessing ? 'TRANSCRIBING...' : 'SAVING...') : '✓  SAVE LOG'}
                  onPress={handleStop}
                  color={accentColor}
                  size="md"
                  disabled={isSaving}
                  style={{ flex: 1 }}
                />
              </View>
            )}

            {/* ── Tags input ── */}
            {hasStarted && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>TAGS (OPTIONAL)</Text>
                <View style={[styles.tagInput, { borderColor: accentColor }]}>
                  <Text style={[styles.tagHash, { color: accentColor }]}>#</Text>
                  <TextInput
                    style={styles.tagInputField}
                    placeholder="work, idea, mission..."
                    placeholderTextColor={Colors.textMuted}
                    value={tags}
                    onChangeText={setTags}
                  />
                </View>
              </View>
            )}

            {/* ── Bottom chrome ── */}
            <View style={styles.bottomChrome}>
              {[Colors.lcarsOrange, Colors.lcarsPurple, Colors.lcarsPeriwinkle, Colors.lcarsGold].map((c, i) => (
                <View key={i} style={[styles.chromeBlock, { backgroundColor: c, flex: i === 0 ? 3 : 1 }]} />
              ))}
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
        <LcarsStatusBar isRecording={isRecording} stardate={`SD ${toStardate()}`} />
      </SafeAreaView>
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.deepSpace },
  safe: { flex: 1 },
  scroll: { paddingBottom: 32 },

  // Stardate block
  stardateBlock: { flexDirection: 'row', alignItems: 'center', margin: Spacing.md, borderWidth: 1, borderRadius: Radius.md, overflow: 'hidden', backgroundColor: Colors.overlay20 },
  sdPill:   { width: 36, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md },
  sdPillText: { ...Typography.labelSM, color: Colors.black },
  sdInfo:   { flex: 1, padding: Spacing.md },
  sdNumber: { ...Typography.stardateXL },
  sdEarth:  { ...Typography.labelSM, color: Colors.textSecondary, marginTop: 2 },
  sdBadge:  { paddingHorizontal: Spacing.md, paddingVertical: 4, marginRight: Spacing.sm, borderWidth: 1, borderColor: Colors.textMuted, borderRadius: Radius.xs },
  sdBadgeText: { ...Typography.labelSM, color: Colors.textMuted },

  section:      { marginHorizontal: Spacing.md, marginTop: Spacing.md },
  sectionLabel: { ...Typography.labelSM, color: Colors.textMuted, marginBottom: 6 },

  // HUD
  hudRow:   { flexDirection: 'row', alignItems: 'center', marginHorizontal: Spacing.md, marginTop: Spacing.md },
  hudCenter:{ flex: 1, alignItems: 'center' },
  timer:    { ...Typography.monoLG, fontSize: 28, fontWeight: '900', letterSpacing: 4, marginTop: 6 },
  stateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  recDot:   { width: 8, height: 8, borderRadius: 4 },
  stateText:{ ...Typography.labelSM, color: Colors.textSecondary },

  // Orb
  orbContainer: { alignItems: 'center', marginTop: Spacing.xl, marginBottom: Spacing.lg },
  orbRing: { position: 'absolute', width: 136, height: 136, borderRadius: 68, borderWidth: 2, top: -8, left: -8 },
  orb: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', elevation: 12, shadowColor: Colors.lcarsPink, shadowOffset: { width: 0, height: 0 }, shadowRadius: 20, shadowOpacity: 0.6 },
  orbIcon:  { fontSize: 28, color: Colors.black },
  orbLabel: { ...Typography.labelSM, color: Colors.black, marginTop: 2 },

  // Transcript panel
  transcriptPanel: { minHeight: 120 },
  transcriptScroll:{ maxHeight: 160 },
  transcriptContent: { padding: Spacing.md, paddingBottom: Spacing.sm },
  processingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.sm },
  processingDot: { width: 8, height: 8, borderRadius: 4 },
  processingText:{ ...Typography.monoSM, letterSpacing: 1 },
  transcriptFinal:   { ...Typography.bodyMD, color: Colors.textPrimary, lineHeight: 22, marginBottom: 4 },
  interimRow:        { flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap' },
  transcriptInterim: { ...Typography.bodyMD, lineHeight: 22, fontStyle: 'italic' },
  cursor:            { fontSize: 14, marginLeft: 1 },
  transcriptPlaceholder: { ...Typography.monoSM, color: Colors.textMuted, textAlign: 'center', paddingVertical: Spacing.md, lineHeight: 20 },
  transcriptFooter: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 6, borderTopWidth: 1, gap: 8 },
  sttDot:   { width: 6, height: 6, borderRadius: 3 },
  sttStatus:{ ...Typography.monoSM, color: Colors.textMuted, flex: 1 },
  charCount:{ ...Typography.monoSM, color: Colors.textMuted },

  // Actions
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginHorizontal: Spacing.md, marginTop: Spacing.md },

  // Tags
  tagInput: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: Radius.md, backgroundColor: Colors.spacePanel, paddingHorizontal: Spacing.md, height: 44 },
  tagHash:  { ...Typography.labelLG, marginRight: 6 },
  tagInputField: { flex: 1, ...Typography.bodyMD, color: Colors.textPrimary },

  // Bottom chrome
  bottomChrome: { flexDirection: 'row', height: 12, gap: 2, marginHorizontal: Spacing.md, marginTop: Spacing.xl, borderRadius: Radius.xs, overflow: 'hidden' },
  chromeBlock:  { borderRadius: 2 },
});
