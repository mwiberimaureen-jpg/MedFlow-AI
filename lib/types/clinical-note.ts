export interface ClinicalNote {
  id: string
  user_id: string
  title: string
  content: string
  source: 'manual' | 'senior_asks' | 'quick_teach' | 'know_your_drugs' | 'clinical_twist'
  spark_id: string | null
  tags: string[] | null
  created_at: string
  updated_at: string
}
