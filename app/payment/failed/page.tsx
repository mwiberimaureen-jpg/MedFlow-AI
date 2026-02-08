'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function PaymentFailedContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason') || 'Unknown error';

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 text-center">
          {/* Error Icon */}
          <div className="mb-6 flex justify-center">
            <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-6">
              <svg
                className="w-16 h-16 text-red-600 dark:text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>

          {/* Error Message */}
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Payment Failed
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
            We couldn't process your payment. Don't worry, no charges were made to your account.
          </p>

          {/* Error Details */}
          {reason && reason !== 'Unknown error' && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-8">
              <p className="text-sm text-red-600 dark:text-red-400">
                <span className="font-semibold">Reason: </span>
                {reason}
              </p>
            </div>
          )}

          {/* Common Issues */}
          <div className="text-left mb-8 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-3">
              Common issues:
            </h2>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Insufficient funds in your account</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Incorrect M-PESA PIN or card details</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Transaction cancelled or timed out</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Network connectivity issues</span>
              </li>
            </ul>
          </div>

          {/* CTA Buttons */}
          <div className="space-y-3">
            <Link
              href="/pricing"
              className="block w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
            >
              Try Again
            </Link>
            <Link
              href="/dashboard"
              className="block w-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
            >
              Return to Dashboard
            </Link>
          </div>

          {/* Help Section */}
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Still having trouble?
            </p>
            <div className="flex justify-center space-x-4">
              <Link
                href="/support"
                className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-medium"
              >
                Contact Support
              </Link>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <Link
                href="/faq"
                className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-medium"
              >
                View FAQs
              </Link>
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            🔒 Your payment information is secure and encrypted
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PaymentFailedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    }>
      <PaymentFailedContent />
    </Suspense>
  );
}
