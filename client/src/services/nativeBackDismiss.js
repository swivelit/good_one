export const NATIVE_BACK_DISMISS_EVENT = 'goodone:native-back-dismiss';

export const requestTopOverlayDismiss = () => {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return false;
  }

  const event = new CustomEvent(NATIVE_BACK_DISMISS_EVENT, {
    cancelable: true,
  });

  window.dispatchEvent(event);
  return event.defaultPrevented;
};
