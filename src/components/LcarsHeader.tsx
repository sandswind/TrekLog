import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Typography, LCARS_CORNER } from '../theme';

interface Props {
  title: string; subtitle?: string; accentColor?: string; rightLabel?: string; style?: ViewStyle;
}

export const LcarsHeader: React.FC<Props> = ({ title, subtitle, accentColor=Colors.lcarsOrange, rightLabel, style }) => (
  <View style={[styles.container, style]}>
    <View style={[styles.pill, { backgroundColor: accentColor }]}/>
    <View style={styles.segments}>
      <View style={[styles.segA, { backgroundColor: accentColor }]}/>
      <View style={[styles.segB, { backgroundColor: Colors.lcarsPurple }]}/>
      <View style={[styles.segC, { backgroundColor: Colors.lcarsPeriwinkle }]}/>
    </View>
    <View style={styles.titleArea}>
      <Text style={[styles.title, { color: accentColor }]}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
    {rightLabel ? (
      <View style={[styles.rightBadge, { borderColor: accentColor }]}>
        <Text style={[styles.rightLabel, { color: accentColor }]}>{rightLabel}</Text>
      </View>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  container:  { flexDirection:'row', alignItems:'center', height:64, paddingRight:16 },
  pill:       { width:LCARS_CORNER*1.4, height:64, borderTopLeftRadius:LCARS_CORNER, borderBottomLeftRadius:LCARS_CORNER },
  segments:   { flexDirection:'column', height:64, width:10, gap:2 },
  segA: { flex:2 }, segB: { flex:1.5 }, segC: { flex:1 },
  titleArea:  { flex:1, marginLeft:14, justifyContent:'center' },
  title:      { ...Typography.displayMD, lineHeight:26 },
  subtitle:   { ...Typography.labelSM, color:Colors.textSecondary, marginTop:1 },
  rightBadge: { borderWidth:1.5, borderRadius:6, paddingHorizontal:10, paddingVertical:4 },
  rightLabel: { ...Typography.monoSM },
});
