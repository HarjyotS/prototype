import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { createClient } from '@deepgram/sdk';
import OpenAI from 'openai';
import ytdl from '@distube/ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import sharp from 'sharp';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { VideoCacheDB } from './database.js';
import { calculateSamplingStrategy, getVideoDuration } from './config/sampling.js';
import {
  evaluateCommunicationSkills,
  evaluatePatientEducation,
  evaluateProfessionalism,
  evaluateSafety
} from './evaluators/osceEvaluator.js';
import { classifyAudioSections } from './evaluators/audioClassifier.js';
import { calculateGrade } from './schemas/osceDomains.js';
import { processWithMediaPipe, aggregateMediaPipeMetrics } from './processors/mediapipeProcessor.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize global OpenAI client for OSCE evaluations
let openaiClient;
try {
  if (!process.env.OPANN) {
    console.error('ERROR: OPANN environment variable is not set! OpenAI evaluations will fail.');
  } else {
    openaiClient = new OpenAI({
      apiKey: process.env.OPANN
    });
    console.log('✓ OpenAI client initialized successfully');
  }
} catch (error) {
  console.error('ERROR: Failed to initialize OpenAI client:', error.message);
}

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for large analysis results
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});

// Health check
app.get('/api/health', (req, res) => {
  const status = {
    status: 'ok',
    message: 'SimInsight API is running',
    apis: {
      openai: !!process.env.OPANN,
      deepgram: !!process.env.DEEPGRAM_API_KEY
    }
  };
  res.json(status);
});

// Video analysis endpoint using Overshoot
app.post('/api/analyze-video', upload.single('video'), async (req, res) => {
  try {
    if (!process.env.OVERSHOOT_API_KEY) {
      return res.status(400).json({
        error: 'Overshoot API key not configured. Please set OVERSHOOT_API_KEY in .env file.'
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const overshootResults = [];
    let isProcessingComplete = false;

    // Initialize Overshoot vision analysis
    const vision = new RealtimeVision({
      apiKey: process.env.OVERSHOOT_API_KEY,
      source: { type: 'video', file: req.file.path },
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
        console.log('Vision analysis result:', result);
        overshootResults.push({
          timestamp: result.timestamp || Date.now(),
          frameNumber: result.frame_number,
          analysis: result.response || result.text,
          rawResult: result
        });
      }
    });

    // Start analysis (this is async)
    vision.start().then(() => {
      isProcessingComplete = true;
      console.log(`Overshoot analysis complete. Collected ${overshootResults.length} results.`);
    }).catch(error => {
      console.error('Overshoot processing error:', error);
      isProcessingComplete = true;
    });

    // Return immediately with job ID for polling
    res.json({
      success: true,
      message: 'Video analysis started with Overshoot',
      file: req.file.filename,
      jobId: req.file.filename,
      pollUrl: `/api/analysis-status/${req.file.filename}`
    });

    // Store results in memory (in production, use Redis or database)
    global.analysisJobs = global.analysisJobs || {};
    global.analysisJobs[req.file.filename] = {
      status: 'processing',
      results: overshootResults,
      isComplete: false,
      filePath: req.file.path
    };

    // Monitor completion
    const checkInterval = setInterval(() => {
      if (isProcessingComplete || overshootResults.length > 0) {
        global.analysisJobs[req.file.filename].status = isProcessingComplete ? 'complete' : 'processing';
        global.analysisJobs[req.file.filename].results = overshootResults;
        global.analysisJobs[req.file.filename].isComplete = isProcessingComplete;

        if (isProcessingComplete) {
          clearInterval(checkInterval);
          // Clean up file after 1 hour
          setTimeout(() => {
            if (fs.existsSync(req.file.path)) {
              fs.unlinkSync(req.file.path);
            }
            delete global.analysisJobs[req.file.filename];
          }, 3600000);
        }
      }
    }, 1000);

  } catch (error) {
    console.error('Video analysis error:', error);
    res.status(500).json({
      error: 'Video analysis failed',
      details: error.message
    });
  }
});

// Analysis status endpoint
app.get('/api/analysis-status/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = global.analysisJobs?.[jobId];

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json({
    success: true,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    isComplete: job.status === 'complete',
    resultsCount: job.overshootResults?.length || 0,
    overshootResults: job.overshootResults || [], // Include results for live progress
    transcriptResults: job.transcriptResults,
    finalResults: job.finalResults,
    error: job.error
  });
});

// Endpoint for client to send Overshoot results
app.post('/api/overshoot-results/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    const { results } = req.body;

    const job = global.analysisJobs?.[jobId];

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Store the results from client
    job.overshootResults = results || [];
    job.waitingForClientAnalysis = false;
    job.progress = 80;

    console.log(`[${jobId}] Received ${results?.length || 0} Overshoot results from client`);

    res.json({
      success: true,
      message: 'Overshoot results received',
      resultsCount: results?.length || 0
    });

  } catch (error) {
    console.error('Error receiving Overshoot results:', error);
    res.status(500).json({
      error: 'Failed to process Overshoot results',
      details: error.message
    });
  }
});

// Transcription endpoint using Deepgram
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!process.env.DEEPGRAM_API_KEY) {
      return res.status(400).json({
        error: 'Deepgram API key not configured. Please set DEEPGRAM_API_KEY in .env file.'
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

    // Read the audio file
    const audioBuffer = fs.readFileSync(req.file.path);

    // Transcribe with Deepgram
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      {
        model: 'nova-2-medical',
        smart_format: true,
        punctuate: true,
        diarize: true,
        utterances: true,
        detect_language: false,
        language: 'en-US',
      }
    );

    if (error) {
      console.error('Deepgram error:', error);
      return res.status(500).json({ error: 'Transcription failed', details: error });
    }

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    // Format response
    const transcript = result.results.channels[0].alternatives[0];
    const utterances = result.results.utterances || [];

    const formattedTranscript = utterances.map((utterance) => ({
      time: formatTimestamp(utterance.start),
      speaker: `Speaker ${utterance.speaker}`,
      text: utterance.transcript,
      start: utterance.start,
      end: utterance.end,
      confidence: utterance.confidence
    }));

    res.json({
      success: true,
      transcript: formattedTranscript,
      fullText: transcript.transcript,
      words: transcript.words,
      confidence: transcript.confidence
    });

  } catch (error) {
    console.error('Transcription error:', error);
    res.status(500).json({
      error: 'Transcription failed',
      details: error.message
    });
  }
});

// YouTube import endpoint - downloads and automatically starts processing
app.post('/api/youtube-import', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'YouTube URL required' });
    }

    // Check API keys
    if (!process.env.OPANN || !process.env.DEEPGRAM_API_KEY) {
      return res.status(400).json({
        error: 'API keys not configured. Please set OPENAI_API_KEY and DEEPGRAM_API_KEY in .env file.'
      });
    }

    // Validate YouTube URL
    if (!ytdl.validateURL(url)) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    // Get video info
    const info = await ytdl.getInfo(url);
    const videoTitle = info.videoDetails.title;
    const videoId = info.videoDetails.videoId;
    const videoDuration = parseInt(info.videoDetails.lengthSeconds);

    console.log(`YouTube video requested: ${videoTitle} (${videoId})`);

    // CHECK CACHE FIRST (only if caching is enabled)
    const enableCache = process.env.ENABLE_VIDEO_CACHE === 'true';

    if (enableCache) {
      const cachedVideo = VideoCacheDB.getCachedVideo(videoId);

      if (cachedVideo && fs.existsSync(cachedVideo.file_path)) {
        console.log(`✓ Video found in cache: ${cachedVideo.file_path}`);

        // Update access time
        VideoCacheDB.touchVideo(videoId);

        // Start processing with cached file
        const jobId = `job-yt-${videoId}-${Date.now()}`;
        const videoPath = cachedVideo.file_path;
        const audioPath = videoPath.replace(/\.[^/.]+$/, '.wav');

        // Initialize job tracking
        global.analysisJobs = global.analysisJobs || {};
        global.analysisJobs[jobId] = {
          status: 'processing',
          stage: 'audio_extraction',
          progress: 0,
          overshootResults: [],
          transcriptResults: null,
          finalResults: null,
          error: null,
          videoTitle: videoTitle,
          fromCache: true
        };

        // Return immediately
        res.json({
          success: true,
          title: videoTitle,
          videoId: videoId,
          jobId: jobId,
          pollUrl: `/api/analysis-status/${jobId}`,
          message: 'Using cached video, processing started',
          cached: true
        });

        // Start async processing
        processVideoFull(jobId, videoPath, audioPath).catch(error => {
          console.error('Full analysis error:', error);
          global.analysisJobs[jobId].status = 'error';
          global.analysisJobs[jobId].error = error.message;
        });

        return;
      }
    }

    console.log(enableCache ? 'Video not in cache, downloading...' : 'Cache disabled, downloading fresh video...');

    // Create uploads directory if it doesn't exist
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Output file path WITHOUT timestamp for caching
    const videoPath = path.join(uploadDir, `yt-${videoId}.mp4`);

    // Download video with both audio and video
    console.log('Starting download...');

    const stream = ytdl(url, {
      quality: 'highest',
      filter: 'audioandvideo'
    });

    const writeStream = fs.createWriteStream(videoPath);
    stream.pipe(writeStream);

    // Wait for download to complete
    await new Promise((resolve, reject) => {
      writeStream.on('finish', () => {
        console.log('Download complete!');
        resolve();
      });
      writeStream.on('error', reject);
      stream.on('error', reject);
    });

    // Get file size
    const fileStats = fs.statSync(videoPath);

    // CACHE THE VIDEO (only if caching is enabled)
    if (enableCache) {
      VideoCacheDB.cacheVideo({
        videoId: videoId,
        sourceType: 'youtube',
        sourceUrl: url,
        filePath: videoPath,
        fileSize: fileStats.size,
        duration: videoDuration,
        title: videoTitle
      });

      console.log(`✓ Video cached: ${videoPath}`);
    } else {
      console.log(`✓ Video downloaded (not cached): ${videoPath}`);
    }

    // Now automatically start processing the downloaded video
    const jobId = `job-yt-${videoId}-${Date.now()}`;
    const audioPath = videoPath.replace(/\.[^/.]+$/, '.wav');

    // Initialize job tracking
    global.analysisJobs = global.analysisJobs || {};
    global.analysisJobs[jobId] = {
      status: 'processing',
      stage: 'audio_extraction',
      progress: 0,
      overshootResults: [],
      transcriptResults: null,
      finalResults: null,
      error: null,
      videoTitle: videoTitle,
      fromCache: false
    };

    // Return immediately with job ID
    res.json({
      success: true,
      title: videoTitle,
      videoId: videoId,
      jobId: jobId,
      pollUrl: `/api/analysis-status/${jobId}`,
      message: 'YouTube video downloaded and processing started',
      cached: false
    });

    // Start async processing
    processVideoFull(jobId, videoPath, audioPath).catch(error => {
      console.error('Full analysis error:', error);
      global.analysisJobs[jobId].status = 'error';
      global.analysisJobs[jobId].error = error.message;
    });

  } catch (error) {
    console.error('YouTube import error:', error);
    res.status(500).json({
      error: 'Failed to import YouTube video',
      details: error.message
    });
  }
});

// Combined analysis endpoint - processes video with both Overshoot and Deepgram
app.post('/api/analyze-full', upload.single('video'), async (req, res) => {
  try {
    // Check API keys
    if (!process.env.OPANN || !process.env.DEEPGRAM_API_KEY) {
      return res.status(400).json({
        error: 'API keys not configured. Please set OPENAI_API_KEY and DEEPGRAM_API_KEY in .env file.'
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const videoPath = req.file.path;
    const audioPath = videoPath.replace(/\.[^/.]+$/, '.wav');

    // Initialize job tracking
    global.analysisJobs = global.analysisJobs || {};
    global.analysisJobs[jobId] = {
      status: 'processing',
      stage: 'audio_extraction',
      progress: 0,
      overshootResults: [],
      transcriptResults: null,
      finalResults: null,
      error: null
    };

    // Return immediately with job ID
    res.json({
      success: true,
      message: 'Full analysis pipeline started',
      jobId: jobId,
      pollUrl: `/api/analysis-status/${jobId}`,
      stages: [
        'Audio extraction & transcription (Deepgram)',
        'Speaker diarization',
        'Video analysis (Overshoot)',
        'Behavioral scoring',
        'Report generation'
      ]
    });

    // Start async processing
    processVideoFull(jobId, videoPath, audioPath).catch(error => {
      console.error('Full analysis error:', error);
      global.analysisJobs[jobId].status = 'error';
      global.analysisJobs[jobId].error = error.message;
    });

  } catch (error) {
    console.error('Full analysis error:', error);
    res.status(500).json({
      error: 'Full analysis failed',
      details: error.message
    });
  }
});

// Helper function to calculate frame difference using sharp
async function calculateFrameDifference(framePath1, framePath2) {
  try {
    // Get image statistics for both frames
    const [img1, img2] = await Promise.all([
      sharp(framePath1).resize(64, 64).raw().toBuffer(),
      sharp(framePath2).resize(64, 64).raw().toBuffer()
    ]);

    // Calculate pixel difference (simple but effective)
    let totalDiff = 0;
    for (let i = 0; i < img1.length; i++) {
      totalDiff += Math.abs(img1[i] - img2[i]);
    }

    // Normalize to 0-1 range
    const normalizedDiff = totalDiff / (img1.length * 255);
    return normalizedDiff;
  } catch (error) {
    console.error('Frame difference calculation error:', error);
    return 1.0; // Assume different if error
  }
}

// Helper function to filter frames by difference threshold
async function filterSignificantFrames(frameFiles, framesDir, threshold = 0.1, jobId = null) {
  if (frameFiles.length === 0) return [];

  const significantFrames = [frameFiles[0]]; // Always keep first frame

  if (jobId) {
    console.log(`[${jobId}] Analyzing ${frameFiles.length} frames for significant changes (threshold: ${threshold})...`);
  }

  // Compare each frame to the previous significant frame
  let lastSignificantFrame = frameFiles[0];

  for (let i = 1; i < frameFiles.length; i++) {
    const currentFramePath = path.join(framesDir, frameFiles[i]);
    const lastFramePath = path.join(framesDir, lastSignificantFrame);

    const diff = await calculateFrameDifference(lastFramePath, currentFramePath);

    if (diff > threshold) {
      significantFrames.push(frameFiles[i]);
      lastSignificantFrame = frameFiles[i];
    }

    // Log progress every 50 frames
    if (jobId && i % 50 === 0) {
      console.log(`[${jobId}] Frame differencing progress: ${i}/${frameFiles.length} (${significantFrames.length} significant)`);
    }
  }

  if (jobId) {
    const reduction = ((1 - significantFrames.length / frameFiles.length) * 100).toFixed(1);
    console.log(`[${jobId}] Frame differencing complete: ${significantFrames.length}/${frameFiles.length} frames kept (${reduction}% reduction)`);
  }

  return significantFrames;
}

// Helper function to call RunPod serverless endpoint for vision analysis
async function callRunPodVision(base64Images, prompt, jobId = null) {
  const RUNPOD_ENDPOINT = 'https://api.runpod.ai/v2/r8pctskc7c4a8t/runsync';
  const RUNPOD_API_KEY = process.env.RUNPOD;

  try {
    // Process all images in PARALLEL to max out workers (10 concurrent)
    const promises = base64Images.map(async (image, i) => {
      const imagePrompt = `${prompt}\n\nAnalyze frame ${i + 1}. Brief bullet points.`;

      const response = await fetch(RUNPOD_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RUNPOD_API_KEY}`
        },
        body: JSON.stringify({
          input: {
            prompt: imagePrompt,
            image: image  // Single base64 image
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`RunPod API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();

      // Extract content from RunPod response
      let rawContent = '';

      // RunPod wraps the output in various ways - extract the actual text
      if (data.output) {
        rawContent = data.output;
      } else if (data.result) {
        rawContent = data.result;
      } else {
        rawContent = data;
      }

      // If it's an object with choices (OpenAI-style response), extract the message
      if (typeof rawContent === 'object' && rawContent.choices && Array.isArray(rawContent.choices)) {
        if (rawContent.choices[0]?.message?.content) {
          rawContent = rawContent.choices[0].message.content;
        } else if (rawContent.choices[0]?.text) {
          rawContent = rawContent.choices[0].text;
        }
      }

      // Convert to string if not already
      let content = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent);

      // Aggressively clean up the content
      content = content
        .trim()
        // Remove leading/trailing quotes
        .replace(/^["']|["']$/g, '')
        // Remove escape sequences
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\')
        // Remove trailing metadata patterns like: ,"id":"cmpl-xxx","created":123,...
        .replace(/,\s*["']?(id|model|object|created|usage|finish_reason|system_fingerprint)["']?\s*:\s*[^,}]+(?=[,}])/g, '')
        // Remove remaining JSON wrapper artifacts
        .replace(/^[{\[]|[}\]]$/g, '')
        .trim();

      return content;
    });

    // Wait for ALL images to complete in parallel
    const analyses = await Promise.all(promises);

    // Join all analyses with "---" separator as expected by the parser
    return analyses.join('\n---\n');

  } catch (error) {
    if (jobId) {
      console.error(`[${jobId}] RunPod API error:`, error.message);
    }
    throw error;
  }
}

// Helper function to parse and structure RunPod vision outputs using OpenAI
async function parseVisionOutputsWithOpenAI(rawOutputs, transcript = null, jobId = null) {
  try {
    if (!rawOutputs || rawOutputs.length === 0) {
      return [];
    }

    // Batch process in groups of 10 to reduce API calls
    const BATCH_SIZE = 10;
    const batches = [];

    for (let i = 0; i < rawOutputs.length; i += BATCH_SIZE) {
      batches.push(rawOutputs.slice(i, i + BATCH_SIZE));
    }

    const allParsedResults = [];

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];

      // Create a combined prompt with all frames in this batch + transcript context
      const combinedInput = batch.map((output, idx) => {
        let frameContext = `Frame ${output.frameNumber} (${output.timeInVideo}s):\nVisual: ${output.analysis}`;

        // Add transcript context if available
        if (transcript && transcript.length > 0) {
          const timeWindow = 5; // 5 second window around frame
          const relevantUtterances = transcript.filter(u =>
            u.start <= output.timeInVideo + timeWindow &&
            u.end >= output.timeInVideo - timeWindow
          );

          if (relevantUtterances.length > 0) {
            const dialogue = relevantUtterances
              .map(u => `${u.speaker}: "${u.text}"`)
              .join('\n');
            frameContext += `\n\nDialogue at this time:\n${dialogue}`;
          }
        }

        return frameContext;
      }).join('\n\n---\n\n');

      if (jobId) {
        console.log(`[${jobId}] Parsing batch ${batchIndex + 1}/${batches.length} with OpenAI (${batch.length} frames)...`);
      }

      // Use OpenAI to parse and structure the output
      const completion = await callOpenAIWithRetry(async () => {
        return await openaiClient.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are analyzing clinical interactions. Extract structured observations correlating visual behavior with dialogue. Return clean, professional bullet points without escape characters or metadata.'
            },
            {
              role: 'user',
              content: `Analyze these video frames WITH their corresponding dialogue. Correlate what's being said with nonverbal behavior. Remove any JSON artifacts, escape sequences, or metadata. Return clean, contextual observations:

${combinedInput}

For each frame, extract and correlate:
- Eye contact & gaze (does it match engagement in conversation?)
- Body language & posture (open/closed relative to what's being discussed?)
- Gestures (illustrative of speech? Defensive? Emphatic?)
- Facial expressions (match emotional content of dialogue?)
- Engagement level (active listening cues when patient speaks?)
- Behavioral concerns (mismatched affect, poor listening, interrupting visually?)

Format as:
Frame [number] ([time]s):
• Eye Contact: [observation, noting correlation with dialogue]
• Body Language: [observation, noting what's being discussed]
• Gestures: [observation, correlation to speech]
• Expressions: [observation, match to dialogue emotion]
• Engagement: [observation, listening cues]
• Concerns: [specific concerns or "None"]`
            }
          ],
          temperature: 0.3,
          max_tokens: 2000
        });
      }, 3, jobId);

      const parsedText = completion.choices[0].message.content;

      // Split back into individual frame results
      const frameBlocks = parsedText.split(/Frame \d+/);

      batch.forEach((output, idx) => {
        // Find the corresponding block (idx + 1 because first split item is empty)
        const blockText = frameBlocks[idx + 1] || parsedText;

        allParsedResults.push({
          ...output,
          analysis: blockText.trim(),
          rawAnalysis: output.analysis // Keep original for debugging
        });
      });
    }

    if (jobId) {
      console.log(`[${jobId}] OpenAI parsing complete: ${allParsedResults.length} frames structured`);
    }

    return allParsedResults;

  } catch (error) {
    if (jobId) {
      console.error(`[${jobId}] OpenAI parsing error:`, error.message);
    }
    // If OpenAI parsing fails, return original outputs
    return rawOutputs;
  }
}

// Helper function to classify speakers using OpenAI
async function classifySpeakers(utterances, jobId = null) {
  try {
    if (!utterances || utterances.length === 0) {
      return utterances;
    }

    // Get unique speaker IDs
    const speakerIds = [...new Set(utterances.map(u => u.speaker))];

    if (speakerIds.length === 1) {
      // Only one speaker - assume it's the clinician
      if (jobId) {
        console.log(`[${jobId}] Only one speaker detected, assuming Clinician`);
      }
      return utterances.map(u => ({ ...u, speaker: 'Clinician' }));
    }

    // Sample utterances from each speaker for classification
    const speakerSamples = {};
    speakerIds.forEach(speakerId => {
      const speakerUtterances = utterances.filter(u => u.speaker === speakerId);
      // Take first 5 utterances from each speaker
      speakerSamples[speakerId] = speakerUtterances.slice(0, 5)
        .map(u => u.transcript)
        .join(' ');
    });

    if (jobId) {
      console.log(`[${jobId}] Classifying ${speakerIds.length} speakers using OpenAI...`);
    }

    // Ask OpenAI to classify speakers
    const completion = await callOpenAIWithRetry(async () => {
      return await openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are analyzing a clinical interaction transcript to identify speakers. Determine which speaker is the healthcare provider (Clinician) and which is the patient based on their language, medical terminology, and role indicators.'
          },
          {
            role: 'user',
            content: `Analyze these speaker samples and identify which speaker number is the Clinician and which is the Patient.

${speakerIds.map(id => `Speaker ${id}: "${speakerSamples[id]}"`).join('\n\n')}

Consider:
- Medical professionals use clinical terminology, ask assessment questions, give instructions
- Patients describe symptoms, ask questions about their condition, respond to clinician
- Clinicians often start with greetings, introductions, or procedural statements
- Students may narrate their actions ("I wash my hands...", "I check...")

Respond in this exact JSON format:
{
  "clinician_speaker": [speaker number],
  "patient_speaker": [speaker number],
  "reasoning": "brief explanation"
}`
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 300
      });
    }, 3, jobId);

    const classification = JSON.parse(completion.choices[0].message.content);

    if (jobId) {
      console.log(`[${jobId}] Speaker classification: ${classification.reasoning}`);
    }

    // Map speakers to roles
    const speakerMap = {};
    speakerMap[classification.clinician_speaker] = 'Clinician';
    speakerMap[classification.patient_speaker] = 'Patient';

    // Handle any additional speakers (mark as Unknown)
    speakerIds.forEach(id => {
      if (!speakerMap[id]) {
        speakerMap[id] = `Speaker ${id}`;
      }
    });

    // Relabel utterances
    return utterances.map(u => ({
      ...u,
      speaker: speakerMap[u.speaker] || `Speaker ${u.speaker}`
    }));

  } catch (error) {
    if (jobId) {
      console.error(`[${jobId}] Speaker classification error:`, error.message);
    }
    // Fallback to original naive mapping
    return utterances.map(u => ({
      ...u,
      speaker: u.speaker === 0 ? 'Clinician' : 'Patient'
    }));
  }
}

// Helper function to retry OpenAI API calls with exponential backoff (kept for OSCE evals)
async function callOpenAIWithRetry(apiCall, maxRetries = 5, jobId = null) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      // Check if it's a rate limit error
      const isRateLimitError = error.status === 429 || error.message?.includes('Rate limit');

      if (!isRateLimitError || attempt === maxRetries) {
        throw error; // Not a rate limit error or out of retries
      }

      // Extract wait time from error message or use exponential backoff
      let waitTime = 1000 * Math.pow(2, attempt); // Default: exponential backoff
      const match = error.message?.match(/try again in (\d+)ms/);
      if (match) {
        waitTime = parseInt(match[1]) + 100; // Add 100ms buffer
      }

      if (jobId) {
        console.log(`[${jobId}] Rate limit hit, retrying in ${waitTime}ms (attempt ${attempt + 1}/${maxRetries})...`);
      }

      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

// Full video processing function
async function processVideoFull(jobId, videoPath, audioPath) {
  const job = global.analysisJobs[jobId];

  try {
    // Always run fresh analysis (caching disabled per user request)
    const videoFilename = path.basename(videoPath);
    console.log(`[${jobId}] Running fresh analysis for ${videoFilename}...`);

    // Step 1: Extract audio from video
    job.stage = 'audio_extraction';
    job.progress = 10;
    console.log(`[${jobId}] Extracting audio...`);

    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .output(audioPath)
        .audioCodec('pcm_s16le')
        .audioFrequency(16000)
        .audioChannels(1)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    // Step 2: Transcribe with Deepgram
    job.stage = 'transcription';
    job.progress = 30;
    console.log(`[${jobId}] Transcribing with Deepgram...`);

    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    const audioBuffer = fs.readFileSync(audioPath);

    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      {
        model: 'nova-2-medical',
        smart_format: true,
        punctuate: true,
        diarize: true,
        utterances: true,
        detect_language: false,
        language: 'en-US',
      }
    );

    if (error) {
      throw new Error(`Deepgram error: ${JSON.stringify(error)}`);
    }

    const transcript = result.results.channels[0].alternatives[0];
    const utterances = result.results.utterances || [];

    // Prepare utterances with raw speaker IDs
    const rawUtterances = utterances.map(u => ({
      time: formatTimestamp(u.start),
      speaker: u.speaker,  // Keep raw speaker number for now
      text: u.transcript,
      transcript: u.transcript,  // Add this for classification
      start: u.start,
      end: u.end,
      confidence: u.confidence
    }));

    // Classify speakers using AI
    console.log(`[${jobId}] Classifying speakers based on content...`);
    const classifiedUtterances = await classifySpeakers(rawUtterances, jobId);

    job.transcriptResults = {
      utterances: classifiedUtterances,
      fullText: transcript.transcript,
      words: transcript.words
    };

    // Step 3: Video analysis with OpenAI Vision + MediaPipe (parallel)
    job.stage = 'video_analysis';
    job.progress = 50;
    console.log(`[${jobId}] Starting parallel video analysis (OpenAI Vision + MediaPipe)...`);

    // Start MediaPipe processing in parallel (non-blocking)
    console.log(`[${jobId}] Starting MediaPipe quantitative analysis in parallel...`);
    const mediapipePromise = processWithMediaPipe(videoPath, 0.5)
      .catch(error => {
        console.warn(`[${jobId}] MediaPipe processing failed: ${error.message}`);
        return null; // Continue even if MediaPipe fails
      });

    const overshootResults = [];
    const framesDir = path.join(__dirname, '../uploads/frames', jobId);

    // Create frames directory
    if (!fs.existsSync(framesDir)) {
      fs.mkdirSync(framesDir, { recursive: true });
    }

    // Use fixed 0.5 fps sampling for speed
    const videoDuration = await getVideoDuration(videoPath);
    const samplingStrategy = { fps: 0.5, ffmpegFilter: 'fps=0.5' };

    console.log(`[${jobId}] Video duration: ${Math.floor(videoDuration / 60)}:${Math.floor(videoDuration % 60).toString().padStart(2, '0')}`);
    console.log(`[${jobId}] Using fixed 0.5 fps sampling (estimated ${Math.floor(videoDuration * 0.5)} frames)`);

    // Store sampling info in job
    job.samplingStrategy = samplingStrategy;

    // Extract frames from video with adaptive sampling
    console.log(`[${jobId}] Extracting frames at ${samplingStrategy.fps.toFixed(2)} fps...`);
    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions([
          '-vf', samplingStrategy.ffmpegFilter,
          '-q:v', '2'     // High quality
        ])
        .output(path.join(framesDir, 'frame-%04d.jpg'))
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    // Get all extracted frames
    const allFrameFiles = fs.readdirSync(framesDir)
      .filter(f => f.endsWith('.jpg'))
      .sort();

    console.log(`[${jobId}] Extracted ${allFrameFiles.length} frames, filtering for significant changes...`);

    // Filter frames by difference threshold (skip static frames)
    const frameFiles = await filterSignificantFrames(allFrameFiles, framesDir, 0.08, jobId);

    console.log(`[${jobId}] Analyzing ${frameFiles.length} significant frames with RunPod Vision...`);

    // Analyze frames: 3 scaled-down images per request, all requests in parallel
    const IMAGES_PER_REQUEST = 3;

    // Group frames into chunks of 3
    const imageGroups = [];
    for (let i = 0; i < frameFiles.length; i += IMAGES_PER_REQUEST) {
      imageGroups.push(frameFiles.slice(i, i + IMAGES_PER_REQUEST));
    }

    console.log(`[${jobId}] Processing ${frameFiles.length} frames: 3 images/request, 10 requests/batch = 30 frames at once`);

    const BATCH_SIZE = 10; // Process 10 requests at a time (maxing out RunPod workers)
    const batches = [];
    for (let i = 0; i < imageGroups.length; i += BATCH_SIZE) {
      batches.push(imageGroups.slice(i, i + BATCH_SIZE));
    }

    console.log(`[${jobId}] Total: ${imageGroups.length} requests in ${batches.length} batches`);

    // Process batches sequentially, requests within batch in parallel
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];

      const batchPromises = batch.map(async (imageGroup, groupIndex) => {
        const absoluteIndex = batchIndex * BATCH_SIZE + groupIndex;
      try {
        // Prepare all images in this group (scaled down)
        const base64Images = [];
        const frameInfo = [];

        for (const frameFile of imageGroup) {
          const frameNumber = parseInt(frameFile.match(/\d+/)[0]);
          const timeInVideo = frameNumber;
          const framePath = path.join(framesDir, frameFile);

          // Read and scale down image to 512px width for faster upload
          const imageBuffer = fs.readFileSync(framePath);
          const scaledBuffer = await sharp(imageBuffer)
            .resize(512, null, { fit: 'inside' })
            .jpeg({ quality: 80 })
            .toBuffer();
          const base64Image = scaledBuffer.toString('base64');

          base64Images.push(base64Image);
          frameInfo.push({ frameNumber, timeInVideo });
        }

        // Create prompt for RunPod
        const timestamps = frameInfo.map(f => `${f.timeInVideo}s`).join(', ');
        const prompt = `Analyze these ${imageGroup.length} frames at ${timestamps}. For EACH frame:
1. Eye contact & gaze
2. Body language & posture
3. Gestures
4. Facial expressions
5. Engagement level
6. Concerning behaviors

Separate each frame with "---". Brief bullet points only.`;

        // Call RunPod Vision API (serverless, 10 workers!)
        const fullAnalysis = await callRunPodVision(base64Images, prompt, jobId);
        const analyses = fullAnalysis.split('---').map(a => a.trim());

        // Create result for each frame
        return frameInfo.map((info, idx) => ({
          timestamp: Date.now(),
          frameNumber: info.frameNumber,
          timeInVideo: info.timeInVideo,
          analysis: analyses[idx] || fullAnalysis,
          rawResult: { output: fullAnalysis }
        }));

      } catch (error) {
        console.error(`[${jobId}] Error in request ${absoluteIndex}:`, error.message);
        return [];
      }
    });

      // Wait for this batch to complete
      const batchResults = await Promise.all(batchPromises);

      // Flatten and add results
      batchResults.flat().forEach(result => {
        if (result) {
          overshootResults.push(result);
        }
      });

      // Update progress
      job.overshootResults = overshootResults;
      job.progress = 50 + Math.min(30, (overshootResults.length / frameFiles.length) * 30);

      console.log(`[${jobId}] Batch ${batchIndex + 1}/${batches.length} complete (${overshootResults.length}/${frameFiles.length} frames)`);
    }

    console.log(`[${jobId}] All ${overshootResults.length} frames analyzed!`);

    // Parse and clean vision outputs with OpenAI (batched to reduce API calls)
    console.log(`[${jobId}] Parsing vision outputs with OpenAI (correlating with transcript)...`);
    const transcriptUtterances = job.transcriptResults?.utterances || [];
    overshootResults = await parseVisionOutputsWithOpenAI(overshootResults, transcriptUtterances, jobId);
    job.overshootResults = overshootResults;

    // Cleanup frames directory
    try {
      fs.rmSync(framesDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`[${jobId}] Failed to cleanup frames:`, error.message);
    }

    console.log(`[${jobId}] Vision analysis complete: ${overshootResults.length} frames analyzed and structured`);

    // Wait for MediaPipe processing to complete
    console.log(`[${jobId}] Waiting for MediaPipe processing to complete...`);
    const mediapipeResults = await mediapipePromise;
    const mediapipeMetrics = mediapipeResults ? aggregateMediaPipeMetrics(mediapipeResults) : null;

    if (mediapipeMetrics) {
      console.log(`[${jobId}] MediaPipe analysis complete:`, {
        forward_lean: `${mediapipeMetrics.forward_lean_pct}%`,
        open_posture: `${mediapipeMetrics.open_posture_pct}%`,
        arms_crossed: `${mediapipeMetrics.arms_crossed_pct}%`,
        gesturing: `${mediapipeMetrics.gesturing_pct}%`,
        nodding: mediapipeMetrics.nodding_count
      });
    } else {
      console.log(`[${jobId}] MediaPipe analysis unavailable, using OpenAI Vision only`);
    }

    // Step 4: Process results and generate analysis
    job.stage = 'behavioral_scoring';
    job.progress = 85;
    console.log(`[${jobId}] Generating behavioral scores...`);

    const sessionData = await generateSessionData(
      jobId,
      job.transcriptResults,
      job.overshootResults,
      videoPath,
      mediapipeMetrics,
      mediapipeResults // Pass raw MediaPipe results for frame-by-frame visualization
    );

    job.finalResults = sessionData;
    job.stage = 'complete';
    job.status = 'complete';
    job.progress = 100;

    // Save session to permanent storage (sessions list on upload page)
    try {
      VideoCacheDB.saveSession(sessionData);
      console.log(`[${jobId}] Session saved to database`);
    } catch (sessionError) {
      console.warn(`[${jobId}] Failed to save session:`, sessionError.message);
    }

    console.log(`[${jobId}] Analysis complete!`);

    // Clean up files after 1 hour
    setTimeout(() => {
      if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
      if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
      delete global.analysisJobs[jobId];
    }, 3600000);

  } catch (error) {
    console.error(`[${jobId}] Processing error:`, error);
    job.status = 'error';
    job.error = error.message;
    throw error;
  }
}

// Generate session data from analysis results with comprehensive OSCE evaluation
async function generateSessionData(jobId, transcriptResults, overshootResults, videoPath, mediapipeMetrics = null, mediapipeRawResults = null) {
  const transcript = transcriptResults.utterances;
  const clinicianUtterances = transcript.filter(u => u.speaker === 'Clinician');
  const patientUtterances = transcript.filter(u => u.speaker === 'Patient');

  const totalDuration = transcript.length > 0 ? transcript[transcript.length - 1].end : 180;

  console.log(`[${jobId}] Starting comprehensive OSCE evaluation...`);

  // Step 1: Classify audio sections
  console.log(`[${jobId}] Classifying audio sections...`);
  const audioClassification = await classifyAudioSections(openaiClient, transcript);
  const audioSections = audioClassification.sections || [];

  // Step 2: Evaluate all OSCE domains with structured outputs (in parallel)
  console.log(`[${jobId}] Evaluating OSCE domains with AI...`);
  const [
    communicationEval,
    patientEducationEval,
    professionalismEval,
    safetyEval
  ] = await Promise.all([
    evaluateCommunicationSkills(openaiClient, transcript, overshootResults),
    evaluatePatientEducation(openaiClient, transcript),
    evaluateProfessionalism(openaiClient, transcript, overshootResults),
    evaluateSafety(openaiClient, transcript)
  ]);

  console.log(`[${jobId}] OSCE domain evaluations complete`);

  // Step 3: Calculate aggregate scores
  const totalScore =
    communicationEval.score +
    patientEducationEval.score +
    professionalismEval.score +
    safetyEval.score;

  const percentage = (totalScore / 40) * 100;  // 4 domains × 10 points
  const grade = calculateGrade(percentage);

  // Step 4: Generate actionable feedback
  const feedback = generateActionableFeedback({
    communication: communicationEval,
    patientEducation: patientEducationEval,
    professionalism: professionalismEval,
    safety: safetyEval
  });

  // Step 5: Calculate legacy metrics for backward compatibility
  const patientSpeakingTime = patientUtterances.reduce((sum, u) => sum + (u.end - u.start), 0);
  const patientSpeakingPct = Math.round((patientSpeakingTime / totalDuration) * 100);

  // Build comprehensive session data
  // Convert file system path to web-accessible URL
  const videoFilename = videoPath ? path.basename(videoPath) : null;
  const videoUrl = videoFilename ? `/uploads/${videoFilename}` : null;

  return {
    id: jobId,
    title: `OSCE Evaluation ${jobId}`,
    duration_seconds: Math.round(totalDuration),
    videoUrl: videoUrl,

    // Audio section classification
    audioSections: audioSections,

    // Comprehensive OSCE evaluation
    osceEvaluation: {
      domains: {
        communication_skills: communicationEval,
        patient_education: patientEducationEval,
        professionalism: professionalismEval,
        safety: safetyEval
      },
      overall: {
        total_score: totalScore,
        percentage: percentage,
        grade: grade,
        overall_impression: generateOverallImpression(percentage, grade)
      },
      actionable_feedback: feedback
    },

    // Legacy scores for backward compatibility
    scores: {
      communication_quality: {
        value: communicationEval.score * 10,
        grade: convertScoreToLetterGrade(communicationEval.score),
        drivers: ['Evidence-based structured evaluation']
      },
      patient_education: {
        value: patientEducationEval.score * 10,
        grade: convertScoreToLetterGrade(patientEducationEval.score),
        drivers: ['Plain language', 'Teach-back', 'Understanding checks']
      },
      professionalism: {
        value: professionalismEval.score * 10,
        grade: convertScoreToLetterGrade(professionalismEval.score),
        drivers: ['Respect', 'Boundaries', 'Ethics']
      },
      safety: {
        value: safetyEval.score * 10,
        grade: convertScoreToLetterGrade(safetyEval.score),
        drivers: ['Medication safety', 'Red flags', 'Risk management']
      }
    },

    // Detailed metrics (hybrid: MediaPipe quantitative + OpenAI qualitative)
    metrics: {
      eye_contact_pct: communicationEval.nonverbal.eye_contact_percent,
      open_posture_pct: mediapipeMetrics?.open_posture_pct ?? communicationEval.nonverbal.open_posture_percent,
      interruption_count: communicationEval.active_listening.interruption_count,
      empathy_count: communicationEval.empathy.empathy_statements_count,
      patient_speaking_pct: patientSpeakingPct,
      avg_response_latency: 1.5,
      teachback_count: patientEducationEval.teach_back_used ? 1 : 0,
      jargon_unexplained_count: patientEducationEval.avoids_jargon ? 0 : 1,
      forward_lean_pct: mediapipeMetrics?.forward_lean_pct ?? (communicationEval.nonverbal.forward_lean ? 60 : 20),
      arms_crossed_pct: mediapipeMetrics?.arms_crossed_pct ?? 0,
      nod_count: mediapipeMetrics?.nodding_count ?? 0,
      gesture_count: mediapipeMetrics?.gesturing_pct ?? 0,
      mirroring_instances: 0,
      avg_proximity_cm: 95,
      proximity_shifts: 3,
      open_question_ratio: 0.7,
      allergies_checked: safetyEval.medication_safety.verifies_allergies,
      red_flags_count: safetyEval.red_flags_recognized.length,
      // MediaPipe source flags
      mediapipe_available: mediapipeMetrics !== null,
      avg_forward_lean_angle: mediapipeMetrics?.avg_forward_lean_angle ?? null
    },

    transcript: transcript.map(u => ({
      ...u,
      flags: annotateTranscript(u)
    })),
    timeline: generateTimeline(transcript, overshootResults, totalDuration),
    overshootResponses: processOvershootForDisplay(overshootResults, totalDuration),
    overshootResults: overshootResults, // Include raw results for frontend
    mediapipeResults: mediapipeRawResults ? mediapipeRawResults.results : null, // Include raw MediaPipe frame data for visualization
    events: extractEventsFromAnalysis(transcript, overshootResults, mediapipeMetrics), // NEW: Extract all events
    radar: generateRadarData({
      communication_skills: communicationEval.score * 10,
      patient_education: patientEducationEval.score * 10,
      professionalism: professionalismEval.score * 10,
      safety: safetyEval.score * 10
    })
  };
}

// Extract events from analysis data for timeline display
function extractEventsFromAnalysis(transcript, overshootResults, mediapipeMetrics) {
  const events = [];
  const eventTimestamps = new Set(); // Prevent duplicate events at same timestamp

  // Helper to add event with deduplication
  const addEvent = (event) => {
    const key = `${event.time.toFixed(1)}-${event.type}`;
    if (!eventTimestamps.has(key)) {
      eventTimestamps.add(key);
      events.push(event);
    }
  };

  // Extract events from overshoot results with better parsing
  overshootResults.forEach(result => {
    const analysis = (result.analysis || '').toLowerCase();
    const time = result.timeInVideo || 0;

    // Eye contact analysis (more nuanced)
    if (analysis.match(/eye contact.*(poor|minimal|reduced|lacking|avoiding|limited)/i)) {
      addEvent({
        time,
        type: 'Poor eye contact',
        severity: 'warning',
        description: 'Clinician not maintaining adequate eye contact with patient',
        detail: 'Consider looking at patient more frequently to build trust'
      });
    } else if (analysis.match(/eye contact.*(good|strong|maintained|excellent|consistent)/i)) {
      addEvent({
        time,
        type: 'Good eye contact',
        severity: 'positive',
        description: 'Strong eye contact maintained',
        detail: 'Builds trust and rapport with patient'
      });
    }

    // Body language analysis
    if (analysis.match(/arms?\s*(crossed|folded)/i)) {
      addEvent({
        time,
        type: 'Defensive posture',
        severity: 'warning',
        description: 'Arms crossed - potentially defensive posture',
        detail: 'May signal disengagement or defensiveness to patient'
      });
    }

    if (analysis.match(/(lean(ing|s)?\s*forward|forward\s*lean)/i)) {
      addEvent({
        time,
        type: 'Engaged lean',
        severity: 'positive',
        description: 'Leaning forward - engaged posture',
        detail: 'Demonstrates active listening and engagement'
      });
    }

    if (analysis.match(/(lean(ing|s)?\s*(back|away)|slouch)/i)) {
      addEvent({
        time,
        type: 'Disengaged posture',
        severity: 'warning',
        description: 'Leaning back or slouching',
        detail: 'May appear disengaged or uninterested'
      });
    }

    if (analysis.match(/open\s*posture/i)) {
      addEvent({
        time,
        type: 'Open posture',
        severity: 'positive',
        description: 'Open, welcoming body language',
        detail: 'Creates comfortable environment for patient'
      });
    }

    if (analysis.match(/(turn(ed|ing)?\s*(away|aside)|facing\s*away)/i)) {
      addEvent({
        time,
        type: 'Turned away',
        severity: 'warning',
        description: 'Body oriented away from patient',
        detail: 'Reduces connection and engagement'
      });
    }

    // Facial expressions and empathy markers
    if (analysis.match(/(nodd(ing|ed|s)|head\s*nod)/i)) {
      addEvent({
        time,
        type: 'Nodding',
        severity: 'positive',
        description: 'Nodding observed',
        detail: 'Shows active listening and understanding'
      });
    }

    if (analysis.match(/(smil(e|ing)|warm\s*expression|friendly)/i)) {
      addEvent({
        time,
        type: 'Positive expression',
        severity: 'positive',
        description: 'Warm, friendly facial expression',
        detail: 'Creates welcoming atmosphere'
      });
    }

    if (analysis.match(/(frown|stern|cold|harsh\s*expression)/i)) {
      addEvent({
        time,
        type: 'Negative expression',
        severity: 'warning',
        description: 'Stern or negative facial expression',
        detail: 'May make patient uncomfortable'
      });
    }

    // Gestures
    if (analysis.match(/(gestur(es|ing)|hand\s*movement|illustrat(ing|ive))/i)) {
      addEvent({
        time,
        type: 'Illustrative gestures',
        severity: 'positive',
        description: 'Using hand gestures while explaining',
        detail: 'Enhances communication clarity'
      });
    }

    // Engagement and attention
    if (analysis.match(/(looking\s*at\s*(screen|computer|chart|notes)|focus(ed|ing)\s*on\s*screen)/i)) {
      addEvent({
        time,
        type: 'Screen focus',
        severity: 'warning',
        description: 'Attention on screen/computer',
        detail: 'Balance documentation with patient interaction'
      });
    }

    if (analysis.match(/(distract(ed|ion)|not\s*paying\s*attention|inattent(ive|ion))/i)) {
      addEvent({
        time,
        type: 'Distraction',
        severity: 'warning',
        description: 'Appears distracted or inattentive',
        detail: 'Full attention needed for quality care'
      });
    }
  });

  // Extract events from transcript with comprehensive pattern matching
  transcript.forEach(utterance => {
    if (!utterance.speaker) return;

    const text = utterance.text.toLowerCase();
    const time = utterance.start;
    const isClinician = utterance.speaker.toLowerCase().includes('clinician');

    if (isClinician) {
      // Empathy phrases (comprehensive list)
      const empathyPatterns = [
        /i\s*(can\s*)?(understand|see|imagine|appreciate)/i,
        /that\s*(must|sounds|seems)\s*(be|like)\s*(difficult|hard|challenging|frustrating|scary|worrying)/i,
        /i('m|\s*am)\s*sorry\s*(to\s*hear|that|you)/i,
        /that'?s\s*(understandable|concerning|worrying)/i,
        /i\s*hear\s*(you|what\s*you)/i,
        /tell\s*me\s*more\s*about/i
      ];

      if (empathyPatterns.some(pattern => pattern.test(utterance.text))) {
        addEvent({
          time,
          type: 'Empathy statement',
          severity: 'positive',
          description: `"${utterance.text.substring(0, 60)}..."`,
          detail: 'Demonstrates empathy and emotional awareness'
        });
      }

      // Teach-back prompts
      const teachbackPatterns = [
        /can\s*you\s*(tell|explain|describe|walk)\s*me/i,
        /in\s*your\s*own\s*words/i,
        /what\s*do\s*you\s*understand/i,
        /how\s*would\s*you\s*explain/i,
        /just\s*to\s*make\s*sure/i
      ];

      if (teachbackPatterns.some(pattern => pattern.test(utterance.text))) {
        addEvent({
          time,
          type: 'Teach-back',
          severity: 'positive',
          description: 'Using teach-back method',
          detail: 'Verifies patient understanding effectively'
        });
      }

      // Open-ended questions (grade boosters)
      const openQuestionPatterns = [
        /^(how|what|tell\s*me|describe|explain)/i,
        /what\s*(brings|concerns|worries)/i,
        /how\s*(are\s*you|do\s*you|would\s*you)/i
      ];

      if (openQuestionPatterns.some(pattern => pattern.test(utterance.text.trim()))) {
        addEvent({
          time,
          type: 'Open question',
          severity: 'positive',
          description: 'Asked open-ended question',
          detail: 'Encourages patient to share more information'
        });
      }

      // Closed questions (potential grade reducers)
      const closedQuestionPatterns = [
        /^(do\s*you|did\s*you|are\s*you|is\s*it|have\s*you|will\s*you|can\s*you)\s/i
      ];

      if (closedQuestionPatterns.some(pattern => pattern.test(utterance.text.trim())) &&
          !teachbackPatterns.some(pattern => pattern.test(utterance.text))) {
        addEvent({
          time,
          type: 'Closed question',
          severity: 'neutral',
          description: 'Asked yes/no question',
          detail: 'Consider using open-ended questions for better information gathering'
        });
      }

      // Medical jargon (comprehensive list)
      const jargonTerms = [
        'hypertension', 'hyperlipidemia', 'dyslipidemia', 'diabetes mellitus',
        'angina', 'myocardial', 'cardiovascular', 'cerebrovascular',
        'tachycardia', 'bradycardia', 'arrhythmia', 'fibrillation',
        'edema', 'dyspnea', 'orthopnea', 'syncope',
        'hepatic', 'renal', 'pulmonary', 'gastrointestinal',
        'prophylaxis', 'prognosis', 'etiology', 'pathophysiology'
      ];

      if (jargonTerms.some(term => text.includes(term))) {
        // Check if followed by explanation
        const hasExplanation = /that('s|\s*is)\s*(means?|when)/i.test(utterance.text);
        addEvent({
          time,
          type: hasExplanation ? 'Jargon explained' : 'Unexplained jargon',
          severity: hasExplanation ? 'positive' : 'warning',
          description: hasExplanation ?
            'Used medical term with explanation' :
            'Medical jargon without explanation',
          detail: hasExplanation ?
            'Good practice - explaining medical terms' :
            'May confuse patient - consider using plain language'
        });
      }

      // Interruptions (detect overlapping speech or cuts off)
      if (text.match(/(but\s*-|wait\s*-|hold\s*on|let\s*me\s*(just|stop|interrupt))/i)) {
        addEvent({
          time,
          type: 'Interruption',
          severity: 'warning',
          description: 'Interrupted patient',
          detail: 'Allow patient to complete thoughts before responding'
        });
      }

      // Summarizing/reflecting
      if (text.match(/(so\s*what\s*i('m|\s*am)\s*hearing|let\s*me\s*summarize|it\s*sounds\s*like|if\s*i\s*understand\s*correctly)/i)) {
        addEvent({
          time,
          type: 'Reflective summary',
          severity: 'positive',
          description: 'Summarizing patient concerns',
          detail: 'Demonstrates active listening'
        });
      }

      // Partnership language
      if (text.match(/(we\s*can|together\s*we|let('s|s)\s*(work|figure|decide)|what\s*do\s*you\s*think)/i)) {
        addEvent({
          time,
          type: 'Partnership language',
          severity: 'positive',
          description: 'Collaborative language used',
          detail: 'Promotes shared decision-making'
        });
      }
    }
  });

  // Sort events by time and return
  return events.sort((a, b) => a.time - b.time);
}

// Helper: Convert 0-10 score to letter grade
function convertScoreToLetterGrade(score) {
  if (score >= 9) return 'A';
  if (score >= 8) return 'B+';
  if (score >= 7) return 'B';
  if (score >= 6) return 'C+';
  if (score >= 5) return 'C';
  return 'F';
}

// Helper: Generate overall impression text
function generateOverallImpression(percentage, grade) {
  if (grade === 'honors') {
    return 'Exceptional clinical interaction demonstrating mastery across all OSCE domains.';
  } else if (grade === 'high_pass') {
    return 'Strong clinical interaction with minor areas for improvement.';
  } else if (grade === 'pass') {
    return 'Satisfactory clinical interaction meeting minimum competency standards.';
  } else {
    return 'Clinical interaction requires significant improvement in multiple domains.';
  }
}

// Helper: Generate actionable feedback from evaluations
function generateActionableFeedback(evaluations) {
  const feedback = [];

  // Communication feedback
  if (evaluations.communication.active_listening.interruption_count > 2) {
    feedback.push({
      domain: 'Communication Skills',
      priority: 'high',
      observation: `Interrupted patient ${evaluations.communication.active_listening.interruption_count} times`,
      recommendation: 'Practice active listening by allowing patient to complete thoughts before responding',
      example: 'Use phrases like "Tell me more about that" instead of jumping to next question'
    });
  }

  if (evaluations.communication.nonverbal.eye_contact_percent < 60) {
    feedback.push({
      domain: 'Communication Skills',
      priority: 'high',
      observation: `Eye contact only ${evaluations.communication.nonverbal.eye_contact_percent}% of time`,
      recommendation: 'Increase eye contact to 60-70% to build trust and rapport',
      example: 'Look at patient while they speak, briefly glance at notes during pauses'
    });
  }

  // Patient education feedback
  if (!evaluations.patientEducation.teach_back_used) {
    feedback.push({
      domain: 'Patient Education',
      priority: 'high',
      observation: 'Did not use teach-back technique',
      recommendation: 'Ask patient to explain information back to verify understanding',
      example: '"Can you explain to me in your own words how you\'ll take this medication?"'
    });
  }

  if (!evaluations.patientEducation.uses_plain_language) {
    feedback.push({
      domain: 'Patient Education',
      priority: 'medium',
      observation: 'Used medical jargon without explanation',
      recommendation: 'Translate medical terms to plain language',
      example: 'Say "high blood pressure" instead of "hypertension"'
    });
  }

  // Safety feedback
  if (!evaluations.safety.medication_safety.verifies_allergies) {
    feedback.push({
      domain: 'Safety',
      priority: 'critical',
      observation: 'Did not verify patient allergies',
      recommendation: 'Always check allergies before prescribing or discussing medications',
      example: '"Before we discuss treatment, let me confirm - do you have any medication allergies?"'
    });
  }

  if (evaluations.safety.red_flags_recognized.length === 0) {
    feedback.push({
      domain: 'Safety',
      priority: 'medium',
      observation: 'No red flag symptoms explicitly discussed',
      recommendation: 'Screen for concerning symptoms that require urgent evaluation',
      example: 'Ask about chest pain, shortness of breath, severe headaches, etc.'
    });
  }

  // Professionalism feedback
  if (!evaluations.professionalism.respect.cultural_sensitivity) {
    feedback.push({
      domain: 'Professionalism',
      priority: 'medium',
      observation: 'Cultural sensitivity could be improved',
      recommendation: 'Demonstrate awareness of cultural factors affecting health beliefs',
      example: 'Ask "Are there any cultural or religious considerations we should keep in mind?"'
    });
  }

  return feedback;
}

// Analyze body language from Overshoot results
function analyzeBodyLanguage(overshootResults) {
  // Parse Overshoot text responses for body language indicators
  let eyeContactMentions = 0;
  let openPostureMentions = 0;
  let forwardLeanMentions = 0;
  let armsCrossedMentions = 0;
  let nodMentions = 0;
  let gestureMentions = 0;
  let mirroringMentions = 0;

  overshootResults.forEach(result => {
    const text = (result.analysis || '').toLowerCase();

    if (text.includes('eye contact') || text.includes('looking at')) eyeContactMentions++;
    if (text.includes('open') && text.includes('posture')) openPostureMentions++;
    if (text.includes('leaning forward') || text.includes('lean forward')) forwardLeanMentions++;
    if (text.includes('arms crossed') || text.includes('crossed arms')) armsCrossedMentions++;
    if (text.includes('nodding') || text.includes('nod')) nodMentions++;
    if (text.includes('gesture') || text.includes('hand movement')) gestureMentions++;
    if (text.includes('mirroring') || text.includes('mirror')) mirroringMentions++;
  });

  const totalFrames = overshootResults.length;

  return {
    eyeContactPct: Math.round((eyeContactMentions / Math.max(totalFrames, 1)) * 100),
    openPosturePct: Math.round((openPostureMentions / Math.max(totalFrames, 1)) * 100),
    forwardLeanPct: Math.round((forwardLeanMentions / Math.max(totalFrames, 1)) * 100),
    armsCrossedPct: Math.round((armsCrossedMentions / Math.max(totalFrames, 1)) * 100),
    nodCount: nodMentions,
    gestureCount: gestureMentions,
    mirroringCount: mirroringMentions,
    engagementScore: Math.round(((eyeContactMentions + openPostureMentions + forwardLeanMentions) / Math.max(totalFrames * 3, 1)) * 100),
    engagementGrade: eyeContactMentions > totalFrames * 0.5 ? 'A' : 'C'
  };
}

// Annotate transcript with flags
function annotateTranscript(utterance) {
  const flags = [];
  const text = utterance.text.toLowerCase();

  // Empathy detection
  const empathyPhrases = ['understand', 'sounds like', 'must be', 'i hear you'];
  if (empathyPhrases.some(phrase => text.includes(phrase))) {
    flags.push('Empathy phrase');
  }

  // Teach-back detection
  if (/tell me|explain back|in your own words/i.test(text)) {
    flags.push('Teach-back prompt');
  }

  // Jargon detection
  const medicalJargon = ['hypertension', 'hyperlipidemia', 'cardiovascular'];
  if (medicalJargon.some(term => text.includes(term))) {
    flags.push('Jargon usage');
  }

  // Question type
  if (utterance.speaker === 'Clinician') {
    if (/^(how|what|tell me)/i.test(text.trim())) {
      flags.push('Open question');
    } else if (/^(do you|did you|are you)/i.test(text.trim())) {
      flags.push('Closed question');
    }
  }

  return flags;
}

// Generate timeline from results
function generateTimeline(transcript, overshootResults, duration) {
  // Speaker segments
  const speakerSegments = transcript.map(u => ({
    start: u.start,
    end: u.end,
    speaker: u.speaker.toLowerCase()
  }));

  // Gaze segments - analyze from overshoot results
  const gazeSegments = analyzeGazeFromOvershoot(overshootResults, duration);

  // Body segments - analyze from overshoot results
  const bodySegments = analyzeBodyLanguageSegments(overshootResults, duration);

  // Events from transcript flags (legacy compatibility)
  const events = [];
  transcript.forEach(u => {
    if (u.flags && u.flags.length > 0) {
      u.flags.forEach(flag => {
        events.push({
          time: u.start,
          type: flag,
          label: u.text.substring(0, 50) + '...',
          detail: `${u.speaker}: ${u.text}`
        });
      });
    }
  });

  return {
    speaker_segments: speakerSegments,
    gaze_segments: gazeSegments,
    body_segments: bodySegments,
    events: events
  };
}

// Analyze gaze patterns from overshoot results
function analyzeGazeFromOvershoot(overshootResults, duration) {
  const segments = [];
  let currentSegment = null;

  overshootResults.forEach(result => {
    const analysis = (result.analysis || '').toLowerCase();
    const time = result.timeInVideo || 0;

    let gazeTarget = 'patient'; // default

    if (analysis.match(/(looking\s*at\s*(screen|computer|chart|notes)|focus(ed|ing)\s*on\s*screen)/i)) {
      gazeTarget = 'screen';
    } else if (analysis.match(/(looking\s*(away|down|elsewhere)|avoid(ing)?\s*eye\s*contact)/i)) {
      gazeTarget = 'elsewhere';
    } else if (analysis.match(/(eye\s*contact|looking\s*at\s*patient|facing\s*patient)/i)) {
      gazeTarget = 'patient';
    }

    if (!currentSegment || currentSegment.target !== gazeTarget) {
      if (currentSegment) {
        currentSegment.end = time;
        segments.push(currentSegment);
      }
      currentSegment = { start: time, target: gazeTarget, end: duration };
    }
  });

  if (currentSegment) {
    segments.push(currentSegment);
  }

  // Fill gaps with default
  if (segments.length === 0) {
    segments.push({ start: 0, end: duration, target: 'patient' });
  }

  return segments;
}

// Analyze body language segments from overshoot results
function analyzeBodyLanguageSegments(overshootResults, duration) {
  const segments = [];
  let currentSegment = null;

  overshootResults.forEach(result => {
    const analysis = (result.analysis || '').toLowerCase();
    const time = result.timeInVideo || 0;

    let bodyState = 'neutral'; // default

    if (analysis.match(/arms?\s*(crossed|folded)/i)) {
      bodyState = 'closed';
    } else if (analysis.match(/(turn(ed|ing)?\s*(away|aside)|facing\s*away)/i)) {
      bodyState = 'away';
    } else if (analysis.match(/(lean(ing)?\s*forward|open\s*posture|engaged)/i)) {
      bodyState = 'open';
    } else if (analysis.match(/(lean(ing)?\s*back|slouch|disengaged)/i)) {
      bodyState = 'closed';
    }

    if (!currentSegment || currentSegment.state !== bodyState) {
      if (currentSegment) {
        currentSegment.end = time;
        segments.push(currentSegment);
      }
      currentSegment = { start: time, state: bodyState, end: duration };
    }
  });

  if (currentSegment) {
    segments.push(currentSegment);
  }

  // Fill gaps with default
  if (segments.length === 0) {
    segments.push({ start: 0, end: duration, state: 'neutral' });
  }

  return segments;
}

// Process Overshoot results for display
function processOvershootForDisplay(overshootResults, duration) {
  const frameGroups = [];
  const groupDuration = 30; // 30 seconds per group

  for (let i = 0; i < Math.ceil(duration / groupDuration); i++) {
    const startTime = i * groupDuration;
    const endTime = Math.min((i + 1) * groupDuration, duration);

    // Find results in this time range
    const groupResults = overshootResults.filter(r =>
      r.timeInVideo >= startTime && r.timeInVideo < endTime
    );

    // Aggregate findings
    const analyses = groupResults.map(r => r.analysis).filter(Boolean);

    frameGroups.push({
      startTime,
      endTime,
      eyeContact: analyses.length > 0 ? analyses[0].substring(0, 100) : 'Analyzing eye contact patterns...',
      bodyLanguage: analyses.length > 1 ? analyses[Math.floor(analyses.length / 2)].substring(0, 100) : 'Analyzing body language...',
      gestures: 'Observing hand and arm movements...',
      engagement: analyses.length > 0 ? 'Clinician appears engaged with patient' : 'Analyzing engagement...',
      concerns: analyses.some(a => a.toLowerCase().includes('cross') || a.toLowerCase().includes('away')) ?
        ['Arms crossed detected', 'Reduced eye contact'] : []
    });
  }

  return frameGroups;
}

// Generate radar chart data
function generateRadarData(scores) {
  return {
    labels: Object.keys(scores).map(k => k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())),
    datasets: [{
      label: 'Current Session',
      data: Object.values(scores).map(s => s.value)
    }]
  };
}

// Get all sessions
app.get('/api/sessions', (req, res) => {
  try {
    const sessions = VideoCacheDB.getAllSessions();
    const stats = VideoCacheDB.getSessionStats();

    res.json({
      success: true,
      sessions: sessions,
      stats: stats
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({
      error: 'Failed to fetch sessions',
      details: error.message
    });
  }
});

// Get a specific session by ID
app.get('/api/sessions/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = VideoCacheDB.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        error: 'Session not found'
      });
    }

    res.json({
      success: true,
      session: session
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({
      error: 'Failed to fetch session',
      details: error.message
    });
  }
});

// Delete a session
app.delete('/api/sessions/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const result = VideoCacheDB.deleteSession(sessionId);

    res.json({
      success: true,
      deleted: result.changes > 0
    });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({
      error: 'Failed to delete session',
      details: error.message
    });
  }
});

// Generate report endpoint
app.post('/api/generate-report', async (req, res) => {
  try {
    const { sessionData, format = 'json' } = req.body;

    if (!sessionData) {
      return res.status(400).json({ error: 'Session data required' });
    }

    // Generate comprehensive report
    const report = {
      metadata: {
        generatedAt: new Date().toISOString(),
        sessionId: sessionData.id,
        title: sessionData.title,
        duration: sessionData.duration_seconds,
        apiVersion: '1.0.0'
      },
      executiveSummary: generateExecutiveSummary(sessionData),
      scores: sessionData.scores,
      detailedAnalysis: generateDetailedAnalysis(sessionData),
      transcript: sessionData.transcript,
      recommendations: generateRecommendations(sessionData),
      comparisonToBenchmark: generateBenchmarkComparison(sessionData)
    };

    if (format === 'pdf') {
      res.json({
        success: true,
        message: 'PDF generation not implemented in demo. Use JSON format.',
        report
      });
    } else {
      res.json({
        success: true,
        report
      });
    }

  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({
      error: 'Report generation failed',
      details: error.message
    });
  }
});

// Helper function to format timestamp
function formatTimestamp(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Helper function to generate executive summary
function generateExecutiveSummary(sessionData) {
  const scores = sessionData.scores;
  const avgScore = Object.values(scores).reduce((sum, s) => sum + s.value, 0) / Object.keys(scores).length;

  let performance = 'excellent';
  if (avgScore < 50) performance = 'needs significant improvement';
  else if (avgScore < 70) performance = 'needs improvement';
  else if (avgScore < 85) performance = 'good';

  return {
    overallPerformance: performance,
    averageScore: Math.round(avgScore),
    strengths: identifyStrengths(scores),
    areasForImprovement: identifyWeaknesses(scores),
    keyInsights: generateKeyInsights(sessionData)
  };
}

// Helper function to identify strengths
function identifyStrengths(scores) {
  return Object.entries(scores)
    .filter(([_, data]) => data.value >= 75)
    .map(([key, data]) => ({
      area: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      score: data.value,
      grade: data.grade
    }));
}

// Helper function to identify weaknesses
function identifyWeaknesses(scores) {
  return Object.entries(scores)
    .filter(([_, data]) => data.value < 75)
    .map(([key, data]) => ({
      area: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      score: data.value,
      grade: data.grade,
      drivers: data.drivers
    }));
}

// Helper function to generate key insights
function generateKeyInsights(sessionData) {
  const insights = [];
  const metrics = sessionData.metrics;

  if (metrics.eye_contact_pct < 50) {
    insights.push(`Limited eye contact (${metrics.eye_contact_pct}%) may impact patient trust and engagement.`);
  }

  if (metrics.interruption_count > 3) {
    insights.push(`Frequent interruptions (${metrics.interruption_count}) prevented patient from fully expressing concerns.`);
  }

  if (metrics.jargon_unexplained_count > 2) {
    insights.push(`Medical jargon used without explanation (${metrics.jargon_unexplained_count} instances) may confuse patients.`);
  }

  if (metrics.patient_speaking_pct < 30) {
    insights.push(`Patient speaking time (${metrics.patient_speaking_pct}%) was low. Consider more open-ended questions.`);
  }

  if (metrics.empathy_count === 0) {
    insights.push('No empathetic phrases detected. Consider acknowledging patient emotions.');
  }

  return insights;
}

// Helper function to generate detailed analysis
function generateDetailedAnalysis(sessionData) {
  return {
    communication: {
      verbalPatterns: {
        questionQuality: sessionData.metrics.open_question_ratio,
        interruptions: sessionData.metrics.interruption_count,
        empathyMarkers: sessionData.metrics.empathy_count,
        languageClarity: sessionData.metrics.jargon_unexplained_count === 0
      },
      speakingBalance: {
        clinicianPercentage: 100 - sessionData.metrics.patient_speaking_pct,
        patientPercentage: sessionData.metrics.patient_speaking_pct,
        responseLatency: sessionData.metrics.avg_response_latency
      }
    },
    nonverbalBehavior: {
      eyeContact: sessionData.metrics.eye_contact_pct,
      posture: {
        openPosture: sessionData.metrics.open_posture_pct,
        forwardLean: sessionData.metrics.forward_lean_pct,
        armsCrossed: sessionData.metrics.arms_crossed_pct
      },
      engagement: {
        nodding: sessionData.metrics.nod_count,
        gestures: sessionData.metrics.gesture_count,
        mirroring: sessionData.metrics.mirroring_instances,
        proximity: sessionData.metrics.avg_proximity_cm
      }
    }
  };
}

// Helper function to generate recommendations
function generateRecommendations(sessionData) {
  const recommendations = [];
  const metrics = sessionData.metrics;

  if (metrics.eye_contact_pct < 60) {
    recommendations.push({
      priority: 'high',
      area: 'Eye Contact',
      suggestion: 'Increase eye contact with patient to build trust. Aim for 60-70% of interaction time.',
      actionable: 'Practice the "80/20 rule" - look at the patient 80% of the time when they\'re speaking.'
    });
  }

  if (metrics.open_question_ratio < 0.5) {
    recommendations.push({
      priority: 'high',
      area: 'Question Quality',
      suggestion: 'Ask more open-ended questions to encourage patient participation.',
      actionable: 'Start questions with "How", "What", "Tell me about" instead of "Do you", "Did you".'
    });
  }

  if (metrics.jargon_unexplained_count > 0) {
    recommendations.push({
      priority: 'high',
      area: 'Language Clarity',
      suggestion: 'Avoid medical jargon or explain terms in plain language.',
      actionable: 'After using medical terms, follow with "in other words..." or "what that means is..."'
    });
  }

  return recommendations;
}

// Helper function to generate benchmark comparison
function generateBenchmarkComparison(sessionData) {
  const benchmarks = {
    eye_contact_pct: 65,
    open_question_ratio: 0.6,
    patient_speaking_pct: 40,
    empathy_count: 4,
    open_posture_pct: 70,
    jargon_unexplained_count: 0
  };

  const comparison = {};
  Object.keys(benchmarks).forEach(key => {
    if (sessionData.metrics[key] !== undefined) {
      const metric = sessionData.metrics[key];
      const benchmark = benchmarks[key];
      const isReversed = key === 'jargon_unexplained_count';

      let status;
      if (isReversed) {
        status = metric <= benchmark ? 'above' : 'below';
      } else {
        status = metric >= benchmark ? 'above' : 'below';
      }

      comparison[key] = {
        value: metric,
        benchmark: benchmark,
        difference: isReversed ? benchmark - metric : metric - benchmark,
        status: status
      };
    }
  });

  return comparison;
}

// Start server
app.listen(PORT, () => {
  const videoCacheStatus = process.env.ENABLE_VIDEO_CACHE === 'true' ? '✓ Enabled ' : '✗ Disabled';
  const analysisCacheStatus = process.env.ENABLE_ANALYSIS_CACHE === 'true' ? '✓ Enabled ' : '✗ Disabled';

  console.log(`
╔════════════════════════════════════════════════════════╗
║         SimInsight API Server Running                 ║
╠════════════════════════════════════════════════════════╣
║  Port: ${PORT}                                          ║
║  Health: http://localhost:${PORT}/api/health           ║
║                                                        ║
║  APIs Configured:                                      ║
║  ✓ OpenAI Vision: ${process.env.OPANN ? '✓ Configured' : '✗ Missing'}                  ║
║  ✓ Deepgram:      ${process.env.DEEPGRAM_API_KEY ? '✓ Configured' : '✗ Missing'}                  ║
║                                                        ║
║  Cache Settings:                                       ║
║  • Video Cache:    ${videoCacheStatus}                  ║
║  • Analysis Cache: ${analysisCacheStatus}                  ║
╚════════════════════════════════════════════════════════╝
  `);
});
