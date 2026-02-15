import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Process video with MediaPipe Holistic
 * Returns quantitative pose, body language, and facial metrics
 */
export async function processWithMediaPipe(videoPath, sampleRate = 1.0) {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, '../../python/mediapipe_processor.py');
    const pythonPath = path.join(__dirname, '../../venv/bin/python');

    console.log(`[MediaPipe] Processing video: ${videoPath} at ${sampleRate} fps`);

    const python = spawn(pythonPath, [pythonScript, videoPath, sampleRate.toString()]);

    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
      // Log progress messages from Python
      console.log(`[MediaPipe] ${data.toString().trim()}`);
    });

    python.on('close', (code) => {
      if (code !== 0) {
        console.error(`[MediaPipe] Error (code ${code}): ${stderr}`);
        reject(new Error(`MediaPipe processing failed: ${stderr}`));
        return;
      }

      try {
        const result = JSON.parse(stdout);
        console.log(`[MediaPipe] Successfully processed ${result.frames_processed} frames`);
        resolve(result);
      } catch (error) {
        console.error(`[MediaPipe] Failed to parse output: ${error.message}`);
        reject(new Error(`Failed to parse MediaPipe output: ${error.message}`));
      }
    });

    python.on('error', (error) => {
      console.error(`[MediaPipe] Spawn error: ${error.message}`);
      reject(error);
    });
  });
}

/**
 * Aggregate MediaPipe results into OSCE-relevant metrics
 */
export function aggregateMediaPipeMetrics(mediapipeResults) {
  if (!mediapipeResults || !mediapipeResults.results || mediapipeResults.results.length === 0) {
    return null;
  }

  const frames = mediapipeResults.results;

  // Calculate percentages and averages
  let forwardLeanCount = 0;
  let armsCrossedCount = 0;
  let openPostureCount = 0;
  let noddingCount = 0;
  let gesturingCount = 0;
  let totalFrames = 0;

  let forwardLeanAngles = [];

  frames.forEach(frame => {
    if (!frame.has_person_detected) return;

    totalFrames++;

    // Pose metrics
    if (frame.pose) {
      if (frame.pose.forward_lean_angle !== null) {
        forwardLeanAngles.push(frame.pose.forward_lean_angle);
        if (frame.pose.forward_lean_angle > 10) { // >10 degrees = leaning forward
          forwardLeanCount++;
        }
      }

      if (frame.pose.arms_crossed) {
        armsCrossedCount++;
      }

      if (frame.pose.open_posture) {
        openPostureCount++;
      }
    }

    // Head movements
    if (frame.head && frame.head.is_nodding) {
      noddingCount++;
    }

    // Hand gestures
    if (frame.hands && frame.hands.gesturing) {
      gesturingCount++;
    }
  });

  const avgForwardLean = forwardLeanAngles.length > 0
    ? forwardLeanAngles.reduce((a, b) => a + b, 0) / forwardLeanAngles.length
    : 0;

  return {
    forward_lean_pct: Math.round((forwardLeanCount / Math.max(totalFrames, 1)) * 100),
    avg_forward_lean_angle: Math.round(avgForwardLean * 10) / 10,
    arms_crossed_pct: Math.round((armsCrossedCount / Math.max(totalFrames, 1)) * 100),
    open_posture_pct: Math.round((openPostureCount / Math.max(totalFrames, 1)) * 100),
    nodding_count: noddingCount,
    gesturing_pct: Math.round((gesturingCount / Math.max(totalFrames, 1)) * 100),
    total_frames_analyzed: totalFrames,
    frames_with_person: totalFrames
  };
}

export default {
  processWithMediaPipe,
  aggregateMediaPipeMetrics
};
