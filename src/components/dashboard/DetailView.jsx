import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown } from 'lucide-react';

const DetailView = ({ session }) => {
  const [expandedMetric, setExpandedMetric] = useState(null);

  const formatMetricName = (key) => {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getMetricColor = (value, isReversed = false) => {
    if (isReversed) {
      if (value <= 1) return 'clinical-teal';
      if (value <= 3) return 'warm-amber';
      return 'alert-red';
    } else {
      if (value >= 70) return 'clinical-teal';
      if (value >= 50) return 'warm-amber';
      return 'alert-red';
    }
  };

  const communicationMetrics = [
    { key: 'eye_contact_pct', label: 'Eye Contact with Patient', unit: '%', good: 72, poor: 23, method: 'Gaze vector estimation from pose model' },
    { key: 'open_question_ratio', label: 'Open-ended Questions', unit: 'ratio', good: 0.8, poor: 0.15, method: 'NLP question-type classification', multiplier: 100 },
    { key: 'interruption_count', label: 'Clinician Interruptions', unit: 'count', good: 1, poor: 7, method: 'Speaker diarization overlap detection', reversed: true },
    { key: 'empathy_count', label: 'Empathy Phrases Detected', unit: 'count', good: 5, poor: 0, method: 'NLP sentiment + empathy lexicon matching' },
    { key: 'patient_speaking_pct', label: 'Patient Speaking Time', unit: '%', good: 42, poor: 18, method: 'Speaker diarization time calculation' },
    { key: 'avg_response_latency', label: 'Average Response Latency', unit: 's', good: 1.2, poor: 0.4, method: 'Turn-taking gap measurement' },
    { key: 'teachback_count', label: 'Teach-back Prompts Used', unit: 'count', good: 3, poor: 0, method: 'NLP pattern matching for teach-back phrases' },
    { key: 'jargon_unexplained_count', label: 'Jargon Without Explanation', unit: 'count', good: 0, poor: 6, method: 'Medical terminology NLP + explanation detection', reversed: true },
  ];

  const bodyLanguageMetrics = [
    { key: 'open_posture_pct', label: 'Open Posture', unit: '%', good: 78, poor: 31, method: 'Pose estimation: shoulder orientation + arm position classification' },
    { key: 'forward_lean_pct', label: 'Forward Lean Toward Patient', unit: '%', good: 62, poor: 18, method: 'Torso angle relative to vertical via spine keypoints' },
    { key: 'arms_crossed_pct', label: 'Arms Crossed Duration', unit: '%', good: 3, poor: 34, method: 'Wrist-to-elbow-to-shoulder angle detection when arms overlap torso midline', reversed: true },
    { key: 'nod_count', label: 'Head Nodding Frequency', unit: 'count', good: 24, poor: 4, method: 'Head keypoint vertical oscillation pattern detection' },
    { key: 'gesture_count', label: 'Illustrative Gestures', unit: 'count', good: 18, poor: 3, method: 'Hand keypoint velocity + trajectory classification (not fidgeting)' },
    { key: 'mirroring_instances', label: 'Mirroring Behavior', unit: 'count', good: 6, poor: 0, method: 'Pose similarity scoring between clinician and patient skeletons across 2s windows' },
    { key: 'avg_proximity_cm', label: 'Average Proximity', unit: 'cm', good: 85, poor: 140, method: 'Hip keypoint distance estimation calibrated to room scale', reversed: true },
    { key: 'proximity_shifts', label: 'Proximity Shifts Toward Patient', unit: 'count', good: 4, poor: 0, method: 'Sustained hip keypoint displacement > 15cm toward patient' },
  ];

  const renderMetricSection = (title, metrics, icon) => {
    return (
      <div className="mb-8">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          {icon}
          {title}
        </h3>
        <div className="space-y-3">
          {metrics.map((metric) => {
            const value = session.metrics[metric.key];
            if (value === undefined) return null;

            const displayValue = metric.multiplier ? (value * metric.multiplier).toFixed(0) : value;
            const isExpanded = expandedMetric === metric.key;
            const color = getMetricColor(metric.reversed ? -value : value, metric.reversed);
            const goodValue = metric.multiplier ? (metric.good * metric.multiplier).toFixed(0) : metric.good;
            const poorValue = metric.multiplier ? (metric.poor * metric.multiplier).toFixed(0) : metric.poor;

            return (
              <div
                key={metric.key}
                className="card bg-slate/50 p-4 cursor-pointer hover:bg-slate/70 transition-colors"
                onClick={() => setExpandedMetric(isExpanded ? null : metric.key)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold">{metric.label}</h4>
                      <div className="flex items-center gap-3">
                        <span className={`text-2xl font-bold font-mono text-${color}`}>
                          {displayValue}{metric.unit === '%' ? '%' : metric.unit === 's' ? 's' : ''}
                        </span>
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </div>
                    </div>

                    {/* Progress Bar Comparison */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-gray-500 w-12">Poor</span>
                      <div className="flex-1 h-2 bg-deep-navy rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-${color} transition-all`}
                          style={{
                            width: `${Math.min(100, (parseFloat(displayValue) / 100) * 100)}%`
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-12 text-right">Good</span>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 pt-4 border-t border-slate/40"
                  >
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center">
                        <p className="text-xs text-gray-500 mb-1">This Session</p>
                        <p className={`text-lg font-bold text-${color}`}>
                          {displayValue}{metric.unit === '%' ? '%' : metric.unit === 's' ? 's' : ''}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500 mb-1">Good Example</p>
                        <p className="text-lg font-bold text-clinical-teal">
                          {goodValue}{metric.unit === '%' ? '%' : metric.unit === 's' ? 's' : ''}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500 mb-1">Poor Example</p>
                        <p className="text-lg font-bold text-alert-red">
                          {poorValue}{metric.unit === '%' ? '%' : metric.unit === 's' ? 's' : ''}
                        </p>
                      </div>
                    </div>

                    <div className="bg-deep-navy/50 rounded-lg p-3">
                      <p className="text-xs text-gray-400">
                        <strong>Measurement Method:</strong> {metric.method}
                      </p>
                    </div>
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-3xl font-bold mb-2">Detailed Metrics Breakdown</h2>
        <p className="text-gray-400">
          Granular view of how each score was computed. Click any metric to see measurement methodology.
        </p>
      </div>

      {renderMetricSection('Communication Quality Metrics', communicationMetrics, '💬')}
      {renderMetricSection('Body Language Metrics', bodyLanguageMetrics, '🤸')}

      <div className="card bg-insight-blue/10 border-insight-blue/30 p-6 mt-8">
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          💡 Key Differentiator
        </h3>
        <p className="text-gray-300">
          No existing simulation analysis tool provides automated body language scoring. The Body Language
          metrics shown above are derived from pose estimation (MediaPipe or similar), mapping to
          clinically-validated nonverbal communication predictors of patient trust and adherence.
        </p>
      </div>
    </div>
  );
};

export default DetailView;
