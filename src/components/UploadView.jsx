import React from 'react';
import { motion } from 'framer-motion';
import { Upload, Play, Sparkles, History, Trash2, Clock } from 'lucide-react';
import { useAppStore } from '../store/appStore';

const UploadView = () => {
  const { startProcessing, loadSession } = useAppStore();
  const [youtubeLoading, setYoutubeLoading] = React.useState(false);
  const [youtubeError, setYoutubeError] = React.useState('');
  const [isDragging, setIsDragging] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState(null);
  const [previousSessions, setPreviousSessions] = React.useState([]);
  const [sessionStats, setSessionStats] = React.useState(null);
  const [loadingSessions, setLoadingSessions] = React.useState(true);
  const fileInputRef = React.useRef(null);

  // Fetch previous sessions on mount
  React.useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/sessions');
      const data = await response.json();

      if (data.success) {
        setPreviousSessions(data.sessions || []);
        setSessionStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleLoadSession = async (sessionId) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`);
      const data = await response.json();

      if (data.success && data.session) {
        loadSession(data.session);
      } else {
        alert('Failed to load session');
      }
    } catch (error) {
      console.error('Error loading session:', error);
      alert('Failed to load session');
    }
  };

  const handleDeleteSession = async (sessionId, e) => {
    e.stopPropagation(); // Prevent triggering the load action

    if (!confirm('Are you sure you want to delete this session?')) {
      return;
    }

    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        // Refresh sessions list
        fetchSessions();
      } else {
        alert('Failed to delete session');
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      alert('Failed to delete session');
    }
  };

  const getGradeColor = (grade) => {
    switch (grade?.toLowerCase()) {
      case 'honors':
        return 'text-clinical-teal';
      case 'high_pass':
        return 'text-insight-blue';
      case 'pass':
        return 'text-warm-amber';
      case 'fail':
        return 'text-alert-red';
      default:
        return 'text-gray-400';
    }
  };

  const formatGrade = (grade) => {
    if (!grade) return 'N/A';
    return grade.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleYouTubeImport = async (url) => {
    setYoutubeLoading(true);
    setYoutubeError('');

    try {
      const response = await fetch('/api/youtube-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      const data = await response.json();

      if (data.success && data.jobId) {
        // YouTube video downloaded and processing started automatically
        alert(`YouTube video imported successfully!\nTitle: ${data.title}\n\nProcessing with OpenAI Vision and Deepgram...`);

        // Start polling for the YouTube processing job
        startProcessingFromJobId(data.jobId);
      } else {
        setYoutubeError(data.error || 'Failed to import YouTube video');
      }
    } catch (error) {
      console.error('YouTube import error:', error);
      setYoutubeError('Failed to import YouTube video. Please check the URL.');
    } finally {
      setYoutubeLoading(false);
    }
  };

  const startProcessingFromJobId = (jobId) => {
    // Set processing state and start polling
    useAppStore.getState().setIsProcessing(true);
    useAppStore.getState().setProcessingStage(0);
    useAppStore.getState().setCurrentView('processing');

    // Poll for results
    const pollInterval = setInterval(async () => {
      try {
        const statusResponse = await fetch(`/api/analysis-status/${jobId}`);
        const statusData = await statusResponse.json();

        console.log('Job status:', statusData);

        // Update stage based on progress
        if (statusData.status === 'processing') {
          if (statusData.stage === 'audio_extraction') useAppStore.getState().setProcessingStage(1);
          else if (statusData.stage === 'transcription') useAppStore.getState().setProcessingStage(2);
          else if (statusData.stage === 'video_analysis') useAppStore.getState().setProcessingStage(3);
          else if (statusData.stage === 'behavioral_scoring') useAppStore.getState().setProcessingStage(4);
        }

        if (statusData.status === 'complete' && statusData.finalResults) {
          clearInterval(pollInterval);
          useAppStore.getState().setProcessingStage(5);

          // Wait a moment then transition to dashboard
          setTimeout(() => {
            useAppStore.getState().loadSession(statusData.finalResults);
          }, 1000);
        } else if (statusData.status === 'error') {
          clearInterval(pollInterval);
          console.error('Processing error:', statusData.error);
          alert('Processing failed: ' + statusData.error);
          useAppStore.getState().setIsProcessing(false);
          useAppStore.getState().setCurrentView('upload');
        }
      } catch (error) {
        console.error('Error polling status:', error);
      }
    }, 2000); // Poll every 2 seconds

    // Safety timeout after 10 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      if (useAppStore.getState().isProcessing) {
        alert('Processing timed out. Please try again with a shorter video.');
        useAppStore.getState().setIsProcessing(false);
        useAppStore.getState().setCurrentView('upload');
      }
    }, 600000);
  };

  const samples = [
    {
      id: 'A',
      title: 'Medication Counseling — Good Communication',
      description: 'Demonstrates high scores with patient-centered approach',
      duration: '3:00',
      thumbnail: '/thumbnails/sample-a.jpg'
    },
    {
      id: 'B',
      title: 'Medication Counseling — Poor Communication',
      description: 'Demonstrates low scores with clinician-centered patterns',
      duration: '3:00',
      thumbnail: '/thumbnails/sample-b.jpg'
    },
    {
      id: 'C',
      title: 'Patient History Intake',
      description: 'Different scenario type demonstration',
      duration: '4:30',
      thumbnail: '/thumbnails/sample-c.jpg'
    }
  ];

  const handleAnalyze = (sampleId) => {
    startProcessing(sampleId, false); // Use sample data
  };

  const handleFileSelect = (file) => {
    // Validate file type
    const validTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/avi'];
    if (!validTypes.includes(file.type)) {
      alert('Please upload a valid video file (MP4, MOV, or AVI)');
      return;
    }

    // Validate file size (500MB)
    if (file.size > 500 * 1024 * 1024) {
      alert('File size must be less than 500MB');
      return;
    }

    setSelectedFile(file);

    // Confirm and start processing
    if (confirm(`Process video: ${file.name}?\n\nThis will analyze the video using OpenAI GPT-4 Vision and Deepgram APIs.`)) {
      startProcessing(file, true); // Use real processing
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  return (
    <div className="min-h-screen bg-deep-navy text-white">
      {/* Header */}
      <header className="border-b border-slate/40 bg-deep-navy/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Sparkles className="text-clinical-teal" size={32} />
                SimInsight
              </h1>
              <p className="text-gray-400 mt-1">AI-Powered Clinical Interaction Analysis</p>
            </div>
            <div className="flex gap-3">
              <button className="btn btn-secondary text-sm">
                Documentation
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-8 py-12">
        {/* Upload Zone */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card card-hover mb-8 text-center py-12"
        >
          <div className="max-w-xl mx-auto">
            <div className="w-20 h-20 bg-clinical-teal/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Upload className="text-clinical-teal" size={40} />
            </div>
            <h2 className="text-2xl font-semibold mb-2">
              Upload Simulation Recording
            </h2>
            <p className="text-gray-400 mb-6">
              Drag and drop a clinical simulation video file (MP4, MOV, or AVI)
            </p>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-12 transition-all cursor-pointer ${
                isDragging
                  ? 'border-clinical-teal bg-clinical-teal/10'
                  : 'border-slate/40 hover:border-clinical-teal/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/x-msvideo,video/avi"
                onChange={handleFileInputChange}
                className="hidden"
              />
              <p className="text-gray-500">
                {isDragging ? 'Drop video file here...' : 'Drop a simulation recording here or click to browse'}
              </p>
              <p className="text-sm text-gray-600 mt-2">
                Supported formats: MP4, MOV, AVI (max 500MB)
              </p>
              {selectedFile && (
                <p className="text-sm text-clinical-teal mt-2">
                  Selected: {selectedFile.name}
                </p>
              )}
            </div>
            <p className="text-xs text-gray-600 mt-4">
              <strong>Real Processing:</strong> Videos are analyzed with OpenAI GPT-4 Vision for body language and Deepgram for transcription
            </p>
          </div>
        </motion.section>

        {/* YouTube Upload Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="card mb-12"
        >
          <div className="max-w-xl mx-auto text-center">
            <div className="w-16 h-16 bg-alert-red/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Play className="text-alert-red" size={32} />
            </div>
            <h2 className="text-2xl font-semibold mb-2">
              Or Import from YouTube
            </h2>
            <p className="text-gray-400 mb-6">
              Enter a YouTube URL to automatically download and convert to MP4
            </p>

            <div className="flex gap-3">
              <input
                type="text"
                placeholder="https://youtube.com/watch?v=..."
                className="input-field flex-1"
                id="youtube-url"
              />
              <button
                onClick={() => {
                  const url = document.getElementById('youtube-url').value;
                  if (url) {
                    handleYouTubeImport(url);
                  }
                }}
                className="btn btn-primary whitespace-nowrap"
              >
                <Play size={18} className="inline mr-2" />
                Import
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-4">
              Video will be downloaded, converted to MP4, and processed automatically
            </p>
          </div>
        </motion.section>

        {/* Previous Sessions */}
        {!loadingSessions && previousSessions.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-12"
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold mb-2 flex items-center gap-2">
                  <History className="text-clinical-teal" size={24} />
                  Previous Sessions
                </h2>
                <p className="text-gray-400">
                  {previousSessions.length} saved session{previousSessions.length !== 1 ? 's' : ''} available
                  {sessionStats && ` • Avg Score: ${sessionStats.avg_score?.toFixed(1) || 'N/A'}/40`}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {previousSessions.slice(0, 5).map((session, index) => (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.05 }}
                  onClick={() => handleLoadSession(session.id)}
                  className="card card-hover cursor-pointer group flex items-center gap-4 p-4"
                >
                  {/* Thumbnail/Icon */}
                  <div className="w-24 h-24 flex-shrink-0 bg-gradient-to-br from-slate to-deep-navy rounded-lg flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-clinical-teal/20 to-insight-blue/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Play className="text-clinical-teal group-hover:scale-110 transition-transform" size={32} />
                    {session.duration_seconds && (
                      <div className="absolute bottom-1 right-1 bg-deep-navy/90 px-1.5 py-0.5 rounded text-[10px] font-mono">
                        {Math.floor(session.duration_seconds / 60)}:{String(Math.floor(session.duration_seconds % 60)).padStart(2, '0')}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg mb-1 truncate">
                      {session.title}
                    </h3>
                    <div className="flex items-center gap-3 text-sm text-gray-400">
                      <div className="flex items-center gap-1">
                        <Clock size={14} />
                        {formatDate(session.created_at)}
                      </div>
                      {session.overall_score !== undefined && (
                        <div className="flex items-center gap-2">
                          <span>Score:</span>
                          <span className="font-semibold text-white">
                            {session.overall_score.toFixed(1)}/40
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Grade Badge */}
                  {session.overall_grade && (
                    <div className={`px-4 py-2 rounded-lg font-semibold ${getGradeColor(session.overall_grade)} bg-slate/50`}>
                      {formatGrade(session.overall_grade)}
                    </div>
                  )}

                  {/* Delete Button */}
                  <button
                    onClick={(e) => handleDeleteSession(session.id, e)}
                    className="p-2 rounded-lg hover:bg-alert-red/20 text-gray-400 hover:text-alert-red transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete session"
                  >
                    <Trash2 size={18} />
                  </button>
                </motion.div>
              ))}
            </div>

            {previousSessions.length > 5 && (
              <div className="text-center mt-4">
                <p className="text-sm text-gray-500">
                  Showing 5 of {previousSessions.length} sessions
                </p>
              </div>
            )}
          </motion.section>
        )}

        {/* Sample Videos */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="mb-6">
            <h2 className="text-2xl font-semibold mb-2">
              Or Try a Sample Recording
            </h2>
            <p className="text-gray-400">
              Pre-loaded sample recordings with computed analysis results
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {samples.map((sample, index) => (
              <motion.div
                key={sample.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className="card card-hover cursor-pointer group"
              >
                {/* Thumbnail */}
                <div className="aspect-video bg-gradient-to-br from-slate to-deep-navy rounded-lg mb-4 flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-clinical-teal/20 to-insight-blue/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <Play className="text-clinical-teal group-hover:scale-110 transition-transform" size={48} />
                  <div className="absolute bottom-2 right-2 bg-deep-navy/90 px-2 py-1 rounded text-xs font-mono">
                    {sample.duration}
                  </div>
                </div>

                {/* Info */}
                <h3 className="font-semibold mb-2 line-clamp-2">
                  Sample {sample.id}: {sample.title}
                </h3>
                <p className="text-sm text-gray-400 mb-4 line-clamp-2">
                  {sample.description}
                </p>

                {/* Analyze Button */}
                <button
                  onClick={() => handleAnalyze(sample.id)}
                  className="btn btn-primary w-full group-hover:shadow-xl group-hover:shadow-clinical-teal/30"
                >
                  <Play size={16} className="inline mr-2" />
                  Analyze
                </button>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Bottom Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-12 text-center text-sm text-gray-500"
        >
          <p>
            Full Pipeline: Video Input → Multimodal Analysis → Scored Dashboard
          </p>
          <p className="mt-1">
            Prepared by Harjyot Singh | Duke University | Stanford CERC
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default UploadView;
