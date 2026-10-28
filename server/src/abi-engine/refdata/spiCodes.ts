/**
 * Trade Agreement / Special Program Claim codes (CATAIR AE Table 8, July
 * 2026, ESF-218/219). Expired programs are left out so they cannot be
 * claimed: NAFTA CA/MX (ended June 30, 2020) and ATPA/ATPDEA J/J+.
 * A '#' code is the program plus the FTA MPF exemption.
 */
export const SPI_CLAIM_CODES = [
  'A', 'AU', 'B', 'B#', 'BH', 'C', 'C#', 'CL', 'CO', 'D', 'E', 'IL', 'JO', 'JP',
  'K', 'K#', 'KR', 'L', 'L#', 'MA', 'N', 'NP', 'OM', 'P', 'P+', 'PA', 'PE', 'R',
  'S', 'S+', 'SG', 'W', 'Y', 'Z',
] as const;

export type SpiClaimCode = (typeof SPI_CLAIM_CODES)[number];
