import * as Notifications from 'expo-notifications';

// 알림이 예약만 되고 화면에 안 뜨는 걸 막으려면 반드시 핸들러를 등록해야 함
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// 이 세션에서 이미 권한을 물어봤으면 또 안 물어봄 (거절했는데 찜할 때마다 계속 뜨면 성가심)
let askedThisSession = false;

async function ensurePermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  if (askedThisSession) return false;
  askedThisSession = true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// 마감 하루 전 오전 9시에 알림 예약. 이미 그 시각이 지났으면(마감이 오늘/내일이거나 이미 지남) 예약 안 함.
// 성공하면 알림 id를 돌려줌 (나중에 취소할 때 필요) — 예약 안 했으면 null.
export async function scheduleDeadlineReminder(
  policyTitle: string,
  deadlineDate: string
): Promise<string | null> {
  const granted = await ensurePermission();
  if (!granted) return null;

  const deadline = new Date(deadlineDate);
  const reminderTime = new Date(deadline);
  reminderTime.setDate(reminderTime.getDate() - 1);
  reminderTime.setHours(9, 0, 0, 0);

  if (reminderTime.getTime() <= Date.now()) return null;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: '⏰ 마감이 내일이에요',
      body: `${policyTitle} — 신청 잊지 마세요!`,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderTime },
  });
  return id;
}

export async function cancelDeadlineReminder(notificationId: string) {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}
