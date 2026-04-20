'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TERMS_VERSION } from '@/lib/legal/terms'

export default function TermsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/dashboard'

  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const handleAccept = async () => {
    if (!agreed) return
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/accept-terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: TERMS_VERSION }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Failed to record acceptance')
      }
      router.replace(next)
    } catch (err: any) {
      setError(err?.message || 'Failed to record acceptance')
      setLoading(false)
    }
  }

  const handleDecline = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              MedFlow AI — Terms and Conditions
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Version {TERMS_VERSION} · Please read carefully before using the application.
            </p>
          </div>

          <div className="px-6 py-6 max-h-[60vh] overflow-y-auto prose prose-sm dark:prose-invert max-w-none">
            <TermsBody />
          </div>

          <div className="px-6 py-5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">
                {error}
              </div>
            )}

            <label className="flex items-start gap-3 cursor-pointer mb-4">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-800 dark:text-gray-200">
                I have read and understood the Terms and Conditions above. I confirm
                that I am a licensed medical practitioner or student under supervision,
                that I accept full professional responsibility for any clinical decisions
                I make, and that I consent to the data-handling practices described.
              </span>
            </label>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleAccept}
                disabled={!agreed || loading}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Recording…' : 'I Agree — Continue'}
              </button>
              <button
                type="button"
                onClick={handleDecline}
                disabled={loading}
                className="flex-1 sm:flex-initial px-6 py-3 rounded-lg font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Decline &amp; Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function TermsBody() {
  return (
    <div className="space-y-6 text-gray-800 dark:text-gray-200">
      <section>
        <h2 className="text-lg font-semibold">1. Medical Disclaimer and Nature of Service</h2>
        <p>
          MedFlow AI (&ldquo;the Service&rdquo;) is a clinical decision-support and documentation
          tool provided for educational and informational purposes only. The Service
          uses large language models to summarise patient histories, suggest differential
          diagnoses, and draft management plans. Its outputs are not medical advice,
          diagnosis, or treatment, and must never be relied upon as a substitute for
          the independent clinical judgement of a qualified, licensed healthcare
          professional. The Service is not a medical device, has not been evaluated
          or approved by any regulatory body (including but not limited to the FDA,
          EMA, or the Kenya Pharmacy and Poisons Board), and must not be used for
          autonomous clinical decision-making.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">2. No Physician-Patient Relationship</h2>
        <p>
          Use of the Service does not create a physician-patient, doctor-user, or
          any other professional care relationship between MedFlow AI, its operators,
          or any third-party provider and any individual whose data is entered into
          the Service. All clinical relationships remain exclusively between the
          registered user (the treating practitioner) and their patient. MedFlow AI
          provides no care, issues no prescriptions, and makes no referrals.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">3. User Responsibility and Professional Judgment</h2>
        <p>
          You are solely and ultimately responsible for every clinical decision made
          in connection with any patient whose information is processed through the
          Service. You agree to:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>independently verify every suggestion, differential, drug dose, and investigation recommended by the Service against current authoritative sources and institutional protocols;</li>
          <li>apply your own professional judgement, clinical examination findings, and knowledge of the individual patient before acting on any output;</li>
          <li>not delegate clinical decision-making to the Service;</li>
          <li>ensure that any documentation generated is reviewed, corrected where necessary, and signed off by a human clinician before entry into a medical record.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">4. Accuracy and Completeness of Data</h2>
        <p>
          The Service is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis without
          warranties of any kind, express or implied, including but not limited to
          warranties of merchantability, fitness for a particular purpose, accuracy,
          completeness, currency, or non-infringement. Large language models can and
          do produce plausible-sounding but incorrect output (&ldquo;hallucinations&rdquo;), miss
          critical findings, mis-grade severity, and be unaware of recent guideline
          updates, drug recalls, or patient-specific contraindications. You acknowledge
          these theoretical and practical blindspots and accept that any reliance on
          Service outputs is at your sole risk.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">5. Limitation of Liability and Indemnification</h2>
        <p>
          To the maximum extent permitted by applicable law, MedFlow AI, its
          affiliates, directors, employees, contractors, and third-party model
          providers shall not be liable for any direct, indirect, incidental,
          consequential, special, exemplary, or punitive damages, including but not
          limited to loss of life, personal injury, misdiagnosis, delayed treatment,
          loss of profits, loss of data, or reputational harm, arising out of or in
          connection with your use of the Service, even if advised of the possibility
          of such damages. To the extent any liability cannot be excluded, the
          aggregate liability of MedFlow AI shall not exceed the fees paid by you
          to MedFlow AI in the twelve (12) months preceding the event giving rise
          to the claim. You agree to indemnify, defend, and hold harmless MedFlow AI
          and its affiliates against any claims, damages, liabilities, or expenses
          (including reasonable legal fees) arising from (a) your use of the Service,
          (b) your breach of these Terms, (c) your violation of any law or regulation,
          or (d) any clinical outcome attributed wholly or partly to the Service.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">6. Data Privacy and Security Compliance</h2>
        <p>
          Patient information processed through the Service is personal and sensitive
          health data. You warrant that you have obtained all necessary consents from
          patients (including informed consent to the use of AI assistance and to the
          transmission of de-identified data to third-party AI processors) prior to
          entering their information. MedFlow AI applies field-level AES-256-GCM
          encryption to identifying fields at rest, de-identifies protected health
          information before transmission to third-party model providers, maintains
          audit logs of access, and supports configurable auto-deletion of patient
          records. You remain the data controller for all patient information you
          enter and are responsible for compliance with applicable laws, including
          the Kenya Data Protection Act, 2019, the US Health Insurance Portability
          and Accountability Act (HIPAA) where applicable, the EU/UK GDPR where
          applicable, and any institutional or jurisdictional rules governing your
          practice. You will not enter patient information into the Service unless
          you are lawfully permitted to do so.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">7. Prohibited Uses</h2>
        <p>You agree not to, and not to permit any third party to:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>use the Service for any emergency, life-threatening, or time-critical clinical scenario where delay or error could cause serious harm — the Service is not designed for, and must not be used in, emergency medicine, resuscitation, or critical-care decision points;</li>
          <li>reverse-engineer, decompile, disassemble, scrape, or otherwise attempt to derive the source code, model weights, prompts, or underlying algorithms of the Service;</li>
          <li>use the Service to train, fine-tune, or evaluate any competing AI system;</li>
          <li>upload malware, attempt to gain unauthorised access to other accounts or infrastructure, or interfere with the Service&apos;s operation;</li>
          <li>upload data you are not authorised to process, or use the Service to harass, discriminate against, or harm any individual;</li>
          <li>use the Service for veterinary, forensic, or insurance-adjudication purposes without prior written authorisation.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">8. Account Security and Credential Responsibility</h2>
        <p>
          You are responsible for maintaining the confidentiality of your account
          credentials and for all activity that occurs under your account. You agree
          to (a) use a strong, unique password, (b) not share your credentials with
          any other person, (c) notify MedFlow AI immediately of any suspected
          unauthorised access or breach, and (d) log out from shared or public
          devices. MedFlow AI is not liable for losses arising from your failure
          to protect your credentials.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">9. Intellectual Property Rights</h2>
        <p>
          The Service, including all software, models, prompts, user interface,
          branding, documentation, and related materials, is owned by MedFlow AI
          or its licensors and is protected by copyright, trademark, and other
          intellectual-property laws. You are granted a limited, non-exclusive,
          non-transferable, revocable licence to access and use the Service for
          your own professional practice, subject to these Terms. You retain
          ownership of the patient information and clinical notes you input;
          MedFlow AI claims no ownership over such content, and uses it only to
          provide, secure, and improve the Service in accordance with Section 6.
          You will not remove or obscure any proprietary notices.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">10. Termination of Access and Modification of Terms</h2>
        <p>
          MedFlow AI may suspend or terminate your access to the Service at any
          time, with or without notice, for any reason, including but not limited
          to breach of these Terms, non-payment, suspected fraudulent activity,
          or a legal or regulatory requirement. Upon termination, your right to
          use the Service ceases immediately; provisions that by their nature
          should survive (including Sections 3, 4, 5, 6, 9, and 11) shall survive.
          MedFlow AI may modify these Terms from time to time. Material changes
          will be presented to you for acceptance on next sign-in; continued use
          after acceptance constitutes agreement to the updated Terms. If you do
          not accept updated Terms, your access will be suspended until you do.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">11. Governing Law and Dispute Resolution</h2>
        <p>
          These Terms shall be governed by and construed in accordance with the
          laws of the Republic of Kenya, without regard to its conflict-of-laws
          principles. Any dispute, controversy, or claim arising out of or in
          connection with these Terms, including any question regarding their
          existence, validity, or termination, shall first be the subject of good-
          faith negotiation between the parties for a period of at least thirty
          (30) days. If not resolved, the dispute shall be referred to and finally
          resolved by arbitration under the Nairobi Centre for International
          Arbitration (NCIA) Arbitration Rules by a single arbitrator, with the
          seat of arbitration in Nairobi, Kenya, and proceedings in the English
          language. Nothing in this section prevents either party from seeking
          urgent injunctive or equitable relief from a court of competent
          jurisdiction.
        </p>
      </section>

      <p className="text-xs text-gray-500 dark:text-gray-400 pt-4 border-t border-gray-200 dark:border-gray-700">
        By clicking &ldquo;I Agree&rdquo;, you represent that you have read, understood, and
        accept these Terms and Conditions in full, and that you have the authority
        to do so in your professional capacity.
      </p>
    </div>
  )
}
