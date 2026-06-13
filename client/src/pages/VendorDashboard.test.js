import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import VendorDashboard from './VendorDashboard';
import { productAPI } from '../api';

jest.mock('../api', () => ({
  productAPI: {
    getMine: jest.fn(),
    renew: jest.fn(),
    delete: jest.fn(),
  },
  vendorAPI: {
    updateProfile: jest.fn(),
  },
}));

jest.mock('../AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'vendor-user-1', name: 'Vendor User', role: 'vendor' },
    vendorProfile: { _id: 'vendor-1', businessName: 'Vendor Shop' },
    setVendorProfile: jest.fn(),
  }),
}));

jest.mock('../config', () => ({
  getUploadUrl: (value) => value,
}));

jest.mock('../services/share', () => ({
  shareProduct: jest.fn(),
  shareVendor: jest.fn(),
}));

jest.mock('react-hot-toast', () => ({
  success: jest.fn(),
  error: jest.fn(),
}));

jest.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }) => (
    <a href={typeof to === 'string' ? to : '#'} {...props}>
      {children}
    </a>
  ),
}), { virtual: true });

describe('VendorDashboard renewal duration selection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    productAPI.getMine.mockResolvedValue({
      data: {
        products: [
          {
            _id: 'product-1',
            title: 'Used Phone',
            category: 'Mobiles',
            price: 12000,
            views: 4,
            isActive: true,
            durationHours: 24,
            expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
          },
        ],
      },
    });
    productAPI.renew.mockResolvedValue({
      data: { message: 'Product listing renewed for 168 hours!' },
    });
  });

  test('renews a product with the selected 7 day duration', async () => {
    render(<VendorDashboard />);

    const renewButton = await screen.findByRole('button', { name: /renew/i });
    fireEvent.click(renewButton);

    fireEvent.change(screen.getByLabelText(/listing duration/i), {
      target: { value: '168' },
    });
    fireEvent.click(screen.getByRole('button', { name: /confirm renew/i }));

    await waitFor(() => {
      expect(productAPI.renew).toHaveBeenCalledWith('product-1', {
        durationHours: 168,
      });
    });
  });
});
