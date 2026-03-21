// === Senior Peer Review format types ===

export type SparkFormat = 'senior_asks' | 'quick_teach' | 'know_your_drugs' | 'clinical_twist'

export interface SeniorAsksContent {
  question: string
  context: string // brief setup: "Your patient has X..."
  answer: string
  teaching_point: string
  clinical_pearl: string
  topic: string
}

export interface QuickTeachContent {
  topic: string
  intro: string // "Since you have a patient with X, let's review..."
  teach_type: 'classification' | 'mnemonic' | 'pathophysiology' | 'criteria'
  cards: Array<{
    id: string
    title: string
    content: string
  }>
  summary_pearl: string
}

export interface KnowYourDrugsContent {
  topic: string
  context: string // "Your patient is on X..."
  drugs: Array<{
    name: string
    mechanism: string
    when_to_use: string
    key_point: string
  }>
  clinical_pearl: string
}

export interface ClinicalTwistContent {
  topic: string
  scenario: string // "Your patient with X is stable. What changes if..."
  twist: string // The variable change
  original_plan: string
  revised_plan: string
  reasoning: string
  clinical_pearl: string
}

export type SparkContent = SeniorAsksContent | QuickTeachContent | KnowYourDrugsContent | ClinicalTwistContent

// === Database row type ===

export interface DailyLearningSpark {
  id: string
  user_id: string
  spark_date: string
  format_type: SparkFormat
  content: SparkContent
  source_conditions: string[]
  generated_at: string
}

// === localStorage state ===

export interface LearningSparkState {
  currentStreak: number
  lastInteractionDate: string // YYYY-MM-DD
  longestStreak: number
  seenSparks: string[] // spark IDs
}

export function getDefaultSparkState(): LearningSparkState {
  return {
    currentStreak: 0,
    lastInteractionDate: '',
    longestStreak: 0,
    seenSparks: [],
  }
}
