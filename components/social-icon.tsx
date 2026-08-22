import { StyleSheet, Text, View } from 'react-native';

// 카카오톡 말풍선 로고, 네이버 초록 원 로고를 실제 브랜드 아이콘 파일 없이 View/Text 조합만으로
// 흉내낸 간단한 버전. (진짜 브랜드 가이드라인에 맞는 정식 로고 에셋이 필요하면 나중에 png/svg로 교체)
const KAKAO_YELLOW = '#FEE500';
const KAKAO_GLYPH = '#391B1B';
const NAVER_GREEN = '#03C75A';

export function KakaoIcon({ size = 52 }: { size?: number }) {
  const glyphW = size * 0.42;
  const glyphH = size * 0.32;
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: KAKAO_YELLOW },
      ]}>
      <View
        style={{
          width: glyphW,
          height: glyphH,
          borderRadius: glyphH / 2,
          backgroundColor: KAKAO_GLYPH,
        }}
      />
      {/* 말풍선 꼬리 */}
      <View
        style={{
          position: 'absolute',
          width: glyphH * 0.4,
          height: glyphH * 0.4,
          backgroundColor: KAKAO_GLYPH,
          bottom: size * 0.3,
          left: size * 0.35,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

export function NaverIcon({ size = 52 }: { size?: number }) {
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: NAVER_GREEN },
      ]}>
      <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: size * 0.42 }}>N</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
});
