import { RealtimeVision } from 'overshoot';

/**
 * Process video file with Overshoot on client-side
 * @param {File} videoFile - The video file to process
 * @param {string} jobId - The server job ID to send results to
 * @param {Function} onProgress - Callback for progress updates
 * @returns {Promise<Array>} - Array of Overshoot results
 */
export async function processVideoWithOvershoot(videoFile, jobId, onProgress) {
  return new Promise((resolve, reject) => {
    const overshootResults = [];
    let isComplete = false;

    try {
      console.log(`[Overshoot] Starting video analysis for job ${jobId}...`);

      // Initialize Overshoot RealtimeVision
      const vision = new RealtimeVision({
        apiKey: import.meta.env.VITE_OVERSHOOT_API_KEY,
        source: { type: 'video', file: videoFile },
        model: 'Qwen/Qwen3-VL-30B-A3B-Instruct',
        prompt: `Analyze this clinical interaction video. Detect and track:
1. Eye contact between clinician and patient
2. Body language and posture (open, closed, leaning forward/away)
3. Gestures and hand movements
4. Facial expressions and empathy markers
5. Physical proximity and engagement
6. Any concerning behaviors (arms crossed, turned away, interruptions)

Return structured data with timestamps for each observation.`,
        clipProcessing: {
          sampling_ratio: 0.8,
          clip_length_seconds: 0.5,
          delay_seconds: 0.2
        },
        onResult: (result) => {
          console.log('[Overshoot] Raw result received:', JSON.stringify(result, null, 2));

          // Extract analysis text from various possible fields
          const analysisText = result.response ||
                               result.text ||
                               result.content ||
                               result.result ||
                               (typeof result === 'string' ? result : null);

          // Store result
          const processedResult = {
            timestamp: result.timestamp || Date.now(),
            frameNumber: result.frame_number || result.frameNumber,
            timeInVideo: result.time_in_video || result.timeInVideo,
            analysis: analysisText,
            rawResult: result
          };

          overshootResults.push(processedResult);

          console.log(`[Overshoot] Processed result #${overshootResults.length}:`, {
            frameNumber: processedResult.frameNumber,
            timeInVideo: processedResult.timeInVideo,
            analysisPreview: analysisText?.substring(0, 100)
          });

          // Update progress immediately
          if (onProgress) {
            onProgress({
              resultsCount: overshootResults.length,
              latestResult: {
                ...result,
                response: analysisText,
                text: analysisText
              }
            });
          }
        }
      });

      // Start processing
      vision.start()
        .then(async () => {
          isComplete = true;
          console.log(`[Overshoot] Processing complete. Collected ${overshootResults.length} results.`);

          // Send results to server
          try {
            const response = await fetch(`/api/overshoot-results/${jobId}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ results: overshootResults })
            });

            const data = await response.json();
            console.log('[Overshoot] Results sent to server:', data);

            resolve(overshootResults);
          } catch (error) {
            console.error('[Overshoot] Failed to send results to server:', error);
            reject(error);
          }
        })
        .catch((error) => {
          console.error('[Overshoot] Processing error:', error);
          isComplete = true;
          reject(error);
        });

      // Safety timeout after 10 minutes
      setTimeout(() => {
        if (!isComplete) {
          console.warn('[Overshoot] Processing timeout');
          vision.stop?.();
          reject(new Error('Overshoot processing timeout'));
        }
      }, 600000);

    } catch (error) {
      console.error('[Overshoot] Initialization error:', error);
      reject(error);
    }
  });
}
