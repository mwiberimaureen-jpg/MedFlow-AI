'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function PaymentSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    // Countdown timer
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push('/dashboard'); // Redirect to dashboard
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 text-center">
          {/* Success Icon */}
          <div className="mb-6 flex justify-center">
            <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-6">
              <svg
                className="w-16 h-16 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>

          {/* Success Message */}
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Payment Successful!
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
            Your subscription has been activated. You now have full access to all premium features.
          </p>

          {/* Details */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6 mb-8">
            <div className="space-y-3 text-left">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Plan:</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  Monthly Subscription
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Amount:</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  KES 2,000
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Status:</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                  Active
                </span>
              </div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="space-y-3">
            <Link
              href="/dashboard"
              className="block w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
            >
              Go to Dashboard
            </Link>
            <Link
              href="/analyze"
              className="block w-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
            >
              Start Analyzing Patients
            </Link>
          </div>

          {/* Auto-redirect Notice */}
          <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
            Redirecting to dashboard in {countdown} seconds...
          </p>
        </div>

        {/* Support Link */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Need help?{' '}
            <Link
              href="/support"
              className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-medium"
            >
              Contact Support
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}
