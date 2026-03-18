// === Content schemas for each spark format ===

export type SparkFormat = 'quiz' | 'mystery' | 'myth' | 'flashcards'

export interface QuizContent {
  question: string
  options: string[] // 4 options
  correct_index: number // 0-3
  explanation: string
  clinical_pearl: string
  topic: string
}

export interface MysteryContent {
  title: string
  patient_presentation: string
  clues: Array<{ order: number; clue: string }>
  diagnosis: string
  key_pearls: string[]
  topic: string
}

export interface MythContent {
  myth: string
  reality: string
  why_it_matters: string
  clinical_context: string
  topic: string
}

export interface FlashcardContent {
  topic: string
  cards: Array<{
    id: string
    front: string
    back: string
    category: 'pathophysiology' | 'diagnosis' | 'management' | 'complications'
  }>
}

export type SparkContent = QuizContent | MysteryContent | MythContent | FlashcardContent

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
  quizHistory: Array<{ date: string; correct: boolean; topic: string }>
  mysteryProgress: Record<string, { cluesRevealed: number; solved: boolean }>
  flashcardProgress: Record<string, { knewIt: string[]; reviewLater: string[] }>
  seenSparks: string[] // spark IDs
}

export function getDefaultSparkState(): LearningSparkState {
  return {
    currentStreak: 0,
    lastInteractionDate: '',
    longestStreak: 0,
    quizHistory: [],
    mysteryProgress: {},
    flashcardProgress: {},
    seenSparks: [],
  }
}
