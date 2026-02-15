import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import ScoreCards from './dashboard/ScoreCards';
import BehavioralTimeline from './dashboard/BehavioralTimeline';
import RadarChart from './dashboard/RadarChart';
import AnnotatedTranscript from './dashboard/AnnotatedTranscript';
import ComparisonView from './dashboard/ComparisonView';
import DetailView from './dashboard/DetailView';
import IntegratedVideoView from './dashboard/IntegratedVideoView';

const DashboardView = () => {
  const { currentSession, activeTab, setActiveTab, resetSession } = useAppStore();

  if (!currentSession) {
    return (
      <div className="min-h-screen bg-deep-navy flex items-center justify-center">
        <p className="text-gray-400">No session data loaded</p>
      </div>
    );
  }

  const handleExportReport = async () => {
    try {
      const response = await fetch('/api/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionData: currentSession })
      });

      const data = await response.json();

      if (data.success) {
        // Download as JSON
        const blob = new Blob([JSON.stringify(data.report, null, 2)], {
          type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `siminsight-report-${currentSession.id}.json`;
        a.click();
      }
    } catch (error) {
      console.error('Error generating report:', error);
    }
  };

  return (
    <div className="min-h-screen bg-deep-navy">
      {/* Header */}
      <header className="border-b border-slate/40 bg-deep-navy/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-[1800px] mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={resetSession}
                className="btn bg-slate hover:bg-slate/80 text-white px-4 py-2"
              >
                <ArrowLeft size={18} className="inline mr-2" />
                New Analysis
              </button>
              <div>
                <h1 className="text-xl font-bold">
                  {currentSession.title}
                </h1>
                <p className="text-sm text-gray-400">
                  Session ID: {currentSession.id} • Duration: {Math.floor(currentSession.duration_seconds / 60)}:{String(currentSession.duration_seconds % 60).padStart(2, '0')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Tab Navigation */}
              <div className="flex bg-slate rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('integrated')}
                  className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                    activeTab === 'integrated'
                      ? 'bg-clinical-teal text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Video Analysis
                </button>
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                    activeTab === 'dashboard'
                      ? 'bg-clinical-teal text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => setActiveTab('details')}
                  className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                    activeTab === 'details'
                      ? 'bg-clinical-teal text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Details
                </button>
                <button
                  onClick={() => setActiveTab('comparison')}
                  className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                    activeTab === 'comparison'
                      ? 'bg-clinical-teal text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Comparison
                </button>
              </div>

              <button
                onClick={handleExportReport}
                className="btn btn-secondary"
              >
                <Download size={18} className="inline mr-2" />
                Export Report
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-[1800px] mx-auto px-8 py-8">
        {activeTab === 'integrated' && (
          <motion.div
            key="integrated"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <IntegratedVideoView session={currentSession} />
          </motion.div>
        )}

        {activeTab === 'dashboard' && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {/* Score Cards */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">Composite Scores</h2>
              <ScoreCards scores={currentSession.scores} />
            </section>

            {/* Behavioral Timeline */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">Behavioral Timeline</h2>
              <BehavioralTimeline
                timeline={currentSession.timeline}
                duration={currentSession.duration_seconds}
              />
            </section>

            {/* Analytics Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Radar Chart */}
              <section>
                <h2 className="text-2xl font-bold mb-4">Interaction Analytics</h2>
                <RadarChart data={currentSession.radar} />
              </section>

              {/* Transcript */}
              <section>
                <h2 className="text-2xl font-bold mb-4">Annotated Transcript</h2>
                <AnnotatedTranscript transcript={currentSession.transcript} />
              </section>
            </div>
          </motion.div>
        )}

        {activeTab === 'details' && (
          <motion.div
            key="details"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <DetailView session={currentSession} />
          </motion.div>
        )}

        {activeTab === 'comparison' && (
          <motion.div
            key="comparison"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <ComparisonView currentSession={currentSession} />
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default DashboardView;
