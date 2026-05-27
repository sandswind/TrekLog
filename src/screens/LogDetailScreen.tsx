/**
 * LogDetailScreen V3 — adds AI title generation + inline title editing
 *
 * New in V3:
 *  - "AI GENERATE TITLE" button in the LOG TITLE panel
 *  - Inline editable title (tap to edit, confirm/cancel)
 *  - AITitlePanel: shows generation state + result + edit flow
 *  - Calls updateLogTitle() + store.loadLogs() to persist
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Alert, ScrollView, Dimensions, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

import { Colors, Typography, Spacing, Radius } from '../theme';
import { StarField }          from '../components/StarField';
import { LcarsHeader }        from '../components/LcarsHeader';
import { LcarsPanel }         from '../components/LcarsPanel';
import { LcarsStatusBar }     from '../components/LcarsStatusBar';
import { LcarsButton }        from '../components/LcarsButton';
import { WaveformVisualizer } from '../components/WaveformVisualizer';
import { usePlayer }          from '../hooks/usePlayer';
import { useLogStore }        from '../store/useLogStore';
import { LogEntry, LogType }  from '../db/schema';
import { useSounds }          from '../hooks/useSounds';
import { useAITitle }         from '../hooks/useAITitle';
import { updateLogTitle }     from '../db/database';
import { formatEarthDate, formatDuration } from '../utils/stardate';
import type { RootStackParamList } from '../../App';

const { width: W } = Dimensions.get('window');

const LOG_TYPE_COLORS: Record<LogType, string> = {
  captain: Colors.captainYellow, personal: Colors.personalBlue, medical: Colors.medicalRed,
};
const LOG_TYPE_LABELS: Record<LogType, string> = {
  captain: "CAPTAIN'S LOG", personal: 'PERSONAL LOG', medical: 'MEDICAL LOG',
};


// ── Playback seek bar ─────────────────────────────────────────────────────────
const PlaybackBar: React.FC<{
  progress: number; positionSecs: number; durationSecs: number;
  onSeek: (s: number) => void; color: string;
}> = ({ progress, positionSecs, durationSecs, onSeek, color }) => {
  const barWidth = W - Spacing.md * 2 - 32;
  return (
    <View style={pbS.container}>
      <View
        style={pbS.track}
        onStartShouldSetResponder={() => true}
        onResponderGrant={e => {
          const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / barWidth));
          onSeek(ratio * durationSecs);
        }}
      >
        <View style={[pbS.fill, { width: `${Math.min(100, progress * 100)}%`, backgroundColor: color }]} />
        <View style={[pbS.head, { left: `${Math.min(99, progress * 100)}%`, backgroundColor: color }]} />
      </View>
      <View style={pbS.times}>
        <Text style={pbS.time}>{formatDuration(positionSecs)}</Text>
        <Text style={pbS.time}>{formatDuration(durationSecs)}</Text>
      </View>
    </View>
  );
};
const pbS = StyleSheet.create({
  container: { marginTop: Spacing.sm },
  track: { height: 4, backgroundColor: Colors.borderDim, borderRadius: 2, position: 'relative', overflow: 'visible' },
  fill:  { height: '100%', borderRadius: 2 },
  head:  { position: 'absolute', top: -5, width: 14, height: 14, borderRadius: 7, marginLeft: -7 },
  times: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  time:  { ...Typography.monoSM, color: Colors.textMuted },
});


// ── Starfleet emblem SVG ──────────────────────────────────────────────────────
const StarfleetEmblem: React.FC<{ color: string; size?: number }> = ({ color, size = 60 }) => (
  <Svg width={size} height={size} viewBox="0 0 60 60">
    <Path d="M30 4 L54 18 L54 38 Q54 52 30 58 Q6 52 6 38 L6 18 Z"
      stroke={color} strokeWidth={2} fill="none" opacity={0.8} />
    <Path d="M30 14 L42 30 L36 30 L36 46 L24 46 L24 30 L18 30 Z"
      fill={color} opacity={0.7} />
    <Path d="M30 4 L30 14" stroke={color} strokeWidth={1.5} opacity={0.5} />
  </Svg>
);

// ── AI Title Panel ────────────────────────────────────────────────────────────
/**
 * Shows current title with:
 *   • Inline edit mode (tap the title text)
 *   • "AI GENERATE" button — calls GPT, previews result, confirm/reject
 *   • State badges: GENERATING… / DONE / ERROR / NO KEY
 */
const AITitlePanel: React.FC<{
  entry:       LogEntry;
  accentColor: string;
  onTitleSaved: (newTitle: string) => void;
}> = ({ entry, accentColor, onTitleSaved }) => {
  const { play }  = useSounds();
  const aiTitle   = useAITitle();

  const [editMode,   setEditMode]   = useState(false);
  const [editText,   setEditText]   = useState(entry.title);
  const [isSaving,   setIsSaving]   = useState(false);
  const [aiPreview,  setAiPreview]  = useState<string | null>(null);
  // Sync editText when entry.title changes from outside
  useEffect(() => { setEditText(entry.title); }, [entry.title]);

  const tags: string[] = (() => { try { return JSON.parse(entry.tags || '[]'); } catch { return []; } })();

  // ── generate AI title ────────────────────────────────────────────────────
  const handleGenerate = async () => {
    play('datastream');
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!entry.transcript) {
      Alert.alert(
        'NO TRANSCRIPT',
        'AI title generation requires a voice transcript.\n\nRecord a new entry with Whisper enabled to use this feature.',
      );
      return;
    }
    setAiPreview(null);
    const result = await aiTitle.generate({
      transcript: entry.transcript,
      logType:    entry.logType,
      stardate:   entry.stardate,
      tags,
    });
    if (result) {
      setAiPreview(result);
    } else if (aiTitle.state === 'no_key') {
      Alert.alert(
        'API KEY REQUIRED',
        'Configure your OpenAI API key in Settings → AI Core to enable title generation.',
      );
    } else if (aiTitle.state === 'error') {
      Alert.alert('GENERATION FAILED', aiTitle.errorMessage || 'Check your API key and network.');
    }
  };


  // ── accept AI preview ────────────────────────────────────────────────────
  const handleAcceptAI = async () => {
    if (!aiPreview) return;
    play('beep');
    setIsSaving(true);
    await updateLogTitle(entry.id, aiPreview);
    onTitleSaved(aiPreview);
    setAiPreview(null);
    aiTitle.reset();
    setIsSaving(false);
  };

  // ── save manual edit ─────────────────────────────────────────────────────
  const handleSaveEdit = async () => {
    if (!editText.trim()) return;
    play('beep');
    setIsSaving(true);
    await updateLogTitle(entry.id, editText.trim());
    onTitleSaved(editText.trim());
    setEditMode(false);
    setIsSaving(false);
  };

  const isGenerating = aiTitle.state === 'generating';

  return (
    <LcarsPanel label="LOG TITLE" accentColor={accentColor} style={panelS.panel}>

      {/* ── Current title (or edit input) ── */}
      {editMode ? (
        <View style={panelS.editBox}>
          <TextInput
            style={[panelS.editInput, { borderColor: accentColor }]}
            value={editText}
            onChangeText={setEditText}
            multiline
            autoFocus
            placeholderTextColor={Colors.textMuted}
          />
          <View style={panelS.editActions}>
            <LcarsButton label="✕ CANCEL" onPress={() => { setEditMode(false); setEditText(entry.title); }}
              color={Colors.textMuted} variant="ghost" size="sm" style={{ flex: 1 }} />
            <LcarsButton label={isSaving ? '...' : '✓ SAVE'} onPress={handleSaveEdit}
              color={accentColor} size="sm" disabled={isSaving || !editText.trim()} style={{ flex: 1 }} />
          </View>
        </View>
      ) : (
        <TouchableOpacity onPress={() => setEditMode(true)} activeOpacity={0.7}>
          <Text style={panelS.titleText}>{entry.title}</Text>
          <Text style={panelS.editHint}>TAP TO EDIT</Text>
        </TouchableOpacity>
      )}

      {/* ── AI preview banner ── */}
      {aiPreview && !editMode && (
        <View style={[panelS.previewBox, { borderColor: Colors.lcarsPurple }]}>
          <View style={panelS.previewHeader}>
            <View style={[panelS.aiBadge, { backgroundColor: Colors.lcarsPurple }]}>
              <Text style={panelS.aiBadgeText}>AI GENERATED</Text>
            </View>
            <TouchableOpacity onPress={() => { setAiPreview(null); aiTitle.reset(); }}>
              <Text style={panelS.previewDismiss}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={[panelS.previewTitle, { color: Colors.lcarsPurple }]}>{aiPreview}</Text>
          <View style={panelS.previewActions}>
            <LcarsButton label="✕ REJECT" onPress={() => { setAiPreview(null); aiTitle.reset(); }}
              color={Colors.medicalRed} variant="ghost" size="sm" style={{ flex: 1 }} />
            <LcarsButton label={isSaving ? 'SAVING...' : '✓ ACCEPT'} onPress={handleAcceptAI}
              color={Colors.lcarsPurple} size="sm" disabled={isSaving} style={{ flex: 1 }} />
          </View>
        </View>
      )}

      {/* ── AI Generate button ── */}
      {!editMode && !aiPreview && (
        <View style={panelS.genRow}>
          <LcarsButton
            label={isGenerating ? '✦ GENERATING...' : '✦ AI GENERATE TITLE'}
            onPress={handleGenerate}
            color={Colors.lcarsPurple}
            variant="ghost"
            size="sm"
            disabled={isGenerating}
            style={{ flex: 1 }}
          />
          {isGenerating && (
            <View style={[panelS.genDot, { backgroundColor: Colors.lcarsPurple }]} />
          )}
        </View>
      )}

      {/* Error state */}
      {aiTitle.state === 'error' && !aiPreview && (
        <Text style={panelS.errorText}>⚠ {aiTitle.errorMessage}</Text>
      )}
    </LcarsPanel>
  );
};

const panelS = StyleSheet.create({
  panel: { marginBottom: 0 },
  titleText: { ...Typography.bodyLG, color: Colors.textPrimary, lineHeight: 24, fontStyle: 'italic' },
  editHint:  { ...Typography.labelSM, color: Colors.textMuted, marginTop: 4, fontSize: 9 },
  editBox:   { gap: Spacing.sm },
  editInput: {
    ...Typography.bodyLG, color: Colors.textPrimary,
    borderWidth: 1.5, borderRadius: Radius.md,
    backgroundColor: Colors.spaceDark,
    padding: Spacing.md, minHeight: 72, lineHeight: 24,
  },
  editActions: { flexDirection: 'row', gap: Spacing.sm },
  previewBox: {
    marginTop: Spacing.sm, borderWidth: 1.5,
    borderRadius: Radius.md, padding: Spacing.md,
    backgroundColor: `${Colors.lcarsPurple}11`,
  },
  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  aiBadge:       { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.xs },
  aiBadgeText:   { ...Typography.labelSM, color: Colors.black, fontSize: 9 },
  previewDismiss:{ ...Typography.labelMD, color: Colors.textMuted },
  previewTitle:  { ...Typography.bodyLG, fontWeight: '700', lineHeight: 26, marginBottom: Spacing.sm },
  previewActions:{ flexDirection: 'row', gap: Spacing.sm },
  genRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  genDot:    { width: 8, height: 8, borderRadius: 4 },
  errorText: { ...Typography.bodySM, color: Colors.medicalRed, marginTop: 6, lineHeight: 18 },
});


// ── Main Screen ───────────────────────────────────────────────────────────────
type RouteProps = RouteProp<RootStackParamList, 'LogDetail'>;

export const LogDetailScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route      = useRoute<RouteProps>();
  const { entryId } = route.params;

  const { entries, removeLog, loadLogs } = useLogStore();
  const { play }  = useSounds();
  const player    = usePlayer();

  const [entry, setEntry]     = useState<LogEntry | null>(null);
  const [localTitle, setLocalTitle] = useState('');  // V3: local optimistic title update
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Sync entry from store
  useEffect(() => {
    const found = entries.find(e => e.id === entryId) ?? null;
    setEntry(found);
    if (found) setLocalTitle(found.title);
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, [entryId, entries]);

  // Load audio when entry changes
  useEffect(() => {
    if (entry?.audioUri) player.load(entry.audioUri);
    return () => { player.unload(); };
  }, [entry?.audioUri]);

  if (!entry) {
    return (
      <View style={styles.root}>
        <StarField />
        <SafeAreaView style={styles.safe}>
          <Text style={styles.notFound}>LOG ENTRY NOT FOUND</Text>
        </SafeAreaView>
      </View>
    );
  }

  const accentColor = LOG_TYPE_COLORS[entry.logType];
  const tags: string[]  = (() => { try { return JSON.parse(entry.tags || '[]'); } catch { return []; } })();
  const createdAt   = new Date(entry.createdAt);
  const isPlaying   = player.state === 'playing';

  // V3: when title is saved, update local state + refresh store
  const handleTitleSaved = async (newTitle: string) => {
    setLocalTitle(newTitle);
    // Refresh store so HomeScreen / Timeline also see updated title
    await loadLogs();
  };

  const handlePlayPause = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isPlaying) { play('pause'); await player.pause(); }
    else           { play('beep');  await player.play();  }
  };

  // Build a "live" entry with the optimistic title for display
  const displayEntry: LogEntry = { ...entry, title: localTitle || entry.title };

  return (
    <View style={styles.root}>
      <StarField />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>

          <LcarsHeader
            title={LOG_TYPE_LABELS[entry.logType]}
            subtitle="LOG PLAYBACK — ARCHIVE ACCESS"
            accentColor={accentColor}
            rightLabel={`SD ${entry.stardate}`}
          />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

            {/* Hero row */}
            <View style={styles.heroRow}>
              <StarfleetEmblem color={accentColor} size={70} />
              <View style={styles.heroInfo}>
                <Text style={[styles.heroStardate, { color: accentColor }]}>STARDATE {entry.stardate}</Text>
                <Text style={styles.heroEarth}>{formatEarthDate(createdAt)}</Text>
                <Text style={styles.heroTime}>{createdAt.toLocaleTimeString('en-US', { hour12: false })} HRS</Text>
              </View>
              <View style={styles.heroRight}>
                {entry.isFirstOfDay && (
                  <View style={[styles.firstBadge, { borderColor: accentColor }]}>
                    <Text style={[styles.firstBadgeText, { color: accentColor }]}>FIRST ENTRY</Text>
                  </View>
                )}
                <Text style={styles.logTypeTag}>{LOG_TYPE_LABELS[entry.logType]}</Text>
              </View>
            </View>

            {/* V3: AI Title Panel */}
            <AITitlePanel
              entry={displayEntry}
              accentColor={accentColor}
              onTitleSaved={handleTitleSaved}
            />

            {/* Playback panel */}
            <LcarsPanel label="AUDIO PLAYBACK" accentColor={Colors.lcarsPeriwinkle} style={styles.panel}>
              <WaveformVisualizer isActive={isPlaying} color={accentColor} height={60} />
              <PlaybackBar
                progress={player.progress}
                positionSecs={player.positionSecs}
                durationSecs={entry.durationSecs}
                onSeek={player.seekTo}
                color={accentColor}
              />
              <View style={styles.controlsRow}>
                <LcarsButton label="« 10"
                  onPress={() => player.seekTo(Math.max(0, player.positionSecs - 10))}
                  color={Colors.lcarsPeriwinkle} variant="ghost" size="sm" />
                <LcarsButton
                  label={isPlaying ? '⏸  PAUSE' : '▶  PLAY'}
                  onPress={handlePlayPause}
                  color={accentColor} size="lg" style={{ minWidth: 140 }}
                  disabled={player.state === 'loading'} />
                <LcarsButton label="10 »"
                  onPress={() => player.seekTo(Math.min(entry.durationSecs, player.positionSecs + 10))}
                  color={Colors.lcarsPeriwinkle} variant="ghost" size="sm" />
              </View>
              <View style={styles.durationRow}>
                <Text style={styles.durationLabel}>DURATION</Text>
                <Text style={[styles.durationValue, { color: accentColor }]}>{formatDuration(entry.durationSecs)}</Text>
              </View>
            </LcarsPanel>

            {/* Transcript */}
            {entry.transcript && (
              <LcarsPanel label="VOICE TRANSCRIPT" accentColor={Colors.lcarsGold} style={styles.panel}>
                <Text style={styles.transcript}>{entry.transcript}</Text>
              </LcarsPanel>
            )}

            {/* Tags */}
            {tags.length > 0 && (
              <LcarsPanel label="CLASSIFICATION TAGS" accentColor={Colors.lcarsTan} style={styles.panel}>
                <View style={styles.tagsWrap}>
                  {tags.map(tag => (
                    <View key={tag} style={styles.tagChip}>
                      <Text style={styles.tagText}># {tag}</Text>
                    </View>
                  ))}
                </View>
              </LcarsPanel>
            )}

            {/* Metadata */}
            <LcarsPanel label="ENTRY METADATA" accentColor={Colors.textMuted} style={styles.panel}>
              <View style={styles.metaGrid}>
                {[
                  ['LOG TYPE', LOG_TYPE_LABELS[entry.logType]],
                  ['STARDATE', entry.stardate],
                  ['EARTH DATE', formatEarthDate(createdAt)],
                  ['DURATION', formatDuration(entry.durationSecs)],
                  ['ENTRY ID', entry.id.split('-')[0].toUpperCase()],
                  ['STATUS', 'ARCHIVED'],
                ].map(([k, v]) => (
                  <View key={k} style={styles.metaItem}>
                    <Text style={styles.metaKey}>{k}</Text>
                    <Text style={styles.metaVal}>{v}</Text>
                  </View>
                ))}
              </View>
            </LcarsPanel>

            {/* Delete */}
            <View style={styles.deleteRow}>
              <LcarsButton
                label="⚠  DELETE LOG ENTRY"
                onPress={() => {
                  play('error');
                  Alert.alert(
                    'DELETE LOG ENTRY',
                    `Permanently delete log from Stardate ${entry.stardate}?`,
                    [
                      { text: 'CANCEL', style: 'cancel' },
                      { text: 'DELETE', style: 'destructive', onPress: async () => {
                          await removeLog(entry.id, entry.audioUri);
                          navigation.goBack();
                        },
                      },
                    ],
                    { userInterfaceStyle: 'dark' }
                  );
                }}
                color={Colors.medicalRed}
                variant="ghost"
                size="md"
                style={{ flex: 1 }}
              />
            </View>

            <View style={styles.bottomChrome}>
              {[3, 1, 2, 1, 4].map((flex, i) => (
                <View key={i} style={[styles.chromeBlock, {
                  flex,
                  backgroundColor: [
                    Colors.lcarsOrange, Colors.lcarsPurple,
                    Colors.lcarsPeriwinkle, Colors.lcarsGold, Colors.lcarsTan,
                  ][i],
                }]} />
              ))}
            </View>

          </ScrollView>

          <LcarsStatusBar stardate={`SD ${entry.stardate}`} />
        </Animated.View>
      </SafeAreaView>
    </View>
  );
};


// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.deepSpace },
  safe: { flex: 1 },
  scroll: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 40 },
  notFound: { ...Typography.displayMD, color: Colors.lcarsPink, padding: Spacing.xl },
  heroRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.overlay20, padding: Spacing.md,
    borderRadius: Radius.md, marginBottom: Spacing.xs,
  },
  heroInfo:      { flex: 1 },
  heroStardate:  { ...Typography.stardateXL, fontSize: 18, lineHeight: 24 },
  heroEarth:     { ...Typography.labelMD, color: Colors.textSecondary, marginTop: 2 },
  heroTime:      { ...Typography.monoSM, color: Colors.textMuted, marginTop: 2 },
  heroRight:     { alignItems: 'flex-end', gap: 6 },
  firstBadge:    { borderWidth: 1, borderRadius: Radius.xs, paddingHorizontal: 8, paddingVertical: 3 },
  firstBadgeText:{ ...Typography.labelSM, fontSize: 9 },
  logTypeTag:    { ...Typography.labelSM, color: Colors.textMuted, fontSize: 9 },
  panel:         { marginBottom: 0 },
  controlsRow:   {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: Spacing.sm, marginTop: Spacing.md,
  },
  durationRow:   { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.sm },
  durationLabel: { ...Typography.labelSM, color: Colors.textMuted },
  durationValue: { ...Typography.monoMD },
  transcript:    { ...Typography.bodyMD, color: Colors.textSecondary, lineHeight: 22, fontStyle: 'italic' },
  tagsWrap:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip:       { borderWidth: 1, borderColor: Colors.lcarsTan, borderRadius: Radius.xs, paddingHorizontal: 10, paddingVertical: 4 },
  tagText:       { ...Typography.labelSM, color: Colors.lcarsTan },
  metaGrid:      { flexDirection: 'row', flexWrap: 'wrap' },
  metaItem:      { width: '50%', paddingVertical: 6, paddingRight: 8 },
  metaKey:       { ...Typography.labelSM, color: Colors.textMuted },
  metaVal:       { ...Typography.monoSM, color: Colors.textSecondary, marginTop: 2 },
  deleteRow:     { flexDirection: 'row', marginTop: Spacing.sm },
  bottomChrome:  { flexDirection: 'row', height: 10, gap: 2, borderRadius: Radius.xs, overflow: 'hidden', marginTop: Spacing.md },
  chromeBlock:   { borderRadius: 2 },
});
