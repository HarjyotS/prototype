import OpenAI from 'openai';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';

/**
 * Audio Section Classification
 * Segments clinical interaction transcript into meaningful sections
 */

// Schema for audio section classification
const AudioSectionSchema = z.object({
  sections: z.array(z.object({
    start_time: z.number(),
    end_time: z.number(),
    section_type: z.enum([
      'greeting_opening',
      'history_taking',
      'physical_examination',
      'diagnosis_discussion',
      'treatment_explanation',
      'patient_education',
      'closing_followup'
    ]),
    confidence: z.number().min(0).max(1),
    summary: z.string()
  }))
});

/**
 * Classify audio sections based on transcript
 * @param {OpenAI} openai - OpenAI client instance
 * @param {Array} transcriptUtterances - Array of transcript utterances with timestamps
 * @returns {Promise<object>} Classified sections with start/end times
 */
export async function classifyAudioSections(openai, transcriptUtterances) {

  // Format transcript with timestamps
  const formattedTranscript = transcriptUtterances.map(u =>
    `[${u.start.toFixed(1)}s - ${u.end.toFixed(1)}s] ${u.speaker}: ${u.text}`
  ).join('\n');

  try {
    const completion = await openai.beta.chat.completions.parse({
      model: 'gpt-4o-2024-08-06',
      messages: [
        {
          role: 'system',
          content: `You are an expert at analyzing clinical interactions. Classify the transcript into sections:

Section Types:
- greeting_opening: Initial greeting and rapport building
- history_taking: Chief complaint and history gathering (symptoms, timeline, past medical history)
- physical_examination: Physical exam discussion or performance
- diagnosis_discussion: Differential diagnosis and assessment discussion
- treatment_explanation: Treatment plan and medication discussion
- patient_education: Patient counseling and education about condition/medications
- closing_followup: Closing statements, follow-up plans, and goodbyes

Provide accurate start and end times for each section based on the transcript timestamps.
Sections should not overlap and should cover the entire interaction.
Use confidence scores to indicate certainty (0.0 to 1.0).`
        },
        {
          role: 'user',
          content: `Classify this clinical interaction transcript into sections:

${formattedTranscript}

Identify section boundaries and provide a brief summary of each section.
Be precise with timestamps and ensure sections cover the entire interaction without gaps.`
        }
      ],
      response_format: zodResponseFormat(AudioSectionSchema, 'audio_classification')
    });

    return completion.choices[0].message.parsed;
  } catch (error) {
    console.error('Audio classification error:', error);
    // Return fallback classification
    return getFallbackClassification(transcriptUtterances);
  }
}

/**
 * Fallback classification when structured output fails
 * Uses simple heuristics to segment the transcript
 */
function getFallbackClassification(transcriptUtterances) {
  if (!transcriptUtterances || transcriptUtterances.length === 0) {
    return { sections: [] };
  }

  const totalDuration = transcriptUtterances[transcriptUtterances.length - 1].end;

  // Simple heuristic: divide into thirds
  const sections = [
    {
      start_time: 0,
      end_time: totalDuration * 0.3,
      section_type: 'greeting_opening',
      confidence: 0.5,
      summary: 'Opening and initial rapport building'
    },
    {
      start_time: totalDuration * 0.3,
      end_time: totalDuration * 0.7,
      section_type: 'patient_education',
      confidence: 0.5,
      summary: 'Main discussion and patient education'
    },
    {
      start_time: totalDuration * 0.7,
      end_time: totalDuration,
      section_type: 'closing_followup',
      confidence: 0.5,
      summary: 'Closing and follow-up discussion'
    }
  ];

  return { sections };
}

/**
 * Get section type for a specific timestamp
 * @param {Array} sections - Classified sections
 * @param {number} timestamp - Time in seconds
 * @returns {string} Section type or 'unknown'
 */
export function getSectionTypeAtTime(sections, timestamp) {
  const section = sections.find(s => timestamp >= s.start_time && timestamp <= s.end_time);
  return section ? section.section_type : 'unknown';
}

/**
 * Get section duration statistics
 * @param {Array} sections - Classified sections
 * @returns {object} Duration statistics by section type
 */
export function getSectionDurations(sections) {
  const durations = {};

  sections.forEach(section => {
    const duration = section.end_time - section.start_time;
    const type = section.section_type;

    if (!durations[type]) {
      durations[type] = 0;
    }
    durations[type] += duration;
  });

  return durations;
}

export default {
  classifyAudioSections,
  getSectionTypeAtTime,
  getSectionDurations
};
