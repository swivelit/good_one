import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { initializePushNotifications } from '../services/pushNotifications';

export default function PushNotificationManager() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !user?._id) return undefined;

    let authToken = null;
    try {
      authToken = localStorage.getItem('token');
    } catch {
      authToken = null;
    }

    if (!authToken) return undefined;

    let cleanup = null;
    let cancelled = false;

    initializePushNotifications({ navigate })
      .then((removeListeners) => {
        if (cancelled) {
          removeListeners?.();
          return;
        }
        cleanup = removeListeners;
      })
      .catch((error) => {
        console.warn('Push notification startup failed', error);
      });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [loading, navigate, user?._id]);

  return null;
}
