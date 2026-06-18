// Country catalog for the signup picker. v1 ships India (D7: single country per
// employer). Others are listed but disabled — onboarding them is a config change
// on the backend (ruleset seeding), not a UI change, so the seam stays visible.

export interface Country {
  code: string;
  name: string;
  currency: string;
  flag: string;
  /** v1 supported (a ruleset exists). */
  supported: boolean;
  /** state/PT-schedule selector options (India only in v1). */
  states?: { code: string; name: string }[];
}

export const COUNTRIES: Country[] = [
  {
    code: 'IN',
    name: 'India',
    currency: 'INR',
    flag: '\u{1F1EE}\u{1F1F3}',
    supported: true,
    states: [
      { code: 'KA', name: 'Karnataka' },
      { code: 'MH', name: 'Maharashtra' },
      { code: 'TN', name: 'Tamil Nadu' },
      { code: 'DL', name: 'Delhi' },
      { code: 'TS', name: 'Telangana' },
    ],
  },
  { code: 'US', name: 'United States', currency: 'USD', flag: '\u{1F1FA}\u{1F1F8}', supported: false },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', flag: '\u{1F1EC}\u{1F1E7}', supported: false },
  { code: 'DE', name: 'Germany', currency: 'EUR', flag: '\u{1F1E9}\u{1F1EA}', supported: false },
];

export function countryByCode(code: string): Country | undefined {
  return COUNTRIES.find((c) => c.code === code);
}

export function countryName(code: string): string {
  return countryByCode(code)?.name ?? code;
}

export function countryFlag(code: string): string {
  return countryByCode(code)?.flag ?? '';
}
