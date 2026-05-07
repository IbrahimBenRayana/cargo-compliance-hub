/**
 * CustomsCity API sample payloads — verbatim from the CC docs the user
 * pasted on 2026-05-07. Used as Vitest fixtures so our schemas + mappers
 * + error parsers are tested against shapes that are guaranteed to
 * match the real upstream contract.
 *
 * Update this file when CC publishes new versions or new endpoints.
 * Don't edit the bodies to "make tests pass" — fix the code instead.
 */

// ─── ISF-10 — POST /api/documents (sandbox payload) ──────────────────

export const CC_ISF10_SAMPLE = {
  type:    'isf' as const,
  send:    false,
  sendAs:  'add' as const,
  version: 2 as const,
  body: [
    {
      masterBOLNumber: '8CUS1AA',
      BOLNumber:       '8CCGENR9001',
      billType:        'HOUSE',
      amendmentCode:   'CT',
      ISFSubmissionType:   '1',
      ISFShipmentTypeCode: '01',
      bondActivityCode: '01',
      bondType:         '8',
      isFROB:           false,
      bondHolderID:     '20-493538700',
      USPortOfArrival:  '1001',
      estimateDateOfArrival: '20260123',
      // IOR
      IORName:           '6MM LOGISTICS   PVT LTD',
      IORLastName:       '6MM LOGISTICS   PVT LTD',
      IORIDCodeQualifier: '24',
      IORNumber:         '20-493538700',
      IORDateOfBirth:    '20260121',
      // ISF Filer
      ISFFilerName:           '6MM LOGISTICS   PVT LTD',
      ISFFilerLastName:       '6MM LOGISTICS   PVT LTD',
      ISFFilerIDCodeQualifier: '24',
      ISFFilerNumber:         '20-493538700',
      ISFFilerDateOfBirth:    '20260121',
      // Consignee (note: identifierCode '24' = EIN qualifier)
      consigneeIdentifierCode: '24',
      consigneeTaxID:    '20-493538700',
      consigneeName:     '6MM LOGISTICS   PVT LTD',
      consigneeAddress1: '330 Snyder Ave,',
      consigneeCity:     'NewYork',
      consigneeStateOrProvince: 'NJ',
      consigneePostalCode: '54588',
      consigneeCountry:    'US',
      // Buyer
      buyerName:    '6MM LOGISTICS   PVT LTD',
      buyerAddress1: '330 Snyder Ave,',
      buyerCity:     'New York',
      buyerStateOrProvince: 'NJ',
      buyerPostalCode: '54588',
      buyerCountry:    'US',
      // Seller
      sellerName:    'Software Testing Pvt Ltd',
      sellerAddress1: 'Room No-104, 1st Floor,',
      sellerCity:     'Chennai',
      sellerStateOrProvince: 'TN',
      sellerPostalCode: '600001',
      sellerCountry:    'IN',
      // shipTo
      shipToName:    '6MM LOGISTICS   PVT LTD',
      shipToAddress1: '330 Snyder Ave,',
      shipToCity:     'New York',
      shipToStateOrProvince: 'NJ',
      shipToPostalCode: '54588',
      shipToCountry:    'US',
      // Consolidator
      consolidatorName:    'Software Testing Pvt Ltd',
      consolidatorAddress1: 'Room No-104, 1st Floor,',
      consolidatorCity:     'Chennai',
      consolidatorStateOrProvince: 'TN',
      consolidatorPostalCode: '600001',
      consolidatorCountry:    'IN',
      // CSL
      containerStuffingLocationName:    'Buckingham Exim Pvt Ltd',
      containerStuffingLocationAddress1: 'ADDD S S',
      containerStuffingLocationCity:     'Alaska',
      containerStuffingLocationStateOrProvince: 'AK',
      containerStuffingLocationPostalCode: '55555',
      containerStuffingLocationCountry:    'US',
      shipments: [
        {
          containerType:   'CN',
          containerNumber: '123456',
          manufacturer: [
            {
              manufacturerName: 'Aastha Logistics',
              manufacturerAddress1: 'Kalpataru Infrastructure',
              manufacturerCity: 'Mumbai',
              manufacturerStateOrProvince: 'MH',
              manufacturerPostalCode: '400055',
              manufacturerCountry: 'IN',
              items: [
                {
                  estimatedQuantity: 120,
                  quantityUOM: 'PKG',
                  estimatedWeight: 200,
                  weightUOM: 'K',
                  description: 'Goods1',
                  countryOfOrigin: 'IN',
                  'commodityHTS-6Number': '0101290090',
                  lineItem: 1,
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

// ─── ABI Document (Entry 7501 + 3461) — POST /api/abi/documents ──────

export const CC_ABI_SAMPLE = {
  type:    'abi' as const,
  version: '2.1' as const,
  body: [
    {
      entryType: '11',           // 11 = informal, 01 = formal
      modeOfTransport: '40',     // 40 = vessel, 41 = air
      dates: {
        entryDate:   '20251126',
        importDate:  '20251126',
        arrivalDate: '20251126',
      },
      location: {
        portOfEntry:        '1001',
        destinationStateUS: 'CA',
      },
      ior: {
        number: '57-123456789',
        name:   'IMPORT COMPANY LLC',
      },
      bond: {
        type:  '0',
        taxId: '57-123456789',
      },
      payment: {
        typeCode: 2,
        preliminaryStatementDate: '20251126',
      },
      firms: 'AB12',
      notifyPartyTaxId4811: '57-123456789',
      entryConsignee: {
        name:    'Acme Corp',
        address: '123 Main Street, Anytown',
        city:    'Springfield',
        state:   'IL',
        postalCode: '62704',
        country: 'US',
      },
      manifest: [
        {
          bill: {
            type:     'M',
            mBOL:     '123-141241001',     // hyphenated entry number — CC canonical form
            hBOL:     '22222220',
            groupBOL: 'N',
          },
          carrier: { code: 'ON' },
          ports:   { portOfUnlading: '1001' },
          quantity:    '1',
          quantityUOM: 'AMM',
          invoices: [
            {
              purchaseOrder:   'PO12345678',
              invoiceNumber:   'INV98765432',
              exportDate:      '20251126',
              relatedParties:  'N',
              countryOfExport: 'CN',
              currency:        'USD',
              exchangeRate:    1,
              items: [
                {
                  sku:         'ELEC001',
                  htsNumber:   '9608600000',
                  description: 'WIRELESS NETWORK ROUTERS, MODEL X500, 2.4GHZ',
                  origin:      { country: 'CN' },
                  values: {
                    currency:           'USD',
                    exchangeRate:       1,
                    totalValueOfGoods:  250,
                  },
                  quantity1:  '500',
                  weight:     { gross: '1000', uom: 'K' },
                  aluminumPercentage: 0,
                  steelPercentage:    100,
                  copperPercentage:   30,
                  cottonFeeExemption:                 'N',
                  autoPartsExemption:                 'Y',
                  otherThanCompletedKitchenParts:     'N',
                  informationalMaterialsExemption:    'N',
                  religiousPurposes:                  'N',
                  agriculturalExemption:              'Y',
                  semiConductorExemption:             7,
                  motorcycleExemption:                'N',
                  parties: [
                    { type: 'manufacturer' as const, taxId: 'MXTESMOR', name: 'TEST', address: 'ADDRESS', city: 'MORELIA', state: 'MCH', postalCode: '6789', country: 'MX' },
                    { type: 'seller' as const,       name: 'Seller Company', address: '101 Seller Road', city: 'Sellertown', state: 'FL', postalCode: '13579', country: 'US' },
                    { type: 'buyer' as const,        name: 'Buyer LLC', address: '303 Buyer Lane', city: 'Buyerville', state: 'NY', postalCode: '11223', country: 'US' },
                    { type: 'shipTo' as const,       loadFrom: 'buyer' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

// ─── ABI Send — POST /api/abi/send ───────────────────────────────────

export const CC_ABI_SEND_SAMPLE = {
  type:        'abi' as const,
  action:      'add',
  application: 'entry-summary-cargo-release',
  MBOLNumber:  '12349494945',
  entryNumber: ['S4G-7508876-8', 'S4G-7508875-0'],
};

// ─── Manifest Query — POST /api/manifest-query ───────────────────────

export const CC_MANIFEST_QUERY_REQUEST = {
  type:                          'BOLNUMBER' as const,
  masterBOLNumber:               'GZTE83U13406089',
  houseBOLNumber:                null,
  limitOutputOption:             '',
  requestRelatedBOL:             false,
  requestBOLAndEntryInformation: false,
};

// AWB-typed sample with a BOL that returns 3 houses + entry numbers
export const CC_MANIFEST_QUERY_AWB_BOL = '16072007541';

// ─── Manifest Query Response — what CC actually returns ─────────────

export const CC_MANIFEST_QUERY_RESPONSE_OK = {
  data: {
    type: 'awbNumber',
    masterBOLNumber: '16072007541',
    requestBOLAndEntryInformation: false,
    requestRelatedBOL:             false,
    limitOutputOption:             '2',
    response: [
      {
        statusMsg: [],
        houses: [
          {
            awbNumber: '16072007541',
            hawbNumber: '0000616038',
            flightNumber: '3080',
            importingCarrierCode: 'CPA',
            scheduledArrivalDate: '092223',
            manifestQty: '1',
            dispositionMsg: [
              { dispositionActionDate: '092223', dispositionActionTime: '141706', dispositionCode: '1C', entryNumber: 'S4G03494914' },
              { dispositionActionDate: '092223', dispositionActionTime: '141706', dispositionCode: 'FS', entryNumber: 'S4G03494914' },
            ],
            manifestedPort: '3901',
          },
        ],
        carrierCode: 'CPA',
        importingVesselCodeOrImpConveyanceName: 'CPA3080 20230922',
        wr1DateOfArrival: '092223',
        manifestedPortOfUnlading: '3901',
        modeOfTransport: 'AIR',
      },
    ],
  },
};

// "BILL NBR NOT ON FILE" shape — what CC returns when the BOL doesn't exist
export const CC_MANIFEST_QUERY_RESPONSE_NOT_FOUND = {
  data: {
    response: {
      errorMessage: 'BILL NBR NOT ON FILE',
      carrierCode:  'CPA',
      masterBLNumber: '16072007541',
    },
  },
};

// ─── Duty Calculation — POST /api/duty-calculation-tool ──────────────

export const CC_DUTY_CALC_REQUEST = {
  items: [
    {
      hts:                            '7320.20.1000',
      description:                    'HELICAL SPRINGS:MV SUSPENSION',
      totalValue:                     13,
      quantity1:                      1,
      quantity2:                      1,
      spi:                            '',
      aluminumPercentage:             100,
      steelPercentage:                100,
      copperPercentage:               100,
      isCottonExempt:                 false,
      isAutoPartExempt:               false,
      kitchenPartNotComplete:         false,
      isInformationalMaterialExempt:  true,
    },
  ],
  entryType:            'informal' as const,
  modeOfTransportation: 'air' as const,
  estimatedEntryDate:   '04/06/2026',
  countryOfOrigin:      'CN',
  currency:             'USD',
};

export const CC_DUTY_CALC_RESPONSE_OK = {
  items: [
    {
      classification: { name: 'HELICAL SPRINGS:MV SUSPENSION', hts: '7320201000' },
      description:    'HELICAL SPRINGS:MV SUSPENSION',
      duty:           0.42,
      subheadingDuties: 4.23,
      subheadings: [
        { hts: '99038815', name: 'ARTICLE OF CHINA,US NTE 20(R)', duty: 0.98 },
        { hts: '99039405', name: 'AUTO PRT, LT TKS, NT33(G)', duty: 3.25 },
      ],
      totalDutiable: 13,
    },
  ],
  countryOfOrigin: 'CN',
  countryOfOriginName: 'China',
  modeOfTransportation: 'air',
  estimatedEntryDate: '04/06/2026',
  currency: 'USD',
  entryFee:  { entryProcessingFee: 2.69, portProcessingFee: 0 },
  summary:   { totalValue: 13, ddp: 0, totalDutiableValue: 13, totalDutiesTaxes: 0 },
  dutiesBreakdown: { totalChargesAmount: 0, totalDuties: 4.65, processingFee: 2.69, totalUserFee: 0, totalIrTax: 0, totaladcvdAmount: 0 },
  ddpBreakdown: { ddpIncluded: false, ddp: 0, shipping: 0, insurance: 0 },
};

// ─── CC error response shapes — what CC returns when validation fails ──
// These are the exact shapes our ccErrorsToIssues mapper has to handle.
// Do not edit; if the shape changes, the test fails and we update the
// mapper, not the fixture.

export const CC_DUTY_ERROR_BAD_HTS = {
  code: 400,
  data: {},
  name: 'BadRequest',
  errors: {
    'items[0]': ["HTS code '6204624000' is not found in the system"],
    'items[1]': ["HTS code '6205202065' is not found in the system"],
  },
  message: 'Some required fields are missing or invalid',
  className: 'bad-request',
};

export const CC_DUTY_ERROR_AI_QUANTITY = {
  code: 400,
  data: {},
  name: 'BadRequest',
  errors: {
    'items[0]': ['At least quantity1 or quantity2 (as number) must be provided'],
  },
  message: 'Some required fields are missing or invalid',
  className: 'bad-request',
};

export const CC_DUTY_ERROR_SPI_MISMATCH = {
  code: 400,
  data: {},
  name: 'BadRequest',
  errors: {
    'items[0]': ["The Special Program Indicator 'MX' does not exist for the HTS code '7320201000', or it does not match the Country Of Origin 'CN'."],
  },
  message: 'Some items failed SPI validations',
  className: 'bad-request',
};

export const CC_ISF_ERROR_PORT = [
  {
    field: 'MBOLNumber: MAUTT776545 - HBOLNumber: MAUTT776545',
    message: 'USPortOfArrival should be equal to one of the allowed values [0000,0101,...]',
  },
];

export const CC_ISF_ERROR_WEIGHT_UOM = [
  { field: 'MBOLNumber: MAEU1234567890 - HBOLNumber: HCLA12345678', message: 'weightUOM should NOT be longer than 1 characters' },
  { field: 'MBOLNumber: MAEU1234567890 - HBOLNumber: HCLA12345678', message: 'weightUOM should be equal to one of the allowed values [null,,L,K]' },
];

export const CC_ISF_ERROR_DESC_LEN = [
  { field: 'MBOLNumber: MAEU123456789 - HBOLNumber: HBOL2026041401', message: 'description should NOT be longer than 45 characters' },
  { field: 'MBOLNumber: MAEU123456789 - HBOLNumber: HBOL2026041401', message: 'description must be between 1 and 45 characters long.' },
];

// ─── HTS Classifier — POST /api/hts-classifier ───────────────────────

export const CC_HTS_CLASSIFIER_REQUEST = {
  items: [
    { description: 'Electric motor, 15 kW, for industrial use, 3-phase AC.' },
    { description: 'HONEY' },
    { description: 'POTATO' },
  ],
};
