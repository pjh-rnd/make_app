import { Platform, StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/constants/moa-colors';

// 민트색 카메라 뷰파인더 프레임(모서리 2개 — 손가락처럼 두 변의 길이가 다른 꺾쇠)에 "Fit Me"
// 글자를 넣은 로고. 왼쪽 위는 엄지(위쪽, 긴 변)·검지(왼쪽, 짧은 변), 오른쪽 아래는 그 대각선
// 반대(아래쪽 긴 변·오른쪽 짧은 변). 얇은 테두리(border) 대신 끝이 둥근 알약(pill) 모양 막대
// 두 개를 겹쳐서 그림 — border 방식은 아무리 두껍게 해도 바깥쪽 끝이 뾰족한 사각으로 남아서
// "두껍고 둥글둥글"한 느낌이 안 났는데, 이렇게 하면 막대 끝까지 다 둥글게 마감됨.
// 가로 여백을 확 줄이고 세로 여백을 살려서 전체 액자가 정사각형에 가깝게 보이게 함
// (글자 폭이 원래 넓어서 가로 padding까지 넉넉히 주면 액자가 옆으로 길쭉해짐).
// 액자 틀(꺾쇠)이 글자에 바짝 붙어서 "딱 맞게 담긴" 느낌이 나도록 여백을 더 줄이고, 그만큼
// 글자도 키워서 액자 안이 꽉 차 보이게 함. 꺾쇠 길이는 더 길게 늘리고, 그만큼 여백은 더 줄여서
// 꺾쇠가 텍스트 쪽으로 바짝 모여드는(겹쳐 들어오는) 느낌을 냄.
// compact=true면 홈 화면 상단바처럼 작은 자리에 쓰는 축소판.
// scale은 compact/large 두 크기 기준에서 한 번 더 배율을 곱하는 옵션(2026-08-23 추가) — 정책
// 상세 화면의 "정책 요약" 뱃지처럼 compact보다도 더 작게 써야 하는 자리가 생겨서 추가함
// (홈 화면/로그인 화면은 scale을 안 넘기니 기본값 1이라 기존 크기 그대로 유지됨).
export function FitMeLogo({ compact = false, scale = 1 }: { compact?: boolean; scale?: number }) {
  const longArm = (compact ? 24 : 40) * scale;
  const shortArm = (compact ? 17 : 26) * scale;
  const thickness = (compact ? 6 : 10) * scale;
  const radius = thickness / 2;
  const paddingHorizontal = (compact ? 6 : 10) * scale;
  const paddingVertical = (compact ? 8 : 16) * scale;
  const fontSize = (compact ? 29 : 46) * scale;

  const bar = { borderRadius: radius, backgroundColor: COLORS.mint };
  const hBar = { ...bar, width: longArm, height: thickness };
  const vBar = { ...bar, width: thickness, height: shortArm };

  return (
    <View style={[styles.frame, { paddingHorizontal, paddingVertical }]}>
      <View style={[styles.corner, hBar, { top: 0, left: 0 }]} />
      <View style={[styles.corner, vBar, { top: 0, left: 0 }]} />
      <View style={[styles.corner, hBar, { bottom: 0, right: 0 }]} />
      <View style={[styles.corner, vBar, { bottom: 0, right: 0 }]} />

      <Text style={[styles.text, { fontSize }]}>Fit Me</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { position: 'relative', alignItems: 'center', justifyContent: 'center' },

  corner: { position: 'absolute' },

  // 브랜드 타이틀(app/(tabs)/index.tsx, app/login.tsx)과 같은 둥근 서체를 씀
  text: {
    fontWeight: '700',
    color: COLORS.ink,
    fontFamily: Platform.select({ ios: 'Arial Rounded MT Bold', android: 'sans-serif-rounded' }),
  },
});
