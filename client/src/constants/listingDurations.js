export const LISTING_DURATION_OPTIONS = [
  { value: 12, label: '12 hours' },
  { value: 24, label: '24 hours' },
  { value: 48, label: '2 days' },
  { value: 72, label: '3 days' },
  { value: 168, label: '7 days' },
];

export const durationLabel = (hours) =>
  LISTING_DURATION_OPTIONS.find((option) => option.value === Number(hours))?.label ||
  `${hours} hours`;
