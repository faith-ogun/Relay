import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { TabBar, type TabItem } from './TabBar';
import { useChildSafe } from '../hooks/useChildSafe';
import { colors } from '../theme/tokens';

/**
 * The tab shell every top-level screen sits inside.
 *
 * Implemented as a component rather than expo-router's Tabs navigator on
 * purpose: the tabs a person sees depend on who they are. A minor has no
 * community tab at all, and a navigator with a hidden route still keeps it
 * reachable by URL. Composing the bar means the surfaces a child mode account
 * cannot use simply do not exist for them.
 */
export const AppTabs: React.FC<{
  active: 'learn' | 'practice' | 'live' | 'community' | 'profile';
  children: React.ReactNode;
}> = ({ active, children }) => {
  const { childSafe } = useChildSafe();

  const items: TabItem[] = [
    { key: 'learn', label: 'Learn', onPress: () => router.replace('/home') },
    { key: 'practice', label: 'Practice', onPress: () => router.replace('/simulator') },
    { key: 'live', label: 'Live', onPress: () => router.replace('/live') },
    ...(childSafe ? [] : [{ key: 'community' as const, label: 'Community', onPress: () => router.replace('/community') }]),
    { key: 'profile', label: 'Profile', onPress: () => router.replace('/profile') },
  ];

  return (
    <View style={s.shell}>
      <View style={s.body}>{children}</View>
      <TabBar items={items} active={active} />
    </View>
  );
};

const s = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.cream },
  body: { flex: 1 },
});
