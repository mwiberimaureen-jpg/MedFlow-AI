/**
 * API Route: Intasend Webhook Handler
 * POST /api/payments/webhook
 *
 * Handles payment notifications from Intasend
 */

import { NextRequest, NextResponse } from 'next/server';
import { getIntasendClient, WebhookPayload } from '@/lib/intasend/client';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    const payload: WebhookPayload = JSON.parse(rawBody);

    // Get signature from headers
    const signature = request.headers.get('X-Intasend-Signature') || '';

    // Verify webhook signature
    const webhookSecret = process.env.INTASEND_WEBHOOK_SECRET || '';
    if (!webhookSecret) {
      console.error('INTASEND_WEBHOOK_SECRET not configured');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    const intasend = getIntasendClient();
    const isValid = intasend.verifyWebhookSignature(rawBody, signature, webhookSecret);

    if (!isValid) {
      console.error('Invalid webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Initialize Supabase client
    const supabase = getSupabaseServerClient();

    // Log webhook event
    const { data: webhookLog } = await supabase
      .from('payment_webhooks')
      .insert({
        provider: 'intasend',
        event_type: payload.state,
        payload: payload,
        status: 'pending',
      })
      .select()
      .single();

    const webhookId = webhookLog?.id;

    // Find subscription by transaction ID
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('transaction_id', payload.invoice_id)
      .single();

    if (subError || !subscription) {
      // Update webhook log
      if (webhookId) {
        await supabase
          .from('payment_webhooks')
          .update({
            status: 'ignored',
            error_message: 'Subscription not found for transaction ID',
            processed_at: new Date().toISOString(),
          })
          .eq('id', webhookId);
      }

      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    // Handle payment state
    if (payload.state === 'COMPLETE') {
      // Payment successful - activate subscription
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days from now

      // Call Supabase function to create subscription
      const { data: result, error: activateError } = await supabase.rpc(
        'create_subscription',
        {
          p_user_id: subscription.user_id,
          p_plan_type: 'monthly',
          p_amount: parseFloat(payload.value),
          p_payment_provider: 'intasend',
          p_transaction_id: payload.invoice_id,
          p_payment_method: payload.provider.toLowerCase(),
        }
      );

      if (activateError) {
        console.error('Error activating subscription:', activateError);

        // Update webhook log
        if (webhookId) {
          await supabase
            .from('payment_webhooks')
            .update({
              status: 'failed',
              error_message: activateError.message,
              processed_at: new Date().toISOString(),
              subscription_id: subscription.id,
              user_id: subscription.user_id,
            })
            .eq('id', webhookId);
        }

        return NextResponse.json(
          { error: 'Failed to activate subscription' },
          { status: 500 }
        );
      }

      // Update subscription record with payment details
      await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          payment_method: payload.provider.toLowerCase(),
          metadata: {
            ...subscription.metadata,
            mpesa_reference: payload.mpesa_reference,
            card_type: payload.card_type,
            net_amount: payload.net_amount,
            charges: payload.charges,
            completed_at: payload.updated_at,
          },
        })
        .eq('id', subscription.id);

      // Update webhook log
      if (webhookId) {
        await supabase
          .from('payment_webhooks')
          .update({
            status: 'processed',
            processed_at: new Date().toISOString(),
            subscription_id: subscription.id,
            user_id: subscription.user_id,
          })
          .eq('id', webhookId);
      }

      console.log(`Subscription activated for user ${subscription.user_id}`);

    } else if (payload.state === 'FAILED') {
      // Payment failed
      await supabase
        .from('subscriptions')
        .update({
          status: 'failed',
          metadata: {
            ...subscription.metadata,
            failed_reason: payload.failed_reason,
            failed_at: payload.updated_at,
          },
        })
        .eq('id', subscription.id);

      // Update webhook log
      if (webhookId) {
        await supabase
          .from('payment_webhooks')
          .update({
            status: 'processed',
            processed_at: new Date().toISOString(),
            subscription_id: subscription.id,
            user_id: subscription.user_id,
          })
          .eq('id', webhookId);
      }

      console.log(`Payment failed for subscription ${subscription.id}: ${payload.failed_reason}`);

    } else if (payload.state === 'PENDING') {
      // Payment pending - no action needed yet
      if (webhookId) {
        await supabase
          .from('payment_webhooks')
          .update({
            status: 'processed',
            processed_at: new Date().toISOString(),
            subscription_id: subscription.id,
            user_id: subscription.user_id,
          })
          .eq('id', webhookId);
      }

      console.log(`Payment pending for subscription ${subscription.id}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully'
    });

  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      {
        error: 'Failed to process webhook',
        message: error.message
      },
      { status: 500 }
    );
  }
}
