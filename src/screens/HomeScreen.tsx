import React, { useEffect, useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Animated, TextInput, Alert, Dimensions, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Typography, Spacing, Radius } from '../theme';
import { StarField } from '../components/StarField';
import { LcarsHeader } from '../components/LcarsHeader';
import { LcarsStatusBar } from '../components/LcarsStatusBar';
import { LogTypeSelector } from '../components/LogTypeSelector';
import { LcarsButton } from '../components/LcarsButton';
import { useLogStore } from '../store/useLogStore';
import { LogEntry, LogType } from '../db/schema';
import { stardateLabel, formatEarthDate, formatEarthDateShort, formatDuration } from '../utils/stardate';
import { useSounds } from '../hooks/useSounds';
import type { RootStackParamList } from '../../App';

const LOG_TYPE_COLORS: Record<LogType,string> = { captain:Colors.captainYellow, personal:Colors.personalBlue, medical:Colors.medicalRed };
const LOG_TYPE_LABELS: Record<LogType,string> = { captain:"CAPTAIN'S LOG", personal:'PERSONAL LOG', medical:'MEDICAL LOG' };

const LogCard: React.FC<{entry:LogEntry;onPress:()=>void;onDelete:()=>void;accentColor:string}> = ({entry,onPress,onDelete,accentColor}) => {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  useEffect(()=>{ Animated.parallel([Animated.timing(slideAnim,{toValue:1,duration:350,useNativeDriver:true}),Animated.timing(opacityAnim,{toValue:1,duration:350,useNativeDriver:true})]).start(); },[]);
  const createdAt = new Date(entry.createdAt);
  const timeStr = createdAt.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false});
  const tags: string[] = JSON.parse(entry.tags||'[]');
  return (
    <Animated.View style={{opacity:opacityAnim,transform:[{translateX:slideAnim.interpolate({inputRange:[0,1],outputRange:[-30,0]})}]}}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.card}>
        <View style={[styles.cardStripe,{backgroundColor:accentColor}]}/>
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <Text style={styles.cardTitle} numberOfLines={2}>{entry.title}</Text>
            <View style={[styles.durationBadge,{borderColor:accentColor}]}>
              <Text style={[styles.durationText,{color:accentColor}]}>{formatDuration(entry.durationSecs)}</Text>
            </View>
          </View>
          <View style={styles.cardDates}>
            <Text style={styles.stardateSmall}>SD {entry.stardate}</Text>
            <Text style={styles.timeSmall}>{timeStr} HRS</Text>
          </View>
          {tags.length>0&&<View style={styles.tagsRow}>{tags.slice(0,3).map(tag=><View key={tag} style={[styles.tag,{borderColor:accentColor}]}><Text style={[styles.tagText,{color:accentColor}]}>#{tag}</Text></View>)}</View>}
        </View>
        <TouchableOpacity onPress={onDelete} style={styles.deleteBtn} hitSlop={{top:8,bottom:8,left:8,right:8}}>
          <Text style={styles.deleteBtnText}>✕</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

const DateGroupHeader: React.FC<{date:string}> = ({date}) => {
  const d = new Date(date+'T12:00:00');
  return (
    <View style={styles.groupHeader}>
      <View style={styles.groupBlock}/>
      <View style={styles.groupDates}>
        <Text style={styles.groupEarth}>{formatEarthDateShort(d)}</Text>
        <Text style={styles.groupStardate}>{stardateLabel(d)}</Text>
      </View>
      <View style={styles.groupLine}/>
    </View>
  );
};

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { grouped, selectedType, isLoading, loadLogs, setSelectedType, removeLog, setSearchQuery } = useLogStore();
  const { play } = useSounds();
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const headerAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(useCallback(()=>{ loadLogs(); },[loadLogs]));
  useEffect(()=>{ Animated.timing(headerAnim,{toValue:1,duration:800,useNativeDriver:true}).start(); },[]);

  const accentColor = LOG_TYPE_COLORS[selectedType];

  type ListItem = {type:'header';date:string}|{type:'entry';entry:LogEntry};
  const listData: ListItem[] = grouped.flatMap(({date,items})=>[{type:'header' as const,date},...items.map(entry=>({type:'entry' as const,entry}))]);

  const EmptyState = () => (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>🖖</Text>
      <Text style={styles.emptyTitle}>NO LOGS RECORDED</Text>
      <Text style={styles.emptySubtitle}>The stars await your first entry, Captain.</Text>
      <LcarsButton label="BEGIN RECORDING" onPress={()=>{play('ding');navigation.navigate('Record');}} color={accentColor} size="md" style={{marginTop:Spacing.lg}}/>
    </View>
  );

  return (
    <View style={styles.root}>
      <StarField/>
      <SafeAreaView style={styles.safe} edges={['top','left','right']}>
        <Animated.View style={{opacity:headerAnim}}>
          <LcarsHeader title={LOG_TYPE_LABELS[selectedType]} subtitle="TREKLOG — STARFLEET PERSONAL ARCHIVE" accentColor={accentColor}/>
        </Animated.View>
        <View style={[styles.stardateBar,{borderColor:accentColor}]}>
          <View style={styles.stardateLeft}>
            <Text style={[styles.stardateBig,{color:accentColor}]}>{stardateLabel()}</Text>
            <Text style={styles.earthDate}>{formatEarthDate()}</Text>
          </View>
          <View style={styles.stardateRight}>
            <Text style={[styles.entryCount,{color:accentColor}]}>{grouped.reduce((a,g)=>a+g.items.length,0)}</Text>
            <Text style={styles.entryCountLabel}>LOG{'\n'}ENTRIES</Text>
          </View>
        </View>
        <View style={styles.selectorRow}><LogTypeSelector selected={selectedType} onChange={t=>{play('beep');setSelectedType(t);}}/></View>
        {showSearch&&(
          <View style={[styles.searchBar,{borderColor:accentColor}]}>
            <Text style={[styles.searchIcon,{color:accentColor}]}>⌕</Text>
            <TextInput style={styles.searchInput} placeholder="SEARCH LOGS..." placeholderTextColor={Colors.textMuted} value={search} onChangeText={t=>{setSearch(t);setSearchQuery(t);}} autoFocus/>
            <TouchableOpacity onPress={()=>{setShowSearch(false);setSearch('');setSearchQuery('');}}><Text style={styles.searchClose}>✕</Text></TouchableOpacity>
          </View>
        )}
        <FlatList
          data={listData}
          keyExtractor={(item,i)=>item.type==='header'?`h-${item.date}`:`e-${item.entry.id}`}
          renderItem={({item})=>item.type==='header'?<DateGroupHeader date={item.date}/>:<LogCard entry={item.entry} accentColor={accentColor} onPress={()=>{play('beep');navigation.navigate('LogDetail',{entryId:item.entry.id});}} onDelete={()=>{play('error');Alert.alert('DELETE LOG ENTRY',`Confirm deletion of log from Stardate ${item.entry.stardate}?`,[{text:'CANCEL',style:'cancel'},{text:'DELETE',style:'destructive',onPress:()=>removeLog(item.entry.id,item.entry.audioUri)}],{userInterfaceStyle:'dark'});}}/>}
          contentContainerStyle={[styles.list,grouped.length===0&&styles.listEmpty]}
          ListEmptyComponent={<EmptyState/>}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadLogs} tintColor={accentColor} colors={[accentColor]}/>}
        />
        <View style={[styles.actionBar,{borderTopColor:accentColor}]}>
          <LcarsButton label="⌕" onPress={()=>{play('beep');setShowSearch(v=>!v);}} color={Colors.lcarsPeriwinkle} variant="ghost" size="sm" style={styles.actionBtnSide}/>
          <LcarsButton label="● NEW LOG ENTRY" onPress={()=>{play('ding');navigation.navigate('Record');}} color={accentColor} size="lg" style={styles.actionBtnMain}/>
          <LcarsButton label="≡" onPress={()=>play('beep')} color={Colors.lcarsPeriwinkle} variant="ghost" size="sm" style={styles.actionBtnSide}/>
        </View>
        <LcarsStatusBar stardate={`SD ${stardateLabel().replace('STARDATE ','')}`}/>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex:1, backgroundColor:Colors.deepSpace }, safe: { flex:1 },
  stardateBar: { flexDirection:'row', alignItems:'center', marginHorizontal:Spacing.md, marginTop:Spacing.sm, padding:Spacing.md, borderWidth:1, borderRadius:Radius.md, backgroundColor:Colors.overlay20 },
  stardateLeft: { flex:1 }, stardateBig: { ...Typography.stardateXL, lineHeight:28 }, earthDate: { ...Typography.labelSM, color:Colors.textSecondary, marginTop:2 },
  stardateRight: { alignItems:'center', paddingLeft:Spacing.md }, entryCount: { ...Typography.displayLG, lineHeight:32 }, entryCountLabel: { ...Typography.labelSM, color:Colors.textMuted, textAlign:'center' },
  selectorRow: { marginHorizontal:Spacing.md, marginTop:Spacing.sm },
  searchBar: { flexDirection:'row', alignItems:'center', marginHorizontal:Spacing.md, marginTop:Spacing.sm, borderWidth:1, borderRadius:Radius.md, backgroundColor:Colors.spacePanel, paddingHorizontal:Spacing.md, height:44 },
  searchIcon: { ...Typography.labelLG, marginRight:8 }, searchInput: { flex:1, ...Typography.bodyMD, color:Colors.textPrimary }, searchClose: { ...Typography.labelMD, color:Colors.textMuted, paddingLeft:8 },
  list: { padding:Spacing.md, gap:Spacing.sm, paddingBottom:Spacing.xxl }, listEmpty: { flex:1, justifyContent:'center' },
  groupHeader: { flexDirection:'row', alignItems:'center', marginTop:Spacing.md, marginBottom:Spacing.xs, gap:Spacing.sm },
  groupBlock: { width:18, height:18, borderRadius:3, backgroundColor:Colors.lcarsPurple }, groupDates: { flex:0 },
  groupEarth: { ...Typography.labelSM, color:Colors.textSecondary }, groupStardate: { ...Typography.monoSM, color:Colors.lcarsGold, marginTop:1 },
  groupLine: { flex:1, height:1, backgroundColor:Colors.borderDim },
  card: { flexDirection:'row', backgroundColor:Colors.spacePanel, borderRadius:Radius.md, overflow:'hidden', marginBottom:2 },
  cardStripe: { width:4 }, cardBody: { flex:1, padding:Spacing.md },
  cardTop: { flexDirection:'row', alignItems:'flex-start', gap:Spacing.sm },
  cardTitle: { ...Typography.bodyLG, color:Colors.textPrimary, flex:1, fontWeight:'600' },
  durationBadge: { borderWidth:1, borderRadius:Radius.xs, paddingHorizontal:6, paddingVertical:2 }, durationText: { ...Typography.monoSM },
  cardDates: { flexDirection:'row', gap:Spacing.md, marginTop:4 }, stardateSmall: { ...Typography.monoSM, color:Colors.lcarsGold }, timeSmall: { ...Typography.monoSM, color:Colors.textMuted },
  tagsRow: { flexDirection:'row', gap:6, marginTop:6, flexWrap:'wrap' }, tag: { borderWidth:1, borderRadius:Radius.xs, paddingHorizontal:6, paddingVertical:2 }, tagText: { ...Typography.labelSM, fontSize:10 },
  deleteBtn: { justifyContent:'center', paddingHorizontal:Spacing.md }, deleteBtnText: { ...Typography.labelMD, color:Colors.textMuted },
  empty: { alignItems:'center', paddingVertical:Spacing.xxl }, emptyIcon: { fontSize:48, marginBottom:Spacing.md },
  emptyTitle: { ...Typography.displayMD, color:Colors.lcarsOrange, marginBottom:Spacing.sm }, emptySubtitle: { ...Typography.bodyMD, color:Colors.textSecondary, textAlign:'center' },
  actionBar: { flexDirection:'row', alignItems:'center', paddingHorizontal:Spacing.md, paddingVertical:Spacing.sm, borderTopWidth:1, gap:Spacing.sm, backgroundColor:Colors.overlay20 },
  actionBtnMain: { flex:1 }, actionBtnSide: { width:44 },
});
