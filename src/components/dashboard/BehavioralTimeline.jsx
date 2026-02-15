import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Eye, MessageSquare, Activity, Info } from 'lucide-react';

const BehavioralTimeline = ({ timeline, duration }) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hoveredEvent, setHoveredEvent] = useState(null);
  const timelineRef = useRef(null);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleTimelineClick = (e) => {
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const newTime = percent * duration;
    setCurrentTime(Math.max(0, Math.min(duration, newTime)));
  };

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
    // In a real implementation, this would control video playback
  };

  const skipTime = (seconds) => {
    setCurrentTime(Math.max(0, Math.min(duration, currentTime + seconds)));
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
      return '#EF4444';
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

  return (
    <div className="card p-6">
      {/* Video Thumbnail & Playback Controls */}
      <div className="mb-6">
        <div className="flex items-center gap-4">
          {/* Mini Video Thumbnail */}
          <div className="w-48 h-28 bg-slate rounded-lg flex items-center justify-center flex-shrink-0">
            <div className="w-12 h-12 bg-clinical-teal/20 rounded-full flex items-center justify-center">
              {isPlaying ? <Pause size={24} className="text-clinical-teal" /> : <Play size={24} className="text-clinical-teal" />}
            </div>
          </div>

          {/* Playback Controls */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
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
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {/* Scrubber */}
            <div
              ref={timelineRef}
              onClick={handleTimelineClick}
              className="relative h-2 bg-slate rounded-full cursor-pointer group"
            >
              <motion.div
                className="absolute left-0 top-0 h-full bg-clinical-teal rounded-full"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />
              <motion.div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-clinical-teal rounded-full border-2 border-white shadow-lg"
                style={{ left: `${(currentTime / duration) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Timeline Tracks */}
      <div className="space-y-4">
        {/* Speaker Track */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare size={16} className="text-gray-400" />
            <h4 className="font-medium text-sm">Speaker</h4>
          </div>
          <div className="relative h-8 bg-slate rounded overflow-hidden">
            {timeline.speaker_segments.map((segment, i) => {
              const left = (segment.start / duration) * 100;
              const width = ((segment.end - segment.start) / duration) * 100;
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
            {timeline.gaze_segments.map((segment, i) => {
              const left = (segment.start / duration) * 100;
              const width = ((segment.end - segment.start) / duration) * 100;
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
            {timeline.body_segments.map((segment, i) => {
              const left = (segment.start / duration) * 100;
              const width = ((segment.end - segment.start) / duration) * 100;
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
          </div>
          <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-[#0D9488]" />
              <span>Open/Engaged</span>
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
              <span>Turned Away</span>
            </div>
          </div>
        </div>

        {/* Events Track */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Info size={16} className="text-gray-400" />
            <h4 className="font-medium text-sm">Events</h4>
          </div>
          <div className="relative h-12 bg-slate rounded">
            {timeline.events.map((event, i) => {
              const left = (event.time / duration) * 100;
              const eventColor = getEventColor(event.type);

              return (
                <div
                  key={i}
                  className="absolute bottom-0 cursor-pointer group"
                  style={{ left: `${left}%` }}
                  onMouseEnter={() => setHoveredEvent(event)}
                  onMouseLeave={() => setHoveredEvent(null)}
                >
                  {/* Event Marker */}
                  <div className={`w-0.5 h-12 bg-${eventColor}`} />
                  <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-1 text-xs bg-${eventColor}/20 border border-${eventColor} px-2 py-1 rounded`}>
                    {getEventIcon(event.type)}
                  </div>

                  {/* Tooltip */}
                  {hoveredEvent === event && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-8 w-64 bg-deep-navy border border-slate/40 rounded-lg p-3 shadow-xl z-10"
                    >
                      <div className="text-xs">
                        <div className="flex items-center justify-between mb-2">
                          <span className={`font-semibold text-${eventColor}`}>
                            {event.type}
                          </span>
                          <span className="font-mono text-gray-400">
                            {formatTime(event.time)}
                          </span>
                        </div>
                        <p className="text-gray-300 mb-1">
                          {event.label}
                        </p>
                        {event.detail && (
                          <p className="text-gray-500 text-[10px]">
                            {event.detail}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend Note */}
      <div className="mt-6 text-xs text-gray-500 text-center">
        <p>
          Multi-track behavioral visualization synchronized to video playback.
          Hover over event markers for details.
        </p>
      </div>
    </div>
  );
};

export default BehavioralTimeline;
