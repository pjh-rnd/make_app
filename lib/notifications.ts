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

// 마감 5일 전 / 3일 전 / 1일 전, 매번 오전 9시에 알림 예약. 이미 그 시각이 지난 것(예: 마감이
// 3일 안 남아서 5일 전 시점은 이미 지났음)은 그 알림만 건너뜀 — 나머지는 정상 예약됨.
// 성공한 알림 id들을 배열로 돌려줌 (나중에 한꺼번에 취소할 때 필요) — 하나도 예약 못 했으면 빈 배열.
const REMINDER_DAYS_BEFORE = [5, 3, 1];

export async function scheduleDeadlineReminders(
  policyTitle: string,
  deadlineDate: string
): Promise<string[]> {
  const granted = await ensurePermission();
  if (!granted) return [];

  const deadline = new Date(deadlineDate);
  const ids: string[] = [];

  for (const daysBefore of REMINDER_DAYS_BEFORE) {
    const reminderTime = new Date(deadline);
    reminderTime.setDate(reminderTime.getDate() - daysBefore);
    reminderTime.setHours(9, 0, 0, 0);

    if (reminderTime.getTime() <= Date.now()) continue;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: daysBefore === 1 ? '⏰ 마감이 내일이에요' : `⏰ 마감이 ${daysBefore}일 남았어요`,
        body: `${policyTitle} — 신청 잊지 마세요!`,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderTime },
    });
    ids.push(id);
  }
  return ids;
}

export async function cancelDeadlineReminders(notificationIds: string[]) {
  await Promise.all(notificationIds.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
}
