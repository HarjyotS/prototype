import { create } from 'zustand';

export const useAppStore = create((set, get) => ({
  // View state
  currentView: 'upload', // 'upload' | 'processing' | 'dashboard'

  // Session data
  currentSession: null,
  selectedSample: null,
  comparisonSample: null,

  // Processing state
  processingStage: 0,
  isProcessing: false,
  overshootProgress: {
    resultsCount: 0,
    latestAnalysis: null,
    isProcessing: false
  },

  // Dashboard state
  activeTab: 'integrated', // 'integrated' | 'dashboard' | 'details' | 'comparison'
  selectedMetric: null,

  // Actions
  setCurrentView: (view) => set({ currentView: view }),

  setProcessingStage: (stage) => set({ processingStage: stage }),

  setIsProcessing: (isProcessing) => set({ isProcessing }),

  setOvershootProgress: (progress) => set({ overshootProgress: progress }),

  loadSession: (sessionData) => set({
    currentSession: sessionData,
    currentView: 'dashboard',
    processingStage: 0,
    isProcessing: false
  }),

  selectSample: async (sampleId) => {
    try {
      const response = await fetch(`/data/sample${sampleId === 'A' ? 'A' : 'B'}.json`);
      const data = await response.json();
      set({ selectedSample: data });
      return data;
    } catch (error) {
      console.error('Error loading sample:', error);
      return null;
    }
  },

  selectComparisonSample: async (sampleId) => {
    try {
      const response = await fetch(`/data/sample${sampleId === 'A' ? 'A' : 'B'}.json`);
      const data = await response.json();
      set({ comparisonSample: data });
      return data;
    } catch (error) {
      console.error('Error loading comparison sample:', error);
      return null;
    }
  },

  startProcessing: async (videoFile, useRealProcessing = true) => {
    set({
      isProcessing: true,
      processingStage: 0,
      currentView: 'processing',
      overshootProgress: { resultsCount: 0, latestAnalysis: null, isProcessing: false }
    });

    // If no video file provided or useRealProcessing is false, use sample data
    if (!videoFile || !useRealProcessing) {
      // Load sample data (fallback mode)
      const sampleId = typeof videoFile === 'string' ? videoFile : 'A';
      const data = await get().selectSample(sampleId);

      if (!data) {
        set({ isProcessing: false });
        return;
      }

      // Simulate processing stages
      const stages = [
        { duration: 2000, stage: 1 }, // Audio Extraction & Transcription
        { duration: 1500, stage: 2 }, // Speaker Diarization
        { duration: 2500, stage: 3 }, // Pose Estimation & Body Language
        { duration: 2000, stage: 4 }, // Linguistic & Behavioral Analysis
        { duration: 1500, stage: 5 }, // Composite Score Generation
      ];

      for (const { duration, stage } of stages) {
        await new Promise(resolve => setTimeout(resolve, duration));
        set({ processingStage: stage });
      }

      // Transition to dashboard
      setTimeout(() => {
        get().loadSession(data);
      }, 500);
      return;
    }

    // Real processing with uploaded video
    try {
      const formData = new FormData();
      formData.append('video', videoFile);

      // Upload and start processing
      const response = await fetch('/api/analyze-full', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Processing failed');
      }

      const jobId = data.jobId;
      console.log('Processing started, job ID:', jobId);

      // Poll for results and update progress
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`/api/analysis-status/${jobId}`);
          const statusData = await statusResponse.json();

          console.log('Job status:', statusData);

          // Update stage based on progress
          if (statusData.status === 'processing') {
            if (statusData.stage === 'audio_extraction') set({ processingStage: 1 });
            else if (statusData.stage === 'transcription') set({ processingStage: 2 });
            else if (statusData.stage === 'video_analysis') {
              set({ processingStage: 3 });

              // Update OpenAI Vision progress
              if (statusData.overshootResults && statusData.overshootResults.length > 0) {
                const latestResult = statusData.overshootResults[statusData.overshootResults.length - 1];
                set({
                  overshootProgress: {
                    resultsCount: statusData.overshootResults.length,
                    latestAnalysis: latestResult?.analysis || null,
                    isProcessing: true
                  }
                });
              } else {
                set({
                  overshootProgress: {
                    resultsCount: 0,
                    latestAnalysis: null,
                    isProcessing: true
                  }
                });
              }
            }
            else if (statusData.stage === 'behavioral_scoring') {
              set({ processingStage: 4 });
              set({
                overshootProgress: {
                  ...get().overshootProgress,
                  isProcessing: false
                }
              });
            }
          }

          if (statusData.status === 'complete' && statusData.finalResults) {
            clearInterval(pollInterval);
            set({ processingStage: 5 });

            // Wait a moment then transition to dashboard
            setTimeout(() => {
              get().loadSession(statusData.finalResults);
            }, 1000);
          } else if (statusData.status === 'error') {
            clearInterval(pollInterval);
            console.error('Processing error:', statusData.error);
            alert('Processing failed: ' + statusData.error);
            set({ isProcessing: false, currentView: 'upload' });
          }
        } catch (error) {
          console.error('Error polling status:', error);
        }
      }, 2000); // Poll every 2 seconds

      // Safety timeout after 10 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (get().isProcessing) {
          alert('Processing timed out. Please try again with a shorter video.');
          set({ isProcessing: false, currentView: 'upload' });
        }
      }, 600000);

    } catch (error) {
      console.error('Processing error:', error);
      alert('Failed to start processing: ' + error.message);
      set({ isProcessing: false, currentView: 'upload' });
    }
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  setSelectedMetric: (metric) => set({ selectedMetric: metric }),

  resetSession: () => set({
    currentView: 'upload',
    currentSession: null,
    selectedSample: null,
    comparisonSample: null,
    processingStage: 0,
    isProcessing: false,
    overshootProgress: { resultsCount: 0, latestAnalysis: null, isProcessing: false },
    activeTab: 'integrated',
    selectedMetric: null
  }),
}));
