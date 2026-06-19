import { render, screen } from '@testing-library/react';
import PrivacyPolicy from './PrivacyPolicy';

test('discloses Meta SDK app events usage', () => {
  render(<PrivacyPolicy />);

  expect(screen.getByText('Meta SDK And App Events')).toBeInTheDocument();
  expect(screen.getByText(/uses the Meta SDK for app measurement/i)).toBeInTheDocument();
  expect(screen.getByText(/Advertiser-ID collection is controlled by app configuration/i))
    .toBeInTheDocument();
});
