import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const MAX_SCALE = 4;
const DOUBLE_TAP_MS = 300;

// Self-contained fullscreen image viewer for Capacitor WebViews:
// pinch-to-zoom, pan when zoomed, swipe between images, double-tap to toggle
// zoom, plus keyboard/desktop controls. Touch is handled with native
// non-passive listeners so preventDefault works (React's onTouch* are passive).
export default function ImageLightbox({
  images,
  index = 0,
  alt = "",
  placeholder,
  onClose,
  onIndexChange,
}) {
  const overlayRef = useRef(null);
  const imgRef = useRef(null);
  const baseSize = useRef({ w: 0, h: 0 });
  const gesture = useRef({ mode: null });
  const tap = useRef({ time: 0, x: 0, y: 0 });
  const transformRef = useRef({ scale: 1, x: 0, y: 0 });

  const [current, setCurrent] = useState(index);
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [gesturing, setGesturing] = useState(false);

  // transformRef mirrors state so native handlers always read the latest value.
  const apply = useCallback((next) => {
    transformRef.current = next;
    setTransform(next);
  }, []);

  const measureBase = useCallback(() => {
    const img = imgRef.current;
    if (img) baseSize.current = { w: img.offsetWidth, h: img.offsetHeight };
  }, []);

  const clampTranslate = useCallback((x, y, scale) => {
    const overlay = overlayRef.current;
    if (!overlay) return { x, y };
    const maxX = Math.max(0, (baseSize.current.w * scale - overlay.clientWidth) / 2);
    const maxY = Math.max(0, (baseSize.current.h * scale - overlay.clientHeight) / 2);
    return { x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY) };
  }, []);

  const goTo = useCallback(
    (nextIndex) => {
      const count = images.length;
      if (!count) return;
      const wrapped = ((nextIndex % count) + count) % count;
      setCurrent(wrapped);
      apply({ scale: 1, x: 0, y: 0 });
      if (onIndexChange) onIndexChange(wrapped);
    },
    [images.length, apply, onIndexChange]
  );

  // Lock background scroll + wire keyboard controls (desktop).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") goTo(current + 1);
      else if (e.key === "ArrowLeft") goTo(current - 1);
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [current, goTo, onClose]);

  // Measure the fitted image size on mount and keep pan bounds valid on resize.
  useEffect(() => {
    const raf = requestAnimationFrame(measureBase);
    const onResize = () => {
      measureBase();
      const c = clampTranslate(
        transformRef.current.x,
        transformRef.current.y,
        transformRef.current.scale
      );
      apply({ ...transformRef.current, x: c.x, y: c.y });
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [measureBase, clampTranslate, apply]);

  // Native, non-passive touch handlers so we can preventDefault inside the WebView.
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return undefined;

    const centerOf = () => {
      const rect = overlay.getBoundingClientRect();
      return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
    };

    const startPinch = (touches) => {
      const [a, b] = [touches[0], touches[1]];
      const { cx, cy } = centerOf();
      gesture.current = {
        mode: "pinch",
        startDist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1,
        startScale: transformRef.current.scale,
        startX: transformRef.current.x,
        startY: transformRef.current.y,
        startMidX: (a.clientX + b.clientX) / 2 - cx,
        startMidY: (a.clientY + b.clientY) / 2 - cy,
        moved: true,
      };
    };

    const startSingle = (touch) => {
      gesture.current = {
        mode: transformRef.current.scale > 1.01 ? "pan" : "idle",
        startClientX: touch.clientX,
        startClientY: touch.clientY,
        startX: transformRef.current.x,
        startY: transformRef.current.y,
        moved: false,
        swipeDx: 0,
      };
    };

    const onStart = (e) => {
      setGesturing(true);
      if (e.touches.length === 2) startPinch(e.touches);
      else if (e.touches.length === 1) startSingle(e.touches[0]);
    };

    const onMove = (e) => {
      const g = gesture.current;
      if (!g.mode) return;

      // Two fingers: pinch-zoom anchored on the finger midpoint.
      if (g.mode === "pinch" && e.touches.length === 2) {
        e.preventDefault();
        const [a, b] = [e.touches[0], e.touches[1]];
        const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const scale = clamp((dist / g.startDist) * g.startScale, 1, MAX_SCALE);
        const { cx, cy } = centerOf();
        const midX = (a.clientX + b.clientX) / 2 - cx;
        const midY = (a.clientY + b.clientY) / 2 - cy;
        const x = midX - (scale * (g.startMidX - g.startX)) / g.startScale;
        const y = midY - (scale * (g.startMidY - g.startY)) / g.startScale;
        const c = clampTranslate(x, y, scale);
        apply({ scale, x: c.x, y: c.y });
        return;
      }

      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const dx = touch.clientX - g.startClientX;
      const dy = touch.clientY - g.startClientY;
      if (!g.moved && Math.hypot(dx, dy) > 6) g.moved = true;

      if (g.mode === "pan" || (g.mode === "idle" && transformRef.current.scale > 1.01)) {
        // Zoomed in: one finger pans.
        e.preventDefault();
        const c = clampTranslate(g.startX + dx, g.startY + dy, transformRef.current.scale);
        apply({ scale: transformRef.current.scale, x: c.x, y: c.y });
      } else if (Math.abs(dx) > Math.abs(dy)) {
        // Not zoomed: horizontal drag = swipe between images (with drag feedback).
        e.preventDefault();
        g.mode = "swipe";
        g.swipeDx = dx;
        apply({ scale: 1, x: dx, y: 0 });
      }
    };

    const finishTap = (changedTouch) => {
      const now = Date.now();
      const { cx, cy } = centerOf();
      const x = changedTouch ? changedTouch.clientX - cx : 0;
      const y = changedTouch ? changedTouch.clientY - cy : 0;
      const last = tap.current;
      if (now - last.time < DOUBLE_TAP_MS && Math.hypot(x - last.x, y - last.y) < 30) {
        // Double-tap: reset when zoomed, otherwise zoom to 2x at the tap point.
        tap.current = { time: 0, x: 0, y: 0 };
        if (transformRef.current.scale > 1.01) {
          apply({ scale: 1, x: 0, y: 0 });
        } else {
          const c = clampTranslate(-x, -y, 2);
          apply({ scale: 2, x: c.x, y: c.y });
        }
      } else {
        tap.current = { time: now, x, y };
      }
    };

    const onEnd = (e) => {
      const g = gesture.current;

      // One finger lifted from a pinch: keep going as a pan with the other finger.
      if (e.touches.length === 1 && (g.mode === "pinch" || g.mode === "pan")) {
        startSingle(e.touches[0]);
        gesture.current.moved = true;
        return;
      }
      if (e.touches.length > 0) return;

      setGesturing(false);

      if (!g.moved) {
        // A clean tap (works whether zoomed or not — handles double-tap reset).
        finishTap(e.changedTouches && e.changedTouches[0]);
      } else if (g.mode === "swipe") {
        const threshold = Math.min(80, (overlay.clientWidth || 320) * 0.18);
        if (g.swipeDx <= -threshold) goTo(current + 1);
        else if (g.swipeDx >= threshold) goTo(current - 1);
        else apply({ scale: 1, x: 0, y: 0 }); // snap back
      } else if (g.mode === "pinch" || g.mode === "pan") {
        if (transformRef.current.scale <= 1.01) {
          apply({ scale: 1, x: 0, y: 0 });
        } else {
          const c = clampTranslate(
            transformRef.current.x,
            transformRef.current.y,
            transformRef.current.scale
          );
          apply({ scale: transformRef.current.scale, x: c.x, y: c.y });
        }
      }

      gesture.current = { mode: null };
    };

    overlay.addEventListener("touchstart", onStart, { passive: false });
    overlay.addEventListener("touchmove", onMove, { passive: false });
    overlay.addEventListener("touchend", onEnd, { passive: false });
    overlay.addEventListener("touchcancel", onEnd, { passive: false });
    return () => {
      overlay.removeEventListener("touchstart", onStart);
      overlay.removeEventListener("touchmove", onMove);
      overlay.removeEventListener("touchend", onEnd);
      overlay.removeEventListener("touchcancel", onEnd);
    };
  }, [current, goTo, clampTranslate, apply]);

  const handleBackdropClick = (e) => {
    // Tapping the dark backdrop (not the image/controls) closes the viewer.
    if (e.target === overlayRef.current) onClose();
  };

  return createPortal(
    <div
      className="image-lightbox"
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      onClick={handleBackdropClick}
    >
      <button
        type="button"
        className="image-lightbox__close"
        onClick={onClose}
        aria-label="Close image viewer"
      >
        <i className="bi bi-x-lg"></i>
      </button>

      {images.length > 1 && (
        <>
          <button
            type="button"
            className="image-lightbox__nav image-lightbox__nav--prev d-none d-md-flex"
            onClick={() => goTo(current - 1)}
            aria-label="Previous image"
          >
            <i className="bi bi-chevron-left"></i>
          </button>
          <button
            type="button"
            className="image-lightbox__nav image-lightbox__nav--next d-none d-md-flex"
            onClick={() => goTo(current + 1)}
            aria-label="Next image"
          >
            <i className="bi bi-chevron-right"></i>
          </button>
        </>
      )}

      <img
        ref={imgRef}
        className="image-lightbox__img"
        src={images[current]}
        alt={alt}
        draggable={false}
        onLoad={measureBase}
        onError={(e) => {
          if (placeholder && !e.target.src.endsWith(placeholder)) {
            e.target.src = placeholder;
          }
        }}
        style={{
          transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
          transition: gesturing ? "none" : "transform 0.2s ease",
        }}
      />

      {images.length > 1 && (
        <div className="image-lightbox__counter">
          {current + 1} / {images.length}
        </div>
      )}
    </div>,
    document.body
  );
}
