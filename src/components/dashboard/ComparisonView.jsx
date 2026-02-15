import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

const ComparisonView = ({ currentSession }) => {
  const { selectComparisonSample, comparisonSample } = useAppStore();
  const [selectedTab, setSelectedTab] = useState('session'); // 'session' | 'progress' | 'cohort'

  useEffect(() => {
    // Auto-load the opposite sample for comparison
    if (currentSession.id.includes('good')) {
      selectComparisonSample('B');
    } else {
      selectComparisonSample('A');
    }
  }, [currentSession]);

  if (!comparisonSample) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">Loading comparison data...</p>
      </div>
    );
  }

  // Session Comparison Tab
  const SessionComparison = () => {
    const comparisonData = Object.keys(currentSession.scores).map(key => ({
      metric: key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      current: currentSession.scores[key].value,
      comparison: comparisonSample.scores[key].value,
      difference: currentSession.scores[key].value - comparisonSample.scores[key].value
    }));

    return (
      <div>
        <div className="mb-6">
          <h3 className="text-2xl font-bold mb-2">Session Comparison</h3>
          <p className="text-gray-400">
            Side-by-side comparison: <span className="text-clinical-teal">{currentSession.title}</span> vs{' '}
            <span className="text-warm-amber">{comparisonSample.title}</span>
          </p>
        </div>

        {/* Bar Chart */}
        <div className="card mb-8 p-6" style={{ height: '500px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparisonData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis type="number" domain={[0, 100]} stroke="#94A3B8" />
              <YAxis type="category" dataKey="metric" width={180} stroke="#94A3B8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0F172A',
                  border: '1px solid #334155',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Bar dataKey="current" fill="#0D9488" name={currentSession.title.substring(0, 30)} />
              <Bar dataKey="comparison" fill="#F59E0B" name={comparisonSample.title.substring(0, 30)} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Difference Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {comparisonData.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`card p-4 ${
                item.difference > 0 ? 'border-clinical-teal/30' : 'border-alert-red/30'
              }`}
            >
              <h4 className="font-semibold mb-3 text-sm">{item.metric}</h4>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold font-mono">
                    {item.current}
                  </div>
                  <div className="text-xs text-gray-500">vs {item.comparison}</div>
                </div>
                <div className={`flex items-center gap-1 ${
                  item.difference > 0 ? 'text-clinical-teal' : 'text-alert-red'
                }`}>
                  {item.difference > 0 ? (
                    <>
                      <ArrowUp size={20} />
                      <span className="font-bold">+{item.difference}</span>
                    </>
                  ) : (
                    <>
                      <ArrowDown size={20} />
                      <span className="font-bold">{item.difference}</span>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  };

  // Learner Progress Tab (Longitudinal)
  const LearnerProgress = () => {
    // Mock longitudinal data
    const progressData = [
      { session: 1, communication_quality: 52, explanation_clarity: 48, patient_engagement: 45, body_language: 50, adherence_support: 47 },
      { session: 2, communication_quality: 58, explanation_clarity: 55, patient_engagement: 52, body_language: 54, adherence_support: 53 },
      { session: 3, communication_quality: 65, explanation_clarity: 63, patient_engagement: 60, body_language: 62, adherence_support: 61 },
      { session: 4, communication_quality: 74, explanation_clarity: 72, patient_engagement: 68, body_language: 70, adherence_support: 69 },
      { session: 5, communication_quality: currentSession.scores.communication_quality.value,
        explanation_clarity: currentSession.scores.explanation_clarity.value,
        patient_engagement: currentSession.scores.patient_engagement.value,
        body_language: currentSession.scores.body_language.value,
        adherence_support: currentSession.scores.adherence_support.value
      },
    ];

    return (
      <div>
        <div className="mb-6">
          <h3 className="text-2xl font-bold mb-2">Learner Progress</h3>
          <p className="text-gray-400">
            Track improvement over multiple simulation sessions
          </p>
        </div>

        <div className="card p-6 mb-6" style={{ height: '500px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={progressData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="session" stroke="#94A3B8" label={{ value: 'Session Number', position: 'bottom' }} />
              <YAxis domain={[0, 100]} stroke="#94A3B8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0F172A',
                  border: '1px solid #334155',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="communication_quality" stroke="#0D9488" strokeWidth={2} name="Communication" />
              <Line type="monotone" dataKey="explanation_clarity" stroke="#3B82F6" strokeWidth={2} name="Explanation" />
              <Line type="monotone" dataKey="patient_engagement" stroke="#F59E0B" strokeWidth={2} name="Engagement" />
              <Line type="monotone" dataKey="body_language" stroke="#8B5CF6" strokeWidth={2} name="Body Language" />
              <Line type="monotone" dataKey="adherence_support" stroke="#EC4899" strokeWidth={2} name="Adherence" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card bg-clinical-teal/10 border-clinical-teal/30 p-6">
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <TrendingUp size={20} className="text-clinical-teal" />
            Progress Insights
          </h4>
          <ul className="space-y-2 text-sm text-gray-300">
            <li>• Communication quality improved by <strong className="text-clinical-teal">35 points</strong> over 5 sessions</li>
            <li>• Most significant improvement in <strong className="text-clinical-teal">Explanation Clarity</strong> (+24 points)</li>
            <li>• Consistent upward trend indicates effective training interventions</li>
            <li>• This quantifies whether simulation curriculum actually works</li>
          </ul>
        </div>
      </div>
    );
  };

  // Cohort Analytics Tab
  const CohortAnalytics = () => {
    // Mock cohort distribution data
    const cohortData = [
      { range: '0-20', count: 2 },
      { range: '21-40', count: 5 },
      { range: '41-60', count: 12 },
      { range: '61-80', count: 18 },
      { range: '81-100', count: 13 },
    ];

    const currentScore = Object.values(currentSession.scores).reduce((sum, s) => sum + s.value, 0) / Object.keys(currentSession.scores).length;
    const percentile = 84; // Mock percentile

    return (
      <div>
        <div className="mb-6">
          <h3 className="text-2xl font-bold mb-2">Cohort Analytics</h3>
          <p className="text-gray-400">
            Compare this session against a cohort of 50 learners
          </p>
        </div>

        {/* Percentile Card */}
        <div className="card bg-gradient-to-br from-clinical-teal/20 to-insight-blue/20 border-clinical-teal/30 p-8 mb-6 text-center">
          <h4 className="text-gray-400 mb-2">Your Percentile Rank</h4>
          <div className="text-6xl font-bold text-clinical-teal mb-2">
            {percentile}th
          </div>
          <p className="text-gray-300">
            You performed better than <strong>{percentile}%</strong> of learners in the cohort
          </p>
        </div>

        {/* Distribution Chart */}
        <div className="card p-6 mb-6" style={{ height: '400px' }}>
          <h4 className="font-semibold mb-4">Score Distribution</h4>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cohortData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="range" stroke="#94A3B8" label={{ value: 'Score Range', position: 'bottom' }} />
              <YAxis stroke="#94A3B8" label={{ value: 'Number of Learners', angle: -90, position: 'insideLeft' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0F172A',
                  border: '1px solid #334155',
                  borderRadius: '8px'
                }}
              />
              <Bar dataKey="count" fill="#0D9488" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-4 text-center">
            <div className="text-gray-400 text-sm mb-1">Your Score</div>
            <div className="text-3xl font-bold text-clinical-teal">
              {Math.round(currentScore)}
            </div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-gray-400 text-sm mb-1">Cohort Average</div>
            <div className="text-3xl font-bold text-gray-300">
              68
            </div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-gray-400 text-sm mb-1">Top Performer</div>
            <div className="text-3xl font-bold text-gray-300">
              94
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Tab Navigation */}
      <div className="flex gap-3 mb-6 border-b border-slate/40">
        <button
          onClick={() => setSelectedTab('session')}
          className={`px-6 py-3 font-medium transition-colors relative ${
            selectedTab === 'session'
              ? 'text-clinical-teal'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Session Comparison
          {selectedTab === 'session' && (
            <motion.div
              layoutId="activeTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-clinical-teal"
            />
          )}
        </button>
        <button
          onClick={() => setSelectedTab('progress')}
          className={`px-6 py-3 font-medium transition-colors relative ${
            selectedTab === 'progress'
              ? 'text-clinical-teal'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Learner Progress
          {selectedTab === 'progress' && (
            <motion.div
              layoutId="activeTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-clinical-teal"
            />
          )}
        </button>
        <button
          onClick={() => setSelectedTab('cohort')}
          className={`px-6 py-3 font-medium transition-colors relative ${
            selectedTab === 'cohort'
              ? 'text-clinical-teal'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Cohort Analytics
          {selectedTab === 'cohort' && (
            <motion.div
              layoutId="activeTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-clinical-teal"
            />
          )}
        </button>
      </div>

      {/* Tab Content */}
      {selectedTab === 'session' && <SessionComparison />}
      {selectedTab === 'progress' && <LearnerProgress />}
      {selectedTab === 'cohort' && <CohortAnalytics />}
    </div>
  );
};

export default ComparisonView;
