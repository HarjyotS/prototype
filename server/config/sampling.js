/**
 * Frame sampling configuration for video analysis
 * Optimizes OpenAI Vision API costs based on video characteristics
 */

export const SamplingProfiles = {
  // High quality - detailed analysis (2 frames per second)
  HIGH: {
    name: 'High Quality',
    fps: 2,
    maxFrames: 360,
    description: 'Best for short videos (<3 min), detailed behavior analysis'
  },

  // Standard - balanced cost/quality (1 frame per second)
  STANDARD: {
    name: 'Standard',
    fps: 1,
    maxFrames: 180,
    description: 'Balanced quality for videos up to 5 minutes'
  },

  // Economy - cost optimized (0.5 frames per second)
  ECONOMY: {
    name: 'Economy',
    fps: 0.5,
    maxFrames: 90,
    description: 'Cost-effective for longer videos (>5 min)'
  },

  // Keyframe - scene-based sampling
  KEYFRAME: {
    name: 'Keyframe Detection',
    sceneChangeThreshold: 0.4,
    maxFrames: 100,
    description: 'Extract only significant scene changes'
  },

  // Adaptive - adjusts based on video length
  ADAPTIVE: {
    name: 'Adaptive',
    targetFrames: 120,
    description: 'Auto-adjust FPS based on video duration'
  }
};

/**
 * Calculate optimal sampling strategy for a video
 * @param {number} videoDuration - Video duration in seconds
 * @param {string} profile - Sampling profile name (default: 'ADAPTIVE')
 * @param {number|null} maxCost - Optional maximum cost constraint
 * @returns {object} Sampling strategy with fps, estimated frames, and cost
 */
export function calculateSamplingStrategy(videoDuration, profile = 'ADAPTIVE', maxCost = null) {
  const config = SamplingProfiles[profile];

  if (!config) {
    throw new Error(`Unknown sampling profile: ${profile}. Valid profiles: ${Object.keys(SamplingProfiles).join(', ')}`);
  }

  if (profile === 'ADAPTIVE') {
    // Calculate FPS to achieve target frame count
    const targetFrames = config.targetFrames;
    const calculatedFps = targetFrames / videoDuration;

    // Clamp between 0.25 and 2 fps
    const fps = Math.max(0.25, Math.min(2, calculatedFps));
    const estimatedFrames = Math.floor(videoDuration * fps);

    return {
      profile: 'ADAPTIVE',
      fps: fps,
      estimatedFrames: estimatedFrames,
      estimatedCost: estimatedFrames * 0.01,  // ~$0.01 per frame for gpt-4o
      estimatedTimeSeconds: estimatedFrames * 2,  // ~2 seconds per frame
      ffmpegFilter: `fps=${fps}`
    };
  }

  if (profile === 'KEYFRAME') {
    return {
      profile: 'KEYFRAME',
      sceneChangeThreshold: config.sceneChangeThreshold,
      maxFrames: config.maxFrames,
      estimatedFrames: Math.min(config.maxFrames, Math.floor(videoDuration * 0.5)),
      estimatedCost: Math.min(config.maxFrames, Math.floor(videoDuration * 0.5)) * 0.01,
      estimatedTimeSeconds: Math.min(config.maxFrames, Math.floor(videoDuration * 0.5)) * 2,
      ffmpegFilter: `select='gt(scene,${config.sceneChangeThreshold})'`
    };
  }

  // Standard FPS-based profiles (HIGH, STANDARD, ECONOMY)
  const estimatedFrames = Math.min(
    Math.floor(videoDuration * config.fps),
    config.maxFrames
  );

  return {
    profile: profile,
    fps: config.fps,
    maxFrames: config.maxFrames,
    estimatedFrames: estimatedFrames,
    estimatedCost: estimatedFrames * 0.01,
    estimatedTimeSeconds: estimatedFrames * 2,
    ffmpegFilter: `fps=${config.fps}`
  };
}

/**
 * Get video duration using ffprobe
 * @param {string} videoPath - Path to video file
 * @returns {Promise<number>} Duration in seconds
 */
export function getVideoDuration(videoPath) {
  return new Promise((resolve, reject) => {
    import('fluent-ffmpeg').then(ffmpegModule => {
      const ffmpeg = ffmpegModule.default;
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          resolve(metadata.format.duration);
        }
      });
    }).catch(reject);
  });
}

/**
 * Get recommended sampling profile based on video duration
 * @param {number} videoDuration - Video duration in seconds
 * @returns {string} Recommended profile name
 */
export function getRecommendedProfile(videoDuration) {
  if (videoDuration <= 180) {
    // Videos under 3 minutes: use HIGH quality
    return 'HIGH';
  } else if (videoDuration <= 300) {
    // Videos 3-5 minutes: use STANDARD quality
    return 'STANDARD';
  } else if (videoDuration <= 600) {
    // Videos 5-10 minutes: use ECONOMY
    return 'ECONOMY';
  } else {
    // Very long videos: use ADAPTIVE
    return 'ADAPTIVE';
  }
}

export default {
  SamplingProfiles,
  calculateSamplingStrategy,
  getVideoDuration,
  getRecommendedProfile
};
