import { Redirect, Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { COLORS } from '@/constants/moa-colors';
import { useSession } from '@/lib/useSession';

export default function TabLayout() {
  const { session, loading } = useSession();

  // 세션 확인 중엔 아직 아무것도 안 그림 (깜빡임 방지)
  if (loading) return null;
  // 로그인 안 되어 있으면 탭 화면 대신 로그인 화면으로 보냄
  if (!session) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        // 전엔 constants/theme.ts의 시스템 다크모드용 색(Colors[colorScheme].tint)을 썼는데,
        // 이 앱 화면은 지금 라이트 팔레트로 고정돼 있어서(app/_layout.tsx 참고) 폰이 다크모드일
        // 땐 이 값이 흰색('#fff')이 돼서 밝은 탭바 위에서 아이콘이 안 보이는 문제가 있었음.
        // 그래서 시스템 설정과 무관하게 이 앱 색상(COLORS)으로 고정함 — 선택된 탭은 민트,
        // 나머지는 진한 회색으로 항상 또렷하게 보이게 함.
        tabBarActiveTintColor: COLORS.mint,
        tabBarInactiveTintColor: COLORS.inkSoft,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: '전체',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="square.grid.2x2.fill" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
