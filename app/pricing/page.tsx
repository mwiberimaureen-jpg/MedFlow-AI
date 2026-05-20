'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ReviewModal } from '@/components/ReviewModal';

interface UserInfo {
  id: string;
  email: string;
  full_name?: string;
  subscription_status?: string;
}

type ReviewMode = 'none' | 'mandatory' | 'optional'
type Step = 'instructions' | 'code' | 'submitted'

export default function PricingPage() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [reviewMode, setReviewMode] = useState<ReviewMode>('none');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [step, setStep] = useState<Step>('instructions');
  const [mpesaCode, setMpesaCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [profileRes, subCountRes] = await Promise.all([
        supabase.from('users').select('id, email, full_name, subscription_status').eq('id', user.id).single(),
        supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', user.id).neq('status', 'pending'),
      ]);

      if (profileRes.data) setUserInfo(profileRes.data);

      const paidCount = subCountRes.count ?? 0;
      if (paidCount === 1) setReviewMode('optional');
      else if (paidCount === 2) setReviewMode('mandatory');
      else setReviewMode('none');
    }
    loadUser();
  }, []);

  const isRenewing = userInfo?.subscription_status === 'active';

  async function handleSubmitCode() {
    if (!mpesaCode.trim()) {
      setError('Please enter your M-Pesa confirmation code.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/payments/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mpesaCode: mpesaCode.trim(),
          email: userInfo?.email,
          fullName: userInfo?.full_name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setStep('submitted');
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubscribeClick() {
    if (reviewMode !== 'none') {
      setShowReviewModal(true);
      return;
    }
    setStep('instructions');
  }

  function handleReviewDone() {
    setShowReviewModal(false);
    setStep('instructions');
  }

  function handleReviewSkip() {
    setShowReviewModal(false);
    setStep('instructions');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            {isRenewing ? 'Renew Your Subscription' : 'Choose Your Plan'}
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            {isRenewing
              ? 'Continue your access to AI-powered clinical tools'
              : 'Start analyzing patient histories with AI-powered insights'}
          </p>
        </div>

        <div className="max-w-lg mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border-2 border-indigo-500">
            <div className="bg-indigo-500 text-white text-center py-2 px-4 text-sm font-semibold">
              MOST POPULAR
            </div>

            <div className="p-8">
              {/* Plan header */}
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Monthly Subscription</h2>
                <p className="text-gray-600 dark:text-gray-300">For medical professionals</p>
              </div>

              <div className="text-center mb-8">
                <div className="flex items-baseline justify-center">
                  <span className="text-5xl font-extrabold text-gray-900 dark:text-white">KES 1,000</span>
                  <span className="text-xl text-gray-600 dark:text-gray-400 ml-2">/month</span>
                </div>
              </div>

              {/* Features */}
              <div className="mb-8 space-y-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">What&apos;s included:</h3>
                <Feature text="Unlimited patient history analyses per month" />
                <Feature text="AI-powered diagnostic suggestions" />
                <Feature text="Structured to-do list for patient care" />
                <Feature text="Secure cloud storage" />
                <Feature text="Mobile and desktop access" />
                <Feature text="Priority support" />
                <Feature text="Regular feature updates" />
              </div>

              {/* Step: instructions */}
              {step === 'instructions' && (
                <div className="space-y-4">
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-5 space-y-3">
                    <p className="text-sm font-semibold text-green-800 dark:text-green-300 uppercase tracking-wide">Pay via M-Pesa</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Paybill Number</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">247247</p>
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Account Number</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">0764987896</p>
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Amount</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">KES 1,000</p>
                      </div>
                    </div>
                    <ol className="text-xs text-gray-600 dark:text-gray-400 space-y-1 list-decimal list-inside pt-1">
                      <li>Go to M-Pesa → Lipa na M-Pesa → Pay Bill</li>
                      <li>Enter Business no. <strong>247247</strong></li>
                      <li>Enter Account no. <strong>0764987896</strong></li>
                      <li>Enter Amount <strong>1000</strong> and your PIN</li>
                      <li>Copy the confirmation code from the SMS you receive</li>
                    </ol>
                  </div>

                  <button
                    type="button"
                    onClick={() => setStep('code')}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-lg transition-colors text-lg shadow-lg"
                  >
                    I&apos;ve Paid — Enter Confirmation Code
                  </button>
                </div>
              )}

              {/* Step: enter code */}
              {step === 'code' && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="mpesa-code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      M-Pesa Confirmation Code
                    </label>
                    <input
                      id="mpesa-code"
                      type="text"
                      value={mpesaCode}
                      onChange={(e) => setMpesaCode(e.target.value.toUpperCase())}
                      placeholder="e.g. RGH7XK1234"
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-lg tracking-widest uppercase"
                      maxLength={12}
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Found in the M-Pesa SMS you received after payment
                    </p>
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleSubmitCode}
                    disabled={isLoading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-4 px-6 rounded-lg transition-colors text-lg shadow-lg"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Submitting...
                      </span>
                    ) : 'Submit Payment'}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setStep('instructions'); setError(null); }}
                    className="w-full text-sm text-gray-500 dark:text-gray-400 hover:underline py-1"
                  >
                    ← Back to payment instructions
                  </button>
                </div>
              )}

              {/* Step: submitted */}
              {step === 'submitted' && (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                    <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Payment Received!</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Your confirmation code <strong className="font-mono">{mpesaCode}</strong> has been submitted.
                    We&apos;ll verify and activate your subscription within a few hours.
                    You&apos;ll be notified at <strong>{userInfo?.email}</strong>.
                  </p>
                </div>
              )}

              {/* Payment note (instructions step only) */}
              {step === 'instructions' && (
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                    After paying, submit your M-Pesa confirmation code. Activation is done manually within a few hours.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              New users get 5 free analyses to get started.
            </p>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-8">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <FAQ
              question="How does the free trial work?"
              answer="New users get 5 free admission analyses. You can explore all features without any payment. Subscribe to continue after your free analyses are used."
            />
            <FAQ
              question="How long does activation take?"
              answer="Once you submit your M-Pesa confirmation code, we verify the payment and activate your account manually — usually within a few hours."
            />
            <FAQ
              question="What if I entered the wrong confirmation code?"
              answer="Email us at medflowai.ke@gmail.com with your correct M-Pesa code and account email and we'll sort it out."
            />
            <FAQ
              question="Is my patient data secure?"
              answer="Absolutely. We use industry-standard encryption and comply with healthcare data protection regulations. Your patient data is never shared with third parties."
            />
          </div>
        </div>
      </div>

      {showReviewModal && userInfo && (
        <ReviewModal
          userEmail={userInfo.email}
          userName={userInfo.full_name}
          context={reviewMode === 'mandatory' ? 'renewal' : 'paid'}
          onClose={handleReviewSkip}
          onSubmitted={handleReviewDone}
        />
      )}
    </div>
  );
}

function Feature({ text }: { text: string }) {
  return (
    <div className="flex items-start">
      <svg className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      <span className="text-gray-700 dark:text-gray-300">{text}</span>
    </div>
  );
}

function FAQ({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{question}</h3>
      <p className="text-gray-600 dark:text-gray-300">{answer}</p>
    </div>
  );
}
