import { act, render } from '@testing-library/react';
import ImageLightbox from './ImageLightbox';
import { NATIVE_BACK_DISMISS_EVENT } from '../services/nativeBackDismiss';

const renderLightbox = (onClose = jest.fn()) => ({
  onClose,
  ...render(
    <ImageLightbox
      images={['/uploads/photo-1.jpg', '/uploads/photo-2.jpg']}
      index={0}
      alt="Desk lamp"
      placeholder="/assets/icons/product-placeholder.png"
      onClose={onClose}
    />
  ),
});

test('ImageLightbox closes when the native back dismiss event is dispatched', () => {
  const { onClose } = renderLightbox();
  const event = new CustomEvent(NATIVE_BACK_DISMISS_EVENT, { cancelable: true });

  act(() => {
    window.dispatchEvent(event);
  });

  expect(event.defaultPrevented).toBe(true);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('ImageLightbox removes the native back dismiss listener on unmount', () => {
  const { onClose, unmount } = renderLightbox();

  unmount();

  act(() => {
    window.dispatchEvent(new CustomEvent(NATIVE_BACK_DISMISS_EVENT, { cancelable: true }));
  });

  expect(onClose).not.toHaveBeenCalled();
});
