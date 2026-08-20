import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { COLORS } from '@/constants/moa-colors';

// native-stack의 headerBackButtonDisplayMode:'minimal'이 이 프로젝트 라이브러리 조합(Expo 54 /
// react-native-screens 4.16 / reanimated 4.1)에서 뒤로가기 버튼이 계속 깜빡이는 문제가 있어서,
// 그 기능 대신 직접 만든 화살표 버튼으로 대체함.
export function HeaderBackButton() {
  return (
    <Pressable onPress={() => router.back()} hitSlop={12} style={styles.button}>
      <Text style={styles.arrow}>‹</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { paddingRight: 14, paddingVertical: 4 },
  arrow: { fontSize: 36, fontWeight: '600', color: COLORS.ink },
});
