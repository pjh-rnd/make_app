import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  // 화면 본문(COLORS)이 아직 라이트 팔레트로 고정돼 있어서, 시스템 다크모드를 그대로 따라가면
  // 헤더/탭바만 어두워지고 나머지는 밝은 채로 남아 어색해짐. 그래서 일단 라이트로 통일해둠
  // — 나중에 COLORS에 다크 팔레트를 따로 만들면 그때 시스템 설정을 다시 따라가게 하면 됨.
  return (
    <ThemeProvider value={DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        {/* 네이티브 헤더 대신 화면 안에서 직접 뒤로가기+제목을 그림 (iOS가 헤더 버튼에 자동으로
            씌우는 원형 배경이 계속 깜빡이는 문제가 있어서, 네이티브 헤더 자체를 안 씀) */}
        <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
