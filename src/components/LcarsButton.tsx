import React, { useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated, ViewStyle, TextStyle } from 'react-native';
import { Colors, Typography, Radius } from '../theme';

type ButtonVariant = 'pill'|'block'|'round'|'ghost';
interface Props {
  label?: string; onPress: ()=>void; color?: string; textColor?: string;
  variant?: ButtonVariant; size?: 'sm'|'md'|'lg'|'xl'; disabled?: boolean;
  style?: ViewStyle; textStyle?: TextStyle; children?: React.ReactNode; active?: boolean;
}
const SIZE_MAP = {
  sm:  { height:32, minWidth:64,  paddingH:14, fontSize:11 },
  md:  { height:44, minWidth:100, paddingH:20, fontSize:13 },
  lg:  { height:56, minWidth:140, paddingH:28, fontSize:15 },
  xl:  { height:72, minWidth:72,  paddingH:0,  fontSize:18 },
};

export const LcarsButton: React.FC<Props> = ({
  label, onPress, color=Colors.lcarsOrange, textColor=Colors.black,
  variant='pill', size='md', disabled=false, style, textStyle, children, active=true,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const dim = SIZE_MAP[size];
  const handlePressIn = () => Animated.spring(scaleAnim,{toValue:0.93,useNativeDriver:true,speed:40}).start();
  const handlePressOut = () => Animated.spring(scaleAnim,{toValue:1,useNativeDriver:true,speed:20}).start();
  const borderRadius = variant==='pill'?Radius.pill:variant==='round'?dim.height/2:variant==='ghost'?Radius.md:Radius.xs;
  const bgColor = variant==='ghost'?'transparent':(active?color:Colors.spacePanel);
  const border = variant==='ghost'?{borderWidth:1.5,borderColor:color}:{};
  return (
    <TouchableOpacity onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} disabled={disabled} activeOpacity={0.85}>
      <Animated.View style={[styles.base,{height:dim.height,minWidth:variant==='round'?dim.height:dim.minWidth,width:variant==='round'?dim.height:undefined,paddingHorizontal:variant==='round'?0:dim.paddingH,borderRadius,backgroundColor:bgColor,opacity:disabled?0.4:1,...border},{transform:[{scale:scaleAnim}]},style]}>
        {children??<Text style={[styles.label,{fontSize:dim.fontSize,color:variant==='ghost'?color:textColor},textStyle]}>{label}</Text>}
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base:  { alignItems:'center', justifyContent:'center', overflow:'hidden' },
  label: { ...Typography.labelMD, fontWeight:'800' },
});
