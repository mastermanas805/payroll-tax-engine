/**
 * Country -> currency derivation (D7: single country per employer, single currency
 * per country — §7 assumptions). Currency is NOT client-supplied; it is derived
 * from the chosen country at registration time.
 *
 * v1 ships India only (the full statutory ruleset). Adding a country is config:
 * extend this map alongside the country's ruleset (FR-13).
 */
const COUNTRY_CURRENCY: Readonly<Record<string, string>> = Object.freeze({
  IN: 'INR',
});

/** Supported registration countries (uppercase ISO-3166 alpha-2). */
export const SUPPORTED_COUNTRIES: readonly string[] = Object.keys(COUNTRY_CURRENCY);

/** True if we can onboard an employer in this country (has a currency mapping). */
export function isSupportedCountry(country: string): boolean {
  return Object.prototype.hasOwnProperty.call(
    COUNTRY_CURRENCY,
    country.toUpperCase(),
  );
}

/**
 * Derive the ISO-4217 currency for a country, or null if unsupported.
 * IN -> INR. The map is the single source of truth.
 */
export function currencyForCountry(country: string): string | null {
  return COUNTRY_CURRENCY[country.toUpperCase()] ?? null;
}
