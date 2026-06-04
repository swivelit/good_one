import {
  NATIVE_BACK_DISMISS_EVENT,
  requestTopOverlayDismiss,
} from './nativeBackDismiss';

test('requestTopOverlayDismiss returns false when no listener prevents default', () => {
  expect(requestTopOverlayDismiss()).toBe(false);
});

test('requestTopOverlayDismiss returns true when a listener prevents default', () => {
  const onDismiss = jest.fn((event) => {
    expect(event.cancelable).toBe(true);
    event.preventDefault();
  });

  window.addEventListener(NATIVE_BACK_DISMISS_EVENT, onDismiss);

  try {
    expect(requestTopOverlayDismiss()).toBe(true);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  } finally {
    window.removeEventListener(NATIVE_BACK_DISMISS_EVENT, onDismiss);
  }
});
