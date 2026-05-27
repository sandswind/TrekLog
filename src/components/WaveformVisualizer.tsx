import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ViewStyle } from 'react-native';
import { Colors } from '../theme';

interface Props { isActive: boolean; barCount?: number; color?: string; height?: number; style?: ViewStyle; amplitudes?: number[]; }

export const WaveformVisualizer: React.FC<Props> = ({ isActive, barCount=40, color=Colors.lcarsOrange, height=80, style, amplitudes }) => {
  const bars = useRef<Animated.Value[]>(Array.from({length:barCount},()=>new Animated.Value(0.1))).current;
  const animRefs = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    if (isActive) {
      bars.forEach((bar,i) => {
        const animate = () => {
          const amp = amplitudes?.[i%(amplitudes.length||1)];
          const target = amp!=null?amp:Math.random()*0.85+0.1;
          animRefs.current[i] = Animated.loop(Animated.sequence([
            Animated.timing(bar,{toValue:target,duration:80+Math.random()*120,useNativeDriver:false}),
            Animated.timing(bar,{toValue:Math.random()*0.3+0.05,duration:80+Math.random()*120,useNativeDriver:false}),
          ]));
          animRefs.current[i].start();
        };
        setTimeout(animate, i*20);
      });
    } else {
      animRefs.current.forEach(a=>a?.stop());
      bars.forEach(bar=>Animated.timing(bar,{toValue:0.06,duration:300,useNativeDriver:false}).start());
    }
    return () => { animRefs.current.forEach(a=>a?.stop()); };
  }, [isActive]);

  return (
    <View style={[styles.container,{height},style]}>
      {bars.map((bar,i) => {
        const isCenter = Math.abs(i-barCount/2)<barCount*0.15;
        return (
          <Animated.View key={i} style={[styles.bar,{
            backgroundColor: isCenter?color:Colors.lcarsSkyBlue,
            height: bar.interpolate({inputRange:[0,1],outputRange:['0%','100%']}),
            opacity: bar.interpolate({inputRange:[0,0.3,1],outputRange:[0.3,0.7,1]}),
          }]}/>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:2, paddingHorizontal:8 },
  bar: { flex:1, borderRadius:2, maxWidth:6, minHeight:3 },
});
