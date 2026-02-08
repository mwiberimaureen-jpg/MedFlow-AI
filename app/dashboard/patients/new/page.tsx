import { PatientHistoryForm } from '@/components/patients/PatientHistoryForm'

export default function NewPatientPage() {
  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">New Patient History</h1>
        <p className="text-gray-600 mt-2">
          Enter patient information and history for AI-powered analysis
        </p>
      </div>

      <PatientHistoryForm />
    </div>
  )
}
