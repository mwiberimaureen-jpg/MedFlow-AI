'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ReviewModal } from '@/components/ReviewModal';

interface UserInfo {
  id: string;
  email: string;
  full_name?: string;
  subscription_status?: string;
  referral_credits?: number;
}

type ReviewMode = 'none' | 'mandatory' | 'optional'
type Step = 'plans' | 'instructions' | 'code' | 'submitted'
type PlanType = 'basic' | 'pro'

const PLANS = {
  basic: { label: 'Basic', price: 1000, patients: 20 },
  pro:   { label: 'Pro',   price: 2000, patients: 50 },
}

export default function PricingPage() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [reviewMode, setReviewMode] = useState<ReviewMode>('none');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanType | null>(null);
  const [step, setStep] = useState<Step>('plans');
  const [mpesaCode, setMpesaCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState('');
  const [referralStatus, setReferralStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [profileRes, subCountRes] = await Promise.all([
        supabase.from('users').select('id, email, full_name, subscription_status, referral_credits').eq('id', user.id).single(),
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

  function handlePlanSelect(plan: PlanType) {
    setSelectedPlan(plan);
    if (reviewMode !== 'none') {
      setShowReviewModal(true);
    } else {
      setStep('instructions');
    }
  }

  function handleReviewDone() {
    setShowReviewModal(false);
    setStep('instructions');
  }

  function handleReviewSkip() {
    setShowReviewModal(false);
    setStep('instructions');
  }

  async function validateReferralCode(code: string) {
    if (code.length !== 4) { setReferralStatus('idle'); return; }
    setReferralStatus('checking');
    try {
      const res = await fetch(`/api/referral/validate?code=${code}`);
      const data = await res.json();
      setReferralStatus(data.valid ? 'valid' : 'invalid');
    } catch {
      setReferralStatus('idle');
    }
  }

  async function handleSubmitCode() {
    if (!mpesaCode.trim()) { setError('Please enter your M-Pesa confirmation code.'); return; }
    if (!selectedPlan) return;
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
          planType: selectedPlan,
          referralCode: referralStatus === 'valid' ? referralCode : undefined,
          useCredit: (userInfo?.referral_credits ?? 0) > 0 && referralStatus !== 'valid',
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

  const plan = selectedPlan ? PLANS[selectedPlan] : null;
  const hasCredit = (userInfo?.referral_credits ?? 0) > 0;
  // Only the referrer's earned credit gives a discount — entering someone else's code does not
  const discountActive = hasCredit;
  const effectivePrice = discountActive && plan ? Math.round(plan.price * 0.75) : (plan?.price ?? 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Choose Your Plan</h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Your notes and summaries are always accessible, even without an active subscription.
          </p>
        </div>

        {/* Step: plan selection */}
        {step === 'plans' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">

              {/* Basic */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden border-2 border-gray-200 dark:border-gray-700 flex flex-col">
                <div className="p-8 flex flex-col flex-1">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Basic</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">For individual clinicians</p>
                  <div className="flex items-baseline mb-8">
                    <span className="text-4xl font-extrabold text-gray-900 dark:text-white">KES 1,000</span>
                    <span className="text-gray-500 dark:text-gray-400 ml-2">/month</span>
                  </div>
                  <ul className="space-y-3 mb-8 flex-1">
                    <Feature text="20 new patient files per month" />
                    <Feature text="Full admission journey — Day 1 to discharge" />
                    <Feature text="Daily AI round notes & learning sparks" />
                    <Feature text="Discharge summaries included" />
                    <Feature text="Notes & summaries always accessible" />
                    <Feature text="AI-powered diagnostic suggestions" />
                    <Feature text="Secure cloud storage" />
                  </ul>
                  <button
                    onClick={() => handlePlanSelect('basic')}
                    className="w-full bg-gray-900 hover:bg-gray-700 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                  >
                    Get Basic
                  </button>
                </div>
              </div>

              {/* Pro */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border-2 border-indigo-500 flex flex-col">
                <div className="bg-indigo-500 text-white text-center py-2 px-4 text-sm font-semibold">
                  MOST POPULAR
                </div>
                <div className="p-8 flex flex-col flex-1">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Pro</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">For busy wards and rotations</p>
                  <div className="flex items-baseline mb-8">
                    <span className="text-4xl font-extrabold text-gray-900 dark:text-white">KES 2,000</span>
                    <span className="text-gray-500 dark:text-gray-400 ml-2">/month</span>
                  </div>
                  <ul className="space-y-3 mb-8 flex-1">
                    <Feature text="50 new patient files per month" />
                    <Feature text="Full admission journey — Day 1 to discharge" />
                    <Feature text="Daily AI round notes & learning sparks" />
                    <Feature text="Discharge summaries included" />
                    <Feature text="Notes & summaries always accessible" />
                    <Feature text="AI-powered diagnostic suggestions" />
                    <Feature text="Secure cloud storage" />
                  </ul>
                  <button
                    onClick={() => handlePlanSelect('pro')}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                  >
                    Get Pro
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-8 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                New users get 5 free patient files. Leave a review to unlock 5 more.
              </p>
            </div>

            {/* FAQ */}
            <div className="mt-16">
              <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-8">Frequently Asked Questions</h2>
              <div className="space-y-4 max-w-3xl mx-auto">
                <FAQ question="What counts as one patient file?" answer="One patient file covers up to 15 analyses — daily round notes, learning sparks, and the discharge summary are all included. Editing the patient history and re-running analysis also counts toward the 15." />
                <FAQ question="Can I edit a patient's history?" answer="Yes — you can always edit a patient's initial history. When you re-run analysis after an edit, it uses one analysis slot from that patient's file. This keeps things fair while still letting you correct or update the history as the admission progresses." />
                <FAQ question="What happens when I reach my patient limit?" answer="You can still view, edit, and access all existing patient notes, summaries, and histories. You just can't open new patient files or run new analyses until you renew your subscription." />
                <FAQ question="How long does activation take?" answer="Your account is activated immediately when you submit your M-Pesa confirmation code. You can start using MedFlow AI right away." />
                <FAQ question="Can I upgrade from Basic to Pro?" answer="Yes — email us at medflowai.ke@gmail.com and we'll sort out the difference." />
                <FAQ question="What payment methods do you accept?" answer="M-Pesa via Paybill 247247. We're working on adding card payments." />
              </div>
            </div>
          </>
        )}

        {/* Step: payment instructions */}
        {step === 'instructions' && plan && (
          <div className="max-w-md mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border-2 border-indigo-500">
              <div className="bg-indigo-500 text-white text-center py-2 px-4 text-sm font-semibold">
                {plan.label} Plan —{' '}
                {discountActive ? (
                  <>
                    <span className="line-through opacity-70">KES {plan.price.toLocaleString()}</span>{' '}
                    KES {effectivePrice.toLocaleString()}/month
                  </>
                ) : (
                  <>KES {plan.price.toLocaleString()}/month</>
                )}
              </div>
              <div className="p-8 space-y-6">
                {/* Referral credit banner */}
                {hasCredit && (
                  <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3 text-sm text-green-700 dark:text-green-400">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Referral credit applied — 25% off this month
                  </div>
                )}

                {/* Referral code input (only if no credit) */}
                {!hasCredit && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Referral code <span className="font-normal text-gray-400">(optional)</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={referralCode}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, '').slice(0, 4)
                          setReferralCode(v)
                          if (v.length === 4) validateReferralCode(v)
                          else setReferralStatus('idle')
                        }}
                        placeholder="4-digit code"
                        maxLength={4}
                        className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-mono tracking-widest text-center bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                      {referralStatus === 'checking' && <span className="text-sm text-gray-500 self-center">Checking…</span>}
                      {referralStatus === 'valid' && <span className="text-sm text-green-600 dark:text-green-400 font-medium self-center">✓ Code accepted</span>}
                      {referralStatus === 'invalid' && <span className="text-sm text-red-500 self-center">Invalid code</span>}
                    </div>
                  </div>
                )}

                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-5 space-y-4">
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
                      <div>
                        {discountActive && (
                          <p className="text-sm line-through text-gray-400">KES {plan.price.toLocaleString()}</p>
                        )}
                        <p className="text-xl font-bold text-gray-900 dark:text-white">KES {effectivePrice.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                  <ol className="text-xs text-gray-600 dark:text-gray-400 space-y-1 list-decimal list-inside pt-1">
                    <li>Go to M-Pesa → Lipa na M-Pesa → Pay Bill</li>
                    <li>Enter Business no. <strong>247247</strong></li>
                    <li>Enter Account no. <strong>0764987896</strong></li>
                    <li>Enter Amount <strong>{effectivePrice.toLocaleString()}</strong> and your PIN</li>
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

                <button
                  type="button"
                  onClick={() => { setStep('plans'); setSelectedPlan(null); }}
                  className="w-full text-sm text-gray-500 dark:text-gray-400 hover:underline py-1"
                >
                  ← Back to plans
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step: enter M-Pesa code */}
        {step === 'code' && plan && (
          <div className="max-w-md mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 space-y-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Enter your M-Pesa code</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {plan.label} Plan — KES {effectivePrice.toLocaleString()}/month
                {discountActive && <span className="text-green-600 dark:text-green-400 ml-1">(referral credit applied)</span>}
              </p>

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
          </div>
        )}

        {/* Step: submitted */}
        {step === 'submitted' && (
          <div className="max-w-md mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Subscription activated!</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Your <strong>{plan?.label}</strong> subscription is now active. You have full access to MedFlow AI.
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                M-Pesa code <strong className="font-mono">{mpesaCode}</strong> received.
              </p>
            </div>
          </div>
        )}
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
      <span className="text-gray-700 dark:text-gray-300 text-sm">{text}</span>
    </div>
  );
}

function FAQ({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-5 text-left gap-4"
      >
        <span className="text-base font-semibold text-gray-900 dark:text-white">{question}</span>
        <svg
          className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-6 pb-5 border-t border-gray-100 dark:border-gray-700 pt-4">
          <p className="text-gray-600 dark:text-gray-300 text-sm">{answer}</p>
        </div>
      )}
    </div>
  );
}
