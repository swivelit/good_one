import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import toast from 'react-hot-toast';
import { authAPI } from '../api';

export const CHAT_NOTIFICATION_CHANNEL_ID = 'chat_messages';

const isNativePlatform = () => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

const getPlatform = () => {
  try {
    return Capacitor.getPlatform();
  } catch {
    return 'unknown';
  }
};

const isGranted = (value) => value === 'granted';

const requestPushPermission = async () => {
  const current = await PushNotifications.checkPermissions();
  if (isGranted(current.receive)) return true;

  const requested = await PushNotifications.requestPermissions();
  return isGranted(requested.receive);
};

const requestLocalPermission = async () => {
  const current = await LocalNotifications.checkPermissions();
  if (isGranted(current.display)) return true;

  const requested = await LocalNotifications.requestPermissions();
  return isGranted(requested.display);
};

const createChatChannel = async () => {
  if (getPlatform() !== 'android') return;

  await LocalNotifications.createChannel({
    id: CHAT_NOTIFICATION_CHANNEL_ID,
    name: 'Chat messages',
    description: 'New GoodOne chat messages',
    importance: 5,
    visibility: 1,
  });
};

const getChatRouteFromData = (data = {}) => {
  if (data.route && String(data.route).startsWith('/chat/')) return String(data.route);
  if (data.conversationId) return `/chat/${data.conversationId}`;
  return null;
};

// Resolve the in-app route to open when a notification is tapped. Honors an
// explicit absolute data.route (e.g. "/dashboard" for listing-expiry alerts),
// otherwise falls back to the chat-specific resolution.
const getRouteFromData = (data = {}) => {
  const explicitRoute = data.route ? String(data.route) : '';
  if (explicitRoute.startsWith('/')) return explicitRoute;
  return getChatRouteFromData(data);
};

const isChatNotification = (data = {}) => data.type === 'chat' || Boolean(data.conversationId);

const scheduleForegroundChatNotification = async (notification) => {
  const data = notification?.data || {};
  if (!isChatNotification(data)) return;

  const permitted = await requestLocalPermission();
  if (!permitted) return;

  await LocalNotifications.schedule({
    notifications: [
      {
        id: Date.now() % 2147483647,
        title: notification.title || 'New GoodOne message',
        body: notification.body || 'You have a new chat message.',
        channelId: CHAT_NOTIFICATION_CHANNEL_ID,
        extra: data,
        schedule: { at: new Date(Date.now() + 250) },
      },
    ],
  });
};

const navigateToNotificationRoute = (notification, navigate) => {
  const data = notification?.data || notification?.extra || {};
  const route = getRouteFromData(data);
  if (route) navigate(route);
};

export const initializePushNotifications = async ({ navigate }) => {
  if (!isNativePlatform()) return () => {};

  const listenerHandles = [];
  const removeListeners = () => {
    listenerHandles.forEach((handle) => {
      try {
        void handle?.remove?.();
      } catch (error) {
        console.warn('Unable to remove push notification listener', error);
      }
    });
  };

  try {
    await requestLocalPermission();
    await createChatChannel();

    const pushPermitted = await requestPushPermission();
    if (!pushPermitted) {
      toast.error('Enable notifications to receive chat alerts');
      return removeListeners;
    }

    listenerHandles.push(
      await PushNotifications.addListener('registration', async (token) => {
        const value = token?.value;
        if (!value) return;

        try {
          await authAPI.registerPushToken({
            token: value,
            platform: getPlatform(),
          });
        } catch (error) {
          console.warn('Failed to register push token with backend', error);
        }
      })
    );

    listenerHandles.push(
      await PushNotifications.addListener('registrationError', (error) => {
        console.warn('Push notification registration failed', error);
      })
    );

    listenerHandles.push(
      await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        void scheduleForegroundChatNotification(notification).catch((error) => {
          console.warn('Failed to show foreground chat notification', error);
        });
      })
    );

    listenerHandles.push(
      await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        navigateToNotificationRoute(action?.notification, navigate);
      })
    );

    listenerHandles.push(
      await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
        navigateToNotificationRoute(action?.notification, navigate);
      })
    );

    await PushNotifications.register();
  } catch (error) {
    console.warn('Unable to initialize push notifications', error);
  }

  return removeListeners;
};
