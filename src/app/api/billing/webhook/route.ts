import { NextResponse } from "next/server";

import connectDB from "@/lib/db";
import { constructStripeEvent } from "@/lib/stripe";
import Website, { type WebsiteBillingStatus } from "@/models/Website";

type CheckoutSession = {
  metadata?: Record<string, string>;
  subscription?: string;
  customer?: string;
};

type Subscription = {
  id: string;
  status: string;
};

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

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const rawBody = Buffer.from(await req.arrayBuffer());

  let event;
  try {
    event = constructStripeEvent(rawBody, signature);
  } catch (error) {
    console.error("Webhook signature error:", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  await connectDB();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as CheckoutSession;
      const websiteId = session.metadata?.websiteId;
      const plan = session.metadata?.plan as string | undefined;
      const subscriptionId = session.subscription;
      const customerId = session.customer;

      if (websiteId && plan) {
        await Website.findByIdAndUpdate(websiteId, {
          plan,
          billingStatus: "active",
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
        });
      }
      break;
    }
    case "customer.subscription.updated": {
      const subscription = event.data.object as Subscription;
      const status = mapStripeStatus(subscription.status);

      await Website.findOneAndUpdate(
        { stripeSubscriptionId: subscription.id },
        { billingStatus: status },
      );
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Subscription;
      await Website.findOneAndUpdate(
        { stripeSubscriptionId: subscription.id },
        { billingStatus: "canceled" },
      );
      break;
    }
    default:
      console.log(`Unhandled Stripe event type: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
