/**
 * TrekLog V2 — App Entry Point
 *
 * Navigation architecture:
 *
 *   RootStack (NativeStack, full-screen)
 *   ├── MainTabs (BottomTabs)           ← new in V2
 *   │   ├── LogsTab   → HomeScreen
 *   │   ├── Timeline  → TimelineScreen  ← new in V2
 *   │   └── Search    → SearchScreen    ← new in V2
 *   ├── Record     (slide_from_bottom)
 *   └── LogDetail  (slide_from_right)
 *
 * The Record and LogDetail screens remain as full-screen stack pages so
 * the tab bar disappears when recording or viewing a log entry.
 */
import 'react-native-get-random-values';
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';
import { Platform } from 'react-native';

import { HomeScreen }     from './src/screens/HomeScreen';
import { RecordScreen }   from './src/screens/RecordScreen';
import { LogDetailScreen }from './src/screens/LogDetailScreen';
import { TimelineScreen } from './src/screens/TimelineScreen';
import { SearchScreen }   from './src/screens/SearchScreen';
import { LcarsTabBar }    from './src/components/LcarsTabBar';
import { Colors }         from './src/theme';
import { getDb }          from './src/db/database';

// ── Navigation type definitions ───────────────────────────────────────────────

/** Root stack — full-screen pages (no tab bar) */
export type RootStackParamList = {
  MainTabs: undefined;
  Record:    undefined;
  LogDetail: { entryId: string };
};

/** Bottom tab navigator param list */
export type TabParamList = {
  LogsTab:  undefined;
  Timeline: undefined;
  Search:   undefined;
};

// ── Navigators ────────────────────────────────────────────────────────────────
const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab   = createBottomTabNavigator<TabParamList>();

/** Inner tab navigator — shown in the MainTabs screen */
function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={props => <LcarsTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="LogsTab"  component={HomeScreen} />
      <Tab.Screen name="Timeline" component={TimelineScreen} />
      <Tab.Screen name="Search"   component={SearchScreen} />
    </Tab.Navigator>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  useEffect(() => {
    // Initialise SQLite DB
    getDb().catch(console.error);

    // Match Android navigation bar to LCARS theme
    if (Platform.OS === 'android') {
      try {
        const nb = NavigationBar as any;
        nb.setBackgroundColorAsync?.(Colors.spaceDark);
        nb.setButtonStyleAsync?.('light');
      } catch (_) {}
    }
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavigationContainer
        theme={{
          dark: true,
          colors: {
            primary:      Colors.lcarsOrange,
            background:   Colors.deepSpace,
            card:         Colors.spaceDark,
            text:         Colors.textPrimary,
            border:       Colors.borderDim,
            notification: Colors.lcarsPink,
          },
          fonts: {
            regular: { fontFamily: 'System', fontWeight: '400' },
            medium:  { fontFamily: 'System', fontWeight: '500' },
            bold:    { fontFamily: 'System', fontWeight: '700' },
            heavy:   { fontFamily: 'System', fontWeight: '900' },
          },
        }}
      >
        <Stack.Navigator
          initialRouteName="MainTabs"
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.deepSpace },
          }}
        >
          {/* Tab-bar screens */}
          <Stack.Screen
            name="MainTabs"
            component={MainTabs}
            options={{ animation: 'none' }}
          />

          {/* Full-screen overlay screens (hide tab bar) */}
          <Stack.Screen
            name="Record"
            component={RecordScreen}
            options={{ animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="LogDetail"
            component={LogDetailScreen}
            options={{ animation: 'slide_from_right' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
