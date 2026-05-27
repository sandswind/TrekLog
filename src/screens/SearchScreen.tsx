/**
 * SearchScreen V2 — Full-text + tag-based search
 *
 * Layout:
 *   ┌──────────────────────────────────────┐
 *   │  LCARS HEADER — COMPUTER, SEARCH...  │
 *   │  [ ⌕  Search field                 ] │
 *   │                                      │
 *   │  TAGS ────────────────────────────── │
 *   │  [#work] [#idea] [#mission] [#daily] │  ← tap to toggle filter
 *   │                                      │
 *   │  RESULTS (42) ─────────────────────  │
 *   │  ┌────────────────────────────────┐  │
 *   │  │  Captain's Log — Meeting notes │  │
 *   │  │  SD 63147.2  •  02:14          │  │
 *   │  └────────────────────────────────┘  │
 *   │  ...                                 │
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  Animated, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Colors, Typography, Spacing, Radius } from '../theme';
import { StarField }       from '../components/StarField';
import { LcarsHeader }     from '../components/LcarsHeader';
import { LcarsStatusBar }  from '../components/LcarsStatusBar';
import { LcarsPanel }      from '../components/LcarsPanel';
import { useLogStore }     from '../store/useLogStore';
import { LogEntry, LogType } from '../db/schema';
import {
  stardateLabel, formatEarthDateShort, formatDuration, toStardate,
} from '../utils/stardate';
import { useSounds } from '../hooks/useSounds';
import type { RootStackParamList } from '../../App';

// ── Constants ──────────────────────────────────────────────────────────────────
const LOG_TYPE_COLORS: Record<LogType, string> = {
  captain:  Colors.captainYellow,
  personal: Colors.personalBlue,
  medical:  Colors.medicalRed,
};

// ── Tag chip (toggleable) ──────────────────────────────────────────────────────
const TagChip: React.FC<{
  tag:      string;
  active:   boolean;
  onPress:  () => void;
  count?:   number;
}> = ({ tag, active, onPress, count }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.88, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
      <Animated.View style={[
        styles.tagChip,
        active && styles.tagChipActive,
        { transform: [{ scale: scaleAnim }] },
      ]}>
        <Text style={[styles.tagChipText, active && styles.tagChipTextActive]}>
          #{tag}
        </Text>
        {count !== undefined && (
          <View style={[styles.tagCount, { backgroundColor: active ? Colors.deepSpace : Colors.borderDim }]}>
            <Text style={[styles.tagCountText, active && { color: Colors.lcarsOrange }]}>
              {count}
            </Text>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

// ── Search result card ─────────────────────────────────────────────────────────
const ResultCard: React.FC<{
  entry:       LogEntry;
  query:       string;
  activeTags:  string[];
  onPress:     () => void;
  index:       number;
}> = ({ entry, query, activeTags, onPress, index }) => {
  const slideAnim   = useRef(new Animated.Value(20)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim,   { toValue: 0, duration: 280, delay: index * 35, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 280, delay: index * 35, useNativeDriver: true }),
    ]).start();
  }, []);

  const color      = LOG_TYPE_COLORS[entry.logType];
  const createdAt  = new Date(entry.createdAt);
  const tags: string[] = JSON.parse(entry.tags || '[]');

  // Highlight query in title
  const highlightTitle = (title: string): React.ReactNode => {
    if (!query.trim()) return <Text style={styles.cardTitle}>{title}</Text>;
    const idx = title.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return <Text style={styles.cardTitle}>{title}</Text>;
    return (
      <Text style={styles.cardTitle}>
        {title.slice(0, idx)}
        <Text style={[styles.cardTitle, { backgroundColor: Colors.glowGold, color: Colors.lcarsGold }]}>
          {title.slice(idx, idx + query.length)}
        </Text>
        {title.slice(idx + query.length)}
      </Text>
    );
  };

  return (
    <Animated.View style={{ opacity: opacityAnim, transform: [{ translateY: slideAnim }] }}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.card}>
        <View style={[styles.cardStripe, { backgroundColor: color }]} />
        <View style={styles.cardBody}>
          {/* Meta row */}
          <View style={styles.cardMeta}>
            <View style={[styles.typeBadge, { backgroundColor: color }]}>
              <Text style={styles.typeBadgeText}>{entry.logType.toUpperCase()}</Text>
            </View>
            <Text style={styles.cardDate}>{formatEarthDateShort(createdAt)}</Text>
            <Text style={styles.cardStardate}>SD {entry.stardate}</Text>
            <Text style={[styles.cardDuration, { color }]}>{formatDuration(entry.durationSecs)}</Text>
          </View>

          {/* Title with highlight */}
          {highlightTitle(entry.title)}

          {/* Transcript snippet */}
          {entry.transcript && (
            <Text style={styles.cardTranscript} numberOfLines={2}>
              "{entry.transcript}"
            </Text>
          )}

          {/* Tags (highlight active ones) */}
          {tags.length > 0 && (
            <View style={styles.tagsRow}>
              {tags.slice(0, 5).map(tag => (
                <View key={tag} style={[
                  styles.resultTag,
                  { borderColor: activeTags.includes(tag) ? color : Colors.borderDim },
                ]}>
                  <Text style={[
                    styles.resultTagText,
                    { color: activeTags.includes(tag) ? color : Colors.textMuted },
                  ]}>
                    #{tag}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ── Tag count map helper ───────────────────────────────────────────────────────
function buildTagCountMap(entries: LogEntry[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of entries) {
    try {
      const arr: string[] = JSON.parse(e.tags || '[]');
      arr.forEach(t => map.set(t, (map.get(t) ?? 0) + 1));
    } catch (_) {}
  }
  return map;
}

// ── Main Screen ────────────────────────────────────────────────────────────────
export const SearchScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    allTags, activeTags, tagResults, isTagSearching,
    loadTags, loadAllLogs, allEntries,
    toggleTag, clearTags, runFullSearch,
  } = useLogStore();
  const { play } = useSounds();

  const [query, setQuery]         = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const headerAnim = useRef(new Animated.Value(0)).current;

  // Load on focus
  useFocusEffect(useCallback(() => {
    loadTags();
    loadAllLogs();
    runFullSearch(''); // init: show all results
  }, []));

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  // Debounced search
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      runFullSearch(text);
    }, 300);
  };

  const handleTagPress = (tag: string) => {
    play('beep');
    toggleTag(tag);
    // Also clear text query so tag-only filter is clean
    setQuery('');
  };

  const handleClearAll = () => {
    play('beep');
    setQuery('');
    clearTags();
  };

  const tagCountMap = buildTagCountMap(allEntries);
  const hasFilters  = query.trim() || activeTags.length > 0;

  // Results to display: tag filter takes priority over text query
  const displayResults = tagResults;

  return (
    <View style={styles.root}>
      <StarField />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>

        <Animated.View style={{ opacity: headerAnim }}>
          <LcarsHeader
            title="COMPUTER SEARCH"
            subtitle="FULL-TEXT + TAG FILTER — ALL LOGS"
            accentColor={Colors.lcarsGold}
          />
        </Animated.View>

        {/* ── Search input ── */}
        <View style={[
          styles.searchBar,
          { borderColor: inputFocused ? Colors.lcarsGold : Colors.borderDim },
        ]}>
          <Text style={[styles.searchIcon, { color: Colors.lcarsGold }]}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="SEARCH TITLE, TRANSCRIPT, STARDATE..."
            placeholderTextColor={Colors.textMuted}
            value={query}
            onChangeText={handleQueryChange}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            returnKeyType="search"
            onSubmitEditing={Keyboard.dismiss}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); runFullSearch(''); }}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Tag cloud ── */}
        {allTags.length > 0 && (
          <LcarsPanel
            label={`TAGS (${allTags.length})`}
            accentColor={Colors.lcarsGold}
            style={styles.tagPanel}
            bodyStyle={styles.tagPanelBody}
          >
            <View style={styles.tagCloud}>
              {allTags.map(tag => (
                <TagChip
                  key={tag}
                  tag={tag}
                  active={activeTags.includes(tag)}
                  count={tagCountMap.get(tag)}
                  onPress={() => handleTagPress(tag)}
                />
              ))}
            </View>
            {(activeTags.length > 0) && (
              <TouchableOpacity onPress={handleClearAll} style={styles.clearAllBtn}>
                <Text style={styles.clearAllText}>✕ CLEAR FILTERS</Text>
              </TouchableOpacity>
            )}
          </LcarsPanel>
        )}

        {/* ── Results header ── */}
        <View style={styles.resultsHeader}>
          <View style={[styles.resultsAccent, { backgroundColor: Colors.lcarsGold }]} />
          <Text style={styles.resultsCount}>
            {isTagSearching ? 'SCANNING...' : `${displayResults.length} RESULT${displayResults.length !== 1 ? 'S' : ''}`}
          </Text>
          {hasFilters && (
            <View style={styles.activeFilters}>
              {activeTags.map(t => (
                <View key={t} style={styles.activeFilterChip}>
                  <Text style={styles.activeFilterText}>#{t}</Text>
                </View>
              ))}
              {query.trim() && (
                <View style={styles.activeFilterChip}>
                  <Text style={styles.activeFilterText}>"{query}"</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ── Results list ── */}
        <FlatList
          data={displayResults}
          keyExtractor={item => item.id}
          renderItem={({ item, index }) => (
            <ResultCard
              entry={item}
              query={query}
              activeTags={activeTags}
              index={index}
              onPress={() => {
                play('beep');
                navigation.navigate('LogDetail', { entryId: item.id });
              }}
            />
          )}
          contentContainerStyle={[
            styles.list,
            displayResults.length === 0 && styles.listEmpty,
          ]}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📡</Text>
              <Text style={styles.emptyTitle}>NO SIGNALS DETECTED</Text>
              <Text style={styles.emptySubtitle}>
                {hasFilters
                  ? 'No logs match the current filters.\nTry clearing tags or adjusting your search.'
                  : 'No logs recorded yet.\nStart recording to build your archive.'}
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />

        <LcarsStatusBar
          stardate={`SD ${toStardate()}`}
          status={`SEARCH — ${displayResults.length} RECORDS`}
        />
      </SafeAreaView>
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.deepSpace },
  safe: { flex: 1 },

  // Search bar
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: Spacing.md, marginTop: Spacing.sm,
    borderWidth: 1.5, borderRadius: Radius.md,
    backgroundColor: Colors.spacePanel,
    paddingHorizontal: Spacing.md, height: 48,
  },
  searchIcon:  { fontSize: 20, marginRight: 10 },
  searchInput: { flex: 1, ...Typography.bodyMD, color: Colors.textPrimary },
  clearBtn:    { ...Typography.labelMD, color: Colors.textMuted, paddingLeft: 8 },

  // Tag panel
  tagPanel: { marginHorizontal: Spacing.md, marginTop: Spacing.md },
  tagPanelBody: { paddingBottom: Spacing.sm },
  tagCloud: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: {
    borderWidth: 1.5, borderColor: Colors.borderDim, borderRadius: Radius.pill,
    paddingHorizontal: 12, paddingVertical: 6,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.spaceDark,
  },
  tagChipActive: {
    backgroundColor: Colors.lcarsGold,
    borderColor: Colors.lcarsGold,
  },
  tagChipText:       { ...Typography.labelSM, color: Colors.textSecondary },
  tagChipTextActive: { color: Colors.black },
  tagCount: { borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1, minWidth: 18, alignItems: 'center' },
  tagCountText: { ...Typography.monoSM, color: Colors.textMuted, fontSize: 9 },
  clearAllBtn: { marginTop: Spacing.sm, alignSelf: 'flex-end' },
  clearAllText: { ...Typography.labelSM, color: Colors.lcarsPink },

  // Results header
  resultsHeader: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: Spacing.md, marginTop: Spacing.md, marginBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  resultsAccent: { width: 14, height: 14, borderRadius: 2 },
  resultsCount:  { ...Typography.labelMD, color: Colors.textSecondary },
  activeFilters: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  activeFilterChip: {
    backgroundColor: Colors.glowGold, borderRadius: Radius.xs,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  activeFilterText: { ...Typography.monoSM, color: Colors.lcarsGold },

  // List
  list:      { paddingHorizontal: Spacing.md, paddingBottom: 40, gap: Spacing.sm },
  listEmpty: { flex: 1, justifyContent: 'center' },

  // Result card
  card: {
    flexDirection: 'row', backgroundColor: Colors.spacePanel,
    borderRadius: Radius.md, overflow: 'hidden',
  },
  cardStripe: { width: 4 },
  cardBody:   { flex: 1, padding: Spacing.md },
  cardMeta:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  typeBadge:  { paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.xs },
  typeBadgeText: { ...Typography.labelSM, color: Colors.black, fontSize: 9 },
  cardDate:      { ...Typography.labelSM, color: Colors.textSecondary },
  cardStardate:  { ...Typography.monoSM, color: Colors.lcarsGold },
  cardDuration:  { ...Typography.monoSM, marginLeft: 'auto' },
  cardTitle:     { ...Typography.bodyLG, color: Colors.textPrimary, fontWeight: '600', lineHeight: 22 },
  cardTranscript:{ ...Typography.bodySM, color: Colors.textSecondary, marginTop: 4, fontStyle: 'italic', lineHeight: 18 },
  tagsRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  resultTag: { borderWidth: 1, borderRadius: Radius.xs, paddingHorizontal: 6, paddingVertical: 2 },
  resultTagText: { ...Typography.labelSM, fontSize: 9 },

  // Empty
  empty: { alignItems: 'center', paddingVertical: Spacing.xxl, paddingHorizontal: Spacing.xl },
  emptyIcon:     { fontSize: 48, marginBottom: Spacing.md },
  emptyTitle:    { ...Typography.displayMD, color: Colors.lcarsGold, marginBottom: Spacing.sm },
  emptySubtitle: { ...Typography.bodyMD, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});
