import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { TabBar, type TabItem } from './TabBar';
import { useChildSafe } from '../hooks/useChildSafe';
import { makeStyles } from '../theme/theme';

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
  active: 'learn' | 'practice' | 'live' | 'community' | 'plans' | 'profile';
  children: React.ReactNode;
}> = ({ active, children }) => {
  const s = useS();
  const { childSafe } = useChildSafe();

  const items: TabItem[] = [
    { key: 'learn', label: 'Learn', onPress: () => router.replace('/home') },
    { key: 'practice', label: 'Practice', onPress: () => router.replace('/simulator') },
    { key: 'live', label: 'Live', onPress: () => router.replace('/live') },
    ...(childSafe ? [] : [{ key: 'community' as const, label: 'Community', onPress: () => router.replace('/community') }]),
    // Hidden for a minor for the same reason community is, and it is the more
    // important of the two: a minor cannot self-purchase (#96), so a tab that
    // leads to a paywall is a doorway that should not exist for them. The plans
    // screen refuses them on arrival as well, because hiding a tab is not a
    // control, only a courtesy.
    ...(childSafe ? [] : [{ key: 'plans' as const, label: 'Plans', onPress: () => router.replace('/plans') }]),
    { key: 'profile', label: 'Profile', onPress: () => router.replace('/profile') },
  ];

  return (
    <View style={s.shell}>
      <View style={s.body}>{children}</View>
      <TabBar items={items} active={active} />
    </View>
  );
};

const useS = makeStyles((colors) => ({
  shell: { flex: 1, backgroundColor: colors.cream },
  body: { flex: 1 },
}));
