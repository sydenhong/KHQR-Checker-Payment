# KHQR Edge Function README

## 1. Overview

This document explains how the frontend calls the Supabase Edge Function `generate-khqr` to generate a KHQR payment code for Bantub upgrade payment.

The function returns:

* KHQR string
* MD5 value for payment checking
* Expiration timestamp
* Receiver information
* Bill number and transaction metadata

Function name:

```txt
generate-khqr
```

Default values:

```txt
Purpose: Upgrade Plan
Currency: KHR
Expiration: 10 minutes
```

> Important: Frontend countdown should use the returned `expiresAt` value from the Edge Function.

## Demo Site

A demo page is available for team testing.

Demo URL:

```txt
[HERE_IS_DEMO_SITE_URL](https://khqr-demo.pages.dev/)
```

This demo page allows the team to:

* Choose currency: `KHR` or `USD`
* Enter payment amount
* Generate KHQR
* View QR code
* View MD5 value
* View expiration time
* Test the frontend request body sent to the Edge Function

> Note: This demo only generates KHQR. Payment checking requires the separate `check-khqr-payment` Edge Function and `BAKONG_API_TOKEN`.

---

## 2. Edge Function Secrets

Set these secrets in Supabase Edge Function Secrets.

For this project, we are using **ABA individual KHQR**, so these secrets are required.

```env
KHQR_TYPE=individual
KHQR_BAKONG_ACCOUNT_ID=abaakhppxxx@abaa
KHQR_MERCHANT_NAME=SYDEN HONG
KHQR_MERCHANT_CITY=Phnom Penh
KHQR_ACCOUNT_INFORMATION=013834100
KHQR_ACQUIRING_BANK=ABA Bank
KHQR_MCC=0000
KHQR_STORE_LABEL=BANTUB
```

### Supabase CLI Example

```bash
supabase secrets set \
  KHQR_TYPE=individual \
  KHQR_BAKONG_ACCOUNT_ID=abaakhppxxx@abaa \
  KHQR_MERCHANT_NAME="SYDEN HONG" \
  KHQR_MERCHANT_CITY="Phnom Penh" \
  KHQR_ACCOUNT_INFORMATION=013834100 \
  KHQR_ACQUIRING_BANK="ABA Bank" \
  KHQR_MCC=0000 \
  KHQR_STORE_LABEL=BANTUB
```

After updating secrets, redeploy the function:

```bash
supabase functions deploy generate-khqr
```

If using a demo function, deploy with the demo function name:

```bash
supabase functions deploy generate-khqr-demo
```

---

## 3. Important Secret Notes

The working ABA receiver uses:

```txt
Bakong Account ID: abaakhppxxx@abaa
Account Information: 013834100
Acquiring Bank: ABA Bank
Merchant Name: SYDEN HONG
Merchant City: Phnom Penh
MCC: 0000
Store Label: BANTUB
```

Do not use this demo account for real payment testing:

```env
KHQR_BAKONG_ACCOUNT_ID=khqrdemo_ben@dev
```

For payment verification, use another Edge Function such as `check-khqr-payment`.

That function needs:

```env
BAKONG_API_TOKEN=your_bakong_api_token
```

`BAKONG_API_TOKEN` is not used by `generate-khqr`.

---

## 4. Frontend Request Body

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

### Request Fields

| Field                  |   Type | Required | Description                                                    |
| ---------------------- | -----: | -------: | -------------------------------------------------------------- |
| `amount`               | number |      Yes | Payment amount. Must be greater than `0`.                      |
| `currency`             | string |       No | Supports `KHR` or `USD`. Default is `KHR`.                     |
| `billNumber`           | string |       No | Unique bill number. Max 25 characters.                         |
| `storeLabel`           | string |       No | Store label. Default is `BANTUB`. Max 25 characters.           |
| `terminalLabel`        | string |       No | Terminal label. Default is `WEB`. Max 25 characters.           |
| `purposeOfTransaction` | string |       No | Payment purpose. Default is `Upgrade Plan`. Max 25 characters. |
| `phoneNumber`          | string |       No | Optional phone number. Max 25 characters.                      |

---

## 5. Frontend Example With Supabase Client

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
  alert("Failed to generate KHQR.");
  return;
}

if (!data?.success) {
  console.error("Generate KHQR failed:", data);
  alert(data?.message || "Failed to generate KHQR.");
  return;
}

console.log("QR:", data.qr);
console.log("MD5:", data.md5);
console.log("Expires At:", data.expiresAt);
```

---

## 6. Frontend Example With Fetch

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

## 7. Success Response Example

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
    "bakongAccountId": "abaakhppxxx@abaa",
    "accountInformation": "013834100",
    "acquiringBank": "ABA Bank",
    "merchantName": "SYDEN HONG",
    "merchantCity": "Phnom Penh",
    "mcc": "0000"
  }
}
```

---

## 8. Error Response Example

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

## 9. Frontend Payment Flow

1. User chooses upgrade package.
2. Frontend calculates total price.
3. Frontend calls `generate-khqr`.
4. Edge Function returns `qr`, `md5`, and `expiresAt`.
5. Frontend shows QR popup.
6. Frontend starts countdown using `expiresAt`.
7. Frontend calls payment-check function using `md5`.
8. If payment is completed, update upgrade request status.
9. If expired, close popup or show retry button.

---

## 10. Demo Payload Example

```ts
const generateKhqrPayload = {
  amount: totalPrice,
  currency: "KHR",
  billNumber: `DEMO-${Date.now()}`,
  storeLabel: "BANTUB",
  terminalLabel: "WEB",
  purposeOfTransaction: "Upgrade Plan",
};
```

---

## 11. Developer Notes

### Amount Rules

For `KHR`:

```ts
amount = Math.round(amount);
```

For `USD`:

```ts
amount = Number(amount.toFixed(2));
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

---

## 12. Common Problems

### QR generated but payment checking fails

`generate-khqr` does not use `BAKONG_API_TOKEN`.

Payment checking needs a valid token in the payment-check Edge Function:

```env
BAKONG_API_TOKEN=your_bakong_api_token
```

### Frontend countdown expires too early

Do not hardcode 2 minutes.

Use the returned value:

```ts
data.expiresAt
```

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

Private payment logic must stay inside Supabase Edge Functions.
