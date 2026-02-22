/**
 * TypeScript type definitions for analysis-related entities
 * Matches the Supabase database schema
 */

// Matches the todo_items table schema
export interface TodoItem {
  id: string;
  analysis_id: string;
  user_id: string;
  item_text: string;
  item_order: number;
  parent_item_id: string | null;
  is_checked: boolean;
  checked_at: string | null;
  category: 'physical_exam' | 'tests' | 'management' | 'differential' | string | null;
  priority: 'high' | 'medium' | 'low' | null;
  created_at: string;
  updated_at: string;
}

// Matches the analyses table schema
export interface Analysis {
  id: string;
  patient_history_id: string;
  user_id: string;
  todo_list_json: object;
  raw_analysis_text: string;
  model_used: string | null;
  analysis_version: string | null;
  processing_time_ms: number | null;
  total_items: number | null;
  completed_items: number;
  summary?: string;
  risk_level?: string;
  created_at: string;
  updated_at: string;
  user_rating: number | null;
  user_feedback: string | null;
  deleted_at: string | null;
}

// Matches the patient_histories table schema
export interface PatientHistory {
  id: string;
  user_id: string;
  patient_name: string | null;
  patient_identifier: string | null;
  history_text: string;
  word_count: number | null;
  status: 'draft' | 'analyzing' | 'completed' | 'error';
  created_at: string;
  updated_at: string;
  analyzed_at: string | null;
  deleted_at: string | null;
  metadata: Record<string, unknown>;
}

// Parsed section from raw_analysis_text
export interface AnalysisSection {
  title: string;
  content: string;
  order: number;
}

// Component Props
export interface AnalysisCardProps {
  analysis: Analysis;
  todoItems: TodoItem[];
  patientHistory: PatientHistory;
}

export interface TodoListDisplayProps {
  todoItems: TodoItem[];
  onToggle: (id: string, isChecked: boolean) => void;
}

export interface TodoItemProps {
  item: TodoItem;
  children?: TodoItem[];
  onToggle: (id: string, isChecked: boolean) => void;
  depth: number;
}

export interface ProgressBarProps {
  completed: number;
  total: number;
}

export interface AnalysisMetaProps {
  analysis: Analysis;
}

export interface AnalysisActionsProps {
  analysisId: string;
  onPrint: () => void;
  onExportPdf: () => Promise<void>;
  onRegenerate: () => Promise<void>;
}

// API Request/Response types
export interface ToggleTodoRequest {
  todo_item_id: string;
  is_checked: boolean;
}

export interface ToggleTodoResponse {
  success: boolean;
  error?: string;
}

export interface RegenerateAnalysisResponse {
  success: boolean;
  new_analysis_id?: string;
  error?: string;
}
