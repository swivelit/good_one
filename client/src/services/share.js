import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import toast from 'react-hot-toast';
import { buildPublicUrl } from '../config';

const getEntityId = (entity) => entity?._id || entity?.id || '';

const formatPrice = (price) => {
  const numericPrice = Number(price);
  if (!Number.isFinite(numericPrice)) return '';
  return `₹${numericPrice.toLocaleString('en-IN')}`;
};

const isCanceledShare = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return error?.name === 'AbortError' || message.includes('cancel');
};

const canUseCapacitorShare = () => {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable?.('Share') !== false;
  } catch {
    return false;
  }
};

const canUseNavigatorShare = () =>
  typeof navigator !== 'undefined' && typeof navigator.share === 'function';

const canUseClipboard = () =>
  typeof navigator !== 'undefined' &&
  navigator.clipboard &&
  typeof navigator.clipboard.writeText === 'function';

export const buildProductShareData = (product) => {
  const id = getEntityId(product);
  const url = buildPublicUrl(`/products/${id}`);
  const title = product?.title ? `GoodOne: ${product.title}` : 'GoodOne product';
  const price = formatPrice(product?.price);
  const text = [product?.title || 'GoodOne product', price && `Price: ${price}`, url]
    .filter(Boolean)
    .join('\n');

  return {
    title,
    text,
    url,
    dialogTitle: 'Share product',
  };
};

export const buildVendorShareData = (vendor) => {
  const id = getEntityId(vendor);
  const businessName = vendor?.businessName || 'GoodOne vendor';
  const url = buildPublicUrl(`/vendors/${id}`);

  return {
    title: businessName,
    text: [`${businessName} on GoodOne`, url].join('\n'),
    url,
    dialogTitle: 'Share vendor profile',
  };
};

export const sharePayload = async (payload) => {
  if (!payload?.url) {
    toast.error('Unable to share this item');
    return false;
  }

  if (canUseCapacitorShare()) {
    try {
      await Share.share(payload);
      return true;
    } catch (error) {
      if (isCanceledShare(error)) return false;
      console.warn('Native share failed, trying web fallback', error);
    }
  }

  if (canUseNavigatorShare()) {
    try {
      await navigator.share({
        title: payload.title,
        text: payload.text,
        url: payload.url,
      });
      return true;
    } catch (error) {
      if (isCanceledShare(error)) return false;
      console.warn('Web share failed, trying clipboard fallback', error);
    }
  }

  if (canUseClipboard()) {
    try {
      await navigator.clipboard.writeText(payload.url);
      toast.success('Share link copied');
      return true;
    } catch (error) {
      console.warn('Clipboard share fallback failed', error);
    }
  }

  toast.error('Sharing is not available on this device');
  return false;
};

export const shareProduct = (product) => sharePayload(buildProductShareData(product));

export const shareVendor = (vendor) => sharePayload(buildVendorShareData(vendor));
