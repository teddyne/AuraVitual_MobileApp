// Kieu hien thi + nhom lich su cua NotificationsScreen (doi nguyen van).
// groupOf / HistoryKind / HistoryGroup da co san trong
// src/lib/notificationHistory.ts nen chi dung lai o day, khong dinh nghia lai.
import { translate } from '../../../i18n/locale';
import type { HistoryGroup, HistoryKind } from '../../../lib/notificationHistory';

export type DisplayItem = {
  id: string;
  kind: HistoryKind;
  category: string;
  time: number;
  title: string;
  body: string;
  icon: string;
  iconBg: string;
  read: boolean;
  memberId?: string | null;
  invite?: {
    requestId: string;
    fromUserId: string;
    fromName: string;
  } | null;
};

export type NotificationFilter = 'all' | 'reminder' | 'family' | 'milestone';

export const GROUP_ORDER: HistoryGroup[] = ['today', 'yesterday', 'week', 'older'];

export const groupLabel = (g: HistoryGroup) =>
  translate(`notifications.group.${g}`);
