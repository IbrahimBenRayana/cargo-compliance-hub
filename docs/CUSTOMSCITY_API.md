# CustomsCity API Integration Guide# CustomsCity ISF API — Reverse-Engineered Reference# CustomsCity API — Reverse-Engineered Documentation



> **Last verified**: April 2, 2026 — Full E2E create + send confirmed working on CC cert sandbox.



## Overview> **Last updated:** April 2026  > **Status**: Verified against live sandbox `api-cert.customscity.com` (April 2026)



CustomsCity (CC) is a Feathers.js REST API for submitting ISF (Importer Security Filing) documents to US CBP.> **Source:** Live testing against `api-cert.customscity.com` (sandbox) + CC dashboard screenshots  > **Architecture**: FeathersJS backend (REST + WebSocket), deployed on Easypanel



- **Cert/Sandbox**: `https://api-cert.customscity.com`> **Architecture:** FeathersJS backend (REST + WebSocket), deployed on Easypanel  > **Auth**: Bearer JWT token

- **Production**: `https://api.customscity.com`

- **Auth**: Bearer token via `POST /authentication` → returns `accessToken`> **Auth:** Bearer JWT token  



## Authentication> **Status:** 17 irreducible sandbox validation errors remain (see [Known Limitations](#16-known-sandbox-limitations))---



```http

POST /authentication

Content-Type: application/json---## 1. Base URLs



{

  "strategy": "local",

  "email": "your-email@domain.com",## Table of Contents| Environment | URL |

  "password": "your-password"

}|-------------|-----|

```

1. [Authentication](#1-authentication)| **Sandbox** | `https://api-cert.customscity.com` |

**Response**: `{ "accessToken": "eyJ...", "user": { ... } }`

2. [Endpoints](#2-endpoints)| **Production** | `https://app.customscity.com` (assumed) |

> **IMPORTANT**: The field is `accessToken`, NOT `token`.

3. [ISF Document Create — Payload Structure](#3-isf-document-create--payload-structure)

All subsequent requests must include:

```4. [Field Reference — Filing Header](#4-filing-header-fields)### Internal Microservices (discovered from JS bundle)

Authorization: Bearer <accessToken>

```5. [Field Reference — IOR & ISF Filer](#5-ior--isf-filer)- `cc-cert-feathers-api.doxwnz.easypanel.host` — Main API



---6. [Field Reference — Bond](#6-bond)- `cc-cert-feathers-api-abi.doxwnz.easypanel.host` — ABI



## Core Endpoints7. [Field Reference — Port & Arrival](#7-port--arrival)- `cc-cert-feathers-api-export.doxwnz.easypanel.host` — Export



### 1. Create Document — `POST /api/documents`8. [Field Reference — Parties](#8-parties)- `cc-cert-feathers-api-socket.doxwnz.easypanel.host` — WebSocket



> ⚠️ **CRITICAL**: Use `/api/documents` (NOT `/api/documents/isf`)!9. [Field Reference — Shipments (Manufacturer + Items)](#9-shipments-manufacturer--items)- `cc-cert-feathers-api-upload.doxwnz.easypanel.host` — File Upload

> The `/api/documents/isf` sub-route runs a stricter validator that NEVER persists — it only returns validation errors.

10. [Field Reference — References & Carnet](#10-references--carnet)

**Request Payload** — `CCDocumentCreatePayload`:

11. [Field Reference — Send Options](#11-send-options)> The public gateway (`api-cert.customscity.com`) proxies to these.

```json

{12. [Dropdown Enums (from CC Dashboard)](#12-dropdown-enums-from-cc-dashboard)

  "type": "isf",

  "send": false,13. [Tax ID / EIN Format](#13-tax-id--ein-format)---

  "sendAs": "add",

  "version": 2,14. [Date Format](#14-date-format)

  "body": [{ /* CCISFDocumentBody — see below */ }]

}15. [Response Handling](#15-response-handling)## 2. Authentication

```

16. [Known Sandbox Limitations](#16-known-sandbox-limitations)

| Field      | Type    | Description                                            |

|------------|---------|--------------------------------------------------------|17. [CC Dashboard UI Tabs](#17-cc-dashboard-ui-tabs)```

| `type`     | string  | Always `"isf"` for ISF filings                        |

| `send`     | boolean | `false` — create only; send separately via `/api/send` |Authorization: Bearer <JWT_TOKEN>

| `sendAs`   | string  | `"add"` (new), `"change"` (amend), `"cancel"` (cancel)|

| `version`  | number  | Always `2`                                             |---Content-Type: application/json

| `body`     | array   | Array containing exactly ONE `CCISFDocumentBody`       |

```

**Success Response** (HTTP 201):

```json## 1. Authentication

{

  "code": "200",Token is issued from CustomsCity dashboard. Sandbox tokens may have extended expiry (ours expires 2027).

  "message": "Document Created",

  "processId": "69cea38e9a40d4e34182faca"```

}

```POST /authentication---



**Duplicate BOL Error** (HTTP 400):Content-Type: application/json

```json

{## 3. Module Types (from JS bundle)

  "name": "BadRequest",

  "message": "Validation errors",{

  "errors": "{\"BOLValidations\":{\"BOL Numbers already exist\":[\"HCLTEST123\"]}}"

}  "strategy": "local",```javascript

```

  "email": "user@example.com",{

---

  "password": "password"  AMS: "ams",

### 2. Send Document — `POST /api/send`

}  AMS_ISF: "ams-isf",

> ⚠️ **CRITICAL**: Uses `BOLNumber` array (house BOL), NOT `documentId`!

```  ISF: "isf",

```json

{  ISF_5: "isf-5",

  "type": "isf",

  "sendAs": "add",**Response:** `{ "accessToken": "<JWT>", "user": { ... } }`  ABI: "abi",

  "BOLNumber": ["HCLTEST123"]

}  ABI_UPLOAD: "abi-upload",

```

The JWT is passed as `Authorization: Bearer <JWT>` on all subsequent calls.    ABI_INBOND: "abi-in-bond",

| Field       | Type     | Description                                          |

|-------------|----------|------------------------------------------------------|Token expiry: ~1 year (confirmed from decoded JWT payload).  ABI_TYPE86: "abi-type86",

| `type`      | string   | Always `"isf"`                                       |

| `sendAs`    | string   | `"add"`, `"change"`, or `"cancel"`                   |  AIR_TYPE86: "air-type86",

| `BOLNumber` | string[] | Array of **house** BOL numbers to send               |

---  AMS_ISF10_TYPE86: "ams-isf10-type86",

**Success Response** (HTTP 201):

```json  TRIFECTA_V2: "trifecta-v2",

{

  "success": true,## 2. Endpoints  AIR_DOCUMENT: "air-document",

  "Documents sent": 1,

  "Documents with vague descriptions": 0,  AIR_TYPE86_MULTI: "air-type86-multi"

  "Documents with invalid party names": 0

}| Method | Path | Description |}

```

|--------|------|-------------|```

---

| `POST` | `/api/documents/isf` | Create ISF document |

### 3. List Documents — `GET /api/documents`

| `GET` | `/api/documents?type=ISF&dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD&skip=0` | List ISF documents |---

```http

GET /api/documents?type=ISF&dateFrom=2025-01-01&dateTo=2026-12-31&skip=0| `GET` | `/api/documents/isf/:id` | Get single ISF document |

```

| `POST` | `/api/hts-classification` | AI HTS code classification |## 4. ISF Document Endpoints

### 4. Document Status — `GET /api/document-status`



```http

GET /api/document-status?manifestType=ISF&BOLNumber=HCLTEST123**Document types enum:** `OceanAMS`, `ISF`, `ABIType86`, `fda-pn`, `AirAMS15`, `AirAMS`### 4.1 Create ISF Document

```



### 5. CBP Messages — `GET /api/messages`

### Base URLs```

```http

GET /api/messages?manifestType=ISF&BOLNumber=HCLTEST123POST /api/documents/isf

```

| Environment | URL |```

### 6. HTS Classification — `POST /api/hts-classifier`

|-------------|-----|

```json

{| Sandbox/Cert | `https://api-cert.customscity.com` |> **IMPORTANT**: NOT `/api/documents`. The ISF type is a sub-resource endpoint.

  "items": [{ "description": "Steel bolts grade 8.8" }]

}| Production | `https://api.customscity.com` (assumed) |

```

#### Payload Structure

**Response**: `{ "items": [{ "description": "...", "hts_code": "731815", "explanation": "..." }] }`

### Endpoints that DO NOT exist:

---

- `/api/documents` (generic POST) — requires `statusProcess.type` Mongoose subdoc; not usable via REST```json

## ISF Document Body — Field Reference

- `/api/documents/isf/validate` — 404{

### BOL & Filing Identity

- `/api/documents/isf/schema` — returns placeholder text, not actual schema  "body": [

| Field                    | Type          | Required | Values / Notes                              |

|--------------------------|---------------|----------|---------------------------------------------|- `/api/parties`, `/api/ports`, `/api/settings`, `/api/contacts` — all 404    {

| `masterBOLNumber`        | string        | ✅       | Master Bill of Lading                       |

| `BOLNumber`              | string        | ✅       | House BOL (or same as master for MASTER)    |      // === Filing Identity ===

| `billType`               | string        | ✅       | `"HOUSE"` or `"MASTER"`                     |

| `amendmentCode`          | string        | ✅       | `"CT"` (Complete Transmission)              |---      "actionCode": "A",                    // A=Add, R=Replace, D=Delete

| `ISFSubmissionType`      | string        | ✅       | `"1"` (ISF-10) or `"2"` (ISF-5)            |

| `ISFShipmentTypeCode`    | string        | ✅       | `"01"` (Direct), `"02"` (To Order), `"03"` (FROB) |      "BOLNumber": "8CUS1000001",           // AN(5,30) - Bill of Lading

| `shipmentSubtypeCode`    | string        | ✅       | `""` (empty string)                         |

| `carnetNumber`           | string        | ✅       | `""` when not applicable                    |## 3. ISF Document Create — Payload Structure      "billType": "HOUSE",                  // A(5,10) - "HOUSE" or "MASTER"

| `carnetCountry`          | string        | ✅       | `""` when not applicable                    |

| `estimatedValue(Type11)` | number\|null  | ✅       | `null`                                      |      "ISFSubmissionType": "1",             // N(1,1) - "1"=ISF-10, "2"=ISF-5, "3"=ISF5→10, "4"=ISF10→5

| `bondActivityCode`       | string        | ✅       | `"01"`                                      |

| `bondType`               | string        | ✅       | `"8"` (Continuous) or `"9"` (Single)        |```      "ISFShipmentTypeCode": "11",          // N(2,2) - Shipment type

| `isFROB`                 | boolean       | ✅       | `false` for non-FROB                        |

| `bondHolderID`           | string        | ✅       | EIN format: `"XX-XXXXXXXXX"`               |POST /api/documents/isf

| `USPortOfArrival`        | string        | ✅       | 4-digit Schedule-D port code (e.g., `"1001"`) |

| `estimateDateOfArrival`  | string        | ✅       | `"YYYYMMDD"` format                         |Content-Type: application/json      // === Shipment Info ===



### FROB-Conditional FieldsAuthorization: Bearer <JWT>      "shipmentSubtypeCode": "01",          // N(1,2) - Conditional



These **MUST be empty strings** when `isFROB` is `false`:      "estimatedValue(Type11)": 500,        // NUMBER - Estimated value (note: parentheses in field name!)



| Field                   | When `isFROB=false` | When `isFROB=true`                        |{

|-------------------------|---------------------|-------------------------------------------|

| `entryTypeCode`         | `""`                | `"00"`, `"62"`, or `"63"`                 |  "body": [ { ...flat ISF fields... } ]      // === IOR (Importer of Record) ===

| `foreignPortOfUnlading` | `""`                | UN/LOCODE                                 |

| `placeOfDelivery`       | `""`                | UN/LOCODE                                 |}      "IORLastName": "CUSTOMS CITY",        // AN(1,35) - Mandatory



### Party Fields — Identifier Codes```      "IORIDCodeQualifier": "24",           // AN(1,2) - "24"=EIN, "PN"=passport, etc.



| Party             | `identifierCode` | `taxID` format       | Notes                           |      "IORNumber": "20-493538700",          // AN(2,80) - Must match qualifier format

|-------------------|-------------------|----------------------|---------------------------------|

| IOR               | `"24"` (EIN)      | `"XX-XXXXXXXXX"`     | `IORName` max 35 chars          |### Critical rules:      "IORDateOfBirth": 20200602,           // NUMBER YYYYMMDD - Conditionally required

| ISF Filer         | `"24"` (EIN)      | `"XX-XXXXXXXXX"`     | `ISFFilerName` max 25 chars     |

| Consignee         | `"24"` (EIN)      | `"XX-XXXXXXXXX"`     |                                 |- `body` **must be an array** (sending an object → HTTP 500: `body.entries is not a function`)

| Buyer             | `""` (empty)      | `""` (empty)         |                                 |

| Ship To           | `""` (empty)      | `""` (empty)         | Allowed: `null, "1", "9", "FR"` |- All party fields are **flat camelCase** at the body root (not nested objects)      // === ISF Filer ===

| Seller            | `""` (empty)      | `""` (empty)         |                                 |

| Consolidator      | `""` (empty)      | `""` (empty)         | Allowed: `null, "1", "9"`       |- Manufacturer + items are nested inside `shipments[].manufacturer[]` and `shipments[].items[]`      "ISFFilerName": "JANE",               // AN(1,25) - Optional first name

| CSL               | `""` (empty)      | `""` (empty)         | Allowed: `null, "1", "9"`       |

- Container type/number appear at **both** body root AND inside `shipments[].items[]`      "ISFFilerLastName": "DOE",            // AN(1,35) - Mandatory

### Name Field Character Restrictions

- Dates are **integers** (`YYYYMMDD`), not strings      "ISFFilerIDCodeQualifier": "24",      // AN(1,2)

> ⚠️ **CC rejects periods (`.`) in name fields!**

      "ISFFilerNumber": "20-493538700",     // AN(2,80)

**Allowed characters**: Letters, numbers, spaces, dashes, ampersands  

**Rejected characters**: Periods (`.`), commas (`,`), quotes, slashes, special chars---      "ISFFilerDateOfBirth": 20200602,      // NUMBER YYYYMMDD



The adapter's `sanitizeName()` function strips rejected characters automatically:

```typescript

function sanitizeName(raw: string, maxLen: number): string {## 4. Filing Header Fields      // === References (conditionally required when no amendmentCode) ===

  return raw.replace(/[^A-Za-z0-9 &\-]/g, '').replace(/\s+/g, ' ').trim().substring(0, maxLen);

}      "additionalISFReferenceCode": "6C",   // AN(1,2) - ENUM (see allowed values)

```

| Field | Type | Required | Accepted Values | CC Dashboard Label |      "additionalISFReferenceID": "JP002299452",  // AN(1,30)

### Address Field Rules

|-------|------|----------|----------------|--------------------|      "referenceCodeA": "??",               // ENUM - unknown allowed values

| Field      | Max Length | Fallback | Notes                                      |

|------------|-----------|----------|--------------------------------------------|| `actionCode` | string(1) | ✅ | `"A"` (Add), `"R"` (Replace), `"D"` (Delete) | — |      "referenceNumberA": "REF001",

| `Address1` | 35        | `"NA"`   | At least 1 char required                   |

| `Address2` | 35        | `"NA"`   | Single period `"."` is **rejected**         || `BOLNumber` | string(5-30) | ✅ | Alphanumeric | **Bill of Lading #** _(SCAC + Bill of Lading#)_ |      "referenceCodeB": "??",

| `City`     | 35        | Required | Use `"Unknown"` as fallback                |

| `State`    | 2-4       | `"XX"`   |                                            || `billType` | string | ✅ | `"HOUSE"`, `"MASTER"` | **Regular/House/Master** dropdown |      "referenceNumberB": "REF002",

| `PostalCode` | 10     | `"00000"` |                                           |

| `Country`  | 2         | Required | ISO 3166-1 alpha-2                         || `ISFSubmissionType` | string(1) | ✅ | `"1"` (ISF-10), `"2"` (ISF-5), `"3"` (ISF-5→10), `"4"` (ISF-10→5) | **ISF Submission Type** dropdown |      "referenceCodeC": "??",



### Date Fields| `ISFShipmentTypeCode` | string(2) | ✅ | `"01"` (Direct), `"02"` (To Order), `"03"` (FROB) | **Shipment Type** dropdown |      "referenceNumberC": "REF003",



All date fields in the working payload use `"YYYYMMDD"` string format:| `shipmentSubtypeCode` | string(2-4) | ✅ | `"01"` | **Shipment Sub-Type** dropdown |

- `estimateDateOfArrival`

- `IORDateOfBirth`| `ISFBond` | string(2) | — | `"01"` (Importer or Broker) | **ISF Bond** dropdown |      // === Bond ===

- `ISFFilerDateOfBirth`

- `buyerDateOfBirth`| `groupingNumber` | string | — | Free text | **Grouping Number** _(Booking #, MBL # etc.)_ |      "bondHolderID": "20-493538700",       // AN(1,30)

- `shipToDateOfBirth`

- `sellerDateOfBirth`| `amendmentCode` | string(2) | Only on amend | `"CT"`, `"FR"`, `"FT"`, `"FX"` | **Amendment Code** dropdown |      "bondType": "8",                      // N(1,1) - "8"=Continuous, "9"=Single Transaction



### Package Info      "bondActivityCode": "01",             // N(2,2)



| Field           | Type         | Value            |### Value fields:

|-----------------|-------------|------------------|

| `packageQuantity` | number\|null | `null`          |      // === Port & Arrival ===

| `packageUnit`   | string       | `""` (empty)     |

| Field | Type | Required | Notes | CC Dashboard Label |      "USPortOfArrival": "5201",            // N(4,4) - Schedule D port code

### Reference Codes

|-------|------|----------|-------|--------------------|      "estimateDateOfArrival": 20260501,    // NUMBER YYYYMMDD

| Field           | Allowed Values                          |

|-----------------|----------------------------------------|| `estimatedValue(Type11)` | number | Conditional | Required when ShipmentType includes type 11 | — |

| `referenceCodeA/B/C` | `""`, `null`, `"7U"`, `"SCI"`, `"SBN"`, `"CR"`, `"FN"` |

| `shipmentValue` | number | — | Shipment value in USD | **Shipment Value ($USD)** |      // === Consignee ===

### Additional Fields

      "consigneeName": "JOE SAMPLE",        // AN(1,60)

| Field                          | Type   | Notes                        |

|-------------------------------|--------|------------------------------|---      "consigneeIdentifierCode": "24",      // AN(2,2) - Mandatory

| `filerCode`                    | string | e.g., `"8CCG"`               |

| `additionalISFReferenceCode`   | string | `""` when not applicable     |      "consigneeTaxID": "20-123456789",     // AN(2,80) - Mandatory

| `additionalISFReferenceNumber` | string | `""` when not applicable     |

## 5. IOR & ISF Filer      "consigneeAddress1": "100 MAIN ST",   // AN(1,35)

---

      "consigneeCity": "TORRANCE",          // AN(2,30)

## Shipments Structure

### Importer of Record      "consigneeStateOrProvince": "CA",     // AN(1,2)

Items nest inside manufacturers, which nest inside shipments:

      "consigneePostalCode": "26271",       // AN(3,15)

```

shipments[0]| Field | Type | Required | Format | CC Dashboard Label |      "consigneeCountry": "US",             // AN(2,3)

  ├── scacCode: "MAEU"

  ├── vesselName: "EVER GIVEN"|-------|------|----------|--------|--------------------|

  ├── voyageNumber: "V001"

  ├── containerType: "CN"| `IORLastName` | string(1,35) | ✅ | — | **Last Name / Company** |      // === Seller ===

  ├── containerNumber: "TEMU1234567"

  └── manufacturer[0]| `IORIDCodeQualifier` | string | ✅ | See ID Code enum | **ID Code** dropdown |      "sellerName": "SELLER CO",            // AN(1,60) - Mandatory

        ├── manufacturerName: "Shanghai Trading Co"

        ├── manufacturerTaxID: ""| `IORNumber` | string | ✅ | `XX-XXXXXXXXX` | **IOR Number** |      "sellerTaxID": "20-123456789",

        ├── registrationCode: ""

        ├── manufacturerAddress1/2/City/State/Zip/Country| `IORDateOfBirth` | number | Conditional | `YYYYMMDD` integer | **IOR Date Of Birth** |      "sellerAddress1": "...",

        └── items[0]

              ├── lineItem: 1      "sellerCity": "...",

              ├── commodityHTS-6Number: "731815"  ← HYPHENATED key!

              ├── description: "Steel Bolts"### ISF Filer (ISF Importer)      "sellerStateOrProvince": "XX",

              ├── countryOfOrigin: "CN"

              ├── estimatedQuantity: 100      "sellerPostalCode": "...",

              ├── quantityUOM: "PKG"

              ├── estimatedWeight: 500| Field | Type | Required | Format | CC Dashboard Label |      "sellerCountry": "XX",

              └── weightUOM: "K"

```|-------|------|----------|--------|--------------------|



### Item Fields| `ISFFilerName` | string | — | First name | **Name** |      // === Buyer ===



| Field                    | Type   | Notes                                || `ISFFilerLastName` | string(1,35) | ✅ | — | **Last Name / Company** |      "buyerName": "BUYER CO",              // AN(1,60) - Mandatory

|--------------------------|--------|--------------------------------------|

| `lineItem`               | number | 1-based sequence number              || `ISFFilerIDCodeQualifier` | string | ✅ | See ID Code enum | **ID Code** dropdown |      "buyerTaxID": "...",

| `commodityHTS-6Number`   | string | **HYPHENATED** key name, 6 digits    |

| `description`            | string | Commodity description                || `ISFFilerNumber` | string | ✅ | `XX-XXXXXXXXX` | **IOR Number** |      "buyerAddress1": "...",

| `countryOfOrigin`        | string | ISO 3166-1 alpha-2                   |

| `estimatedQuantity`      | number | Numeric (not string)                 || `ISFFilerDateOfBirth` | number | Conditional | `YYYYMMDD` integer | **IOR Date Of Birth** |      "buyerCity": "...",

| `quantityUOM`            | string | `"PKG"`, `"PCS"`, `"CTN"`, etc.     |

| `estimatedWeight`        | number | Numeric (not string)                 |      "buyerStateOrProvince": "XX",

| `weightUOM`              | string | `"K"` (KG) or `"L"` (LBS)           |

Both sections have:      "buyerPostalCode": "...",

---

- **Party Selector** — free text search for existing parties      "buyerCountry": "XX",

## Workflow: Create → Send

- **Identifiers** — dropdown

The CC API uses a two-step workflow:

- **Copy From** — dropdown to copy from another party (e.g., "Buyer") + **Load** button      // === Ship To ===

### Step 1: Create Document

```      "shipToName": "SHIP TO",              // AN(1,60) - Mandatory

POST /api/documents

Body: { type: "isf", send: false, sendAs: "add", version: 2, body: [{...}] }---      "shipToTaxID": "...",

→ Returns: { processId: "69cea38e..." }

```      "shipToAddress1": "...",



### Step 2: Send Document## 6. Bond      "shipToCity": "...",

```

POST /api/send      "shipToStateOrProvince": "XX",

Body: { type: "isf", sendAs: "add", BOLNumber: ["HCLTEST123"] }

→ Returns: { success: true, "Documents sent": 1 }| Field | Type | Required | Accepted Values | CC Dashboard Label |      "shipToPostalCode": "...",

```

|-------|------|----------|----------------|--------------------|      "shipToCountry": "XX",

### Amend Workflow

1. Create with `sendAs: "change"`| `bondType` | string(1) | ✅ | `"8"` (Continuous), `"9"` (Single Transaction) | **Bond Type** dropdown |

2. Send with `sendAs: "change"`, same `BOLNumber`

| `bondHolderID` | string | ✅ | `XX-XXXXXXXXX` EIN format | **Bond Holder Tax ID** |      // === Container Stuffing Location ===

### Cancel Workflow

1. Create with `sendAs: "cancel"`| `bondActivityCode` | string(2) | ✅ | `"01"` | — _(internal, not shown in UI)_ |      "containerStuffingLocationName": "STUFFING LOC", // AN(1,60) - Mandatory

2. Send with `sendAs: "cancel"`, same `BOLNumber`

      "containerStuffingLocationTaxID": "...",

---

---      "containerStuffingLocationAddress1": "...",

## Error Handling

      "containerStuffingLocationCity": "...",

### Validation Errors (HTTP 400)

```json## 7. Port & Arrival      "containerStuffingLocationStateOrProvince": "XX",

{

  "name": "BadRequest",      "containerStuffingLocationPostalCode": "...",

  "message": "Validation errors",

  "errors": "{\"MBOLNumber: MCL123 - HBOLNumber: HCL123\":[\"IORName must be between 1 and 35 characters...\"]}"| Field | Type | Required | Format | CC Dashboard Label |      "containerStuffingLocationCountry": "XX",

}

```|-------|------|----------|--------|--------------------|



The `errors` field is a **JSON string** containing an object keyed by `"MBOLNumber: X - HBOLNumber: Y"` with an array of error messages.| `USPortOfArrival` | string(4) | ✅ | 4-digit Schedule D code | **US Port of Arrival** _(shows `0101 - PORTLAND, ME`)_ |      // === Consolidator ===



### Common Validation Errors| `estimateDateOfArrival` | number | ✅ | `YYYYMMDD` integer | **Est. Date of Arrival** |      "consolidatorName": "CONSOLIDATOR",    // AN(1,60) - Mandatory



| Error | Cause | Fix || `packageQuantity` | string | — | Numeric string | **Package Quantity** |      "consolidatorTaxID": "...",

|-------|-------|-----|

| `IORName must be between 1 and 35 characters` | Name has special chars (periods) | Strip periods from names || `packageUnit` | string | — | e.g. `"CTN"` | **Package Unit** |      "consolidatorAddress1": "...",

| `consigneeAddress2 must be between 1 and 35 characters` | Address2 is `"."` only | Use `"NA"` as default |

| `USPortOfArrival must be one of [...]` | Empty or invalid port code | Use valid 4-digit code |      "consolidatorCity": "...",

| `entryTypeCode not required when isFROB is false` | entryTypeCode non-empty when isFROB=false | Set to `""` |

| `BOL Numbers already exist` | Duplicate BOL submission | Use unique BOL numbers |> ⚠️ `USPortOfArrival` is **max 4 chars**. Do NOT pass UN/LOCODEs like `"CNSHA"` (5 chars → rejected).        "consolidatorStateOrProvince": "XX",



---> Example from CC dashboard: `0101` = Portland, ME      "consolidatorPostalCode": "...",



## Rate Limiting & Retry      "consolidatorCountry": "XX",



The adapter implements exponential backoff retry:---

- **Retryable statuses**: 408, 429, 500, 502, 503, 504

- **Max retries**: 3      // === Container ===

- **Base delay**: 1000ms (doubles each retry)

- **Max delay**: 10,000ms## 8. Parties      "containerType": "20",                // AN(2,2) - "20","2B","40","4B"

- **Timeout**: 30 seconds per request

      "containerNumber": "ABCD800001",      // AN(1,15)

---

The CC dashboard has **4 tabs**: IOR / ISF Importer | **Parties** | Shipment Details | Additional References

## Adapter Architecture

      // === Shipments (with Manufacturer + Items) ===

```

server/src/services/customscity.ts### Parties Tab — 6 party sections:      "shipments": [

├── Types: CCDocumentCreatePayload, CCISFDocumentBody, CCShipment, CCManufacturerWithItems, CCItem

├── Helpers: sanitizeName(), sanitizeAddress(), formatTaxId(), toYYYYMMDDString(), partyField()        {

├── Mapping: mapFilingToCC() — Prisma Filing → CC payload

├── Reverse: mapCCToInternal() — CC response → Prisma formatEach party follows the **same flat field pattern** at the body root:          "manufacturer": [

└── Client: CustomsCityClient class

     ├── createDocument() — POST /api/documents            {

     ├── sendDocument() — POST /api/send

     ├── listDocuments() — GET /api/documents```              "manufacturerName": "MFG CO",

     ├── getDocumentStatus() — GET /api/document-status

     ├── getMessages() — GET /api/messages{prefix}Name                — string, required (*) for most parties              "manufacturerTaxID": "...",

     ├── classifyHTS() — POST /api/hts-classifier

     ├── getMIDList() — GET /api/query/mid/list{prefix}IdentifierCode      — string, dropdown (ID Code)              "manufacturerAddress1": "...",   // Required

     ├── calculateDuty() — POST /api/duty-calculation-tool

     └── testConnection() — connectivity check{prefix}TaxID               — string, XX-XXXXXXXXX format              "manufacturerCity": "...",        // Required

```

{prefix}Address1            — string, required (*)              "manufacturerStateOrProvince": "XX", // Required

## Integration Mapping

{prefix}Address2            — string, optional              "manufacturerPostalCode": "...",  // Required

### Filing → CC Payload Mapping

{prefix}City                — string, required (*)              "manufacturerCountry": "CN"

| Our Field (Prisma)             | CC Field                           | Transform                    |

|-------------------------------|------------------------------------|------------------------------|{prefix}StateOrProvince     — string ("XX" when unknown)            }

| `filing.masterBol`            | `masterBOLNumber`                  | Direct                       |

| `filing.houseBol`             | `BOLNumber`                        | Direct                       |{prefix}PostalCode          — string ("00000" when unknown)            ],

| `filing.importerName`         | `IORName`, `IORLastName`           | `sanitizeName(_, 35)`        |

| `filing.importerName`         | `ISFFilerName`, `ISFFilerLastName` | `sanitizeName(_, 25)`        |{prefix}Country             — string, 2-letter ISO, required (*)          "items": [

| `filing.importerNumber`       | `IORNumber`, `ISFFilerNumber`      | `formatTaxId()`              |

| `filing.consigneeName`        | `consigneeName`                    | `sanitizeName(_, 35)`        |```            {

| `filing.consigneeNumber`      | `consigneeTaxID`                   | `formatTaxId()`              |

| `filing.buyer` (JSONB)        | `buyerName`, `buyerAddress1`, etc. | `partyField()` + sanitize    |              "description": "COTTON T-SHIRTS",

| `filing.seller` (JSONB)       | `sellerName`, `sellerAddress1`, etc.| `partyField()` + sanitize   |

| `filing.shipToParty` (JSONB)  | `shipToName`, etc.                 | `partyField()` + sanitize    || Party | Prefix | Required Fields (★ from CC UI) | Notes |              "commodityHTS6Number": "830140",  // M(6,10) - 6-10 digit HTS

| `filing.consolidator` (JSONB) | `consolidatorName`, etc.           | `partyField()` + sanitize    |

| `filing.containerStuffingLocation` | `containerStuffingLocationName`, etc. | `partyField()` + sanitize ||-------|--------|-------------------------------|-------|              "countryOfOrigin": "CN",          // AN(2,3)

| `filing.manufacturer` (array) | `shipments[0].manufacturer[0]`     | Array mapping + sanitize     |

| `filing.commodities` (array)  | `shipments[0].manufacturer[0].items` | Array mapping              || **Consignee** | `consignee` | IdentifierCode★, TaxID★, Address1★, City★, Country★ | `identifierCode` REQUIRED |              "estimatedQuantity": "10",

| `filing.containers[0].number` | `shipments[0].containerNumber`     | Direct                       |

| `filing.estimatedArrival`     | `estimateDateOfArrival`            | `toYYYYMMDDString()`         || **Consolidator** | `consolidator` | Name★, Address1★, City★, Country★ | |              "quantityUOM": "PCS",

| `filing.foreignPortOfUnlading`| `USPortOfArrival`                  | `.slice(0, 4)`, fallback `"1001"` |

| `filing.scacCode`             | `shipments[0].scacCode`            | Direct                       || **Buyer** | `buyer` | Name★, Address1★, City★, Country★ | `identifierCode` REQUIRED |              "estimatedWeight": "10",

| `filing.vesselName`           | `shipments[0].vesselName`          | Direct                       |

| `filing.voyageNumber`         | `shipments[0].voyageNumber`        | Direct                       || **Ship To** | `shipTo` | Name★, Address1★, City★, Country★ | |              "weightUOM": "K"                  // K=KG

| `filing.bondType`             | `bondType`                         | `"continuous"→"8"`, `"single"→"9"` |

| **Container Stuffing Location** | `containerStuffingLocation` | Name only | Least restrictive |            }

| **Seller** | `seller` | Name★, IdentifierCode★, TaxID★, Address1★, City★, Country★ | |          ]

        }

Each party section also has:      ]

- **Party Selector** + **Identifiers** dropdown (top row)    }

- **Copy From** dropdown + **Load** button (bottom row)  ]

}

---```



## 9. Shipments (Manufacturer + Items)#### Response (validation errors)



### Container (body root level)Returns JSON array of validation errors:

```json

| Field | Type | Required | Values | CC Dashboard Label |[

|-------|------|----------|--------|--------------------|  { "index": 0, "field": "fieldName", "message": "error description" }

| `containerType` | string | ✅ | `"20"`, `"2B"`, `"40"`, `"4B"` | **Container Type** |]

| `containerNumber` | string | ✅ | ISO container code | **Container Number** |```



### Shipment Details Tab — Grid columns:#### Response (success)



| Column | Maps to | Required |Returns created document with `_id` field.

|--------|---------|----------|

| Valid/Invalid | _(read-only)_ | — |---

| Sequence Number | `items[].sequenceNumber` | Auto |

| **Container Type** | `items[].containerType` | ✅ |### 4.2 List ISF Documents

| **Container Number** | `items[].containerNumber` | ✅ |

| Estimated Quantity | `items[].estimatedQuantity` | — |```

| Quantity UOM | `items[].quantityUOM` | — |GET /api/documents?type=ISF&dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD&skip=0

| Estimated Weight | `items[].estimatedWeight` | — |```



Items are added via the **+** button (top-right of the grid).Returns:

```json

### Nested payload structure:{

  "total": 0,

```json  "skip": 0,

{  "limit": 50,

  "shipments": [{  "data": []

    "manufacturer": [{}

      "manufacturerName": "Factory Name",```

      "manufacturerIdentifierCode": "24",

      "manufacturerTaxID": "00-000000000",---

      "manufacturerAddress1": "123 Factory Rd",

      "manufacturerCity": "Shanghai",### 4.3 Get Document Status

      "manufacturerStateOrProvince": "SH",

      "manufacturerPostalCode": "200000",```

      "manufacturerCountry": "CN"GET /api/document-status?manifestType=ISF&skip=0&masterBOLNumber=XXXX

    }],```

    "items": [{

      "sequenceNumber": 1,Required params: `manifestType`, `skip`, and at least one of `masterBOLNumber` or `houseBOLNumber`.

      "description": "Cotton T-Shirts",

      "commodityHTS6Number": "610910",---

      "countryOfOrigin": "CN",

      "containerType": "40",### 4.4 HTS Classification (AI)

      "containerNumber": "MSKU1234567",

      "estimatedQuantity": "100",```

      "quantityUOM": "PCS",POST /api/hts-classifier

      "estimatedWeight": "500",```

      "weightUOM": "K"

    }]**Working payload:**

  }]```json

}{

```  "items": [{ "description": "cotton t-shirts for men" }]

}

---```



## 10. References & Carnet**Response:**

```json

### Additional References Tab{

  "items": [

| Section | Code Field (dropdown) | Value Field | CC Dashboard Label |    {

|---------|----------------------|-------------|-------------------|      "description": "cotton t-shirts for men",

| **Main** | `additionalISFReferenceCode` | `additionalISFReferenceID` | Additional ISF Reference ID + # |      "hts_code": "6109100012",

| **A** | `referenceCodeA` | `referenceNumberA` | Additional ISF Reference ID (A) + Code (A) |      "explanation": "AI-generated classification reasoning..."

| **B** | `referenceCodeB` | `referenceNumberB` | Additional References B |    }

| **C** | `referenceCodeC` | `referenceNumberC` | Additional References C |  ]

}

Reference code values: `"PO"` (Purchase Order), `"IN"` (Invoice), `"BL"` (Bill of Lading), `"CI"` (Commercial Invoice)```



### Amendment Code (also on this tab)---



Dropdown: `CT - Complete Transactions` (default)### 4.5 Test Connectivity



### Carnet```

GET /api/test

| Field | Default | Notes |```

|-------|---------|-------|

| `carnetNumber` | `"NA"` | Required; use `"NA"` when not applicable |Returns `{ "connected": true, "environment": "sandbox" }` when healthy.

| `carnetCountry` | `"US"` | Required |

---

---

## 5. ISF Reference Values

## 11. Send Options

### ISF Submission Type

The CC dashboard shows a **Send Options** section with:| Value | Description |

- **Send As** dropdown — determines submission mode|-------|------------|

| `1` | ISF-10 submission |

The CC UI has **three action buttons**:| `2` | ISF-5 submission |

1. **Cancel** — discard changes| `3` | ISF-5 → ISF-10 conversion |

2. **Save** — persist as DRAFT (no CBP submission)| `4` | ISF-10 → ISF-5 conversion |

3. **Send** — validate + persist + submit to CBP

### Bond Types

---| Value | Description |

|-------|------------|

## 12. Dropdown Enums (from CC Dashboard)| `8` | Continuous |

| `9` | Single Transaction |

### ISF Submission Type

| Value | Label |### Action Codes

|-------|-------|| Value | Description |

| `"1"` | ISF-10 ||-------|------------|

| `"2"` | ISF-5 || `A` | Add (new filing) |

| `"3"` | ISF-5 → ISF-10 || `D` | Delete |

| `"4"` | ISF-10 → ISF-5 || `R` | Replace |



### Shipment Type (`ISFShipmentTypeCode`)### Amendment/Action Reason Codes

| Value | Label || Value | Description |

|-------|-------||-------|------------|

| `"01"` | Direct Shipments || `CT` | Complete Transaction |

| `"02"` | To Order Shipments || `FR` | Flexible Range |

| `"03"` | FROB (Foreign Remaining on Board) || `FT` | Flexible Timing |

| `FX` | Flexible Range and Flexible Timing |

### Regular/House/Master (`billType`)

| Value | Label |### Container Types

|-------|-------|| Value | Description |

| `"HOUSE"` | House ||-------|------------|

| `"MASTER"` | Master || `20` | 20 ft. IL Container (Open Top) |

| `2B` | 20 ft. IL Container (Closed Top) |

### ISF Bond| `40` | 40 ft. IL Container (Open Top) |

| Value | Label || `4B` | 40 ft. IL Container (Closed Top) |

|-------|-------|

| `"01"` | Importer or Broker |### ID Code Qualifiers (IOR/Filer)

| Value | Format Pattern |

### Bond Type|-------|---------------|

| Value | Label || `24` | `XX-XXXXXXXXX` (EIN) — `^([0-9]{2})([-])([A-Z0-9]{9})$` |

|-------|-------|| `PN` | Passport number |

| `"8"` | Continuous || Others | 15-char alphanumeric `^[A-Za-z\d]{15}$`, or `XXX-XX-XXXX` SSN, or `XXXXXX-XXXXX` |

| `"9"` | Single Transaction |

### Bill Type

### ID Code (`IORIDCodeQualifier` / `*IdentifierCode`)| Value | Description |

| Value | Label | Notes ||-------|------------|

|-------|-------|-------|| `HOUSE` | House Bill of Lading |

| `"24"` | Employer's Identification Number (EIN) | ✅ Recommended || `MASTER` | Master Bill of Lading |

| `"34"` | DUNS Number | Requires `DateOfBirth` fields || (possibly others) | |

| `"PN"` | Passport Number | Adds validation errors |

### Weight UOM

### Container Type| Value | Description |

| Value | Label ||-------|------------|

|-------|-------|| `K` | Kilograms |

| `"20"` | 20-foot Standard |

| `"2B"` | 20-foot Open Top |---

| `"40"` | 40-foot Standard |

| `"4B"` | 40-foot HC / Open Top |## 6. Field Type Notation



### Amendment CodeFrom the CSV/Excel templates:

| Value | Label |- `AN(min,max)` = Alphanumeric, min-max characters

|-------|-------|- `N(min,max)` = Numeric

| `"CT"` | Complete Transactions |- `A(min,max)` = Alphabetic

| `"FR"` | — |- `M(min,max)` = Fixed format (e.g., date YYYYMMDD)

| `"FT"` | — |

| `"FX"` | — |---



---## 7. Data Type Rules (discovered via validation)



## 13. Tax ID / EIN Format| Field | JSON Type | Notes |

|-------|-----------|-------|

All `*TaxID`, `IORNumber`, and `ISFFilerNumber` fields must match:| `IORDateOfBirth` | `number` | YYYYMMDD as integer |

| `ISFFilerDateOfBirth` | `number` | YYYYMMDD as integer |

```| `estimateDateOfArrival` | `number` | YYYYMMDD as integer |

XX-XXXXXXXXX| `estimatedValue(Type11)` | `number` | Dollar amount |

```| Most other fields | `string` | Even numeric codes like port numbers |



- 2 digits + dash + 9 alphanumeric characters---

- Example from CC dashboard screenshot: `24-123456789`

- Placeholder when missing: `00-000000000`## 8. Known Issues / Open Questions



---### Resolved ✅

- Correct ISF endpoint is `/api/documents/isf` (NOT `/api/documents`)

## 14. Date Format- Payload uses `{ body: [...] }` format

- HTS classifier uses `{ items: [{description}] }` format

All date fields are **integers** in `YYYYMMDD` format:- Date fields must be numbers (YYYYMMDD)

- `estimatedValue(Type11)` — field name contains parentheses

```- `manufacturer` is an array inside each `shipments` entry

20260430  →  April 30, 2026- `manufacturer` fields need full address (not just name/country)

```

### Open Questions ❓

**NOT** strings like `"2026-04-30"`.- **`items` field**: Required at body item level but exact structure TBD. May need specific property names different from `commodityHTS6Number`

- **Reference codes**: `referenceCodeA/B/C` allowed enum values unknown (not PO/IN/CO/6C)

Fields using this format:- **`additionalISFReferenceCode`**: `6C` appears in sample data but rejected by validator

- `IORDateOfBirth`- **ISFShipmentTypeCode**: Allowed values — `11` found in sample, others unknown

- `ISFFilerDateOfBirth`- **`shipmentSubtypeCode`**: Allowed values beyond `01` unknown

- `estimateDateOfArrival`

### To Get Full Answers:

---Contact CustomsCity support:

- Email: service@customscity.com

## 15. Response Handling- Phone: +1-888-724-8914

- Request: Full API documentation / OpenAPI spec for ISF document creation

### Success (document persisted):

```json---

HTTP 201

{## 9. FeathersJS Service Names (from bundle)

  "_id": "abc123...",

  "type": "ISF",These are all services available on the CC platform:

  "status": "draft",```

  "body": [{ ... }],abi-census, abi-in-bond, abi-upload, aci-air-cargo, aci-air-conveyance,

  "createdAt": "...",aci-air-supplementary, air-cacm, air-cargo, air-conveyance, air-document,

  "updatedAt": "..."air-document-backup, air-info, air-supplementary, ams-isf,

}ams-marketing-order, ams-organic, census-query, entry-summary-query,

```fda-iuc, fda-prior-notice, firms-query, food-all, hts-query,

in-bond-upload, invoice-items, lacey-act, manifest-query,

### Validation failure (NOT persisted):manufacturer-upload, medical-devices, net-chb, net-chb-fda,

```jsonnet-chb-fda-cos, net-chb-fda-data, net-chb-multi,

HTTP 201   ← NOTE: still returns 201!net-chb-multi-only-air, party-master-upload, scac-query,

[standalone-pn, standalone-pn-upload, data-pilot, data-pilot-upload

  { "index": 0, "field": "items", "message": "should have required property 'items'" },```

  { "index": 0, "message": "should be equal to one of the allowed values" },

  { "index": 0, "message": "should match \"then\" schema" }---

]

```## 10. Downloaded Reference Files



**Detection logic:** Response is an **array** (not an object with `_id`).  Saved to `/tmp/` during analysis:

When the response is an array, the document was **NOT persisted**.- `ISF_GUIDE.xlsx` — Full ISF 10+2 field guide with explanations

- `ISF_TEMPLATE.csv` — Upload template with all 98 columns

### Error (server crash):- `ISF_5_GUIDE.xlsx` — ISF-5 guide

```json

HTTP 500Source URLs (from CC frontend bundle):

{- `https://cert.customscity.com/assets/ISF_TEMPLATE-CMS99Z2k.csv`

  "name": "GeneralError",- `https://cert.customscity.com/assets/ISF_GUIDE-xe7qkjyp.xlsx`

  "message": "context.data.body.entries is not a function...",- `https://cert.customscity.com/assets/ISF_5_GUIDE-CTNL9-r-.xlsx`

  "code": 500- `https://cert.customscity.com/assets/AMS_ISF5_GUIDE-hPCY_2MS.xlsx`

}- `https://cert.customscity.com/assets/AMS_ISF10_TYPE86_TEMPLATE-C0mbWViE.csv`

```- `https://cert.customscity.com/assets/AMS_ISF10_TYPE86_GUIDE-CMi6eptV.xlsx`

This happens when `body` is sent as an object instead of an array.

---

## 16. Known Sandbox Limitations

The CC sandbox (`api-cert.customscity.com`) always returns **17 irreducible validation errors**:

1. `[items] should have required property 'items'` — persists regardless of where items are placed
2. 8 × `should be equal to one of the allowed values` — no `field` property, from JSON Schema `if/then` conditions
3. 8 × `should match "then" schema` — paired with above

### What was exhaustively tested (30+ variants across 15+ test scripts):
- Every `ISFShipmentTypeCode`: `"01"`, `"02"`, `"03"`, `"11"` — all produce 17 errors
- Every `identifierCode`: `"24"`, `"34"`, `"PN"`, `"CBP"`, removed — `"24"` is optimal
- Items at 6 different positions (root, inside body, inside shipments, both, doubly nested)
- Every `billType`, `bondType`, `actionCode`, `containerType` variant
- With/without `ISFBond`, `groupingNumber`, `packageQuantity`, `shipmentValue`
- `body` as object vs array (object → HTTP 500)
- All US addresses vs mixed US/foreign
- Alternative endpoints: `/api/documents`, `/api/isf`, action/save wrappers
- `status: 'draft'`, `action: 'save'`, `sendAs: 'draft'` wrappers
- `statusProcess` nested object with type

**Conclusion:** These 17 errors are a **sandbox-level limitation**, not a payload issue. The CC web UI likely has additional frontend-only validation that prevents sending until client-side checks pass, and the server-side `if/then` JSON schemas may reference internal enum values not exposed in any external documentation.

### Recommendations to resolve:
1. Contact CustomsCity support for sandbox configuration / sample payload
2. Request access to their official API documentation
3. Check if the sandbox account needs additional setup (bond filing, SCAC registration, etc.)
4. Intercept the CC web dashboard's actual network requests when creating an ISF via browser DevTools

---

## 17. CC Dashboard UI Tabs

Based on screenshots of the CC cert environment web form:

### Header Section (always visible)
- Created By, Status (DRAFT), Last Response, ISF Transaction Number
- **ISF** tab | **Messages** tab
- Importer Security Filing (ISF-10) header bar

### Filing Fields (top section)
Row 1: Grouping Number, ISF Submission Type★, Regular/House/Master★  
Row 2: Bill of Lading #★, Shipment Type★, Carnet Number  
Row 3: Carnet Country, Shipment Sub-Type, Shipment Value ($USD)  
Row 4: ISF Bond★, Bond Type★, Bond Holder Tax ID★  
Row 5: US Port of Arrival★, Est. Date of Arrival★, Add FROB Information?  
Row 6: Package Quantity, Package Unit  

### Tab 1: IOR / ISF Importer
- **Importer of Record** card: Party Selector, Identifiers, Name, Last Name/Company★, ID Code★, IOR Number★, IOR Date Of Birth, Copy From + Load
- **ISF Importer** card: Same fields layout

### Tab 2: Parties
- **Consignee** card: Identifier Code★, Tax ID★, Address 1★, City★, Country★
- **Consolidator** card: Name★, Address 1★, City★, Country★
- **Buyer** card: Name★, Address 1★, City★, Country★  
- **Ship To** card: Name★, Address 1★, City★, Country★
- **Container Stuffing Location** card: Name (no required markers)
- **Seller** card: Name★, Identifier Code★, Tax ID★, Address 1★, City★, Country★

### Tab 3: Shipment Details
- Data grid: Valid/Invalid | Sequence Number | Container Type★ | Container Number★ | Estimated Quantity | Quantity UOM | Estimated Weight
- **+** button to add item rows
- "No Rows To Show" when empty

### Tab 4: Additional References
- **Amendment Code** section: dropdown (`CT - Complete Transactions`)
- **Additional References**: ISF Reference ID (dropdown) + ISF Reference #
- **Additional References A**: ISF Reference ID (A) dropdown + ISF Code (A)
- **Additional References B**: same pattern

### Send Options (collapsible section)
- **Send As** dropdown

### Action Buttons (bottom)
- **Cancel** | **Save** | **Send**

_★ = Required field (red asterisk in CC UI)_
