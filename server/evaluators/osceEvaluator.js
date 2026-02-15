import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import {
  CommunicationSkillsSchema,
  PatientEducationSchema,
  ProfessionalismSchema,
  SafetySchema
} from '../schemas/osceDomains.js';

/**
 * OSCE Evaluators using OpenAI Structured Outputs
 * Provides consistent, reliable evaluation across all OSCE competency domains
 */

/**
 * Evaluate communication skills using structured outputs
 * @param {OpenAI} openai - OpenAI client instance
 * @param {Array} transcriptSegments - Array of transcript utterances
 * @param {Array} videoFrameAnalyses - Array of video frame analyses
 * @returns {Promise<object>} Structured communication skills evaluation
 */
export async function evaluateCommunicationSkills(openai, transcriptSegments, videoFrameAnalyses) {
  // Validate OpenAI client
  if (!openai || !openai.beta) {
    console.error('OpenAI client is invalid in evaluateCommunicationSkills');
    return getFallbackCommunicationEval(transcriptSegments, videoFrameAnalyses);
  }

  // Prepare context from transcript and video
  const transcript = transcriptSegments.map(s => `[${s.speaker}] ${s.text}`).join('\n');
  const videoSummary = summarizeVideoAnalyses(videoFrameAnalyses);

  try {
    const completion = await openai.beta.chat.completions.parse({
      model: 'gpt-4o-2024-08-06',
      messages: [
        {
          role: 'system',
          content: `You are an expert OSCE evaluator assessing communication skills in a clinical interaction.
Analyze the transcript and video observations to evaluate verbal and nonverbal communication, active listening, and empathy.
Provide specific, evidence-based scores and detailed notes citing specific examples from the interaction.`
        },
        {
          role: 'user',
          content: `Evaluate this clinical interaction:

TRANSCRIPT:
${transcript}

VIDEO OBSERVATIONS:
${videoSummary}

Provide a comprehensive communication skills evaluation with structured data.
- Score each dimension on evidence from the transcript and video
- Count specific instances (interruptions, empathy statements)
- Provide concrete percentages for nonverbal behaviors
- Include detailed notes with specific examples`
        }
      ],
      response_format: zodResponseFormat(CommunicationSkillsSchema, 'communication_evaluation')
    });

    return completion.choices[0].message.parsed;
  } catch (error) {
    console.error('Communication evaluation error:', error);
    // Return default evaluation if structured output fails
    return getFallbackCommunicationEval(transcriptSegments, videoFrameAnalyses);
  }
}

/**
 * Evaluate patient education using structured outputs
 * @param {OpenAI} openai - OpenAI client instance
 * @param {Array} transcriptSegments - Array of transcript utterances
 * @returns {Promise<object>} Structured patient education evaluation
 */
export async function evaluatePatientEducation(openai, transcriptSegments) {

  const transcript = transcriptSegments.map(s => `[${s.speaker}] ${s.text}`).join('\n');

  try {
    const completion = await openai.beta.chat.completions.parse({
      model: 'gpt-4o-2024-08-06',
      messages: [
        {
          role: 'system',
          content: `You are an expert OSCE evaluator assessing patient education and counseling.
Evaluate how well the clinician explains medical information, checks understanding, and engages in shared decision-making.
Look for teach-back techniques, plain language usage, and patient-centered communication.`
        },
        {
          role: 'user',
          content: `Evaluate patient education in this clinical interaction:

TRANSCRIPT:
${transcript}

Assess:
- Plain language usage vs. medical jargon
- Teach-back techniques (asking patient to explain back)
- Treatment plan clarity and completeness
- Shared decision-making approach
- Follow-up instructions clarity
- Addressing patient concerns and barriers

Provide evidence-based evaluation with specific examples from the transcript.`
        }
      ],
      response_format: zodResponseFormat(PatientEducationSchema, 'patient_education_evaluation')
    });

    return completion.choices[0].message.parsed;
  } catch (error) {
    console.error('Patient education evaluation error:', error);
    return getFallbackPatientEducationEval(transcriptSegments);
  }
}

/**
 * Evaluate professionalism using structured outputs
 * @param {OpenAI} openai - OpenAI client instance
 * @param {Array} transcriptSegments - Array of transcript utterances
 * @param {Array} videoFrameAnalyses - Array of video frame analyses
 * @returns {Promise<object>} Structured professionalism evaluation
 */
export async function evaluateProfessionalism(openai, transcriptSegments, videoFrameAnalyses) {

  const transcript = transcriptSegments.map(s => `[${s.speaker}] ${s.text}`).join('\n');
  const videoSummary = summarizeVideoAnalyses(videoFrameAnalyses);

  try {
    const completion = await openai.beta.chat.completions.parse({
      model: 'gpt-4o-2024-08-06',
      messages: [
        {
          role: 'system',
          content: `You are an expert OSCE evaluator assessing professionalism in clinical interactions.
Evaluate respect, boundaries, ethical behavior, and professional demeanor.
Look for cultural sensitivity, patient dignity, appropriate professional boundaries, and ethical conduct.`
        },
        {
          role: 'user',
          content: `Evaluate professionalism in this clinical interaction:

TRANSCRIPT:
${transcript}

VIDEO OBSERVATIONS:
${videoSummary}

Assess professional behavior, respect for patient dignity, cultural sensitivity, appropriate boundaries, and ethical conduct.
Provide evidence-based evaluation with specific examples.`
        }
      ],
      response_format: zodResponseFormat(ProfessionalismSchema, 'professionalism_evaluation')
    });

    return completion.choices[0].message.parsed;
  } catch (error) {
    console.error('Professionalism evaluation error:', error);
    return getFallbackProfessionalismEval();
  }
}

/**
 * Evaluate safety and risk management
 * @param {OpenAI} openai - OpenAI client instance
 * @param {Array} transcriptSegments - Array of transcript utterances
 * @returns {Promise<object>} Structured safety evaluation
 */
export async function evaluateSafety(openai, transcriptSegments) {

  const transcript = transcriptSegments.map(s => `[${s.speaker}] ${s.text}`).join('\n');

  try {
    const completion = await openai.beta.chat.completions.parse({
      model: 'gpt-4o-2024-08-06',
      messages: [
        {
          role: 'system',
          content: `You are an expert OSCE evaluator assessing safety and risk management in clinical interactions.
Evaluate patient identification, medication safety, red flag recognition, and harm prevention.
Safety is critical - be thorough in identifying any missed safety checks.`
        },
        {
          role: 'user',
          content: `Evaluate safety practices in this clinical interaction:

TRANSCRIPT:
${transcript}

Assess:
- Medication safety (allergy checks, interactions, dosing, side effects)
- Red flag symptom recognition
- Infection control and hand hygiene
- Patient identification
- Harm prevention (suicide risk, domestic violence, fall risk as applicable)
- Error management and seeking help when uncertain

Identify specific red flags mentioned or missed. Be thorough and evidence-based.`
        }
      ],
      response_format: zodResponseFormat(SafetySchema, 'safety_evaluation')
    });

    return completion.choices[0].message.parsed;
  } catch (error) {
    console.error('Safety evaluation error:', error);
    return getFallbackSafetyEval();
  }
}

// Helper function to summarize video analyses
function summarizeVideoAnalyses(videoFrameAnalyses) {
  if (!videoFrameAnalyses || videoFrameAnalyses.length === 0) {
    return 'No video analysis data available.';
  }

  const summary = {
    eyeContactFrames: 0,
    openPostureFrames: 0,
    forwardLeanFrames: 0,
    totalFrames: videoFrameAnalyses.length,
    keyObservations: []
  };

  videoFrameAnalyses.forEach(frame => {
    const text = (frame.analysis || '').toLowerCase();
    if (text.includes('eye contact')) summary.eyeContactFrames++;
    if (text.includes('open') && text.includes('posture')) summary.openPostureFrames++;
    if (text.includes('leaning forward') || text.includes('lean forward')) summary.forwardLeanFrames++;
  });

  const eyeContactPct = Math.round((summary.eyeContactFrames / summary.totalFrames) * 100);
  const openPosturePct = Math.round((summary.openPostureFrames / summary.totalFrames) * 100);
  const forwardLeanPct = Math.round((summary.forwardLeanFrames / summary.totalFrames) * 100);

  return `Video Analysis Summary:
- Eye contact observed in ${summary.eyeContactFrames}/${summary.totalFrames} frames (${eyeContactPct}%)
- Open posture observed in ${summary.openPostureFrames}/${summary.totalFrames} frames (${openPosturePct}%)
- Forward lean observed in ${summary.forwardLeanFrames}/${summary.totalFrames} frames (${forwardLeanPct}%)
- Total frames analyzed: ${summary.totalFrames}`;
}

// Fallback evaluations (in case structured output fails)
function getFallbackCommunicationEval(transcriptSegments, videoFrameAnalyses) {
  const clinicianUtterances = transcriptSegments.filter(s => s.speaker === 'Clinician');
  const interruptionCount = 0; // Would need overlap detection

  // Count empathy phrases
  const empathyPhrases = ['understand', 'sounds like', 'must be', 'i hear you', 'that\'s difficult'];
  const empathyCount = clinicianUtterances.filter(u =>
    empathyPhrases.some(phrase => u.text.toLowerCase().includes(phrase))
  ).length;

  // Calculate video metrics
  const summary = {
    eyeContactFrames: 0,
    openPostureFrames: 0,
    totalFrames: videoFrameAnalyses.length
  };

  videoFrameAnalyses.forEach(frame => {
    const text = (frame.analysis || '').toLowerCase();
    if (text.includes('eye contact')) summary.eyeContactFrames++;
    if (text.includes('open') && text.includes('posture')) summary.openPostureFrames++;
  });

  const eyeContactPct = Math.round((summary.eyeContactFrames / Math.max(summary.totalFrames, 1)) * 100);
  const openPosturePct = Math.round((summary.openPostureFrames / Math.max(summary.totalFrames, 1)) * 100);

  return {
    verbal: {
      clear_articulation: true,
      appropriate_pace: true,
      appropriate_volume: true,
      minimal_filler_words: true
    },
    nonverbal: {
      eye_contact_percent: eyeContactPct,
      open_posture_percent: openPosturePct,
      forward_lean: openPosturePct > 50,
      nodding_frequency: 'appropriate',
      facial_expressions: 'empathetic'
    },
    active_listening: {
      allows_patient_to_speak: true,
      interruption_count: interruptionCount,
      acknowledges_emotions: empathyCount > 0,
      summarizes_periodically: false,
      clarifies_understanding: true
    },
    empathy: {
      empathy_statements_count: empathyCount,
      responds_to_emotions: empathyCount > 0,
      validates_feelings: empathyCount > 0
    },
    score: Math.min(10, 6 + Math.floor(empathyCount / 2) + Math.floor(eyeContactPct / 20)),
    notes: 'Fallback evaluation - structured output unavailable'
  };
}

function getFallbackPatientEducationEval(transcriptSegments) {
  const clinicianUtterances = transcriptSegments.filter(s => s.speaker === 'Clinician');

  // Detect teach-back
  const teachBackUsed = clinicianUtterances.some(u =>
    /tell me|explain back|in your own words/i.test(u.text)
  );

  // Detect jargon
  const medicalJargon = ['hypertension', 'hyperlipidemia', 'cardiovascular'];
  const jargonCount = clinicianUtterances.filter(u =>
    medicalJargon.some(term => u.text.toLowerCase().includes(term))
  ).length;

  return {
    assesses_understanding: teachBackUsed,
    uses_plain_language: jargonCount < 3,
    avoids_jargon: jargonCount === 0,
    checks_health_literacy: false,
    provides_written_materials: false,
    teach_back_used: teachBackUsed,
    addresses_concerns: true,
    shared_decision_making: false,
    treatment_plan: {
      clearly_explained: true,
      includes_risks_benefits: false,
      discusses_alternatives: false,
      addresses_barriers: false
    },
    follow_up: {
      timeline_specified: false,
      warning_signs_discussed: false,
      contact_info_provided: false
    },
    score: teachBackUsed ? 8 : 6,
    notes: 'Fallback evaluation - structured output unavailable'
  };
}

function getFallbackProfessionalismEval() {
  return {
    punctuality: 'not_applicable',
    dress_code: 'not_visible',
    respect: {
      patient_dignity: true,
      cultural_sensitivity: true,
      no_judgmental_language: true
    },
    boundaries: {
      appropriate_touch: true,
      professional_distance: true,
      no_personal_disclosure: true
    },
    ethical_behavior: {
      honesty: true,
      transparency: true,
      acknowledges_limitations: false
    },
    score: 8,
    notes: 'Fallback evaluation - structured output unavailable'
  };
}

function getFallbackSafetyEval() {
  return {
    patient_identification: false,
    hand_hygiene_compliance: false,
    infection_control: false,
    medication_safety: {
      verifies_allergies: false,
      checks_interactions: false,
      appropriate_dosing: false,
      discusses_side_effects: false
    },
    red_flags_recognized: [],
    harm_prevention: {
      suicide_risk_assessed: null,
      domestic_violence_screened: null,
      fall_risk_evaluated: null
    },
    error_management: {
      acknowledges_uncertainty: false,
      seeks_help_appropriately: false
    },
    score: 5,
    notes: 'Fallback evaluation - structured output unavailable. Limited safety data assessed.'
  };
}

export default {
  evaluateCommunicationSkills,
  evaluatePatientEducation,
  evaluateProfessionalism,
  evaluateSafety
};
