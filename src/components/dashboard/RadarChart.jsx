import React from 'react';
import { motion } from 'framer-motion';
import { Radar, RadarChart as RechartsRadar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

const RadarChart = ({ data }) => {
  // Format data for Recharts
  const chartData = Object.entries(data).map(([key, value]) => ({
    metric: formatMetricName(key),
    value: value,
    benchmark: getBenchmark(key)
  }));

  function formatMetricName(key) {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  function getBenchmark(key) {
    // Average benchmark values for good performers
    const benchmarks = {
      eye_contact: 65,
      question_quality: 70,
      speaking_balance: 60,
      language_clarity: 80,
      empathy: 70,
      active_listening: 75,
      posture_openness: 70,
      physical_engagement: 68
    };
    return benchmarks[key] || 70;
  }

  return (
    <div className="card h-[500px]">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsRadar data={chartData}>
          <PolarGrid stroke="#334155" />
          <PolarAngleAxis
            dataKey="metric"
            tick={{ fill: '#94A3B8', fontSize: 12 }}
            stroke="#334155"
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: '#64748B' }}
            stroke="#334155"
          />
          {/* Benchmark overlay */}
          <Radar
            name="Benchmark"
            dataKey="benchmark"
            stroke="#64748B"
            fill="#64748B"
            fillOpacity={0.1}
            strokeDasharray="5 5"
          />
          {/* Current session */}
          <Radar
            name="This Session"
            dataKey="value"
            stroke="#0D9488"
            fill="#0D9488"
            fillOpacity={0.3}
            strokeWidth={2}
          />
        </RechartsRadar>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-clinical-teal/30 border-2 border-clinical-teal rounded-sm" />
          <span>This Session</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-gray-500 border-dashed rounded-sm" />
          <span className="text-gray-400">Benchmark</span>
        </div>
      </div>

      {/* Note */}
      <p className="text-xs text-gray-500 text-center mt-4">
        8 dimensions of interaction quality overlaid on benchmark averages
      </p>
    </div>
  );
};

export default RadarChart;
