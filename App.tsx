import 'react-native-get-random-values';
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';
import { Platform } from 'react-native';
import { HomeScreen }      from './src/screens/HomeScreen';
import { RecordScreen }    from './src/screens/RecordScreen';
import { LogDetailScreen } from './src/screens/LogDetailScreen';
import { Colors }          from './src/theme';
import { getDb }           from './src/db/database';

export type RootStackParamList = {
  Home:      undefined;
  Record:    undefined;
  LogDetail: { entryId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  useEffect(() => {
    getDb().catch(console.error);
    if (Platform.OS === 'android') {
      try {
        const nb = NavigationBar as any;
        nb.setBackgroundColorAsync?.(Colors.deepSpace);
        nb.setButtonStyleAsync?.('light');
      } catch(_){}
    }
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light"/>
      <NavigationContainer
        theme={{
          dark: true,
          colors: { primary:Colors.lcarsOrange, background:Colors.deepSpace, card:Colors.spaceDark, text:Colors.textPrimary, border:Colors.borderDim, notification:Colors.lcarsPink },
          fonts: { regular:{fontFamily:'System',fontWeight:'400'}, medium:{fontFamily:'System',fontWeight:'500'}, bold:{fontFamily:'System',fontWeight:'700'}, heavy:{fontFamily:'System',fontWeight:'900'} },
        }}
      >
        <Stack.Navigator initialRouteName="Home" screenOptions={{ headerShown:false, animation:'slide_from_right', contentStyle:{backgroundColor:Colors.deepSpace} }}>
          <Stack.Screen name="Home"      component={HomeScreen}/>
          <Stack.Screen name="Record"    component={RecordScreen}    options={{animation:'slide_from_bottom'}}/>
          <Stack.Screen name="LogDetail" component={LogDetailScreen}/>
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
