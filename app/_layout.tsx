import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { HeaderBackButton } from '@/components/header-back-button';

export const unstable_settings = {
  anchor: '(tabs)',
};

// edit-profile 헤더 옵션 — 컴포넌트 밖에 고정해서, 렌더링마다 새 객체/함수가 생겨 navigator가
// "옵션이 바뀌었다"고 오인하는 일이 없게 함
const EDIT_PROFILE_OPTIONS = { title: '마이페이지', headerLeft: () => <HeaderBackButton /> };

export default function RootLayout() {
  // 화면 본문(COLORS)이 아직 라이트 팔레트로 고정돼 있어서, 시스템 다크모드를 그대로 따라가면
  // 헤더/탭바만 어두워지고 나머지는 밝은 채로 남아 어색해짐. 그래서 일단 라이트로 통일해둠
  // — 나중에 COLORS에 다크 팔레트를 따로 만들면 그때 시스템 설정을 다시 따라가게 하면 됨.
  return (
    <ThemeProvider value={DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="edit-profile" options={EDIT_PROFILE_OPTIONS} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
