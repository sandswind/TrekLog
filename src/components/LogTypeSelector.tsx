import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Typography } from '../theme';
import { LogType } from '../db/schema';

const LOG_TYPE_CONFIG: Record<LogType,{label:string;sublabel:string;color:string}> = {
  captain:  { label:'CAPTAIN',  sublabel:"CAPTAIN'S LOG",  color:Colors.captainYellow },
  personal: { label:'PERSONAL', sublabel:'PERSONAL LOG',   color:Colors.personalBlue  },
  medical:  { label:'MEDICAL',  sublabel:'MEDICAL LOG',    color:Colors.medicalRed    },
};

interface Props { selected: LogType; onChange: (t: LogType)=>void; }

export const LogTypeSelector: React.FC<Props> = ({ selected, onChange }) => (
  <View style={styles.row}>
    {(Object.keys(LOG_TYPE_CONFIG) as LogType[]).map(type => {
      const cfg = LOG_TYPE_CONFIG[type];
      const isActive = selected===type;
      return (
        <TouchableOpacity key={type} onPress={()=>onChange(type)} activeOpacity={0.8}
          style={[styles.btn,{backgroundColor:isActive?cfg.color:Colors.spacePanel,borderColor:cfg.color}]}>
          <Text style={[styles.label,{color:isActive?Colors.black:cfg.color}]}>{cfg.label}</Text>
          <Text style={[styles.sub,{color:isActive?Colors.black:Colors.textMuted}]}>{cfg.sublabel}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection:'row', gap:8 },
  btn: { flex:1, paddingVertical:10, paddingHorizontal:8, borderRadius:8, borderWidth:1.5, alignItems:'center' },
  label: { ...Typography.labelSM, fontWeight:'800' },
  sub: { ...Typography.bodySM, textTransform:'uppercase', letterSpacing:0.8, marginTop:2, fontSize:9 },
});
