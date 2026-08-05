/**
 * Entry Summary reference tables — AE Tables 2, 3, 4, 6, 13, 17 and the
 * output E0 reference-data-type registry (Entry Summary Create/Update,
 * July 2026, ESF-194..206, 215-217, 222, 247).
 */

/** AE Table 2 — Entry Type Codes (ESF-215). */
export const ENTRY_TYPE_CODES: Record<string, string> = {
  '01': 'Consumption – Free & Dutiable',
  '02': 'Consumption – Quota/Visa',
  '03': 'Consumption – AD/CVD',
  '06': 'Foreign Trade Zone (FTZ)',
  '07': 'Consumption – Quota/Visa & AD/CVD',
  '11': 'Informal – Free & Dutiable',
  '12': 'Informal – Quota/Visa',
  '21': 'Warehouse',
  '22': 'Re-warehouse',
  '23': 'Temporary Importation under Bond (TIB)',
  '31': 'Warehouse Withdrawal – Consumption',
  '32': 'Warehouse Withdrawal – Quota',
  '34': 'Warehouse Withdrawal – AD/CVD',
  '38': 'Warehouse Withdrawal – Quota & AD/CVD',
  '51': 'Military - Defense Contract Management Agency (DCMA)',
  '52': 'Government - Dutiable',
};

/** AE Table 3 — Mode of Transportation Codes (ESF-215). */
export const MOT_CODES: Record<string, string> = {
  '10': 'Vessel, Non-Containerized',
  '11': 'Vessel, Containerized',
  '12': 'Border Water Borne',
  '20': 'Rail, Non-Containerized',
  '21': 'Rail, Containerized',
  '30': 'Truck, Non-Containerized',
  '31': 'Truck, Containerized',
  '32': 'Auto',
  '33': 'Pedestrian',
  '34': 'Road, Other',
  '40': 'Air, Non-Containerized',
  '41': 'Air, Containerized',
  '50': 'Mail',
  '60': 'Passenger, Hand Carried',
  '70': 'Fixed Transport',
};

/** AE Table 4 — Bond Waiver Reason Codes (ESF-216). */
export const BOND_WAIVER_REASON_CODES: Record<string, string> = {
  '995': 'Supplemental Duty Bills on Vessel Repair Entries',
  '996': 'Fines, Penalty, or Liquidated Damage Bills',
  '997': 'All Other Contingent Bills',
  '998': 'Bills Secured – Other than Surety',
  '999': 'No Surety, Unsecured Bills',
};

/** AE Table 6 — User Fee Accounting Class Codes (ESF-217). */
export const USER_FEE_CLASS_CODES: Record<string, string> = {
  // 34-Record 'header'
  '311': 'Informal Entry Fee',
  '496': 'Dutiable Mail Fee',
  '500': 'Manual Entry Surcharge',
  // 62-Record 'line'
  '053': 'Beef Fee',
  '054': 'Pork Fee',
  '055': 'Honey Fee',
  '056': 'Cotton Fee',
  '057': 'Raspberry Fee',
  '079': 'Sugar Fee',
  '090': 'Potato Fee',
  '102': 'Lime Fee',
  '103': 'Mushroom Fee',
  '104': 'Watermelon Fee',
  '105': 'Softwood Lumber Fee',
  '106': 'Blueberry Fee',
  '107': 'Avocado Fee',
  '108': 'Mango Fee',
  '109': 'Sorghum Fee',
  '110': 'Dairy Product Fee',
  '124': 'Pecan Fee',
  '125': 'Christmas Tree Fee',
  '499': 'Formal Merchandise Processing Fee (MPF)',
  '501': 'Harbor Maintenance Fee',
};

/** AE Table 13 — Internal Revenue Accounting Class Codes (ESF-222). */
export const IR_TAX_CLASS_CODES: Record<string, string> = {
  '016': 'Distilled Spirits',
  '017': 'Wines',
  '018': 'Tobacco Products',
  '022': 'Other',
};

/** AE Table 17 — Other Revenue Accounting Class Codes (ESF-247). */
export const OTHER_REVENUE_CLASS_CODES: Record<string, string> = {
  '672': 'Coffee Imports to Puerto Rico – Duty Assessment',
};

/**
 * Output E0 Reference Data Type Codes (Table 1 — Returned Entry Summary
 * Reference Data, ESF-194..203). Maps the 6-char signpost code to the input
 * grouping it points at.
 */
export const REFERENCE_DATA_TYPES: Record<string, string> = {
  SUMMRY: 'Entry Summary identifier',
  CARMAN: 'Cargo Manifest grouping (22-Record)',
  BOLINB: 'Bill of Lading/In-Bond grouping (23-Record)',
  BNDDTL: 'Bond grouping (31-Record)',
  CONREL: 'Consolidated Release grouping (32-Record)',
  MISDOC: 'Missing Document grouping (33-Record)',
  HDRFEE: 'Header Fee grouping (34-Record)',
  PSCHRE: 'PSC Header Reason grouping (35-Record)',
  PSCEXP: 'PSC Filing Explanation grouping (36-Record)',
  LINITM: 'Line Item grouping (40-Record)',
  EIPINV: 'EIP Invoice grouping (42-Record)',
  INVLIN: 'EIP Invoice Line Range grouping (42-Record)',
  COMDES: 'Commercial Description grouping (44-Record)',
  ARPART: 'Article Party grouping (47-Record)',
  TARIFF: 'Harmonized Tariff Number grouping (50-Record)',
  TARQTY: 'Harmonized Tariff Quantity/UOM grouping (50-Record)',
  LICNSE: 'License Detail grouping (52-Record)',
  ADDCVD: 'AD/CVD Case grouping (53-Record)',
  IADDET: "Importer's Additional Declaration grouping (54-Record)",
  LINFEE: 'Line Fee grouping (62-Record)',
  PSCLRE: 'PSC Line Reason grouping (63-Record)',
  CENWRN: 'Census Warning Condition Override grouping (CW02-Record)',
  PSTLIN: 'Post-line identifier',
  TOTALS: 'Totals/trailer identifier',
  FEETOT: 'Fee Total grouping (89-Record)',
};
