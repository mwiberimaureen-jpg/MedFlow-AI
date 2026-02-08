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
  processing_time_ms?: number
  total_items: number
  completed_items: number
  user_rating?: number
  user_feedback?: string
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
  category: 'diagnostic' | 'treatment' | 'follow-up' | 'referral' | 'monitoring' | 'lifestyle'
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
  category: 'diagnostic' | 'treatment' | 'follow-up' | 'referral' | 'monitoring' | 'lifestyle'
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

export interface AnalysisResponse {
  summary: string
  risk_level: 'low' | 'medium' | 'high'
  todo_items: TodoItemJson[]
}
