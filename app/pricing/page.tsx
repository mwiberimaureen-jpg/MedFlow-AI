'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PricingPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // TODO: Get user info from Supabase Auth context
  // For now, using placeholder
  const userId = 'user-id-placeholder';
  const userEmail = 'user@example.com';
  const userName = 'John Doe';

  const handleSubscribe = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/payments/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          email: userEmail,
          fullName: userName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Intasend checkout page
      window.location.href = data.checkoutUrl;

    } catch (err: any) {
      console.error('Error creating checkout:', err);
      setError(err.message || 'Something went wrong. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Start analyzing patient histories with AI-powered insights
          </p>
        </div>

        {/* Pricing Card */}
        <div className="max-w-lg mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border-2 border-indigo-500">
            {/* Popular Badge */}
            <div className="bg-indigo-500 text-white text-center py-2 px-4 text-sm font-semibold">
              MOST POPULAR
            </div>

            <div className="p-8">
              {/* Plan Name */}
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Monthly Subscription
                </h2>
                <p className="text-gray-600 dark:text-gray-300">
                  For medical professionals
                </p>
              </div>

              {/* Price */}
              <div className="text-center mb-8">
                <div className="flex items-baseline justify-center">
                  <span className="text-5xl font-extrabold text-gray-900 dark:text-white">
                    KES 2,000
                  </span>
                  <span className="text-xl text-gray-600 dark:text-gray-400 ml-2">
                    /month
                  </span>
                </div>
              </div>

              {/* Features */}
              <div className="mb-8 space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  What's included:
                </h3>
                <Feature text="100 patient history analyses per month" />
                <Feature text="AI-powered diagnostic suggestions" />
                <Feature text="Structured to-do lists for patient care" />
                <Feature text="Secure cloud storage" />
                <Feature text="Mobile and desktop access" />
                <Feature text="Priority support" />
                <Feature text="Regular feature updates" />
              </div>

              {/* CTA Button */}
              <button
                onClick={handleSubscribe}
                disabled={isLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-4 px-6 rounded-lg transition-colors duration-200 text-lg shadow-lg"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Processing...
                  </span>
                ) : (
                  'Subscribe Now'
                )}
              </button>

              {/* Error Message */}
              {error && (
                <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400 text-center">
                    {error}
                  </p>
                </div>
              )}

              {/* Payment Methods */}
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-3">
                  Secure payment via Intasend
                </p>
                <div className="flex justify-center items-center space-x-4">
                  <PaymentBadge text="M-PESA" />
                  <PaymentBadge text="Visa" />
                  <PaymentBadge text="Mastercard" />
                </div>
              </div>
            </div>
          </div>

          {/* Trial Info */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              New users get a 7-day free trial. Cancel anytime.
            </p>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-8">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <FAQ
              question="How does the free trial work?"
              answer="New users automatically get a 7-day free trial. You can explore all features without any payment. If you don't subscribe after the trial, your account will be downgraded to free tier."
            />
            <FAQ
              question="Can I cancel anytime?"
              answer="Yes, you can cancel your subscription at any time from your account settings. You'll continue to have access until the end of your billing period."
            />
            <FAQ
              question="What payment methods do you accept?"
              answer="We accept M-PESA, Visa, and Mastercard payments through our secure payment partner Intasend."
            />
            <FAQ
              question="Is my patient data secure?"
              answer="Absolutely. We use industry-standard encryption and comply with healthcare data protection regulations. Your patient data is never shared with third parties."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Feature({ text }: { text: string }) {
  return (
    <div className="flex items-start">
      <svg
        className="w-6 h-6 text-green-500 mr-3 flex-shrink-0 mt-0.5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 13l4 4L19 7"
        />
      </svg>
      <span className="text-gray-700 dark:text-gray-300">{text}</span>
    </div>
  );
}

function PaymentBadge({ text }: { text: string }) {
  return (
    <div className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-semibold text-gray-700 dark:text-gray-300">
      {text}
    </div>
  );
}

function FAQ({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {question}
      </h3>
      <p className="text-gray-600 dark:text-gray-300">{answer}</p>
    </div>
  );
}
