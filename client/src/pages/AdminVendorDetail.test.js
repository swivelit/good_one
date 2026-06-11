import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminVendorDetail from './AdminVendorDetail';
import { productAPI, vendorAPI } from '../api';

jest.mock('../api', () => ({
  productAPI: {
    renew: jest.fn(),
    update: jest.fn(),
  },
  vendorAPI: {
    getAdminOne: jest.fn(),
    updateAdminProfile: jest.fn(),
  },
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
  useParams: () => ({ id: 'vendor-1' }),
}), { virtual: true });

const vendorResponse = {
  data: {
    vendor: {
      _id: 'vendor-1',
      businessName: 'Original Shop',
      businessDescription: 'Original description',
      businessCategory: 'Electronics',
      businessAddress: 'Market Street',
      website: 'https://example.com',
      logo: '',
      coverImage: '',
      isApproved: true,
      verificationStatus: 'verified',
      user: {
        name: 'Owner Name',
        email: 'owner@example.com',
        phone: '9999999999',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    },
    products: [
      {
        _id: 'product-1',
        title: 'Old Phone',
        description: 'Lightly used',
        price: 7000,
        originalPrice: 9999,
        category: 'Mobiles',
        condition: 'good',
        location: 'Chennai',
        images: [],
        isActive: false,
        durationHours: 24,
        expiresAt: '2026-01-01T00:00:00.000Z',
        renewedAt: '2026-01-01T00:00:00.000Z',
        renewalCount: 1,
        views: 12,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  },
};

describe('AdminVendorDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    vendorAPI.getAdminOne.mockResolvedValue(vendorResponse);
    vendorAPI.updateAdminProfile.mockResolvedValue({ data: { vendor: vendorResponse.data.vendor } });
    productAPI.renew.mockResolvedValue({ data: { success: true } });
    productAPI.update.mockResolvedValue({ data: { success: true } });
  });

  test('renders vendor profile and products, then updates profile, renews, and edits product', async () => {
    render(<AdminVendorDetail />);

    expect(await screen.findByText('Original Shop')).toBeInTheDocument();
    expect(screen.getByText('owner@example.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Old Phone')).toBeInTheDocument();
    expect(screen.getAllByText('Expired').length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText(/business name/i), {
      target: { value: 'Updated Shop' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }));

    await waitFor(() => {
      expect(vendorAPI.updateAdminProfile).toHaveBeenCalledWith(
        'vendor-1',
        expect.objectContaining({
          businessName: 'Updated Shop',
          businessDescription: 'Original description',
          isApproved: true,
          verificationStatus: 'verified',
        })
      );
    });

    fireEvent.change(screen.getByLabelText(/renewal duration for old phone/i), {
      target: { value: '168' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^renew$/i }));

    await waitFor(() => {
      expect(productAPI.renew).toHaveBeenCalledWith('product-1', {
        durationHours: 168,
      });
    });

    fireEvent.change(screen.getByLabelText(/product title for old phone/i), {
      target: { value: 'Updated Phone' },
    });
    fireEvent.change(screen.getByLabelText(/product price for old phone/i), {
      target: { value: '7999' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save product/i }));

    await waitFor(() => {
      expect(productAPI.update).toHaveBeenCalledWith(
        'product-1',
        expect.objectContaining({
          title: 'Updated Phone',
          description: 'Lightly used',
          price: 7999,
          originalPrice: 9999,
          category: 'Mobiles',
          condition: 'good',
          location: 'Chennai',
        })
      );
    });
  });
});
