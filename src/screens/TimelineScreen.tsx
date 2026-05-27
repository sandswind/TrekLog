/**
 * TimelineScreen V2 — LCARS stellar-cartography timeline view
 *
 * Design concept:
 *   All log entries across all types shown on a vertical "starship mission log"
 *   timeline. Each day is a "waypoint" node on the vertical spine; entries hang
 *   off it like sensor contacts. Animated entrance, LCARS chrome on both sides.
 *
 *   ┌─────────────────────────────┐
 *   │  LCARS HEADER               │
 *   │  SD 63147.2 ─── 2026•MAY    │
 *   │                             │
 *   │  ◆─── 2026-05-27 ───────    │  ← day waypoint
 *   │  │  ┌─────────────────────┐ │
 *   │  │  │ Captain's Log       │ │  ← entry card
 *   │  │  │ SD 63147.2  01:23   │ │
 *   │  │  └─────────────────────┘ │
 *   │  │                          │
 *   │  ◆─── 2026-05-26 ───────    │
 *   │  │  ...                     │
 */

import React, { useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Animated, Dimensions, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Line, Circle, Path } from 'react-native-svg';

import { Colors, Typography, Spacing, Radius } from '../theme';
import { StarField }       from '../components/StarField';
import { LcarsHeader }     from '../components/LcarsHeader';
import { LcarsStatusBar }  from '../components/LcarsStatusBar';
import { useLogStore }     from '../store/useLogStore';
import { LogEntry, LogType } from '../db/schema';
import {
  stardateLabel, formatEarthDate, formatEarthDateShort,
  formatDuration, toStardate,
} from '../utils/stardate';
import { useSounds } from '../hooks/useSounds';
import type { RootStackParamList } from '../../App';

const { width: W } = Dimensions.get('window');

// ── Constants ──────────────────────────────────────────────────────────────────
const LOG_TYPE_COLORS: Record<LogType, string> = {
  captain:  Colors.captainYellow,
  personal: Colors.personalBlue,
  medical:  Colors.medicalRed,
};
const LOG_TYPE_LABELS: Record<LogType, string> = {
  captain:  "CAP",
  personal: "PER",
  medical:  "MED",
};

const SPINE_X    = 28;   // x-position of the vertical timeline spine
const CARD_LEFT  = 56;   // card starts to the right of the spine

// ── Entry card (hangs off timeline spine) ─────────────────────────────────────
const TimelineCard: React.FC<{
  entry:       LogEntry;
  isLast:      boolean;
  onPress:     () => void;
  index:       number;
}> = ({ entry, isLast, onPress, index }) => {
  const slideAnim   = useRef(new Animated.Value(40)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim,   { toValue: 0, duration: 320, delay: index * 45, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 320, delay: index * 45, useNativeDriver: true }),
    ]).start();
  }, []);

  const color        = LOG_TYPE_COLORS[entry.logType];
  const createdAt    = new Date(entry.createdAt);
  const timeStr      = createdAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const tags: string[] = JSON.parse(entry.tags || '[]');

  return (
    <Animated.View style={[
      styles.cardWrapper,
      { opacity: opacityAnim, transform: [{ translateX: slideAnim }] },
    ]}>
      {/* Horizontal connector from spine to card */}
      <View style={styles.connectorLine} />
      {/* Connector dot */}
      <View style={[styles.connectorDot, { backgroundColor: color }]} />

      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.card}>
        {/* Left accent stripe */}
        <View style={[styles.cardStripe, { backgroundColor: color }]} />

        <View style={styles.cardBody}>
          {/* Type badge + time */}
          <View style={styles.cardMeta}>
            <View style={[styles.typeBadge, { backgroundColor: color }]}>
              <Text style={styles.typeBadgeText}>{LOG_TYPE_LABELS[entry.logType]}</Text>
            </View>
            <Text style={styles.cardTime}>{timeStr} HRS</Text>
            <Text style={styles.cardStardate}>SD {entry.stardate}</Text>
            <View style={styles.cardMetaRight}>
              <Text style={[styles.durationText, { color }]}>{formatDuration(entry.durationSecs)}</Text>
            </View>
          </View>

          {/* Title */}
          <Text style={styles.cardTitle} numberOfLines={2}>{entry.title}</Text>

          {/* Transcript preview */}
          {entry.transcript ? (
            <Text style={styles.cardTranscript} numberOfLines={2}>
              "{entry.transcript}"
            </Text>
          ) : null}

          {/* Tags */}
          {tags.length > 0 && (
            <View style={styles.tagsRow}>
              {tags.slice(0, 4).map(tag => (
                <View key={tag} style={[styles.tagChip, { borderColor: color }]}>
                  <Text style={[styles.tagText, { color }]}>#{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ── Day waypoint header ────────────────────────────────────────────────────────
const DayWaypoint: React.FC<{ date: string; count: number; isFirst: boolean }> = ({
  date, count, isFirst,
}) => {
  const d         = new Date(date + 'T12:00:00');
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }).start();
  }, []);

  return (
    <View style={styles.waypointRow}>
      {/* Diamond node on spine */}
      <Animated.View style={[styles.waypointDiamond, { transform: [{ scale: scaleAnim }] }]}>
        <Svg width={20} height={20} viewBox="0 0 20 20">
          <Path
            d="M10 1 L19 10 L10 19 L1 10 Z"
            fill={Colors.lcarsOrange}
            stroke={Colors.lcarsGold}
            strokeWidth={1}
          />
        </Svg>
      </Animated.View>

      {/* Date labels */}
      <View style={styles.waypointInfo}>
        <Text style={styles.waypointEarth}>{formatEarthDateShort(d)}</Text>
        <Text style={styles.waypointStardate}>{stardateLabel(d)}</Text>
      </View>

      {/* Entry count badge */}
      <View style={styles.waypointCount}>
        <Text style={styles.waypointCountText}>{count}</Text>
        <Text style={styles.waypointCountLabel}>ENTR{count === 1 ? 'Y' : 'IES'}</Text>
      </View>
    </View>
  );
};

// ── Stats header bar ───────────────────────────────────────────────────────────
const TimelineStats: React.FC<{ allEntries: LogEntry[] }> = ({ allEntries }) => {
  const byType = {
    captain:  allEntries.filter(e => e.logType === 'captain').length,
    personal: allEntries.filter(e => e.logType === 'personal').length,
    medical:  allEntries.filter(e => e.logType === 'medical').length,
  };
  const totalSecs = allEntries.reduce((s, e) => s + e.durationSecs, 0);
  const hours = Math.floor(totalSecs / 3600);
  const mins  = Math.floor((totalSecs % 3600) / 60);

  return (
    <View style={styles.statsBar}>
      {/* Stat cells */}
      {([
        ['TOTAL',    String(allEntries.length), Colors.lcarsOrange],
        ['CAPTAIN',  String(byType.captain),    Colors.captainYellow],
        ['PERSONAL', String(byType.personal),   Colors.personalBlue],
        ['MEDICAL',  String(byType.medical),    Colors.medicalRed],
        ['RUNTIME',  hours > 0 ? `${hours}H ${mins}M` : `${mins}M`, Colors.lcarsPeriwinkle],
      ] as [string, string, string][]).map(([label, val, color]) => (
        <View key={label} style={styles.statCell}>
          <Text style={[styles.statVal, { color }]}>{val}</Text>
          <Text style={styles.statLabel}>{label}</Text>
        </View>
      ))}
    </View>
  );
};

// ── Empty state ────────────────────────────────────────────────────────────────
const EmptyTimeline: React.FC = () => (
  <View style={styles.empty}>
    <Text style={styles.emptyIcon}>🌌</Text>
    <Text style={styles.emptyTitle}>NO MISSION LOGS</Text>
    <Text style={styles.emptySubtitle}>
      Your timeline awaits.{'\n'}Record your first log entry to begin the journey.
    </Text>
  </View>
);

// ── Main Screen ────────────────────────────────────────────────────────────────
export const TimelineScreen: React.FC = () => {
  const navigation   = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { allEntries, allGrouped, isLoading, loadAllLogs } = useLogStore();
  const { play }     = useSounds();
  const headerAnim   = useRef(new Animated.Value(0)).current;

  useFocusEffect(useCallback(() => { loadAllLogs(); }, [loadAllLogs]));

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 700, useNativeDriver: true }).start();
  }, []);

  // Flatten groups into FlatList items
  type ListItem =
    | { type: 'stats' }
    | { type: 'waypoint'; date: string; count: number; isFirst: boolean }
    | { type: 'entry';    entry: LogEntry; index: number };

  const listData: ListItem[] = [
    { type: 'stats' },
    ...allGrouped.flatMap(({ date, items }, gi) => [
      { type: 'waypoint' as const, date, count: items.length, isFirst: gi === 0 },
      ...items.map((entry, ei) => ({ type: 'entry' as const, entry, index: ei })),
    ]),
  ];

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'stats') {
      return <TimelineStats allEntries={allEntries} />;
    }
    if (item.type === 'waypoint') {
      return <DayWaypoint date={item.date} count={item.count} isFirst={item.isFirst} />;
    }
    return (
      <TimelineCard
        entry={item.entry}
        isLast={false}
        index={item.index}
        onPress={() => {
          play('beep');
          navigation.navigate('LogDetail', { entryId: item.entry.id });
        }}
      />
    );
  };

  return (
    <View style={styles.root}>
      <StarField />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <Animated.View style={{ opacity: headerAnim }}>
          <LcarsHeader
            title="MISSION TIMELINE"
            subtitle="STARFLEET ARCHIVE — CHRONOLOGICAL VIEW"
            accentColor={Colors.lcarsPeriwinkle}
          />
        </Animated.View>

        <FlatList
          data={listData}
          keyExtractor={(item, i) => {
            if (item.type === 'stats')    return 'stats';
            if (item.type === 'waypoint') return `w-${item.date}`;
            return `e-${item.entry.id}`;
          }}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.list,
            allGrouped.length === 0 && styles.listEmpty,
          ]}
          ListEmptyComponent={<EmptyTimeline />}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={loadAllLogs}
              tintColor={Colors.lcarsPeriwinkle}
              colors={[Colors.lcarsPeriwinkle]}
            />
          }
        />

        <LcarsStatusBar stardate={`SD ${toStardate()}`} status="TIMELINE — ALL LOGS" />
      </SafeAreaView>
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.deepSpace },
  safe: { flex: 1 },
  list: { paddingBottom: 40, paddingTop: Spacing.sm },
  listEmpty: { flex: 1, justifyContent: 'center' },

  // Stats bar
  statsBar: {
    flexDirection: 'row',
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    backgroundColor: Colors.spacePanel,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderDim,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: Colors.borderDim,
  },
  statVal:   { ...Typography.displayMD, fontSize: 18, lineHeight: 24 },
  statLabel: { ...Typography.labelSM, color: Colors.textMuted, marginTop: 2 },

  // Waypoint
  waypointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: SPINE_X - 10,
    paddingRight: Spacing.md,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  waypointDiamond: { width: 20, height: 20 },
  waypointInfo: { flex: 1 },
  waypointEarth:    { ...Typography.labelMD, color: Colors.textPrimary },
  waypointStardate: { ...Typography.monoSM, color: Colors.lcarsGold, marginTop: 1 },
  waypointCount: { alignItems: 'flex-end' },
  waypointCountText:  { ...Typography.displayMD, fontSize: 18, color: Colors.lcarsOrange, lineHeight: 22 },
  waypointCountLabel: { ...Typography.labelSM, color: Colors.textMuted },

  // Card
  cardWrapper: {
    marginLeft: SPINE_X,
    marginRight: Spacing.md,
    marginBottom: Spacing.sm,
    position: 'relative',
  },
  connectorLine: {
    position: 'absolute',
    left: -SPINE_X + 10,     // from spine (SPINE_X - diamond half) to card
    top: '50%',
    width: SPINE_X - 10,
    height: 1,
    backgroundColor: Colors.borderDim,
  },
  connectorDot: {
    position: 'absolute',
    left: -SPINE_X + 7,
    top: '50%',
    marginTop: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.spacePanel,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  cardStripe: { width: 4 },
  cardBody:   { flex: 1, padding: Spacing.md },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  typeBadge: {
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: Radius.xs,
  },
  typeBadgeText: { ...Typography.labelSM, color: Colors.black, fontSize: 9 },
  cardTime:      { ...Typography.monoSM, color: Colors.textMuted },
  cardStardate:  { ...Typography.monoSM, color: Colors.lcarsGold },
  cardMetaRight: { flex: 1, alignItems: 'flex-end' },
  durationText:  { ...Typography.monoSM },
  cardTitle:     { ...Typography.bodyLG, color: Colors.textPrimary, fontWeight: '600', lineHeight: 22 },
  cardTranscript:{ ...Typography.bodySM, color: Colors.textSecondary, marginTop: 4, fontStyle: 'italic', lineHeight: 18 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  tagChip: { borderWidth: 1, borderRadius: Radius.xs, paddingHorizontal: 6, paddingVertical: 2 },
  tagText: { ...Typography.labelSM, fontSize: 9 },

  // Empty
  empty: { alignItems: 'center', paddingVertical: Spacing.xxl, paddingHorizontal: Spacing.xl },
  emptyIcon:     { fontSize: 52, marginBottom: Spacing.md },
  emptyTitle:    { ...Typography.displayMD, color: Colors.lcarsPeriwinkle, marginBottom: Spacing.sm },
  emptySubtitle: { ...Typography.bodyMD, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});
