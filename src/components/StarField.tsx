import React, { useEffect, useRef, useMemo } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import { Colors } from '../theme';
const { width: W, height: H } = Dimensions.get('window');
const STAR_COLORS = ['#FFFFFF','#AAAAFF','#FFEECC','#CCDDFF','#FFEEFF'];
const NUM_STARS = 120;

export const StarField: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const stars = useMemo(() => Array.from({ length: NUM_STARS }, (_, i) => ({
    id: i, x: Math.random()*W, y: Math.random()*H,
    size: Math.random()<0.15?2.5:Math.random()<0.4?1.5:1,
    opacity: new Animated.Value(Math.random()),
    duration: 1500+Math.random()*3000,
    color: STAR_COLORS[Math.floor(Math.random()*STAR_COLORS.length)],
  })), []);

  useEffect(() => {
    stars.forEach(star => {
      const twinkle = () => Animated.sequence([
        Animated.timing(star.opacity,{toValue:Math.random()*0.5+0.5,duration:star.duration,useNativeDriver:true}),
        Animated.timing(star.opacity,{toValue:Math.random()*0.2+0.1,duration:star.duration,useNativeDriver:true}),
      ]).start(()=>twinkle());
      setTimeout(twinkle, Math.random()*2000);
    });
  }, []);

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={styles.bgBase}/>
      <View style={styles.bgNebula1}/>
      <View style={styles.bgNebula2}/>
      {stars.map(star => (
        <Animated.View key={star.id} style={[styles.star,{left:star.x,top:star.y,width:star.size,height:star.size,borderRadius:star.size/2,backgroundColor:star.color,opacity:star.opacity}]}/>
      ))}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  bgBase: { ...StyleSheet.absoluteFill, backgroundColor: Colors.deepSpace },
  bgNebula1: { position:'absolute',top:-100,left:-80,width:340,height:340,borderRadius:170,backgroundColor:'rgba(40,30,90,0.35)' },
  bgNebula2: { position:'absolute',bottom:-80,right:-60,width:260,height:260,borderRadius:130,backgroundColor:'rgba(60,30,10,0.30)' },
  star: { position:'absolute' },
});
