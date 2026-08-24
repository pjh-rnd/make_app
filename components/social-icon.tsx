import Svg, { Path } from 'react-native-svg';
import { StyleSheet, View } from 'react-native';

// 2026-08-24: 사용자가 "이모지가 이상해 보인다"고 지적함 — 특히 구글 아이콘이 원래 파란 단색
// "G" 글자였는데, 실제로 알아볼 수 있는 구글 로고는 4색(빨/노/초/파)이라 그것만으로는 안 닮아
// 보였음. `react-native-svg`(이미 프로젝트 의존성에 있던 패키지)로 실제 브랜드 아이콘 모양에
// 훨씬 가까운 벡터 아이콘으로 교체함(정식 로고 에셋 파일을 쓰는 건 아니고, 각 브랜드가 공개한
// 아이콘 모양을 손으로 그린 벡터 경로임 — 카카오톡 말풍선/네이버 N/구글 4색 G).
const KAKAO_YELLOW = '#FEE500';
const NAVER_GREEN = '#03C75A';

export function KakaoIcon({ size = 52 }: { size?: number }) {
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: KAKAO_YELLOW },
      ]}>
      <Svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24">
        {/* 카카오톡 말풍선 아이콘(둥근 말풍선 + 아래 왼쪽으로 뻗은 작은 꼬리) */}
        <Path
          fill="#391B1B"
          d="M12 3C6.48 3 2 6.48 2 10.8c0 2.85 1.9 5.35 4.75 6.74-.16.6-1.03 3.7-1.05 3.94 0 0-.02.19.1.27.12.08.26.02.26.02.35-.05 4.02-2.63 4.65-3.06.62.09 1.26.14 1.9.14 5.52 0 10-3.48 10-7.8S17.52 3 12 3z"
        />
      </Svg>
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
      <Svg width={size * 0.46} height={size * 0.46} viewBox="0 0 24 24">
        {/* 네이버 로고의 말풍선 모양 "N" — 두꺼운 사선 획으로 구성됨 */}
        <Path fill="#FFFFFF" d="M16.3 12.9 7.9 1H1v22h6.7V11.1l8.4 11.9H23V1h-6.7z" />
      </Svg>
    </View>
  );
}

export function GoogleIcon({ size = 52 }: { size?: number }) {
  return (
    <View
      style={[
        styles.circle,
        styles.googleCircle,
        { width: size, height: size, borderRadius: size / 2 },
      ]}>
      <Svg width={size * 0.5} height={size * 0.5} viewBox="0 0 48 48">
        {/* 구글 공식 4색 "G" 로고(노랑/빨강/초록/파랑 4조각) */}
        <Path
          fill="#FFC107"
          d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20c11.045 0 20-8.955 20-20 0-1.341-.138-2.65-.389-3.917z"
        />
        <Path
          fill="#FF3D00"
          d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
        />
        <Path
          fill="#4CAF50"
          d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
        />
        <Path
          fill="#1976D2"
          d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  googleCircle: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E3E1D9' },
});
