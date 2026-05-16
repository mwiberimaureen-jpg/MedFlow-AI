import { PatientHistoryForm } from '@/components/patients/PatientHistoryForm'

const DEMO_PATIENT = {
  patient_name: 'Demo Patient',
  patient_age: '34',
  patient_gender: 'female',
  patient_identifier: 'DEMO-CASE',
  rotation: 'Internal Medicine',
  ai_consent: true,
  third_party_consent: true,
  history_text: `34-year-old woman presenting with a 3-week history of progressive exertional dyspnoea, orthopnoea, bilateral ankle oedema, and paroxysmal nocturnal dyspnoea. She reports an upper respiratory tract infection 4 weeks prior that resolved spontaneously. No prior cardiac history. Non-smoker, no alcohol use, no regular medications.

On examination: BP 110/70 mmHg, HR 112 bpm (irregularly irregular), RR 22 breaths/min, SpO2 91% on room air, Temperature 37.1°C. JVP raised at 4cm above the sternal angle. Bilateral basal fine crackles on auscultation. Bilateral pitting oedema to the knees. No murmurs auscultated.

Investigations: CXR shows cardiomegaly with bilateral perihilar shadowing consistent with pulmonary oedema. ECG: atrial fibrillation with rapid ventricular response (HR 112). Echo pending. FBC: WBC 8.2, Hb 11.8 g/dL, Platelets 210. UECs: Na 132 mmol/L, K 3.8 mmol/L, Creatinine 98 umol/L. BNP: 1840 pg/mL. Troponin: negative x2. TFTs: normal.`
}

export default function NewPatientPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>
}) {
  const resolvedParams = searchParams instanceof Promise
    ? { demo: undefined }
    : searchParams as { demo?: string }

  const isDemo = resolvedParams.demo === 'true'

  return (
    <div className="max-w-4xl">
      {isDemo ? (
        <div className="mb-8">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚡</span>
              <div>
                <p className="font-semibold text-blue-900 dark:text-blue-100">Demo Case — See MedFlow AI in action</p>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  A real clinical scenario is pre-loaded below. Hit <strong>Analyze</strong> to see what MedFlow generates — impression, differentials, management plan, and complications.
                </p>
              </div>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Try a Demo Case</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Everything is pre-filled. Just scroll down and click Analyze.
          </p>
        </div>
      ) : (
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">New Patient History</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Enter patient information and history for AI-powered analysis
          </p>
        </div>
      )}

      <PatientHistoryForm initialData={isDemo ? DEMO_PATIENT : undefined} />
    </div>
  )
}
