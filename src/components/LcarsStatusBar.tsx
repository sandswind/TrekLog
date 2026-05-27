import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors, Typography } from '../theme';

interface Props { status?: string; stardate?: string; isRecording?: boolean; }

export const LcarsStatusBar: React.FC<Props> = ({ status='SYSTEMS NOMINAL', stardate, isRecording=false }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (isRecording) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim,{toValue:0.3,duration:500,useNativeDriver:true}),
        Animated.timing(pulseAnim,{toValue:1,duration:500,useNativeDriver:true}),
      ])).start();
    } else { pulseAnim.stopAnimation(); pulseAnim.setValue(1); }
  }, [isRecording]);

  return (
    <View style={styles.container}>
      <View style={styles.leftBlocks}>
        <View style={[styles.block,{backgroundColor:Colors.lcarsOrange,width:36}]}/>
        <View style={[styles.block,{backgroundColor:Colors.lcarsPurple,width:20}]}/>
        <View style={[styles.block,{backgroundColor:Colors.lcarsPeriwinkle,width:14}]}/>
      </View>
      <View style={styles.center}>
        {isRecording?(
          <View style={styles.recordRow}>
            <Animated.View style={[styles.recDot,{opacity:pulseAnim}]}/>
            <Text style={[styles.statusText,{color:Colors.lcarsPink}]}>REC</Text>
          </View>
        ):<Text style={styles.statusText}>{status}</Text>}
      </View>
      <View style={styles.rightBlocks}>
        {stardate?<Text style={styles.stardateText}>{stardate}</Text>:null}
        <View style={[styles.block,{backgroundColor:Colors.lcarsGold,width:14}]}/>
        <View style={[styles.block,{backgroundColor:Colors.lcarsTan,width:24}]}/>
        <View style={[styles.block,{backgroundColor:Colors.lcarsOrange,width:40}]}/>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container:   { flexDirection:'row', alignItems:'center', height:40, backgroundColor:Colors.spaceDark, borderTopWidth:2, borderTopColor:Colors.lcarsOrange },
  leftBlocks:  { flexDirection:'row', height:'100%', alignItems:'stretch', gap:2, paddingVertical:6, paddingLeft:8 },
  rightBlocks: { flexDirection:'row', height:'100%', alignItems:'center', gap:2, paddingVertical:6, paddingRight:8 },
  block:       { borderRadius:2, height:'100%' },
  center:      { flex:1, alignItems:'center', justifyContent:'center' },
  statusText:  { ...Typography.monoSM, color:Colors.textSecondary, letterSpacing:2 },
  stardateText:{ ...Typography.monoSM, color:Colors.lcarsGold, letterSpacing:1.5, marginRight:8 },
  recordRow:   { flexDirection:'row', alignItems:'center', gap:6 },
  recDot:      { width:8, height:8, borderRadius:4, backgroundColor:Colors.lcarsPink },
});
