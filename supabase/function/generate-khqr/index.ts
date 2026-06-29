import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import * as khqrPkg from "npm:bakong-khqr";

const {
  BakongKHQR,
  khqrData,
  IndividualInfo,
  MerchantInfo,
} = (khqrPkg as any).default ?? khqrPkg;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EXPIRATION_MINUTES = 10;

type GenerateKhqrBody = {
  amount: number;
  currency?: "KHR" | "USD";
  billNumber?: string;
  storeLabel?: string;
  terminalLabel?: string;
  purposeOfTransaction?: string;
  phoneNumber?: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getEnv(name: string, required = true) {
  const value = Deno.env.get(name);

  if (required && (!value || value.trim() === "")) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value?.trim() ?? "";
}

function limitText(value: string | undefined, max: number) {
  if (!value) return undefined;
  return value.trim().slice(0, max);
}

function normalizeCurrency(currency?: string): "KHR" | "USD" {
  const value = String(currency || "KHR").toUpperCase();

  if (value === "USD" || value === "840") return "USD";
  return "KHR";
}

function normalizeAmount(amount: number, currency: "KHR" | "USD") {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Amount must be greater than 0");
  }

  if (currency === "KHR") {
    return Math.round(amount);
  }

  return Number(amount.toFixed(2));
}

function getKhqrCurrency(currency: "KHR" | "USD") {
  return currency === "USD" ? khqrData.currency.usd : khqrData.currency.khr;
}

function extractKhqrResult(result: any) {
  const qr = result?.data?.qr || result?.data?.QR;
  const md5 = result?.data?.md5 || result?.data?.MD5;

  return {
    qr,
    md5,
    status: result?.status || result?.Status || null,
  };
}

function applyIndividualReceiverFields(
  individualInfo: any,
  accountInformation: string,
  acquiringBank: string,
) {
  // Different SDK builds may read these as direct properties.
  if (accountInformation) {
    individualInfo.accountInformation = accountInformation;
    individualInfo.AccountInformation = accountInformation;
  }

  if (acquiringBank) {
    individualInfo.acquiringBank = acquiringBank;
    individualInfo.AcquiringBank = acquiringBank;
  }

  // Some SDK builds may expose setter methods.
  if (
    accountInformation &&
    typeof individualInfo.setAccountInformation === "function"
  ) {
    individualInfo.setAccountInformation(accountInformation);
  }

  if (acquiringBank && typeof individualInfo.setAcquiringBank === "function") {
    individualInfo.setAcquiringBank(acquiringBank);
  }
}

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return jsonResponse(
        {
          success: false,
          message: "Method not allowed",
        },
        405,
      );
    }

    const body = (await req.json()) as GenerateKhqrBody;

    const currency = normalizeCurrency(body.currency);
    const amount = normalizeAmount(Number(body.amount), currency);

    const khqrType = getEnv("KHQR_TYPE", false) || "individual";

    const bakongAccountId = getEnv("KHQR_BAKONG_ACCOUNT_ID");
    const merchantName = getEnv("KHQR_MERCHANT_NAME");
    const merchantCity = getEnv("KHQR_MERCHANT_CITY", false) || "Phnom Penh";

    // Important for ABA individual / P2P KHQR.
    // From your original ABA QR:
    // KHQR_ACCOUNT_INFORMATION = 013834100
    // KHQR_ACQUIRING_BANK = ABA Bank
    const accountInformation = getEnv("KHQR_ACCOUNT_INFORMATION", false);
    const acquiringBank = getEnv("KHQR_ACQUIRING_BANK", false);

    const mcc = getEnv("KHQR_MCC", false) || "0000";

    // Expiration time, same as the frontend countdown.
    const expiresAt = Date.now() + EXPIRATION_MINUTES * 60 * 1000;

    const optionalData: Record<string, unknown> = {
      currency: getKhqrCurrency(currency),
      amount,
      merchantCategoryCode: mcc,

      billNumber: limitText(body.billNumber || `UPG-${Date.now()}`, 25),
      mobileNumber: limitText(body.phoneNumber, 25),
      storeLabel: limitText(
        body.storeLabel || getEnv("KHQR_STORE_LABEL", false) || "BANTUB",
        25,
      ),
      terminalLabel: limitText(body.terminalLabel || "WEB", 25),
      purposeOfTransaction: limitText(
        body.purposeOfTransaction || "Upgrade Plan",
        25,
      ),

      expirationTimestamp: expiresAt,
    };

    // Add these also to optionalData for SDK builds that read them there.
    if (accountInformation) {
      optionalData.accountInformation = accountInformation;
    }

    if (acquiringBank) {
      optionalData.acquiringBank = acquiringBank;
    }

    const KHQR = new BakongKHQR();

    let result;

    if (khqrType === "merchant") {
      const merchantId = getEnv("KHQR_MERCHANT_ID");
      const merchantAcquiringBank =
        getEnv("KHQR_ACQUIRING_BANK", false) || acquiringBank;

      if (!merchantAcquiringBank) {
        throw new Error("Missing KHQR_ACQUIRING_BANK");
      }

      const merchantInfo = new MerchantInfo(
        bakongAccountId,
        merchantName,
        merchantCity,
        merchantId,
        merchantAcquiringBank,
        optionalData,
      );

      result = KHQR.generateMerchant(merchantInfo);
    } else {
      const individualInfo = new IndividualInfo(
        bakongAccountId,
        merchantName,
        merchantCity,
        optionalData,
      );

      applyIndividualReceiverFields(
        individualInfo,
        accountInformation,
        acquiringBank,
      );

      result = KHQR.generateIndividual(individualInfo);
    }

    const { qr, md5, status } = extractKhqrResult(result);

    if (!qr || !md5) {
      return jsonResponse(
        {
          success: false,
          message: "Failed to generate KHQR",
          status,
          raw: result,
        },
        500,
      );
    }

    return jsonResponse({
      success: true,
      qr,
      md5,
      amount,
      currency,
      billNumber: optionalData.billNumber,
      expiresAt,
      khqrType,
      receiver: {
        bakongAccountId,
        accountInformation: accountInformation || null,
        acquiringBank: acquiringBank || null,
        merchantName,
        merchantCity,
        mcc,
      },
    });
  } catch (error) {
    console.error("generate-khqr error:", error);

    return jsonResponse(
      {
        success: false,
        message: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});
