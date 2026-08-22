// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
// ⚠️ 여기 있는 항목은 절대 지우거나 이름을 바꾸지 말고 "추가"만 할 것 — 이 객체가
// IconSymbolName 타입(= keyof typeof MAPPING)의 기준이라, 기존 키를 지우면 그 아이콘을 쓰던
// 다른 화면(예: 탭 아이콘)이 안드로이드/웹에서 통째로 안 보이게 됨(iOS는 SF Symbol 이름을
// 직접 쓰는 icon-symbol.ios.tsx라 이 매핑과 무관하게 항상 보임 — 그래서 iOS에선 문제가 안 보였던 것).
// 새 탭/아이콘을 추가할 땐 여기 새 줄만 보태면 됨.
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'heart.fill': 'favorite',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'square.grid.2x2.fill': 'apps',
  'bell.fill': 'notifications',
  'person.crop.circle.fill': 'account-circle',
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
