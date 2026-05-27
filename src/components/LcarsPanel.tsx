import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Typography, Radius } from '../theme';

interface Props {
  children: React.ReactNode; accentColor?: string; label?: string;
  style?: ViewStyle; bodyStyle?: ViewStyle; noPad?: boolean;
}

export const LcarsPanel: React.FC<Props> = ({ children, accentColor=Colors.lcarsPeriwinkle, label, style, bodyStyle, noPad=false }) => (
  <View style={[styles.wrapper, style]}>
    <View style={[styles.stripe, { backgroundColor: accentColor }]}/>
    <View style={styles.right}>
      {label && (
        <View style={[styles.labelRow,{borderBottomColor:accentColor}]}>
          <Text style={[styles.label,{color:accentColor}]}>{label}</Text>
          <View style={styles.dots}>
            {[0,1,2].map(i=><View key={i} style={[styles.dot,{backgroundColor:accentColor}]}/>)}
          </View>
        </View>
      )}
      <View style={[!noPad&&styles.body,bodyStyle]}>{children}</View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  wrapper:  { flexDirection:'row', borderRadius:Radius.md, overflow:'hidden', backgroundColor:Colors.spacePanel },
  stripe:   { width:5 },
  right:    { flex:1 },
  labelRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:12, paddingVertical:6, borderBottomWidth:1, borderBottomColor:Colors.borderDim },
  label:    { ...Typography.labelSM },
  dots:     { flexDirection:'row', gap:4 },
  dot:      { width:5, height:5, borderRadius:3, opacity:0.7 },
  body:     { padding:12 },
});
