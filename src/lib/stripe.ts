import { createHmac, timingSafeEqual } from "crypto";

type CheckoutSessionParams = {
  mode: "subscription";
  line_items: { price: string; quantity: number }[];
  success_url: string;
  cancel_url: string;
  metadata?: Record<string, string>;
};

type StripeEvent<T = unknown> = {
  id: string;
  type: string;
  data: { object: T };
};

const STRIPE_API_BASE = "https://api.stripe.com/v1";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Missing STRIPE_SECRET_KEY");
}

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

type StripeRequestOptions = {
  method?: "GET" | "POST";
  body?: URLSearchParams;
};

async function stripeRequest<T>(
  endpoint: string,
  { method = "POST", body }: StripeRequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
  };

  const requestInit: RequestInit = {
    method,
    headers,
  };

  if (body) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    requestInit.body = body.toString();
  }

  const response = await fetch(`${STRIPE_API_BASE}/${endpoint}`, requestInit);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Stripe request failed: ${response.status} ${errorText}`);
  }

  return (await response.json()) as T;
}

function parseStripeSignatureHeader(signatureHeader: string | null) {
  if (!signatureHeader) {
    throw new Error("Missing stripe-signature header");
  }

  const components = signatureHeader.split(",").map((part) => part.trim());
  let timestamp = "";
  const signatures: string[] = [];

  for (const component of components) {
    const [key, value] = component.split("=");
    if (key === "t") {
      timestamp = value;
    } else if (key?.startsWith("v")) {
      signatures.push(value);
    }
  }

  if (!timestamp || signatures.length === 0) {
    throw new Error("Invalid stripe-signature header");
  }

  return { timestamp, signatures };
}

function isTimestampValid(timestamp: string, toleranceSeconds = 5 * 60) {
  const parsed = Number(timestamp);
  if (Number.isNaN(parsed)) {
    return false;
  }
  const now = Math.floor(Date.now() / 1000);
  return Math.abs(now - parsed) <= toleranceSeconds;
}

export const stripe = {
  checkout: {
    sessions: {
      async create(params: CheckoutSessionParams) {
        const body = new URLSearchParams();
        body.append("mode", params.mode);
        body.append("success_url", params.success_url);
        body.append("cancel_url", params.cancel_url);

        params.line_items.forEach((item, index) => {
          body.append(`line_items[${index}][price]`, item.price);
          body.append(`line_items[${index}][quantity]`, String(item.quantity));
        });

        if (params.metadata) {
          for (const [key, value] of Object.entries(params.metadata)) {
            body.append(`metadata[${key}]`, value);
          }
        }

        return stripeRequest<{ url: string; id: string }>("checkout/sessions", {
          body,
        });
      },
    },
  },
  subscriptions: {
    async retrieve<T = unknown>(id: string) {
      return stripeRequest<T>(`subscriptions/${id}`, { method: "GET" });
    },
  },
};

export function constructStripeEvent<T = unknown>(rawBody: Buffer, signatureHeader: string | null) {
  if (!WEBHOOK_SECRET) {
    throw new Error("Missing STRIPE_WEBHOOK_SECRET");
  }

  const { timestamp, signatures } = parseStripeSignatureHeader(signatureHeader);
  if (!isTimestampValid(timestamp)) {
    throw new Error("Stripe signature timestamp outside tolerance");
  }

  const signedPayload = `${timestamp}.${rawBody.toString("utf8")}`;
  const expectedSignatureHex = createHmac("sha256", WEBHOOK_SECRET)
    .update(signedPayload)
    .digest("hex");
  const expectedSignature = Buffer.from(expectedSignatureHex, "hex");

  const isValid = signatures.some((signature) => {
    try {
      const provided = Buffer.from(signature, "hex");
      if (provided.length !== expectedSignature.length) {
        return false;
      }
      return timingSafeEqual(provided, expectedSignature);
    } catch {
      return false;
    }
  });

  if (!isValid) {
    throw new Error("Invalid Stripe signature");
  }

  const payload = rawBody.toString("utf8");
  return JSON.parse(payload) as StripeEvent<T>;
}
