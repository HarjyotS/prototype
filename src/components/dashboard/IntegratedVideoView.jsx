import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Eye, MessageSquare, Activity, Info, Sparkles } from 'lucide-react';

const IntegratedVideoView = ({ session }) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hoveredEvent, setHoveredEvent] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewTime, setPreviewTime] = useState(null);
  const [previewPosition, setPreviewPosition] = useState(null);
  const timelineRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const transcriptContainerRef = useRef(null);
  const previewCanvasRef = useRef(null);

  // Sync video with current time
  useEffect(() => {
    if (videoRef.current && !isPlaying) {
      videoRef.current.currentTime = currentTime;
    }
  }, [currentTime, isPlaying]);

  // Auto-scroll transcript to current time
  useEffect(() => {
    if (transcriptContainerRef.current) {
      const activeElement = transcriptContainerRef.current.querySelector('[data-active="true"]');
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentTime]);

  // Handle global mouse events for dragging
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mouseup', handleGlobalMouseUp);
      window.addEventListener('mousemove', handleTimelineMouseMove);
    }

    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('mousemove', handleTimelineMouseMove);
    };
  }, [isDragging]);

  // Draw MediaPipe overlay on canvas
  useEffect(() => {
    if (!canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');

    // Match canvas size to video
    const resizeCanvas = () => {
      canvas.width = video.offsetWidth;
      canvas.height = video.offsetHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Draw MediaPipe landmarks
    const drawFrame = () => {
      if (!ctx || !canvas.width || !canvas.height) return;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Get current MediaPipe frame data
      const mediapipeData = getCurrentMediaPipeFrame();
      if (mediapipeData && mediapipeData.has_person_detected) {
        drawPoseLandmarks(ctx, mediapipeData, canvas.width, canvas.height);
      }

      // Continue drawing if playing
      if (isPlaying) {
        requestAnimationFrame(drawFrame);
      }
    };

    drawFrame();
    const interval = setInterval(drawFrame, 100); // Update every 100ms

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      clearInterval(interval);
    };
  }, [currentTime, isPlaying]);

  // Update preview canvas when hovering timeline
  useEffect(() => {
    if (!previewCanvasRef.current || !videoRef.current || previewTime === null) return;

    const canvas = previewCanvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');

    // Draw current video frame to preview canvas
    const drawPreview = () => {
      try {
        // Draw scaled-down video frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      } catch (error) {
        // Video might not be ready, fill with placeholder
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#64748B';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Loading...', canvas.width / 2, canvas.height / 2);
      }
    };

    drawPreview();
  }, [previewTime]);

  // Get current MediaPipe frame based on video time
  const getCurrentMediaPipeFrame = () => {
    // Use mediapipeResults if available (contains raw pose/hand/face data)
    const mediapipeFrames = session.mediapipeResults || [];

    if (mediapipeFrames.length === 0) {
      return null;
    }

    // Find closest MediaPipe frame to current time
    let closestFrame = null;
    let minDiff = Infinity;

    mediapipeFrames.forEach(frame => {
      if (frame.timestamp !== undefined) {
        const diff = Math.abs(frame.timestamp - currentTime);
        if (diff < minDiff) {
          minDiff = diff;
          closestFrame = frame;
        }
      }
    });

    return closestFrame;
  };

  // Draw pose landmarks on canvas
  const drawPoseLandmarks = (ctx, mediapipeData, width, height) => {
    ctx.save();

    let yOffset = 10;

    // Draw MediaPipe pose indicators if available
    if (mediapipeData && mediapipeData.pose) {
      const pose = mediapipeData.pose;

      // Set up styles
      ctx.strokeStyle = '#0D9488'; // clinical-teal
      ctx.fillStyle = '#0D9488';
      ctx.lineWidth = 3;
      ctx.font = '13px Inter, sans-serif';

      // Draw forward lean indicator
      if (pose.forward_lean_angle !== null && pose.forward_lean_angle !== undefined) {
        const leanText = `Lean: ${pose.forward_lean_angle.toFixed(1)}°`;
        const leanColor = pose.forward_lean_angle > 10 ? '#0D9488' : '#64748B';

        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(10, yOffset, 130, 28);
        ctx.fillStyle = leanColor;
        ctx.fillText(leanText, 18, yOffset + 19);
        yOffset += 35;
      }

      // Draw arms crossed indicator
      if (pose.arms_crossed) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.85)'; // red for warning
        ctx.fillRect(10, yOffset, 150, 28);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('⚠️ Arms Crossed', 18, yOffset + 19);
        yOffset += 35;
      }

      // Draw open posture indicator
      if (pose.open_posture) {
        ctx.fillStyle = 'rgba(13, 148, 136, 0.85)'; // teal for positive
        ctx.fillRect(10, yOffset, 150, 28);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('✓ Open Posture', 18, yOffset + 19);
        yOffset += 35;
      }
    }

    // Draw active event markers at current time
    const currentEvents = (session.events || session.timeline?.events || []).filter(event => {
      return Math.abs(event.time - currentTime) < 3; // Show events within 3 seconds
    });

    if (currentEvents.length > 0) {
      currentEvents.forEach((event, index) => {
        const isPositive = event.severity === 'positive' ||
                          event.type?.includes('Empathy') ||
                          event.type?.includes('Teach-back') ||
                          event.type?.includes('Forward lean');
        const isWarning = event.severity === 'warning' ||
                         event.type?.includes('Jargon') ||
                         event.type?.includes('Arms crossed') ||
                         event.type?.includes('Eye contact drop');

        const bgColor = isPositive ? 'rgba(13, 148, 136, 0.85)' :
                       isWarning ? 'rgba(239, 68, 68, 0.85)' :
                       'rgba(59, 130, 246, 0.85)';

        const icon = isPositive ? '↑' : isWarning ? '↓' : '•';

        // Draw event card
        const eventY = yOffset + (index * 35);
        const textWidth = ctx.measureText(event.type).width;
        const cardWidth = Math.min(textWidth + 50, width - 20);

        ctx.fillStyle = bgColor;
        ctx.fillRect(10, eventY, cardWidth, 28);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 13px Inter, sans-serif';
        ctx.fillText(`${icon} ${event.type}`, 18, eventY + 19);
      });
    }

    ctx.restore();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleTimelineClick = (e) => {
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const newTime = percent * session.duration_seconds;
    seekToTime(newTime);
  };

  const handleTimelineMouseDown = (e) => {
    setIsDragging(true);
    handleTimelineClick(e);
  };

  const handleTimelineMouseMove = (e) => {
    if (!timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    const time = percent * session.duration_seconds;

    setPreviewTime(time);
    setPreviewPosition(x);

    if (isDragging) {
      seekToTime(time);
    }
  };

  const handleTimelineMouseUp = () => {
    setIsDragging(false);
  };

  const handleTimelineMouseLeave = () => {
    setPreviewTime(null);
    setPreviewPosition(null);
  };

  const seekToTime = (time) => {
    const newTime = Math.max(0, Math.min(session.duration_seconds, time));
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  const handleEventClick = (eventTime) => {
    seekToTime(eventTime);
    if (videoRef.current && isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const skipTime = (seconds) => {
    setCurrentTime(Math.max(0, Math.min(session.duration_seconds, currentTime + seconds)));
  };

  const getSegmentColor = (type, value) => {
    if (type === 'speaker') {
      return value === 'clinician' ? '#3B82F6' : '#F59E0B';
    } else if (type === 'gaze') {
      if (value === 'patient') return '#0D9488';
      if (value === 'screen') return '#F59E0B';
      return '#EF4444';
    } else if (type === 'body') {
      if (value === 'open') return '#0D9488';
      if (value === 'neutral') return '#3B82F6';
      if (value === 'closed') return '#F59E0B';
      if (value === 'away') return '#EF4444';
      return '#64748B';
    }
    return '#64748B';
  };

  const getEventIcon = (type) => {
    const icons = {
      'Empathy phrase': '❤️',
      'Teach-back prompt': '🔄',
      'Jargon usage': '⚠️',
      'Closed question': '❌',
      'Eye contact drop': '👁️',
      'Interruption': '⏸️',
      'Barrier probing': '🔍',
      'Forward lean': '➡️',
      'Arms crossed': '🛡️',
      'Nodding': '👍',
      'Mirroring': '🪞',
      'Proximity shift': '↔️',
      'Open question': '❓',
      'Plain language': '✓',
      'Turned away': '↩️'
    };
    return icons[type] || '•';
  };

  const getEventColor = (type) => {
    if (type.includes('Empathy') || type.includes('Teach-back') || type.includes('Barrier') || type.includes('Open question') || type.includes('Plain language')) {
      return 'clinical-teal';
    }
    if (type.includes('Jargon') || type.includes('Closed') || type.includes('Interruption') || type.includes('Arms crossed') || type.includes('Turned away')) {
      return 'alert-red';
    }
    if (type.includes('Eye contact drop')) {
      return 'alert-red';
    }
    return 'insight-blue';
  };

  // Parse overshoot analysis text to extract sections
  const parseOvershootAnalysis = (analysis) => {
    if (!analysis || typeof analysis !== 'string') return null;

    // Try to extract structured sections from the text
    const sections = {
      eyeContact: '',
      bodyLanguage: '',
      gestures: '',
      engagement: '',
      concerns: []
    };

    // Extract each section based on common patterns
    const eyeMatch = analysis.match(/eye contact[:\s]+(.*?)(?=body language|gestures|facial|engagement|concerns|$)/is);
    const bodyMatch = analysis.match(/body language[:\s]+(.*?)(?=gestures|eye contact|facial|engagement|concerns|$)/is);
    const gestureMatch = analysis.match(/gestures[:\s]+(.*?)(?=facial|eye contact|body|engagement|concerns|$)/is);
    const engagementMatch = analysis.match(/engagement[:\s]+(.*?)(?=concerns|eye contact|body|gestures|$)/is);

    sections.eyeContact = eyeMatch ? eyeMatch[1].trim() : analysis.substring(0, 100) + '...';
    sections.bodyLanguage = bodyMatch ? bodyMatch[1].trim() : 'Normal posture';
    sections.gestures = gestureMatch ? gestureMatch[1].trim() : 'Natural gesturing';
    sections.engagement = engagementMatch ? engagementMatch[1].trim() : 'Engaged';

    // Extract concerns
    if (analysis.toLowerCase().includes('concern')) {
      const concernMatch = analysis.match(/concern[^:]*:(.*?)$/is);
      if (concernMatch) {
        sections.concerns = [concernMatch[1].trim()];
      }
    }

    return sections;
  };

  // Get current overshoot response based on time
  const getCurrentOvershootResponse = () => {
    // Use actual overshoot results if available
    if (session.overshootResults && session.overshootResults.length > 0) {
      // Find the closest frame to current time
      const currentFrame = session.overshootResults.find(frame =>
        Math.abs(frame.timeInVideo - currentTime) < 2
      ) || session.overshootResults[0];

      // Parse the analysis text
      const parsed = parseOvershootAnalysis(currentFrame.analysis);
      if (parsed) {
        return {
          startTime: Math.max(0, currentFrame.timeInVideo - 1),
          endTime: currentFrame.timeInVideo + 1,
          ...parsed
        };
      }
    }

    // Fall back to mock data
    const frameGroups = generateMockOvershootResponses();
    return frameGroups.find(group =>
      currentTime >= group.startTime && currentTime < group.endTime
    ) || frameGroups[0];
  };

  // Get ALL transcript entries (not just current time window)
  const getAllTranscriptEntries = () => {
    if (!session.transcript) return [];

    // Show ALL transcript entries, sorted by time
    return session.transcript.sort((a, b) => parseTimeToSeconds(a.time) - parseTimeToSeconds(b.time));
  };

  const parseTimeToSeconds = (timeStr) => {
    const [mins, secs] = timeStr.split(':').map(Number);
    return mins * 60 + secs;
  };

  const getTranscriptAtTime = (time) => {
    if (!session.transcript) return 'No transcript';

    // Find closest transcript entry
    const closest = session.transcript.reduce((prev, curr) => {
      const prevDiff = Math.abs(parseTimeToSeconds(prev.time) - time);
      const currDiff = Math.abs(parseTimeToSeconds(curr.time) - time);
      return currDiff < prevDiff ? curr : prev;
    });

    return closest ? `${closest.speaker}: ${closest.text.substring(0, 40)}...` : 'No transcript';
  };

  const getHighlightColor = (flags) => {
    if (!flags || flags.length === 0) return 'bg-slate/30';

    if (flags.some(f => f.toLowerCase().includes('empathy') || f.toLowerCase().includes('teach-back') || f.toLowerCase().includes('open question'))) {
      return 'bg-clinical-teal/20 border-l-2 border-clinical-teal';
    }
    if (flags.some(f => f.toLowerCase().includes('jargon') || f.toLowerCase().includes('interruption') || f.toLowerCase().includes('closed'))) {
      return 'bg-alert-red/20 border-l-2 border-alert-red';
    }
    return 'bg-insight-blue/20 border-l-2 border-insight-blue';
  };

  const currentOvershoot = getCurrentOvershootResponse();
  const allTranscriptEntries = getAllTranscriptEntries();

  return (
    <div className="space-y-6">
      {/* Overshoot Prompt Info Card */}
      <div className="card bg-insight-blue/10 border-insight-blue/30 p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="text-insight-blue mt-1" size={20} />
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-2 text-insight-blue">Overshoot AI Analysis Prompt</h3>
            <div className="bg-deep-navy/50 rounded-lg p-3 font-mono text-xs text-gray-300">
              <p className="mb-2">Analyze this clinical interaction video. Detect and track:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Eye contact between clinician and patient</li>
                <li>Body language and posture (open, closed, leaning forward/away)</li>
                <li>Gestures and hand movements</li>
                <li>Facial expressions and empathy markers</li>
                <li>Physical proximity and engagement</li>
                <li>Any concerning behaviors (arms crossed, turned away, interruptions)</li>
              </ol>
              <p className="mt-2">Return structured data with timestamps for each observation.</p>
            </div>
            <div className="mt-2 text-xs text-gray-400">
              Model: <span className="text-clinical-teal font-semibold">Qwen/Qwen3-VL-30B-A3B-Instruct</span> •
              Clip Length: <span className="text-clinical-teal font-semibold">0.5s</span> •
              Sampling Ratio: <span className="text-clinical-teal font-semibold">80%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main 3-Column Layout */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Column: Video Player */}
        <div className="col-span-5">
          <div className="card p-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Play size={18} className="text-clinical-teal" />
              Video Player
            </h3>

            {/* Video Container */}
            <div className="relative bg-black rounded-lg overflow-hidden mb-4" style={{ aspectRatio: '16/9' }}>
              {session.videoUrl ? (
                <>
                  <video
                    ref={videoRef}
                    className="w-full h-full"
                    onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                  >
                    <source src={session.videoUrl} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                  {/* MediaPipe Overlay Canvas */}
                  <canvas
                    ref={canvasRef}
                    className="absolute top-0 left-0 w-full h-full pointer-events-none"
                    style={{ zIndex: 10 }}
                  />
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-clinical-teal/20 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Play size={32} className="text-clinical-teal" />
                    </div>
                    <p className="text-gray-400 text-sm">Demo Mode: No video loaded</p>
                    <p className="text-gray-500 text-xs mt-1">Timeline preview available</p>
                  </div>
                </div>
              )}

              {/* Time Overlay */}
              <div className="absolute bottom-4 left-4 bg-black/80 px-3 py-1 rounded font-mono text-sm" style={{ zIndex: 20 }}>
                {formatTime(currentTime)}
              </div>
            </div>

            {/* Playback Controls */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={togglePlayPause}
                  className="btn btn-primary px-4 py-2"
                >
                  {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                </button>
                <button
                  onClick={() => skipTime(-10)}
                  className="btn bg-slate hover:bg-slate/80 px-3 py-2"
                >
                  -10s
                </button>
                <button
                  onClick={() => skipTime(10)}
                  className="btn bg-slate hover:bg-slate/80 px-3 py-2"
                >
                  +10s
                </button>
                <span className="font-mono text-sm text-gray-400">
                  {formatTime(currentTime)} / {formatTime(session.duration_seconds)}
                </span>
              </div>

              {/* Scrubber */}
              <div
                ref={timelineRef}
                onClick={handleTimelineClick}
                onMouseDown={handleTimelineMouseDown}
                onMouseMove={handleTimelineMouseMove}
                onMouseLeave={handleTimelineMouseLeave}
                className="relative h-3 bg-slate rounded-full cursor-pointer group"
              >
                <motion.div
                  className="absolute left-0 top-0 h-full bg-clinical-teal rounded-full"
                  style={{ width: `${(currentTime / session.duration_seconds) * 100}%` }}
                />
                <motion.div
                  className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-clinical-teal rounded-full border-2 border-white shadow-lg cursor-grab active:cursor-grabbing"
                  style={{ left: `${(currentTime / session.duration_seconds) * 100}%` }}
                />

                {/* Preview tooltip */}
                {previewTime !== null && previewPosition !== null && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute bottom-full mb-2 -translate-x-1/2 pointer-events-none"
                    style={{ left: `${previewPosition}px` }}
                  >
                    <div className="bg-deep-navy border border-slate/40 rounded-lg shadow-xl overflow-hidden">
                      {/* Preview canvas */}
                      <div className="w-40 h-24 bg-black relative">
                        <canvas
                          ref={previewCanvasRef}
                          width="160"
                          height="90"
                          className="w-full h-full"
                        />
                        <div className="absolute bottom-1 right-1 bg-black/80 px-2 py-0.5 rounded text-xs font-mono text-white">
                          {formatTime(previewTime)}
                        </div>
                      </div>
                      {/* Preview transcript snippet */}
                      <div className="px-2 py-1.5 text-xs text-gray-300 max-w-[160px] truncate">
                        {getTranscriptAtTime(previewTime)}
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Middle Column: Overshoot Responses */}
        <div className="col-span-3">
          <div className="card p-4 h-full flex flex-col">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Sparkles size={18} className="text-insight-blue" />
              AI Analysis
            </h3>

            <div className="space-y-4 max-h-[500px] overflow-y-auto scrollbar-thin flex-1">
              <div className="bg-slate/50 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">Frame Group</div>
                <div className="font-mono text-sm text-clinical-teal">
                  {formatTime(currentOvershoot.startTime)} - {formatTime(currentOvershoot.endTime)}
                </div>
              </div>

              <div className="space-y-3">
                {/* Eye Contact */}
                <div className="bg-deep-navy/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye size={14} className="text-clinical-teal" />
                    <span className="text-xs font-semibold">Eye Contact</span>
                  </div>
                  <p className="text-xs text-gray-300">{currentOvershoot.eyeContact}</p>
                </div>

                {/* Body Language */}
                <div className="bg-deep-navy/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity size={14} className="text-clinical-teal" />
                    <span className="text-xs font-semibold">Body Language</span>
                  </div>
                  <p className="text-xs text-gray-300">{currentOvershoot.bodyLanguage}</p>
                </div>

                {/* Gestures */}
                <div className="bg-deep-navy/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare size={14} className="text-clinical-teal" />
                    <span className="text-xs font-semibold">Gestures</span>
                  </div>
                  <p className="text-xs text-gray-300">{currentOvershoot.gestures}</p>
                </div>

                {/* Engagement */}
                <div className="bg-deep-navy/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Info size={14} className="text-clinical-teal" />
                    <span className="text-xs font-semibold">Engagement</span>
                  </div>
                  <p className="text-xs text-gray-300">{currentOvershoot.engagement}</p>
                </div>

                {/* Concerns */}
                {currentOvershoot.concerns && currentOvershoot.concerns.length > 0 && (
                  <div className="bg-alert-red/10 border border-alert-red/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-alert-red">⚠️ Concerns</span>
                    </div>
                    <ul className="text-xs text-gray-300 space-y-1">
                      {currentOvershoot.concerns.map((concern, i) => (
                        <li key={i} className="flex items-start gap-1">
                          <span>•</span>
                          <span>{concern}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Transcript */}
        <div className="col-span-4">
          <div className="card p-4 h-full">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <MessageSquare size={18} className="text-warm-amber" />
              Live Transcript
            </h3>

            <div
              ref={transcriptContainerRef}
              className="space-y-3 max-h-[500px] overflow-y-auto scrollbar-thin"
            >
              {allTranscriptEntries.length > 0 ? (
                allTranscriptEntries.map((item, index) => {
                  const entryTime = parseTimeToSeconds(item.time);
                  const isActive = Math.abs(entryTime - currentTime) < 2;

                  return (
                    <motion.div
                      key={index}
                      data-active={isActive}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`p-3 rounded-lg transition-all ${
                        isActive
                          ? 'ring-2 ring-clinical-teal ' + getHighlightColor(item.flags)
                          : getHighlightColor(item.flags)
                      } ${item.flags && item.flags.length > 0 ? 'pl-4' : ''}`}
                    >
                      {/* Header: Time and Speaker */}
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`font-mono text-xs ${isActive ? 'text-clinical-teal font-bold' : 'text-gray-400'}`}>
                          {item.time}
                        </span>
                        <span className={`font-semibold text-xs ${
                          item.speaker === 'Clinician' ? 'text-blue-400' : 'text-amber-400'
                        }`}>
                          {item.speaker}
                        </span>
                      </div>

                      {/* Text */}
                      <p className="text-xs text-gray-200 mb-2 leading-relaxed">
                        {item.text}
                      </p>

                      {/* Flags/Annotations */}
                      {item.flags && item.flags.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {item.flags.map((flag, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded text-[10px] font-medium bg-clinical-teal/20 text-clinical-teal"
                            >
                              {flag}
                            </span>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  );
                })
              ) : (
                <div className="flex items-center justify-center h-32 text-gray-500">
                  <p className="text-sm">No transcript at current time</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Timeline Tracks - Full Width */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4">Behavioral Timeline</h3>

        <div className="space-y-4">
          {/* Speaker Track */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare size={16} className="text-gray-400" />
              <h4 className="font-medium text-sm">Speaker</h4>
            </div>
            <div className="relative h-8 bg-slate rounded overflow-hidden">
              {session.timeline.speaker_segments.map((segment, i) => {
                const left = (segment.start / session.duration_seconds) * 100;
                const width = ((segment.end - segment.start) / session.duration_seconds) * 100;
                return (
                  <div
                    key={i}
                    className="absolute top-0 h-full transition-opacity hover:opacity-80"
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      backgroundColor: getSegmentColor('speaker', segment.speaker)
                    }}
                    title={`${segment.speaker}: ${formatTime(segment.start)} - ${formatTime(segment.end)}`}
                  />
                );
              })}
              {/* Current time indicator */}
              <div
                className="absolute top-0 h-full w-0.5 bg-white z-10"
                style={{ left: `${(currentTime / session.duration_seconds) * 100}%` }}
              />
            </div>
            <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm bg-[#3B82F6]" />
                <span>Clinician</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm bg-[#F59E0B]" />
                <span>Patient</span>
              </div>
            </div>
          </div>

          {/* Gaze Track */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Eye size={16} className="text-gray-400" />
              <h4 className="font-medium text-sm">Gaze</h4>
            </div>
            <div className="relative h-8 bg-slate rounded overflow-hidden">
              {session.timeline.gaze_segments.map((segment, i) => {
                const left = (segment.start / session.duration_seconds) * 100;
                const width = ((segment.end - segment.start) / session.duration_seconds) * 100;
                return (
                  <div
                    key={i}
                    className="absolute top-0 h-full transition-opacity hover:opacity-80"
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      backgroundColor: getSegmentColor('gaze', segment.target)
                    }}
                    title={`Looking at ${segment.target}: ${formatTime(segment.start)} - ${formatTime(segment.end)}`}
                  />
                );
              })}
              {/* Current time indicator */}
              <div
                className="absolute top-0 h-full w-0.5 bg-white z-10"
                style={{ left: `${(currentTime / session.duration_seconds) * 100}%` }}
              />
            </div>
            <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm bg-[#0D9488]" />
                <span>Patient</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm bg-[#F59E0B]" />
                <span>Screen/Chart</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm bg-[#EF4444]" />
                <span>Elsewhere</span>
              </div>
            </div>
          </div>

          {/* Body Language Track */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Activity size={16} className="text-gray-400" />
              <h4 className="font-medium text-sm">Body Language</h4>
            </div>
            <div className="relative h-8 bg-slate rounded overflow-hidden">
              {session.timeline.body_segments.map((segment, i) => {
                const left = (segment.start / session.duration_seconds) * 100;
                const width = ((segment.end - segment.start) / session.duration_seconds) * 100;
                return (
                  <div
                    key={i}
                    className="absolute top-0 h-full transition-opacity hover:opacity-80"
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      backgroundColor: getSegmentColor('body', segment.state)
                    }}
                    title={`${segment.state} posture: ${formatTime(segment.start)} - ${formatTime(segment.end)}`}
                  />
                );
              })}
              {/* Current time indicator */}
              <div
                className="absolute top-0 h-full w-0.5 bg-white z-10"
                style={{ left: `${(currentTime / session.duration_seconds) * 100}%` }}
              />
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm bg-[#0D9488]" />
                <span>Open</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm bg-[#3B82F6]" />
                <span>Neutral</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm bg-[#F59E0B]" />
                <span>Closed</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm bg-[#EF4444]" />
                <span>Away</span>
              </div>
            </div>
          </div>

          {/* Events Track */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Info size={16} className="text-gray-400" />
              <h4 className="font-medium text-sm">Key Events & Grade Impact</h4>
            </div>
            <div className="relative h-16 bg-slate rounded">
              {/* Use session.events if available, otherwise use timeline.events */}
              {(session.events || session.timeline?.events || []).map((event, i) => {
                const left = (event.time / session.duration_seconds) * 100;
                const eventColor = getEventColor(event.type || event.severity);
                const isPositive = event.severity === 'positive' || eventColor === 'clinical-teal';
                const isWarning = event.severity === 'warning' || eventColor === 'alert-red';

                return (
                  <div
                    key={i}
                    className="absolute bottom-0 cursor-pointer group hover:scale-110 transition-transform"
                    style={{ left: `${left}%`, transform: 'translateX(-50%)' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEventClick(event.time);
                    }}
                    onMouseEnter={() => setHoveredEvent(event)}
                    onMouseLeave={() => setHoveredEvent(null)}
                  >
                    {/* Event Marker with grade impact */}
                    <div
                      className={`w-1 h-16 transition-all ${
                        isPositive ? 'bg-clinical-teal group-hover:w-1.5' :
                        isWarning ? 'bg-alert-red group-hover:w-1.5' :
                        'bg-insight-blue group-hover:w-1.5'
                      }`}
                    />
                    <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-1 text-xs ${
                      isPositive ? 'bg-clinical-teal/20 border-clinical-teal' :
                      isWarning ? 'bg-alert-red/20 border-alert-red' :
                      'bg-insight-blue/20 border-insight-blue'
                    } border px-2 py-1 rounded shadow-sm`}>
                      {isPositive ? '↑' : isWarning ? '↓' : '•'}
                    </div>

                    {/* Tooltip */}
                    {hoveredEvent === event && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-10 w-72 bg-deep-navy border border-slate/40 rounded-lg p-4 shadow-xl z-20"
                      >
                        <div className="text-xs">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className={`font-semibold ${
                                isPositive ? 'text-clinical-teal' :
                                isWarning ? 'text-alert-red' :
                                'text-insight-blue'
                              }`}>
                                {event.type}
                              </span>
                              {isPositive && (
                                <span className="text-[10px] bg-clinical-teal/20 text-clinical-teal px-2 py-0.5 rounded">
                                  Grade ↑
                                </span>
                              )}
                              {isWarning && (
                                <span className="text-[10px] bg-alert-red/20 text-alert-red px-2 py-0.5 rounded">
                                  Grade ↓
                                </span>
                              )}
                            </div>
                            <span className="font-mono text-gray-400">
                              {formatTime(event.time)}
                            </span>
                          </div>
                          <p className="text-gray-300 mb-1">
                            {event.description || event.label}
                          </p>
                          {event.detail && (
                            <p className="text-gray-500 text-[10px] mt-2 border-t border-slate/40 pt-2">
                              {event.detail}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </div>
                );
              })}
              {/* Current time indicator */}
              <div
                className="absolute top-0 h-full w-0.5 bg-white z-10"
                style={{ left: `${(currentTime / session.duration_seconds) * 100}%` }}
              />

              {/* Empty state */}
              {(!session.events || session.events.length === 0) &&
               (!session.timeline?.events || session.timeline.events.length === 0) && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-gray-500 text-xs">No events detected</p>
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm bg-clinical-teal" />
                <span>Positive (Grade ↑)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm bg-alert-red" />
                <span>Warning (Grade ↓)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm bg-insight-blue" />
                <span>Neutral</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Mock function to generate overshoot responses
// In production, this would come from actual Overshoot API results
function generateMockOvershootResponses() {
  return [
    {
      startTime: 0,
      endTime: 30,
      eyeContact: "Clinician maintaining good eye contact with patient (75% of frame time). Brief glances at chart.",
      bodyLanguage: "Open posture, leaning slightly forward. Arms uncrossed, palms visible.",
      gestures: "Minimal gestures, hands resting on desk. Occasional nodding observed.",
      engagement: "High engagement. Clinician facing patient directly with attentive posture.",
      concerns: []
    },
    {
      startTime: 30,
      endTime: 60,
      eyeContact: "Eye contact reduced to 45%. Clinician looking at screen more frequently.",
      bodyLanguage: "Posture remains open but less forward lean. Slight shift in chair position.",
      gestures: "Increased hand movements while explaining. Pointing gestures toward screen.",
      engagement: "Moderate engagement. Attention divided between patient and documentation.",
      concerns: ["Extended screen time may reduce patient connection"]
    },
    {
      startTime: 60,
      endTime: 90,
      eyeContact: "Poor eye contact (20%). Clinician primarily focused on computer screen.",
      bodyLanguage: "Body turned 45° away from patient. Arms crossed briefly at 1:15 mark.",
      gestures: "Minimal gestures. Typing movements dominant.",
      engagement: "Low engagement. Patient appears to be waiting for clinician's attention.",
      concerns: ["Extended screen time reducing patient connection", "Arms crossed indicating defensive posture"]
    },
    {
      startTime: 90,
      endTime: 120,
      eyeContact: "Eye contact restored to 70%. Clinician re-engaged with patient.",
      bodyLanguage: "Return to open posture. Leaning forward toward patient. Shoulders relaxed.",
      gestures: "Empathetic gestures observed. Open palm gestures indicating listening.",
      engagement: "High engagement restored. Clinician providing full attention to patient.",
      concerns: []
    },
    {
      startTime: 120,
      endTime: 150,
      eyeContact: "Consistent eye contact at 65%. Appropriate balance with note-taking.",
      bodyLanguage: "Maintained open posture. Occasional mirroring of patient's movements.",
      gestures: "Nodding frequently. Illustrative gestures while explaining treatment options.",
      engagement: "Strong engagement. Active listening cues present throughout segment.",
      concerns: []
    }
  ];
}

export default IntegratedVideoView;
