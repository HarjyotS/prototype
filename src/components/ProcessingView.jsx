import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Radio, Users, Activity, Brain, BarChart3, Check } from 'lucide-react';
import { useAppStore } from '../store/appStore';

const ProcessingView = () => {
  const { processingStage, overshootProgress } = useAppStore();

  const stages = [
    {
      id: 1,
      label: 'Audio Extraction & Transcription',
      duration: '2s',
      icon: Radio,
      visual: 'Waveform animation',
      color: 'clinical-teal'
    },
    {
      id: 2,
      label: 'Speaker Diarization & Role Detection',
      duration: '1.5s',
      icon: Users,
      visual: 'Two silhouette icons separating',
      color: 'insight-blue'
    },
    {
      id: 3,
      label: 'Pose Estimation, Gaze Tracking & Body Language Analysis',
      duration: '2.5s',
      icon: Activity,
      visual: 'Skeleton wireframe overlay with posture/gesture annotations',
      color: 'clinical-teal'
    },
    {
      id: 4,
      label: 'Linguistic & Behavioral Analysis',
      duration: '2s',
      icon: Brain,
      visual: 'Text highlight scanning animation',
      color: 'insight-blue'
    },
    {
      id: 5,
      label: 'Composite Score Generation',
      duration: '1.5s',
      icon: BarChart3,
      visual: 'Radar chart drawing in',
      color: 'clinical-teal'
    }
  ];

  const totalDuration = stages.reduce((sum, stage) => sum + parseFloat(stage.duration), 0);
  const elapsedTime = stages
    .slice(0, processingStage)
    .reduce((sum, stage) => sum + parseFloat(stage.duration), 0);
  const progressPercent = (elapsedTime / totalDuration) * 100;

  return (
    <div className="min-h-screen bg-deep-navy flex items-center justify-center p-8">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-3xl font-bold mb-2">Processing Clinical Interaction</h1>
          <p className="text-gray-400">
            Running multimodal AI analysis pipeline
          </p>
        </motion.div>

        {/* Processing Stages */}
        <div className="card bg-slate/50 backdrop-blur-sm p-8">
          <div className="space-y-6">
            {stages.map((stage, index) => {
              const isActive = processingStage === stage.id;
              const isCompleted = processingStage > stage.id;
              const isPending = processingStage < stage.id;

              const StageIcon = stage.icon;

              return (
                <motion.div
                  key={stage.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`flex items-center gap-4 p-4 rounded-lg transition-all ${
                    isActive
                      ? 'bg-clinical-teal/10 border border-clinical-teal/30'
                      : isCompleted
                      ? 'bg-clinical-teal/5 border border-clinical-teal/20'
                      : 'bg-slate/30 border border-slate/20'
                  }`}
                >
                  {/* Stage Number / Icon */}
                  <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                    isCompleted
                      ? 'bg-clinical-teal text-deep-navy'
                      : isActive
                      ? 'bg-clinical-teal/20 text-clinical-teal animate-pulse'
                      : 'bg-slate/50 text-gray-500'
                  }`}>
                    {isCompleted ? (
                      <Check size={24} />
                    ) : (
                      <StageIcon size={24} />
                    )}
                  </div>

                  {/* Stage Info */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className={`font-semibold ${
                        isActive ? 'text-clinical-teal' : isCompleted ? 'text-white' : 'text-gray-400'
                      }`}>
                        Stage {stage.id}: {stage.label}
                      </h3>
                      <span className={`text-sm font-mono ${
                        isActive || isCompleted ? 'text-clinical-teal' : 'text-gray-500'
                      }`}>
                        {stage.duration}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      {stage.visual}
                    </p>

                    {/* OpenAI Vision live progress for stage 3 */}
                    {stage.id === 3 && isActive && overshootProgress.isProcessing && (
                      <div className="mt-2 p-2 bg-clinical-teal/5 rounded border border-clinical-teal/20">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-clinical-teal font-semibold">
                            OpenAI Vision Analysis
                          </span>
                          <span className="text-clinical-teal font-mono">
                            {overshootProgress.resultsCount} frames analyzed
                          </span>
                        </div>
                        {overshootProgress.latestAnalysis && (
                          <p className="text-xs text-gray-400 truncate">
                            Latest: {overshootProgress.latestAnalysis.substring(0, 80)}...
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Visual Indicator */}
                  {isActive && (
                    <div className="flex-shrink-0">
                      <div className="flex gap-1">
                        <motion.div
                          className="w-2 h-2 bg-clinical-teal rounded-full"
                          animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                          transition={{ duration: 1, repeat: Infinity }}
                        />
                        <motion.div
                          className="w-2 h-2 bg-clinical-teal rounded-full"
                          animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                          transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                        />
                        <motion.div
                          className="w-2 h-2 bg-clinical-teal rounded-full"
                          animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                          transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                        />
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Progress Bar */}
          <div className="mt-8">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Overall Progress</span>
              <span className="font-mono text-clinical-teal">
                {Math.round(progressPercent)}%
              </span>
            </div>
            <div className="h-2 bg-slate rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-clinical-teal to-insight-blue"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.5, ease: 'easeInOut' }}
              />
            </div>
            <div className="mt-2 text-center text-sm text-gray-500">
              <span className="font-mono">
                {elapsedTime.toFixed(1)}s / {totalDuration.toFixed(1)}s
              </span>
            </div>
          </div>

          {/* OpenAI Vision Live Progress */}
          {processingStage === 3 && overshootProgress.isProcessing && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 p-4 bg-clinical-teal/10 border border-clinical-teal/30 rounded-lg"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-clinical-teal rounded-full animate-pulse" />
                  <span className="text-sm font-semibold text-clinical-teal">
                    OpenAI GPT-4 Vision Analysis
                  </span>
                </div>
                <span className="text-sm font-mono text-clinical-teal">
                  {overshootProgress.resultsCount} frames processed
                </span>
              </div>

              {overshootProgress.latestAnalysis && (
                <div className="bg-deep-navy/50 rounded p-3">
                  <p className="text-xs text-gray-400 mb-1">Latest Detection:</p>
                  <p className="text-sm text-white line-clamp-2">
                    {overshootProgress.latestAnalysis}
                  </p>
                </div>
              )}

              <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                <Activity size={14} className="text-clinical-teal" />
                <span>Analyzing body language, eye contact, and engagement patterns...</span>
              </div>
            </motion.div>
          )}
        </div>

        {/* Bottom Note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 text-center text-sm text-gray-500"
        >
          <p>
            This is where you demonstrate engineering depth to the VP of Technology
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default ProcessingView;
