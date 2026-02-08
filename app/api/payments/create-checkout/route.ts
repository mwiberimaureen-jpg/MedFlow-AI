/**
 * API Route: Create Intasend Checkout Session
 * POST /api/payments/create-checkout
 *
 * Creates a checkout session for monthly subscription payment
 */

import { NextRequest, NextResponse } from 'next/server';
import { getIntasendClient } from '@/lib/intasend/client';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface CreateCheckoutRequest {
  userId: string;
  email: string;
  fullName?: string;
  phoneNumber?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateCheckoutRequest = await request.json();
    const { userId, email, fullName, phoneNumber } = body;

    // Validate required fields
    if (!userId || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: userId and email are required' },
        { status: 400 }
      );
    }

    // Initialize Supabase client
    const supabase = getSupabaseServerClient();

    // Check if user exists and get their info
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, subscription_status')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Generate unique API reference
    const apiRef = `SUB_${userId.substring(0, 8)}_${Date.now()}`;

    // Subscription plan details
    const MONTHLY_PRICE = 2000; // KES 2,000/month
    const CURRENCY = 'KES';

    // Parse full name
    const nameParts = fullName?.split(' ') || ['', ''];
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Create checkout session with Intasend
    const intasend = getIntasendClient();
    const checkout = await intasend.createCheckout({
      amount: MONTHLY_PRICE,
      currency: CURRENCY,
      email: email,
      first_name: firstName,
      last_name: lastName,
      phone_number: phoneNumber,
      redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success`,
      api_ref: apiRef,
    });

    // Create pending subscription record
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .insert({
        user_id: userId,
        status: 'pending',
        plan_type: 'monthly',
        amount: MONTHLY_PRICE,
        currency: CURRENCY,
        payment_provider: 'intasend',
        transaction_id: checkout.id,
        starts_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        metadata: {
          api_ref: apiRef,
          checkout_url: checkout.url,
          signature: checkout.signature,
        },
      })
      .select()
      .single();

    if (subError) {
      console.error('Error creating subscription record:', subError);
      return NextResponse.json(
        { error: 'Failed to create subscription record' },
        { status: 500 }
      );
    }

    // Return checkout URL to client
    return NextResponse.json({
      success: true,
      checkoutUrl: checkout.url,
      subscriptionId: subscription.id,
      apiRef: apiRef,
    });

  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      {
        error: 'Failed to create checkout session',
        message: error.message
      },
      { status: 500 }
    );
  }
}
