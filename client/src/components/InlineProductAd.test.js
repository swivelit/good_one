import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";

jest.mock("@capacitor/core", () => {
  const nativeAdPlugin = {
    create: jest.fn(),
    load: jest.fn(),
    show: jest.fn(),
    updatePosition: jest.fn(),
    hide: jest.fn(),
    destroy: jest.fn(),
  };

  return {
    __mockNativeAdPlugin: nativeAdPlugin,
    registerPlugin: jest.fn(() => nativeAdPlugin),
    Capacitor: {
      isNativePlatform: jest.fn(() => true),
      getPlatform: jest.fn(() => "android"),
      Plugins: {
        NativeAd: nativeAdPlugin,
      },
    },
  };
});

jest.mock("react-router-dom", () => ({
  useLocation: () => ({
    pathname: "/browse",
    search: "",
    hash: "",
  }),
}), { virtual: true });

const {
  __mockNativeAdPlugin: mockNativeAdPlugin,
  Capacitor: mockCapacitor,
} = require("@capacitor/core");
const InlineProductAd = require("./InlineProductAd").default;

const flushPromises = async () => {
  for (let index = 0; index < 5; index += 1) {
    await Promise.resolve();
  }
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCapacitor.isNativePlatform.mockReturnValue(true);
  mockCapacitor.getPlatform.mockReturnValue("android");
  mockNativeAdPlugin.create.mockResolvedValue({ slotId: "slot" });
  mockNativeAdPlugin.load.mockResolvedValue({
    loaded: true,
    renderable: false,
    renderFailureReason: "missing-headline",
  });
  mockNativeAdPlugin.show.mockResolvedValue({ renderable: true, visible: true });
  mockNativeAdPlugin.updatePosition.mockResolvedValue({ renderable: true, visible: true });
  mockNativeAdPlugin.hide.mockResolvedValue({});
  mockNativeAdPlugin.destroy.mockResolvedValue({});

  window.requestAnimationFrame = jest.fn((callback) => {
    callback();
    return 1;
  });
  window.cancelAnimationFrame = jest.fn();
});

test("destroys the native slot and keeps the placeholder when load returns renderable false", async () => {
  expect(mockCapacitor.isNativePlatform()).toBe(true);
  expect(mockCapacitor.getPlatform()).toBe("android");

  render(<InlineProductAd index={2} />);

  expect(screen.getByTestId("inline-product-ad-placeholder")).toBeInTheDocument();

  await act(async () => {
    await flushPromises();
  });

  await waitFor(() => {
    expect(mockNativeAdPlugin.create).toHaveBeenCalled();
  });

  const slotId = mockNativeAdPlugin.create.mock.calls[0][0].slotId;

  expect(mockNativeAdPlugin.load).toHaveBeenCalledWith(expect.objectContaining({ slotId }));
  expect(mockNativeAdPlugin.show).not.toHaveBeenCalled();
  expect(mockNativeAdPlugin.hide).toHaveBeenCalledWith({ slotId });
  expect(mockNativeAdPlugin.destroy).toHaveBeenCalledWith({ slotId });
  expect(screen.getByTestId("inline-product-ad-placeholder")).toBeInTheDocument();
});
