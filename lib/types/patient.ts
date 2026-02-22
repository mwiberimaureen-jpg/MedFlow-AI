export interface PatientHistory {
  id: string
  user_id: string
  patient_name: string
  patient_age?: number
  patient_gender?: string
  patient_identifier?: string
  history_text: string
  word_count?: number
  status: 'draft' | 'analyzing' | 'completed' | 'error'
  metadata?: Record<string, any>
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

export interface Analysis {
  id: string
  patient_history_id: string
  user_id: string
  todo_list_json: TodoItemJson[]
  raw_analysis_text: string
  model_used?: string
  analysis_version?: string | null
  processing_time_ms?: number
  total_items: number
  completed_items: number
  user_rating?: number
  user_feedback?: string | null
  summary: string
  risk_level: 'low' | 'medium' | 'high'
  created_at: string
  updated_at: string
}

export interface TodoItem {
  id: string
  analysis_id: string
  title: string
  description?: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  category: 'physical_examination' | 'investigations' | 'differential_diagnosis' | 'management_plan' | 'complications' | 'follow_up' | 'diagnostic' | 'treatment' | 'follow-up' | 'referral' | 'monitoring' | 'lifestyle'
  is_completed: boolean
  order_index: number
  parent_item_id?: string | null
  created_at: string
  updated_at: string
}

export interface TodoItemJson {
  title: string
  description?: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  category: 'physical_examination' | 'investigations' | 'differential_diagnosis' | 'management_plan' | 'complications' | 'follow_up' | 'diagnostic' | 'treatment' | 'follow-up' | 'referral' | 'monitoring' | 'lifestyle'
  order?: number
}

export interface DashboardStats {
  total_patients: number
  total_analyses: number
  this_month_count: number
  pending_analyses: number
  completed_this_week: number
}

export interface PatientWithAnalysis extends PatientHistory {
  analyses: (Analysis & { todo_items: TodoItem[] })[]
}

export interface CreatePatientRequest {
  patient_name: string
  patient_age?: number
  patient_gender?: string
  patient_identifier?: string
  history_text: string
  status?: 'draft' | 'submitted'
  metadata?: Record<string, any>
}

export interface GapsInHistory {
  missing_information: string[]
  follow_up_questions: string[]
  physical_exam_checklist: string[]
}

export interface TestInterpretation {
  number: number
  test_name: string
  deranged_parameters: string[]
  normal_parameters_assumed: string
  interpretation: string
}

export interface DifferentialDiagnosis {
  diagnosis: string
  supporting_evidence: string
  against_evidence: string
}

export interface ConfirmatoryTest {
  test: string
  rationale: string
}

export interface ManagementPlan {
  current_plan_analysis: string
  recommended_plan: { step: string; rationale: string }[]
  adjustments_based_on_status: string
}

export interface Complication {
  complication: string
  prevention_plan: string
}

export interface AnalysisResponse {
  risk_level: 'low' | 'medium' | 'high'
  gaps_in_history: GapsInHistory
  test_interpretation: TestInterpretation[]
  impressions: string[]
  differential_diagnoses: DifferentialDiagnosis[]
  confirmatory_tests: ConfirmatoryTest[]
  management_plan: ManagementPlan
  complications: Complication[]
  summary: string
  todo_items: TodoItemJson[]
}
