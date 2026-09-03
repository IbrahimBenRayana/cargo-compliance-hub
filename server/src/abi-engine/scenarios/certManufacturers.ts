/**
 * CERT background data: every manufacturer MID the certification scenarios
 * reference, with firm details verified to derive each MID byte-exact via
 * deriveMid (Directive 3500-13). ACE requires the MID on file before an AE
 * references it (F523). Generated from the scenario fixtures Aug 25 2026;
 * excludes 3 CA-prefixed package MIDs that deriveMid cannot produce
 * (CATORFUR815TOR/CATORVIN926TOR/CAWPGOAT173WPG — rep decision pending).
 */
export interface CertManufacturer {
  mid: string;
  name: string;
  street: string;
  city: string;
  countryCode: string;
  /** Required for US/CA/CN firms (AMF-17); not part of MID derivation. */
  zipOrPostalCode?: string;
  /** Already acknowledged by CERT ($5U/$6). */
  added?: boolean;
}

export const CERT_MANUFACTURERS: CertManufacturer[] = [
  { mid: 'SGSIGPRI123SIN', name: 'SIGMA PRINTERS PTE', street: '123 JURONG RD', city: 'SINGAPORE', countryCode: 'SG', added: true },
  { mid: 'EGCAIKNI456CAI', name: 'CAIRO KNITTING MILLS', street: '456 NILE CORNICHE', city: 'CAIRO', countryCode: 'EG', added: true },
  { mid: 'CNSHEBAT123SHA', name: 'SHENZHEN BATTERY CO', street: '123 PUDONG AVE', city: 'SHANGHAI', countryCode: 'CN', zipOrPostalCode: '200001', added: true },
  { mid: 'PHMANCAR789MNL', name: 'MANILA CARBON WORKS', street: '789 QUIRINO AVE', city: 'MNL', countryCode: 'PH', added: true },
  { mid: 'GBLONNAV321LON', name: 'LONDON NAVIGATION INSTRUMENTS', street: '321 THAMES RD', city: 'LONDON', countryCode: 'GB', added: true },
  { mid: 'CLSCLBER246SCL', name: 'S C L BERRIES', street: '246 AVENIDA COSTANERA', city: 'SCL', countryCode: 'CL', added: true },
  { mid: 'CHZURPAS135ZUR', name: 'ZURICH PASTA AG', street: '135 BAHNHOFSTRASSE', city: 'ZURICH', countryCode: 'CH', added: true },
  { mid: 'FRPARMUS791PAR', name: 'PARIS MUSHROOMS', street: '791 RUE DE SEINE', city: 'PARIS', countryCode: 'FR', added: true },
  { mid: 'ITMILTOM468MIL', name: 'MILANO TOMATO SRL', street: '468 VIA ROMA', city: 'MILANO', countryCode: 'IT', added: true },
  { mid: 'CLSCLPUL802SCL', name: 'S C L PULP SA', street: '802 CAMINO FORESTAL', city: 'SCL', countryCode: 'CL', added: true },
  { mid: 'KRSELSTE579SEL', name: 'S E L STEEL', street: '579 GANGNAM DAERO', city: 'SEL', countryCode: 'KR', added: true },
  { mid: 'JPTYOSHO913TYO', name: 'T Y O SHOE CO', street: '913 GINZA', city: 'TYO', countryCode: 'JP', added: true },
  { mid: 'FMPNIBAS753PNI', name: 'P N I BASKETS', street: '753 KASELEHLIE ST', city: 'PNI', countryCode: 'FM', added: true },
  { mid: 'MXMEXAPP159MEX', name: 'MEXICO APPAREL SA', street: '159 REFORMA', city: 'MEXICO CITY', countryCode: 'MX', added: true },
  { mid: 'CNSHERAP321SHA', name: 'SHENZHEN RAPESEED CO', street: '321 NANSHAN RD', city: 'SHANGHAI', countryCode: 'CN', zipOrPostalCode: '200001', added: true },
  { mid: 'CNSHEORA654SHA', name: 'SHENZHEN ORALCARE LTD', street: '654 FUTIAN BLVD', city: 'SHANGHAI', countryCode: 'CN', zipOrPostalCode: '200001', added: true },
  { mid: 'CNSHEFLM987SHA', name: 'SHENZHEN FLM IMAGING', street: '987 LUOHU RD', city: 'SHANGHAI', countryCode: 'CN', zipOrPostalCode: '200001', added: true },
  { mid: 'GBLONHEP531LON', name: 'LONDON HEPARIN LTD', street: '531 KING EDWARD ST', city: 'LONDON', countryCode: 'GB', added: true },
  { mid: 'CLSCLAPR864SCL', name: 'S C L APRICOTS', street: '864 VALLE CENTRAL', city: 'SCL', countryCode: 'CL', added: true },
  { mid: 'DESOLKNI275SOL', name: 'SOLINGEN KNIVES GMBH', street: '275 KLINGENSTRASSE', city: 'SOLINGEN', countryCode: 'DE', added: true },
  { mid: 'GLGOHAIR428GOH', name: 'G O H AIRCRAFT PARTS', street: '428 AQQUSINERSUAQ', city: 'GOH', countryCode: 'GL', added: true },
  { mid: 'CHGENWAT552GEN', name: 'GENEVA WATCH SA', street: '552 RUE DU RHONE', city: 'GENEVA', countryCode: 'CH', added: true },
  { mid: 'MACASBEL713CAS', name: 'CASABLANCA BELTS', street: '713 BLVD MOHAMMED V', city: 'CASABLANCA', countryCode: 'MA', added: true },
  // 027 (Karl 9/3: XQ = Canadian province) — CA MIDs need postal codes (AMF-17).
  { mid: 'CATORAPP159TOR', name: 'TORONTO APPAREL', street: '159 SPADINA AVE', city: 'TORONTO', countryCode: 'CA', zipOrPostalCode: 'M5V2T6', added: false },
  { mid: 'CNSHETOO654SHA', name: 'SHENZHEN TOOLS CO', street: '654 BAO AN RD', city: 'SHANGHAI', countryCode: 'CN', zipOrPostalCode: '200001', added: true },
  { mid: 'GUHAGPEA842HAG', name: 'HAGATNA PEARLS', street: '842 MARINE CORPS DR', city: 'HAGATNA', countryCode: 'GU', added: true },
  { mid: 'MXMTYSTL654MTY', name: 'M T Y STL METALS', street: '654 AV CONSTITUCION', city: 'MTY', countryCode: 'MX', added: true },
  { mid: 'AUPERDIA987PER', name: 'PERTH DIAMONDS', street: '987 HAY ST', city: 'PERTH', countryCode: 'AU', added: true },
  { mid: 'KRSELWIG217SEL', name: 'S E L WIGS', street: '217 JONGNO', city: 'SEL', countryCode: 'KR', added: true },
  { mid: 'ESMADALU365MAD', name: 'MADRID ALUMINIO SA', street: '365 GRAN VIA', city: 'MADRID', countryCode: 'ES', added: true },
  { mid: 'VCKINMEA754KIN', name: 'KINGSTOWN MEATS', street: '754 BAY ST', city: 'KINGSTOWN', countryCode: 'VC', added: true },
  { mid: 'ITMILFER426MIL', name: 'MILANO FERTILIZZANTI', street: '426 CORSO BUENOS AIRES', city: 'MILANO', countryCode: 'IT', added: true },
  { mid: 'TWTPEFER538TPE', name: 'T P E FERTILIZERS', street: '538 ZHONGSHAN RD', city: 'TPE', countryCode: 'TW', added: true },
  { mid: 'KRSELFER649SEL', name: 'S E L FERTILIZER', street: '649 MAPO DAERO', city: 'SEL', countryCode: 'KR', added: true },
  { mid: 'GLGOHWAT219GOH', name: 'G O H WATCH REPAIR', street: '219 IMANEQ', city: 'GOH', countryCode: 'GL', added: true },
  { mid: 'JPMATELE288OSA', name: 'MATSUSHITA ELECTRIC', street: '288 KADOMA', city: 'OSAKA', countryCode: 'JP', added: true },
  { mid: 'ZAJNBLEA318JNB', name: 'J N B LEATHER', street: '318 COMMISSIONER ST', city: 'JNB', countryCode: 'ZA', added: true },
  { mid: 'KRSELWOO471SEL', name: 'S E L WOOD PRODUCTS', street: '471 TEHERAN RO', city: 'SEL', countryCode: 'KR', added: true },
  { mid: 'HTPAPTEX593PAP', name: 'P A P TEXTILES', street: '593 RUE PAVEE', city: 'PAP', countryCode: 'HT', added: true },
  { mid: 'JPTYOAUT137TYO', name: 'T Y O AUTOS', street: '137 SHIBAURA', city: 'TYO', countryCode: 'JP', added: true },
  { mid: 'GBLONFAN204LON', name: 'LONDON FANS LTD', street: '204 BRICK LANE', city: 'LONDON', countryCode: 'GB', added: true },
  { mid: 'KRSELTIM682SEL', name: 'S E L TIMERS', street: '682 EULJIRO', city: 'SEL', countryCode: 'KR', added: true },
  { mid: 'ITROMPAS284ROM', name: 'ROMA PASTA SRL', street: '284 VIA APPIA', city: 'ROMA', countryCode: 'IT', added: true },
  { mid: 'CNSHEREL491SHA', name: 'SHENZHEN RELAYS', street: '491 LONGGANG AVE', city: 'SHANGHAI', countryCode: 'CN', zipOrPostalCode: '200001', added: true },
  { mid: 'CNCAWBAT7057SHE', name: 'CAW BATTERIES', street: '7057 BAOAN BLVD', city: 'SHENZHEN', countryCode: 'CN', zipOrPostalCode: '518000', added: true },
  { mid: 'FRCOGBRA759COG', name: 'COGNAC BRANDY SA', street: '759 QUAI DES CHAIS', city: 'COGNAC', countryCode: 'FR', added: true },
  { mid: 'HKHKGJEW368HKG', name: 'H K G JEWELLERY', street: '368 NATHAN RD', city: 'HKG', countryCode: 'HK', added: true },
  { mid: 'DEMUNSNO347MUN', name: 'MUNICH SNOWMOBILES', street: '347 LEOPOLDSTRASSE', city: 'MUNICH', countryCode: 'DE', added: true },
  { mid: 'HKHKGRAD529HKG', name: 'H K G RADIO', street: '529 DES VOEUX RD', city: 'HKG', countryCode: 'HK', added: true },
  { mid: 'KRSELALU906SEL', name: 'S E L ALUMINUM', street: '906 OLYMPIC RO', city: 'SEL', countryCode: 'KR', added: true },
  { mid: 'TWNICSAN435TAI', name: 'NICSAN', street: '435 INDUSTRIAL RD', city: 'TAICHUNG', countryCode: 'TW', added: true },
];
