# KHQR Edge Function README

## 1. Overview

This document explains how the frontend calls the Supabase Edge Function `generate-khqr` to generate a KHQR payment code for Bantub upgrade payment.

The function generates:

* KHQR string
* MD5 value for payment checking
* Expiration timestamp
* Receiver information
* Bill number and transaction metadata

Function name:

```txt
generate-khqr
```

Default payment purpose:

```txt
Upgrade Plan
```

Default currency:

```txt
KHR
```

Default QR expiration:

```txt
10 minutes
```

> Important: The frontend countdown should match the Edge Function value `EXPIRATION_MINUTES = 10`.

---

## 2. Edge Function Secrets

Set these secrets in Supabase Edge Function secrets.

### Required Secrets

```env
KHQR_BAKONG_ACCOUNT_ID=your_bakong_account_id
KHQR_MERCHANT_NAME=your_merchant_name
```

Example:

```env
KHQR_BAKONG_ACCOUNT_ID=syden_hong@bank
KHQR_MERCHANT_NAME=SYDEN HONG
```

---

### Optional Secrets

```env
KHQR_TYPE=individual
KHQR_MERCHANT_CITY=Phnom Penh
KHQR_ACCOUNT_INFORMATION=013834100
KHQR_ACQUIRING_BANK=ABA Bank
KHQR_MCC=0000
KHQR_STORE_LABEL=BANTUB
```

Recommended value for normal individual / P2P KHQR:

```env
KHQR_TYPE=individual
```

For ABA individual KHQR, these are important:

```env
KHQR_ACCOUNT_INFORMATION=013834100
KHQR_ACQUIRING_BANK=ABA Bank
```

---

### Merchant Mode Secrets

Only required if using merchant mode:

```env
KHQR_TYPE=merchant
KHQR_MERCHANT_ID=your_merchant_id
KHQR_ACQUIRING_BANK=your_acquiring_bank
```

If `KHQR_TYPE=merchant`, the function requires:

```env
KHQR_MERCHANT_ID
KHQR_ACQUIRING_BANK
```

---

### Payment Check Function Secret

This secret is not used by `generate-khqr`.

It is only required for the payment verification Edge Function, for example `check-khqr-payment`.

```env
BAKONG_API_TOKEN=your_bakong_api_token
```

Do not expose this token in frontend code.

---

## 3. Frontend Request Body

The frontend should send this body to `generate-khqr`.

```json
{
  "amount": 2500,
  "currency": "KHR",
  "billNumber": "E0B8C423",
  "storeLabel": "BANTUB",
  "terminalLabel": "WEB",
  "purposeOfTransaction": "Upgrade Plan"
}
```

### Request Body Fields

| Field                  |   Type | Required | Description                                                                  |
| ---------------------- | -----: | -------: | ---------------------------------------------------------------------------- |
| `amount`               | number |      Yes | Payment amount. Must be greater than `0`.                                    |
| `currency`             | string |       No | Supports `KHR` or `USD`. Default is `KHR`.                                   |
| `billNumber`           | string |       No | Unique bill number. Max 25 characters.                                       |
| `storeLabel`           | string |       No | Store label. Default from `KHQR_STORE_LABEL` or `BANTUB`. Max 25 characters. |
| `terminalLabel`        | string |       No | Terminal label. Default is `WEB`. Max 25 characters.                         |
| `purposeOfTransaction` | string |       No | Payment purpose. Default is `Upgrade Plan`. Max 25 characters.               |
| `phoneNumber`          | string |       No | Optional customer phone number. Max 25 characters.                           |

---

## 4. Call From Frontend Using Supabase Client

Recommended frontend call:

```ts
const payload = {
  amount: 2500,
  currency: "KHR",
  billNumber: "E0B8C423",
  storeLabel: "BANTUB",
  terminalLabel: "WEB",
  purposeOfTransaction: "Upgrade Plan",
};

const { data, error } = await supabase.functions.invoke("generate-khqr", {
  body: payload,
});

if (error) {
  console.error("Generate KHQR error:", error);
  alert("Failed to generate KHQR. Please try again.");
  return;
}

if (!data?.success) {
  console.error("Generate KHQR failed:", data);
  alert(data?.message || "Failed to generate KHQR.");
  return;
}

console.log("KHQR:", data.qr);
console.log("MD5:", data.md5);
console.log("Expires At:", data.expiresAt);
```

---

## 5. Call From Frontend Using Fetch

Alternative direct `fetch` example:

```ts
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const payload = {
  amount: 2500,
  currency: "KHR",
  billNumber: "E0B8C423",
  storeLabel: "BANTUB",
  terminalLabel: "WEB",
  purposeOfTransaction: "Upgrade Plan",
};

const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-khqr`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  },
  body: JSON.stringify(payload),
});

const data = await response.json();

if (!response.ok || !data.success) {
  console.error("Generate KHQR failed:", data);
  alert(data.message || "Failed to generate KHQR.");
  return;
}

console.log(data);
```

---

## 6. Success Response Example

```json
{
  "success": true,
  "qr": "000201010212...",
  "md5": "cd13e9486b281384f0bfddeb2c5e175e",
  "amount": 2500,
  "currency": "KHR",
  "billNumber": "E0B8C423",
  "expiresAt": 1793160000000,
  "khqrType": "individual",
  "receiver": {
    "bakongAccountId": "your_bakong_account_id",
    "accountInformation": "013834100",
    "acquiringBank": "ABA Bank",
    "merchantName": "SYDEN HONG",
    "merchantCity": "Phnom Penh",
    "mcc": "0000"
  }
}
```

---

## 7. Error Response Example

```json
{
  "success": false,
  "message": "Missing environment variable: KHQR_BAKONG_ACCOUNT_ID"
}
```

Another possible error:

```json
{
  "success": false,
  "message": "Amount must be greater than 0"
}
```

---

## 8. Frontend Payment Flow

Recommended flow:

1. User chooses upgrade package.
2. Frontend calculates total price.
3. Frontend sends request to `generate-khqr`.
4. Edge Function returns `qr`, `md5`, and `expiresAt`.
5. Frontend shows QR popup.
6. Frontend starts countdown using `expiresAt`.
7. Frontend uses `md5` to call payment-check function.
8. If payment is completed, update upgrade request status.
9. If expired, close popup or show retry button.

---

## 9. Example Upgrade Payment Payload

Use this format for Bantub upgrade plan payment:

```ts
const generateKhqrPayload = {
  amount: totalPrice,
  currency: "KHR",
  billNumber: upgradeRequestCode,
  storeLabel: "BANTUB",
  terminalLabel: "WEB",
  purposeOfTransaction: "Upgrade Plan",
};
```

Example:

```ts
const generateKhqrPayload = {
  amount: 2500,
  currency: "KHR",
  billNumber: "E0B8C423",
  storeLabel: "BANTUB",
  terminalLabel: "WEB",
  purposeOfTransaction: "Upgrade Plan",
};
```

---

## 10. Important Notes For Developers

### Amount Rules

For `KHR`:

```ts
amount = Math.round(amount)
```

For `USD`:

```ts
amount = Number(amount.toFixed(2))
```

### Currency Rules

Accepted values:

```txt
KHR
USD
840
```

If currency is missing, the function uses:

```txt
KHR
```

### Text Limit

These fields are limited to 25 characters:

```txt
billNumber
phoneNumber
storeLabel
terminalLabel
purposeOfTransaction
```

### CORS

The Edge Function allows:

```txt
POST
OPTIONS
```

Allowed headers:

```txt
authorization
x-client-info
apikey
content-type
```

---

## 11. Local Testing Payload

Use this JSON body for testing:

```json
{
  "amount": 2500,
  "currency": "KHR",
  "billNumber": "E0B8C423",
  "storeLabel": "BANTUB",
  "terminalLabel": "WEB",
  "purposeOfTransaction": "Upgrade Plan"
}
```

---

## 12. Common Problems

### Problem: Missing environment variable

Example:

```json
{
  "success": false,
  "message": "Missing environment variable: KHQR_BAKONG_ACCOUNT_ID"
}
```

Fix:

Check Edge Function Secrets and make sure the required secret exists.

---

### Problem: QR generated but payment checking fails

Possible reason:

`generate-khqr` works without `BAKONG_API_TOKEN`, but payment checking needs a valid Bakong API token.

Fix:

Check the payment verification Edge Function secret:

```env
BAKONG_API_TOKEN=your_bakong_api_token
```

---

### Problem: Frontend countdown expires too early

Current Edge Function expiration is:

```ts
const EXPIRATION_MINUTES = 10;
```

Fix:

Make the frontend countdown use the returned `expiresAt` value instead of hardcoding 2 minutes.

---

## 13. Security Rules

Do not put these values in frontend code:

```txt
BAKONG_API_TOKEN
SUPABASE_SERVICE_ROLE_KEY
KHQR_BAKONG_ACCOUNT_ID
KHQR_ACCOUNT_INFORMATION
KHQR_ACQUIRING_BANK
```

Frontend can use:

```txt
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Private payment logic must stay inside Edge Functions.
