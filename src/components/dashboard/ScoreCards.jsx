import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Info } from 'lucide-react';

const ScoreCards = ({ scores }) => {
  const [animatedScores, setAnimatedScores] = useState({});

  useEffect(() => {
    // Animate score count-up
    const duration = 1500; // 1.5 seconds
    const steps = 60;
    const interval = duration / steps;

    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;

      const newScores = {};
      Object.entries(scores).forEach(([key, data]) => {
        newScores[key] = Math.round(data.value * progress);
      });

      setAnimatedScores(newScores);

      if (currentStep >= steps) {
        clearInterval(timer);
        // Set final values
        const finalScores = {};
        Object.entries(scores).forEach(([key, data]) => {
          finalScores[key] = data.value;
        });
        setAnimatedScores(finalScores);
      }
    }, interval);

    return () => clearInterval(timer);
  }, [scores]);

  const getScoreColor = (score) => {
    if (score >= 75) return 'clinical-teal';
    if (score >= 50) return 'warm-amber';
    return 'alert-red';
  };

  const getScoreGrade = (score) => {
    if (score >= 75) return { text: 'Excellent/Good', class: 'score-excellent' };
    if (score >= 50) return { text: 'Needs Improvement', class: 'score-medium' };
    return { text: 'Poor', class: 'score-poor' };
  };

  const formatKey = (key) => {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {Object.entries(scores).map(([key, data], index) => {
        const scoreColor = getScoreColor(data.value);
        const scoreGrade = getScoreGrade(data.value);
        const currentScore = animatedScores[key] || 0;
        const circumference = 2 * Math.PI * 45; // radius = 45
        const progress = (currentScore / 100) * circumference;

        return (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`card ${scoreGrade.class} p-6 relative overflow-hidden group`}
          >
            {/* Background Glow */}
            <div className={`absolute inset-0 bg-gradient-to-br from-${scoreColor}/5 to-transparent opacity-50`} />

            {/* Content */}
            <div className="relative">
              {/* Circular Progress */}
              <div className="flex justify-center mb-4">
                <div className="relative w-32 h-32">
                  <svg className="transform -rotate-90" width="128" height="128">
                    {/* Background circle */}
                    <circle
                      cx="64"
                      cy="64"
                      r="45"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="8"
                      className="text-slate opacity-20"
                    />
                    {/* Progress circle */}
                    <motion.circle
                      cx="64"
                      cy="64"
                      r="45"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="8"
                      strokeLinecap="round"
                      className={`text-${scoreColor}`}
                      initial={{ strokeDasharray: circumference, strokeDashoffset: circumference }}
                      animate={{ strokeDashoffset: circumference - progress }}
                      transition={{ duration: 1.5, ease: 'easeOut' }}
                    />
                  </svg>
                  {/* Score Number */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-bold font-mono">
                      {currentScore}
                    </span>
                    <span className="text-xs text-gray-400">/100</span>
                  </div>
                </div>
              </div>

              {/* Label */}
              <h3 className="font-semibold text-center mb-2">
                {formatKey(key)}
              </h3>

              {/* Grade */}
              <div className={`text-center text-sm font-medium mb-3 px-3 py-1 rounded-full bg-${scoreColor}/20 text-${scoreColor}`}>
                {data.grade}
              </div>

              {/* Drivers */}
              <div className="text-xs text-gray-400 space-y-1">
                {data.drivers.slice(0, 3).map((driver, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="mt-1">•</span>
                    <span className="flex-1">{driver}</span>
                  </div>
                ))}
              </div>

              {/* Hover Info */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Info size={16} className="text-gray-400" />
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default ScoreCards;
