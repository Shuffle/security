// Shim for the legacy `components/Countries.jsx` from Shuffle Core.
// Provides a country list compatible with MUI Autocomplete (uses .label).
const countries: { code: string; label: string; phone: string }[] = [
  { code: 'US', label: 'United States', phone: '1' },
  { code: 'GB', label: 'United Kingdom', phone: '44' },
  { code: 'NO', label: 'Norway', phone: '47' },
  { code: 'SE', label: 'Sweden', phone: '46' },
  { code: 'DK', label: 'Denmark', phone: '45' },
  { code: 'FI', label: 'Finland', phone: '358' },
  { code: 'DE', label: 'Germany', phone: '49' },
  { code: 'FR', label: 'France', phone: '33' },
  { code: 'ES', label: 'Spain', phone: '34' },
  { code: 'IT', label: 'Italy', phone: '39' },
  { code: 'NL', label: 'Netherlands', phone: '31' },
  { code: 'BE', label: 'Belgium', phone: '32' },
  { code: 'IE', label: 'Ireland', phone: '353' },
  { code: 'PT', label: 'Portugal', phone: '351' },
  { code: 'CH', label: 'Switzerland', phone: '41' },
  { code: 'AT', label: 'Austria', phone: '43' },
  { code: 'PL', label: 'Poland', phone: '48' },
  { code: 'CA', label: 'Canada', phone: '1' },
  { code: 'AU', label: 'Australia', phone: '61' },
  { code: 'NZ', label: 'New Zealand', phone: '64' },
  { code: 'JP', label: 'Japan', phone: '81' },
  { code: 'SG', label: 'Singapore', phone: '65' },
  { code: 'IN', label: 'India', phone: '91' },
  { code: 'BR', label: 'Brazil', phone: '55' },
  { code: 'MX', label: 'Mexico', phone: '52' },
  { code: 'ZA', label: 'South Africa', phone: '27' },
  { code: 'AE', label: 'United Arab Emirates', phone: '971' },
];

export default countries;
