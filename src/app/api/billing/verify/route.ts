import { NextResponse } from "next/server";

import connectDB from "@/lib/db";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";
import Website, { type WebsiteBillingStatus, type WebsitePlan } from "@/models/Website";

const BILLING_STATUS_MAP: Record<string, WebsiteBillingStatus> = {
  active: "active",
  trialing: "active",
  past_due: "past_due",
  unpaid: "past_due",
  canceled: "canceled",
  incomplete: "inactive",
  incomplete_expired: "canceled",
  paused: "past_due",
};

function mapStripeStatus(status: string): WebsiteBillingStatus {
  return BILLING_STATUS_MAP[status] ?? "inactive";
}

function derivePlanFromPrice(priceId: string | null | undefined, currentPlan: WebsitePlan): WebsitePlan {
  if (!priceId) {
    return currentPlan;
  }

  if (priceId === process.env.STRIPE_PRICE_PRO) {
    return "pro";
  }

  if (priceId === process.env.STRIPE_PRICE_STANDARD) {
    return "standard";
  }

  if (priceId === process.env.STRIPE_PRICE_BASIC) {
    return "basic";
  }

  return currentPlan;
}

export async function POST(req: Request) {
  try {
    const { websiteId } = (await req.json()) as { websiteId?: string };

    if (!websiteId) {
      return NextResponse.json({ error: "Missing websiteId" }, { status: 400 });
    }

    await connectDB();

    const site = await Website.findById(websiteId);

    if (!site) {
      return NextResponse.json({ error: "Website not found" }, { status: 404 });
    }

    if (!site.stripeSubscriptionId) {
      return NextResponse.json({ error: "No subscription linked" }, { status: 400 });
    }
const subscription = (await stripe.subscriptions.retrieve(
  site.stripeSubscriptionId
)) as Stripe.Subscription;


    site.billingStatus = mapStripeStatus(subscription.status);

    const defaultPlan = site.plan ?? "basic";
    const latestPriceId = subscription.items.data[0]?.price?.id ?? null;
    site.plan = derivePlanFromPrice(latestPriceId, defaultPlan);

    await site.save();

    return NextResponse.json({
      ok: true,
      plan: site.plan,
      billingStatus: site.billingStatus,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Billing verify error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
