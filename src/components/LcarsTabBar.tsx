/**
 * LcarsTabBar — Custom LCARS-styled bottom tab bar
 *
 * Replaces the default React Navigation tab bar with a full-width
 * LCARS chrome panel: left pill block + three segmented tab buttons + right block.
 *
 *  ╔══╦═══════╦══════════╦══════════╦══╗
 *  ║▓▓║ LOGS  ║ TIMELINE ║  SEARCH  ║▓▓║
 *  ╚══╩═══════╩══════════╩══════════╩══╝
 */
import React, { useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions,
} from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Colors, Typography, Radius } from '../theme';

const { width: W } = Dimensions.get('window');

type TabConfig = {
  key:   string;
  label: string;
  icon:  string;
  color: string;
};

const TAB_CONFIGS: TabConfig[] = [
  { key: 'LogsTab',     label: 'LOGS',     icon: '◉', color: Colors.lcarsOrange },
  { key: 'Timeline',    label: 'TIMELINE', icon: '⬡', color: Colors.lcarsPeriwinkle },
  { key: 'Search',      label: 'SEARCH',   icon: '⌕', color: Colors.lcarsGold },
];

export const LcarsTabBar: React.FC<BottomTabBarProps> = ({ state, navigation }) => {
  const scaleAnims = useRef(TAB_CONFIGS.map(() => new Animated.Value(1))).current;

  const handlePress = (routeName: string, index: number) => {
    // Spring bounce animation
    Animated.sequence([
      Animated.timing(scaleAnims[index], { toValue: 0.88, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnims[index], { toValue: 1, useNativeDriver: true, speed: 30 }),
    ]).start();

    const event = navigation.emit({
      type: 'tabPress',
      target: state.routes[index]?.key,
      canPreventDefault: true,
    });
    if (!event.defaultPrevented) {
      navigation.navigate(routeName);
    }
  };

  return (
    <View style={styles.container}>
      {/* Left LCARS pill block */}
      <View style={styles.leftBlock}>
        <View style={[styles.blockTop, { backgroundColor: Colors.lcarsOrange }]} />
        <View style={[styles.blockMid, { backgroundColor: Colors.lcarsPurple }]} />
        <View style={[styles.blockBot, { backgroundColor: Colors.lcarsPeriwinkle }]} />
      </View>

      {/* Tab buttons */}
      <View style={styles.tabs}>
        {TAB_CONFIGS.map((tab, index) => {
          const isFocused = state.index === index;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => handlePress(tab.key, index)}
              activeOpacity={0.8}
              style={styles.tabTouch}
            >
              <Animated.View
                style={[
                  styles.tab,
                  { transform: [{ scale: scaleAnims[index] }] },
                  isFocused && { backgroundColor: `${tab.color}22` },
                ]}
              >
                {/* Active indicator line */}
                {isFocused && (
                  <View style={[styles.activeBar, { backgroundColor: tab.color }]} />
                )}

                <Text style={[styles.tabIcon, { color: isFocused ? tab.color : Colors.textMuted }]}>
                  {tab.icon}
                </Text>
                <Text style={[
                  styles.tabLabel,
                  { color: isFocused ? tab.color : Colors.textMuted },
                  isFocused && styles.tabLabelActive,
                ]}>
                  {tab.label}
                </Text>
              </Animated.View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Right LCARS block */}
      <View style={styles.rightBlock}>
        <View style={[styles.blockTop, { backgroundColor: Colors.lcarsGold }]} />
        <View style={[styles.blockMid, { backgroundColor: Colors.lcarsTan }]} />
        <View style={[styles.blockBot, { backgroundColor: Colors.lcarsOrange }]} />
      </View>
    </View>
  );
};

const TAB_HEIGHT = 64;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: TAB_HEIGHT,
    backgroundColor: Colors.spaceDark,
    borderTopWidth: 2,
    borderTopColor: Colors.lcarsOrange,
    alignItems: 'stretch',
  },

  // Side LCARS blocks
  leftBlock: {
    width: 28,
    flexDirection: 'column',
    gap: 2,
    paddingVertical: 8,
    paddingLeft: 6,
  },
  rightBlock: {
    width: 28,
    flexDirection: 'column',
    gap: 2,
    paddingVertical: 8,
    paddingRight: 6,
  },
  blockTop: { flex: 2, borderRadius: 2 },
  blockMid: { flex: 1.5, borderRadius: 2 },
  blockBot: { flex: 1, borderRadius: 2 },

  // Tabs
  tabs:     { flex: 1, flexDirection: 'row' },
  tabTouch: { flex: 1 },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
    position: 'relative',
    borderRadius: Radius.xs,
    marginHorizontal: 2,
    marginVertical: 4,
    gap: 2,
  },

  // Active top bar indicator
  activeBar: {
    position: 'absolute',
    top: -4,
    left: 8,
    right: 8,
    height: 2.5,
    borderRadius: 1.5,
  },

  tabIcon:  { fontSize: 18 },
  tabLabel: { ...Typography.labelSM, fontSize: 9, letterSpacing: 1 },
  tabLabelActive: { fontWeight: '800' },
});
