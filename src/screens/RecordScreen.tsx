import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Alert, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Colors, Typography, Spacing, Radius } from '../theme';
import { StarField } from '../components/StarField';
import { LcarsHeader } from '../components/LcarsHeader';
import { LcarsStatusBar } from '../components/LcarsStatusBar';
import { LcarsButton } from '../components/LcarsButton';
import { WaveformVisualizer } from '../components/WaveformVisualizer';
import { LogTypeSelector } from '../components/LogTypeSelector';
import { useRecorder } from '../hooks/useRecorder';
import { useLogStore } from '../store/useLogStore';
import { useSounds } from '../hooks/useSounds';
import { LogType } from '../db/schema';
import { formatEarthDate, formatDuration, toStardate } from '../utils/stardate';
import Svg, { Circle, Line } from 'react-native-svg';

const LOG_TYPE_COLORS: Record<LogType,string> = { captain:Colors.captainYellow, personal:Colors.personalBlue, medical:Colors.medicalRed };
const LOG_LABELS: Record<LogType,string> = { captain:"CAPTAIN'S LOG", personal:'PERSONAL LOG', medical:'MEDICAL LOG' };

const RecordOrb: React.FC<{isRecording:boolean;isPaused:boolean;onPress:()=>void;color:string}> = ({isRecording,isPaused,onPress,color}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringAnim  = useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    if(isRecording&&!isPaused){
      Animated.loop(Animated.sequence([Animated.timing(pulseAnim,{toValue:1.08,duration:700,useNativeDriver:true}),Animated.timing(pulseAnim,{toValue:0.96,duration:700,useNativeDriver:true})])).start();
      Animated.loop(Animated.timing(ringAnim,{toValue:1,duration:2000,useNativeDriver:true})).start();
    } else { pulseAnim.stopAnimation(); ringAnim.stopAnimation(); Animated.spring(pulseAnim,{toValue:1,useNativeDriver:true}).start(); ringAnim.setValue(0); }
  },[isRecording,isPaused]);
  const orbColor = isRecording&&!isPaused?Colors.lcarsPink:color;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <Animated.View style={[styles.orbRing,{borderColor:orbColor,opacity:ringAnim.interpolate({inputRange:[0,0.5,1],outputRange:[0.8,0.2,0.8]})}]}/>
      <Animated.View style={[styles.orb,{backgroundColor:isRecording&&!isPaused?Colors.lcarsPink:color,transform:[{scale:pulseAnim}]}]}>
        <Text style={styles.orbIcon}>{isRecording&&!isPaused?'⏸':isPaused?'▶':'●'}</Text>
        <Text style={styles.orbLabel}>{isRecording&&!isPaused?'PAUSE':isPaused?'RESUME':'RECORD'}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

const RadialMeter: React.FC<{value:number;color:string;size?:number}> = ({value,color,size=100}) => {
  const r=(size/2)-6, circumference=2*Math.PI*r;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={size/2} cy={size/2} r={r} stroke={Colors.borderDim} strokeWidth={3} fill="none" strokeDasharray={`${circumference*0.75} ${circumference*0.25}`} strokeDashoffset={circumference*0.125} strokeLinecap="round"/>
      <Circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={3} fill="none" strokeDasharray={`${circumference*0.75*value} ${circumference-circumference*0.75*value}`} strokeDashoffset={circumference*0.125} strokeLinecap="round" rotation={-135} origin={`${size/2}, ${size/2}`}/>
      {[0,0.25,0.5,0.75,1].map((tick,i)=>{const angle=-135+tick*270,rad=(angle*Math.PI)/180,x1=size/2+(r-8)*Math.cos(rad),y1=size/2+(r-8)*Math.sin(rad),x2=size/2+(r+2)*Math.cos(rad),y2=size/2+(r+2)*Math.sin(rad);return <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={1.5} opacity={0.6}/>;  })}
    </Svg>
  );
};

export const RecordScreen: React.FC = () => {
  const navigation = useNavigation();
  const { addLog, selectedType } = useLogStore();
  const { play } = useSounds();
  const recorder = useRecorder();
  const [logType, setLogType] = useState<LogType>(selectedType);
  const [tags, setTags] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const accentColor = LOG_TYPE_COLORS[logType];
  const isRecording = recorder.state==='recording';
  const isPaused    = recorder.state==='paused';
  const hasStarted  = isRecording||isPaused;
  const avgAmp = recorder.amplitudes.slice(15,25).reduce((a,b)=>a+b,0)/10;

  const handleRecordToggle = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if(!hasStarted){play('ding');await recorder.start();}
    else if(isRecording){play('pause');await recorder.pause();}
    else if(isPaused){play('beep');await recorder.resume();}
  };

  const handleStop = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    play('datastream');
    const result = await recorder.stop();
    if(!result) return;
    setIsSaving(true);
    try {
      const parsedTags = tags.split(/[,，\s]+/).map(t=>t.trim().replace(/^#/,'')).filter(Boolean);
      await addLog({logType,audioUri:result.uri,durationSecs:result.durationSecs,tags:parsedTags});
      navigation.goBack();
    } catch(e){Alert.alert('SAVE FAILED','Unable to save log entry.');}
    finally{setIsSaving(false);}
  };

  const handleDiscard = () => {
    play('error');
    Alert.alert('DISCARD RECORDING','This log entry will be lost. Are you certain, Captain?',
      [{text:'CANCEL',style:'cancel'},{text:'DISCARD',style:'destructive',onPress:async()=>{await recorder.discard();navigation.goBack();}}],
      {userInterfaceStyle:'dark'});
  };

  return (
    <View style={styles.root}>
      <StarField/>
      <SafeAreaView style={styles.safe} edges={['top','left','right']}>
        <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <LcarsHeader title={LOG_LABELS[logType]} subtitle="NEW ENTRY — RECORD MODE" accentColor={accentColor}/>
            <View style={[styles.stardateBlock,{borderColor:accentColor}]}>
              <View style={[styles.sdPill,{backgroundColor:accentColor}]}><Text style={styles.sdPillText}>SD</Text></View>
              <View style={styles.sdInfo}><Text style={[styles.sdNumber,{color:accentColor}]}>{toStardate()}</Text><Text style={styles.sdEarth}>{formatEarthDate()}</Text></View>
              <View style={styles.sdBadge}><Text style={styles.sdBadgeText}>SUPPLEMENTAL</Text></View>
            </View>
            {!hasStarted&&<View style={styles.section}><Text style={styles.sectionLabel}>LOG CLASSIFICATION</Text><LogTypeSelector selected={logType} onChange={setLogType}/></View>}
            <View style={styles.hudRow}>
              <RadialMeter value={avgAmp} color={accentColor} size={90}/>
              <View style={styles.hudCenter}>
                <WaveformVisualizer isActive={isRecording} amplitudes={recorder.amplitudes} color={accentColor} height={70}/>
                <Text style={[styles.timer,{color:accentColor}]}>{formatDuration(recorder.durationSecs)}</Text>
                {hasStarted&&<View style={styles.stateRow}><View style={[styles.recDot,{backgroundColor:isRecording?Colors.lcarsPink:Colors.lcarsGold}]}/><Text style={styles.stateText}>{isRecording?'RECORDING IN PROGRESS':'TRANSMISSION PAUSED'}</Text></View>}
              </View>
              <View style={{transform:[{scaleX:-1}]}}><RadialMeter value={avgAmp*0.8} color={Colors.lcarsPeriwinkle} size={90}/></View>
            </View>
            <View style={styles.orbContainer}><RecordOrb isRecording={isRecording} isPaused={isPaused} onPress={handleRecordToggle} color={accentColor}/></View>
            {hasStarted&&<View style={styles.actionRow}>
              <LcarsButton label="✕  DISCARD" onPress={handleDiscard} color={Colors.lcarsPink} variant="ghost" size="md" style={{flex:1}}/>
              <LcarsButton label={isSaving?'SAVING...':'✓  SAVE LOG'} onPress={handleStop} color={accentColor} size="md" disabled={isSaving} style={{flex:1}}/>
            </View>}
            {hasStarted&&<View style={styles.section}>
              <Text style={styles.sectionLabel}>TAGS (OPTIONAL)</Text>
              <View style={[styles.tagInput,{borderColor:accentColor}]}>
                <Text style={[styles.tagHash,{color:accentColor}]}>#</Text>
                <TextInput style={styles.tagInputField} placeholder="work, idea, mission..." placeholderTextColor={Colors.textMuted} value={tags} onChangeText={setTags}/>
              </View>
            </View>}
            <View style={styles.bottomChrome}>
              {[Colors.lcarsOrange,Colors.lcarsPurple,Colors.lcarsPeriwinkle,Colors.lcarsGold].map((c,i)=><View key={i} style={[styles.chromeBlock,{backgroundColor:c,flex:i===0?3:1}]}/>)}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        <LcarsStatusBar isRecording={isRecording} stardate={`SD ${toStardate()}`}/>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:Colors.deepSpace}, safe:{flex:1}, scroll:{paddingBottom:20},
  stardateBlock:{flexDirection:'row',alignItems:'center',margin:Spacing.md,borderWidth:1,borderRadius:Radius.md,overflow:'hidden',backgroundColor:Colors.overlay20},
  sdPill:{width:36,alignItems:'center',justifyContent:'center',paddingVertical:Spacing.md}, sdPillText:{...Typography.labelSM,color:Colors.black},
  sdInfo:{flex:1,padding:Spacing.md}, sdNumber:{...Typography.stardateXL}, sdEarth:{...Typography.labelSM,color:Colors.textSecondary,marginTop:2},
  sdBadge:{paddingHorizontal:Spacing.md,paddingVertical:4,marginRight:Spacing.sm,borderWidth:1,borderColor:Colors.textMuted,borderRadius:Radius.xs},
  sdBadgeText:{...Typography.labelSM,color:Colors.textMuted},
  section:{marginHorizontal:Spacing.md,marginTop:Spacing.md}, sectionLabel:{...Typography.labelSM,color:Colors.textMuted,marginBottom:6},
  hudRow:{flexDirection:'row',alignItems:'center',marginHorizontal:Spacing.md,marginTop:Spacing.md},
  hudCenter:{flex:1,alignItems:'center'}, timer:{...Typography.monoLG,fontSize:28,fontWeight:'900',letterSpacing:4,marginTop:6},
  stateRow:{flexDirection:'row',alignItems:'center',gap:6,marginTop:4}, recDot:{width:8,height:8,borderRadius:4}, stateText:{...Typography.labelSM,color:Colors.textSecondary},
  orbContainer:{alignItems:'center',marginTop:Spacing.xl,marginBottom:Spacing.lg},
  orbRing:{position:'absolute',width:136,height:136,borderRadius:68,borderWidth:2,top:-8,left:-8},
  orb:{width:120,height:120,borderRadius:60,alignItems:'center',justifyContent:'center',elevation:12,shadowColor:Colors.lcarsPink,shadowOffset:{width:0,height:0},shadowRadius:20,shadowOpacity:0.6},
  orbIcon:{fontSize:28,color:Colors.black}, orbLabel:{...Typography.labelSM,color:Colors.black,marginTop:2},
  actionRow:{flexDirection:'row',gap:Spacing.sm,marginHorizontal:Spacing.md,marginTop:Spacing.md},
  tagInput:{flexDirection:'row',alignItems:'center',borderWidth:1,borderRadius:Radius.md,backgroundColor:Colors.spacePanel,paddingHorizontal:Spacing.md,height:44},
  tagHash:{...Typography.labelLG,marginRight:6}, tagInputField:{flex:1,...Typography.bodyMD,color:Colors.textPrimary},
  bottomChrome:{flexDirection:'row',height:12,gap:2,marginHorizontal:Spacing.md,marginTop:Spacing.xl,borderRadius:Radius.xs,overflow:'hidden'},
  chromeBlock:{borderRadius:2},
});
