import { NextResponse } from "next/server";

import connectDB from "@/lib/db";
import { stripe } from "@/lib/stripe";
import Website, { type WebsitePlan } from "@/models/Website";

type CheckoutPayload = {
  websiteId?: string;
  plan?: WebsitePlan;
};

const PLAN_TO_PRICE: Record<WebsitePlan, string | undefined> = {
  basic: process.env.STRIPE_PRICE_BASIC,
  standard: process.env.STRIPE_PRICE_STANDARD,
  pro: process.env.STRIPE_PRICE_PRO,
};

export async function POST(req: Request) {
  const { websiteId, plan }: CheckoutPayload = await req.json();

  if (!websiteId || !plan) {
    return NextResponse.json({ error: "Missing websiteId or plan" }, { status: 400 });
  }

  const priceId = PLAN_TO_PRICE[plan];
  if (!priceId) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  await connectDB();
  const site = await Website.findById(websiteId);

  if (!site) {
    return NextResponse.json({ error: "Website not found" }, { status: 404 });
  }

  if (!process.env.APP_BASE_URL) {
    return NextResponse.json({ error: "Missing APP_BASE_URL" }, { status: 500 });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.APP_BASE_URL}/dashboard?checkout=success&websiteId=${site._id}`,
      cancel_url: `${process.env.APP_BASE_URL}/dashboard?checkout=cancel`,
      metadata: {
        websiteId: site._id.toString(),
        plan,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout error", error);
    return NextResponse.json({ error: "Unable to create checkout session" }, { status: 500 });
  }
}
