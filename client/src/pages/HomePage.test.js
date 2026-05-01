import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import HomePage from './HomePage';
import { productAPI, statsAPI } from '../api';

const mockNavigate = jest.fn();
let mockSearchParams = new URLSearchParams();

jest.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }) => (
    <a href={typeof to === 'string' ? to : '#'} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => mockNavigate,
  useSearchParams: () => [mockSearchParams],
}), { virtual: true });

jest.mock('../api', () => ({
  productAPI: {
    getAll: jest.fn(),
  },
  statsAPI: {
    getPublic: jest.fn(),
  },
}));

jest.mock('../productCard', () => function ProductCardMock({ product }) {
  return <div>{product.title}</div>;
});

jest.mock('react-countup', () => ({
  __esModule: true,
  default: function CountUpMock({ end }) {
    return <span>{end}</span>;
  },
}));

describe('HomePage browse filters', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockSearchParams = new URLSearchParams();
    productAPI.getAll.mockResolvedValue({ data: { products: [], pages: 1, total: 0 } });
    statsAPI.getPublic.mockResolvedValue({
      data: {
        stats: {
          activeListings: 0,
          registeredVendors: 0,
          registeredBuyers: 0,
          totalRenewals: 0,
        },
      },
    });
  });

  test('reads category and search query params when fetching products', async () => {
    mockSearchParams = new URLSearchParams('category=Mobiles&search=iphone');

    render(<HomePage />);

    expect(await screen.findByText(/No products found/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(productAPI.getAll).toHaveBeenCalledWith({
        page: 1,
        limit: 12,
        category: 'Mobiles',
        search: 'iphone',
      });
    });
  });

  test('category chip updates the browse URL while preserving active search', async () => {
    mockSearchParams = new URLSearchParams('search=iphone');

    render(<HomePage />);

    expect(await screen.findByText(/No products found/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mobiles' }));

    expect(mockNavigate).toHaveBeenCalledWith('/browse?category=Mobiles&search=iphone');
    await waitFor(() => {
      expect(productAPI.getAll).toHaveBeenLastCalledWith({
        page: 1,
        limit: 12,
        category: 'Mobiles',
        search: 'iphone',
      });
    });
  });
});
