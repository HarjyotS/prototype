import { z } from 'zod';

/**
 * OSCE Domain Schemas for Structured Evaluation
 * Based on comprehensive OSCE rubric requirements
 */

// Domain 1: Communication Skills
export const CommunicationSkillsSchema = z.object({
  verbal: z.object({
    clear_articulation: z.boolean(),
    appropriate_pace: z.boolean(),
    appropriate_volume: z.boolean(),
    minimal_filler_words: z.boolean()
  }),
  nonverbal: z.object({
    eye_contact_percent: z.number().min(0).max(100),
    open_posture_percent: z.number().min(0).max(100),
    forward_lean: z.boolean(),
    nodding_frequency: z.enum(['appropriate', 'excessive', 'minimal']),
    facial_expressions: z.enum(['empathetic', 'neutral', 'inappropriate'])
  }),
  active_listening: z.object({
    allows_patient_to_speak: z.boolean(),
    interruption_count: z.number(),
    acknowledges_emotions: z.boolean(),
    summarizes_periodically: z.boolean(),
    clarifies_understanding: z.boolean()
  }),
  empathy: z.object({
    empathy_statements_count: z.number(),
    responds_to_emotions: z.boolean(),
    validates_feelings: z.boolean()
  }),
  score: z.number().min(0).max(10),
  notes: z.string()
});

// Domain 2: Patient Education and Counseling
export const PatientEducationSchema = z.object({
  assesses_understanding: z.boolean(),
  uses_plain_language: z.boolean(),
  avoids_jargon: z.boolean(),
  checks_health_literacy: z.boolean(),
  provides_written_materials: z.boolean(),
  teach_back_used: z.boolean(),
  addresses_concerns: z.boolean(),
  shared_decision_making: z.boolean(),
  treatment_plan: z.object({
    clearly_explained: z.boolean(),
    includes_risks_benefits: z.boolean(),
    discusses_alternatives: z.boolean(),
    addresses_barriers: z.boolean()
  }),
  follow_up: z.object({
    timeline_specified: z.boolean(),
    warning_signs_discussed: z.boolean(),
    contact_info_provided: z.boolean()
  }),
  score: z.number().min(0).max(10),
  notes: z.string()
});

// Domain 3: Professionalism
export const ProfessionalismSchema = z.object({
  punctuality: z.enum(['on_time', 'slightly_late', 'significantly_late', 'not_applicable']),
  dress_code: z.enum(['professional', 'acceptable', 'unprofessional', 'not_visible']),
  respect: z.object({
    patient_dignity: z.boolean(),
    cultural_sensitivity: z.boolean(),
    no_judgmental_language: z.boolean()
  }),
  boundaries: z.object({
    appropriate_touch: z.boolean(),
    professional_distance: z.boolean(),
    no_personal_disclosure: z.boolean()
  }),
  ethical_behavior: z.object({
    honesty: z.boolean(),
    transparency: z.boolean(),
    acknowledges_limitations: z.boolean()
  }),
  score: z.number().min(0).max(10),
  notes: z.string()
});

// Domain 4: Safety and Risk Management
export const SafetySchema = z.object({
  patient_identification: z.boolean(),
  hand_hygiene_compliance: z.boolean(),
  infection_control: z.boolean(),
  medication_safety: z.object({
    verifies_allergies: z.boolean(),
    checks_interactions: z.boolean(),
    appropriate_dosing: z.boolean(),
    discusses_side_effects: z.boolean()
  }),
  red_flags_recognized: z.array(z.string()),
  harm_prevention: z.object({
    suicide_risk_assessed: z.boolean().nullable(),
    domestic_violence_screened: z.boolean().nullable(),
    fall_risk_evaluated: z.boolean().nullable()
  }),
  error_management: z.object({
    acknowledges_uncertainty: z.boolean(),
    seeks_help_appropriately: z.boolean()
  }),
  score: z.number().min(0).max(10),
  notes: z.string()
});

// Comprehensive OSCE Evaluation (combines all domains)
export const ComprehensiveOSCESchema = z.object({
  session_metadata: z.object({
    session_id: z.string(),
    timestamp: z.string(),
    evaluator: z.enum(['ai', 'human', 'hybrid']),
    scenario_type: z.enum([
      'history_taking',
      'physical_exam',
      'patient_counseling',
      'medication_counseling',
      'breaking_bad_news',
      'shared_decision_making',
      'emergency_scenario'
    ])
  }),

  domains: z.object({
    communication_skills: CommunicationSkillsSchema,
    patient_education: PatientEducationSchema,
    professionalism: ProfessionalismSchema,
    safety: SafetySchema
  }),

  overall: z.object({
    total_score: z.number().min(0).max(40),  // Sum of 4 domains × 10 points
    percentage: z.number().min(0).max(100),
    grade: z.enum(['honors', 'high_pass', 'pass', 'fail']),
    overall_impression: z.string()
  }),

  actionable_feedback: z.array(z.object({
    domain: z.string(),
    priority: z.enum(['critical', 'high', 'medium', 'low']),
    observation: z.string(),
    recommendation: z.string(),
    example: z.string().optional()
  }))
});

// Helper function to convert score (0-10) to letter grade
export function convertScoreToGrade(score) {
  if (score >= 9) return 'A';
  if (score >= 8) return 'B+';
  if (score >= 7) return 'B';
  if (score >= 6) return 'C+';
  if (score >= 5) return 'C';
  return 'F';
}

// Helper function to calculate overall grade from percentage
export function calculateGrade(percentage) {
  if (percentage >= 90) return 'honors';
  if (percentage >= 80) return 'high_pass';
  if (percentage >= 70) return 'pass';
  return 'fail';
}

export default {
  CommunicationSkillsSchema,
  PatientEducationSchema,
  ProfessionalismSchema,
  SafetySchema,
  ComprehensiveOSCESchema,
  convertScoreToGrade,
  calculateGrade
};
