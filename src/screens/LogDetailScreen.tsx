import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Alert, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Circle, Path, Line } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Colors, Typography, Spacing, Radius } from '../theme';
import { StarField } from '../components/StarField';
import { LcarsHeader } from '../components/LcarsHeader';
import { LcarsPanel } from '../components/LcarsPanel';
import { LcarsStatusBar } from '../components/LcarsStatusBar';
import { LcarsButton } from '../components/LcarsButton';
import { WaveformVisualizer } from '../components/WaveformVisualizer';
import { usePlayer } from '../hooks/usePlayer';
import { useLogStore } from '../store/useLogStore';
import { LogEntry, LogType } from '../db/schema';
import { useSounds } from '../hooks/useSounds';
import { formatEarthDate, formatDuration } from '../utils/stardate';
import type { RootStackParamList } from '../../App';

const { width: W } = Dimensions.get('window');
const LOG_TYPE_COLORS: Record<LogType,string> = { captain:Colors.captainYellow, personal:Colors.personalBlue, medical:Colors.medicalRed };
const LOG_TYPE_LABELS: Record<LogType,string> = { captain:"CAPTAIN'S LOG", personal:'PERSONAL LOG', medical:'MEDICAL LOG' };

const PlaybackBar: React.FC<{progress:number;positionSecs:number;durationSecs:number;onSeek:(s:number)=>void;color:string}> = ({progress,positionSecs,durationSecs,onSeek,color}) => {
  const barWidth = W - Spacing.md*2 - 32;
  return (
    <View style={pbStyles.container}>
      <View style={pbStyles.track} onStartShouldSetResponder={()=>true} onResponderGrant={e=>{const x=e.nativeEvent.locationX;onSeek(Math.max(0,Math.min(1,x/barWidth))*durationSecs);}}>
        <View style={[pbStyles.fill,{width:`${Math.min(100,progress*100)}%`,backgroundColor:color}]}/>
        <View style={[pbStyles.head,{left:`${Math.min(99,progress*100)}%`,backgroundColor:color}]}/>
      </View>
      <View style={pbStyles.times}><Text style={pbStyles.time}>{formatDuration(positionSecs)}</Text><Text style={pbStyles.time}>{formatDuration(durationSecs)}</Text></View>
    </View>
  );
};
const pbStyles = StyleSheet.create({
  container:{marginTop:Spacing.sm}, track:{height:4,backgroundColor:Colors.borderDim,borderRadius:2,position:'relative',overflow:'visible'},
  fill:{height:'100%',borderRadius:2}, head:{position:'absolute',top:-5,width:14,height:14,borderRadius:7,marginLeft:-7},
  times:{flexDirection:'row',justifyContent:'space-between',marginTop:10}, time:{...Typography.monoSM,color:Colors.textMuted},
});

const StarfleetEmblem: React.FC<{color:string;size?:number}> = ({color,size=60}) => (
  <Svg width={size} height={size} viewBox="0 0 60 60">
    <Path d="M30 4 L54 18 L54 38 Q54 52 30 58 Q6 52 6 38 L6 18 Z" stroke={color} strokeWidth={2} fill="none" opacity={0.8}/>
    <Path d="M30 14 L42 30 L36 30 L36 46 L24 46 L24 30 L18 30 Z" fill={color} opacity={0.7}/>
    <Path d="M30 4 L30 14" stroke={color} strokeWidth={1.5} opacity={0.5}/>
  </Svg>
);

type RouteProps = RouteProp<RootStackParamList,'LogDetail'>;

export const LogDetailScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProps>();
  const { entryId } = route.params;
  const { entries, removeLog } = useLogStore();
  const { play } = useSounds();
  const player = usePlayer();
  const [entry, setEntry] = useState<LogEntry|null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(()=>{ setEntry(entries.find(e=>e.id===entryId)??null); Animated.timing(fadeAnim,{toValue:1,duration:600,useNativeDriver:true}).start(); },[entryId,entries]);
  useEffect(()=>{ if(entry?.audioUri) player.load(entry.audioUri); return()=>{ player.unload(); }; },[entry?.audioUri]);

  if (!entry) return (<View style={styles.root}><StarField/><SafeAreaView style={styles.safe}><Text style={styles.notFound}>LOG ENTRY NOT FOUND</Text></SafeAreaView></View>);

  const accentColor = LOG_TYPE_COLORS[entry.logType];
  const tags: string[] = JSON.parse(entry.tags||'[]');
  const createdAt = new Date(entry.createdAt);
  const isPlaying = player.state==='playing';

  const handlePlayPause = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if(isPlaying){play('pause');await player.pause();}else{play('beep');await player.play();}
  };

  return (
    <View style={styles.root}>
      <StarField/>
      <SafeAreaView style={styles.safe} edges={['top','left','right']}>
        <Animated.View style={{flex:1,opacity:fadeAnim}}>
          <LcarsHeader title={LOG_TYPE_LABELS[entry.logType]} subtitle="LOG PLAYBACK — ARCHIVE ACCESS" accentColor={accentColor} rightLabel={`SD ${entry.stardate}`}/>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            <View style={styles.heroRow}>
              <StarfleetEmblem color={accentColor} size={70}/>
              <View style={styles.heroInfo}>
                <Text style={[styles.heroStardate,{color:accentColor}]}>STARDATE {entry.stardate}</Text>
                <Text style={styles.heroEarth}>{formatEarthDate(createdAt)}</Text>
                <Text style={styles.heroTime}>{createdAt.toLocaleTimeString('en-US',{hour12:false})} HRS</Text>
              </View>
              <View style={styles.heroRight}>
                {entry.isFirstOfDay&&<View style={[styles.firstBadge,{borderColor:accentColor}]}><Text style={[styles.firstBadgeText,{color:accentColor}]}>FIRST ENTRY</Text></View>}
                <Text style={styles.logTypeTag}>{LOG_TYPE_LABELS[entry.logType]}</Text>
              </View>
            </View>
            <LcarsPanel label="LOG TITLE" accentColor={accentColor} style={styles.panel}><Text style={styles.logTitle}>{entry.title}</Text></LcarsPanel>
            <LcarsPanel label="AUDIO PLAYBACK" accentColor={Colors.lcarsPeriwinkle} style={styles.panel}>
              <WaveformVisualizer isActive={isPlaying} color={accentColor} height={60}/>
              <PlaybackBar progress={player.progress} positionSecs={player.positionSecs} durationSecs={entry.durationSecs} onSeek={player.seekTo} color={accentColor}/>
              <View style={styles.controlsRow}>
                <LcarsButton label="« 10" onPress={()=>player.seekTo(Math.max(0,player.positionSecs-10))} color={Colors.lcarsPeriwinkle} variant="ghost" size="sm"/>
                <LcarsButton label={isPlaying?'⏸  PAUSE':'▶  PLAY'} onPress={handlePlayPause} color={accentColor} size="lg" style={{minWidth:140}} disabled={player.state==='loading'}/>
                <LcarsButton label="10 »" onPress={()=>player.seekTo(Math.min(entry.durationSecs,player.positionSecs+10))} color={Colors.lcarsPeriwinkle} variant="ghost" size="sm"/>
              </View>
              <View style={styles.durationRow}><Text style={styles.durationLabel}>DURATION</Text><Text style={[styles.durationValue,{color:accentColor}]}>{formatDuration(entry.durationSecs)}</Text></View>
            </LcarsPanel>
            {entry.transcript&&<LcarsPanel label="VOICE TRANSCRIPT" accentColor={Colors.lcarsGold} style={styles.panel}><Text style={styles.transcript}>{entry.transcript}</Text></LcarsPanel>}
            {tags.length>0&&<LcarsPanel label="CLASSIFICATION TAGS" accentColor={Colors.lcarsTan} style={styles.panel}><View style={styles.tagsWrap}>{tags.map(tag=><View key={tag} style={styles.tagChip}><Text style={styles.tagText}># {tag}</Text></View>)}</View></LcarsPanel>}
            <LcarsPanel label="ENTRY METADATA" accentColor={Colors.textMuted} style={styles.panel}>
              <View style={styles.metaGrid}>
                {[['LOG TYPE',LOG_TYPE_LABELS[entry.logType]],['STARDATE',entry.stardate],['EARTH DATE',formatEarthDate(createdAt)],['DURATION',formatDuration(entry.durationSecs)],['ENTRY ID',entry.id.split('-')[0].toUpperCase()],['STATUS','ARCHIVED']].map(([k,v])=>(
                  <View key={k} style={styles.metaItem}><Text style={styles.metaKey}>{k}</Text><Text style={styles.metaVal}>{v}</Text></View>
                ))}
              </View>
            </LcarsPanel>
            <View style={styles.deleteRow}>
              <LcarsButton label="⚠  DELETE LOG ENTRY" onPress={()=>{play('error');Alert.alert('DELETE LOG ENTRY',`Permanently delete log from Stardate ${entry.stardate}?`,[{text:'CANCEL',style:'cancel'},{text:'DELETE',style:'destructive',onPress:async()=>{await removeLog(entry.id,entry.audioUri);navigation.goBack();}}],{userInterfaceStyle:'dark'});}} color={Colors.medicalRed} variant="ghost" size="md" style={{flex:1}}/>
            </View>
            <View style={styles.bottomChrome}>
              {[3,1,2,1,4].map((flex,i)=><View key={i} style={[styles.chromeBlock,{flex,backgroundColor:[Colors.lcarsOrange,Colors.lcarsPurple,Colors.lcarsPeriwinkle,Colors.lcarsGold,Colors.lcarsTan][i]}]}/>)}
            </View>
          </ScrollView>
          <LcarsStatusBar stardate={`SD ${entry.stardate}`}/>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:Colors.deepSpace}, safe:{flex:1}, scroll:{padding:Spacing.md,gap:Spacing.md,paddingBottom:40}, notFound:{...Typography.displayMD,color:Colors.lcarsPink,padding:Spacing.xl},
  heroRow:{flexDirection:'row',alignItems:'center',gap:Spacing.md,backgroundColor:Colors.overlay20,padding:Spacing.md,borderRadius:Radius.md,marginBottom:Spacing.xs},
  heroInfo:{flex:1}, heroStardate:{...Typography.stardateXL,fontSize:18,lineHeight:24}, heroEarth:{...Typography.labelMD,color:Colors.textSecondary,marginTop:2}, heroTime:{...Typography.monoSM,color:Colors.textMuted,marginTop:2},
  heroRight:{alignItems:'flex-end',gap:6}, firstBadge:{borderWidth:1,borderRadius:Radius.xs,paddingHorizontal:8,paddingVertical:3}, firstBadgeText:{...Typography.labelSM,fontSize:9}, logTypeTag:{...Typography.labelSM,color:Colors.textMuted,fontSize:9},
  panel:{marginBottom:0}, logTitle:{...Typography.bodyLG,color:Colors.textPrimary,lineHeight:24,fontStyle:'italic'},
  controlsRow:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:Spacing.sm,marginTop:Spacing.md},
  durationRow:{flexDirection:'row',justifyContent:'space-between',marginTop:Spacing.sm}, durationLabel:{...Typography.labelSM,color:Colors.textMuted}, durationValue:{...Typography.monoMD},
  transcript:{...Typography.bodyMD,color:Colors.textSecondary,lineHeight:22,fontStyle:'italic'},
  tagsWrap:{flexDirection:'row',flexWrap:'wrap',gap:8}, tagChip:{borderWidth:1,borderColor:Colors.lcarsTan,borderRadius:Radius.xs,paddingHorizontal:10,paddingVertical:4}, tagText:{...Typography.labelSM,color:Colors.lcarsTan},
  metaGrid:{flexDirection:'row',flexWrap:'wrap',gap:0}, metaItem:{width:'50%',paddingVertical:6,paddingRight:8}, metaKey:{...Typography.labelSM,color:Colors.textMuted}, metaVal:{...Typography.monoSM,color:Colors.textSecondary,marginTop:2},
  deleteRow:{flexDirection:'row',marginTop:Spacing.sm},
  bottomChrome:{flexDirection:'row',height:10,gap:2,borderRadius:Radius.xs,overflow:'hidden',marginTop:Spacing.md}, chromeBlock:{borderRadius:2},
});
