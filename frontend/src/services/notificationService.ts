import api from './api';
import { AppNotification, NotificationResponse, NotificationType } from '../types/notification';

export interface NotificationFilterParams {
  page?: number;
  limit?: number;
  unread_only?: boolean;
  type?: NotificationType | 'ALL';
}

export const fetchNotifications = async (
  params?: NotificationFilterParams
): Promise<NotificationResponse> => {
  const response = await api.get<NotificationResponse>('/notifications', { params });
  return response.data;
};

export const fetchUnreadCount = async (): Promise<number> => {
  const response = await api.get<{ status: string; data: { unreadCount: number } }>(
    '/notifications/unread-count'
  );
  return response.data.data.unreadCount;
};

export const markNotificationAsRead = async (id: string): Promise<AppNotification> => {
  const response = await api.patch<{ status: string; data: AppNotification }>(
    `/notifications/${id}/read`
  );
  return response.data.data;
};

export const markAllNotificationsAsRead = async (): Promise<void> => {
  await api.patch('/notifications/mark-all-read');
};

export const deleteNotification = async (id: string): Promise<void> => {
  await api.delete(`/notifications/${id}`);
};

export const clearAllNotifications = async (): Promise<void> => {
  await api.delete('/notifications/clear-all');
};
