import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter } from 'lucide-react';

const AnnotatedTranscript = ({ transcript }) => {
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const getHighlightColor = (flags) => {
    if (!flags || flags.length === 0) return null;

    if (flags.some(f => f.toLowerCase().includes('empathy') || f.toLowerCase().includes('teach-back') || f.toLowerCase().includes('open question'))) {
      return 'bg-clinical-teal/20 border-l-2 border-clinical-teal';
    }
    if (flags.some(f => f.toLowerCase().includes('jargon') || f.toLowerCase().includes('interruption') || f.toLowerCase().includes('closed'))) {
      return 'bg-alert-red/20 border-l-2 border-alert-red';
    }
    return 'bg-insight-blue/20 border-l-2 border-insight-blue';
  };

  const getFlagBadgeColor = (flag) => {
    if (flag.toLowerCase().includes('empathy') || flag.toLowerCase().includes('teach-back') || flag.toLowerCase().includes('open question') || flag.toLowerCase().includes('plain language') || flag.toLowerCase().includes('barrier probing')) {
      return 'bg-clinical-teal/20 text-clinical-teal border-clinical-teal';
    }
    if (flag.toLowerCase().includes('jargon') || flag.toLowerCase().includes('interruption') || flag.toLowerCase().includes('closed') || flag.toLowerCase().includes('arms crossed') || flag.toLowerCase().includes('turned away')) {
      return 'bg-alert-red/20 text-alert-red border-alert-red';
    }
    return 'bg-insight-blue/20 text-insight-blue border-insight-blue';
  };

  const filteredTranscript = transcript.filter(item => {
    // Search filter
    if (searchTerm && !item.text.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    // Category filter
    if (filter === 'all') return true;
    if (filter === 'empathy' && item.flags.some(f => f.toLowerCase().includes('empathy'))) return true;
    if (filter === 'jargon' && item.flags.some(f => f.toLowerCase().includes('jargon'))) return true;
    if (filter === 'teachback' && item.flags.some(f => f.toLowerCase().includes('teach-back'))) return true;

    return false;
  });

  return (
    <div className="card h-[500px] flex flex-col">
      {/* Header with filters */}
      <div className="mb-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search transcript..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10 py-2 text-sm"
          />
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={16} className="text-gray-400" />
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === 'all'
                ? 'bg-clinical-teal text-white'
                : 'bg-slate text-gray-400 hover:text-white'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('empathy')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === 'empathy'
                ? 'bg-clinical-teal text-white'
                : 'bg-slate text-gray-400 hover:text-white'
            }`}
          >
            Empathy
          </button>
          <button
            onClick={() => setFilter('teachback')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === 'teachback'
                ? 'bg-clinical-teal text-white'
                : 'bg-slate text-gray-400 hover:text-white'
            }`}
          >
            Teach-back
          </button>
          <button
            onClick={() => setFilter('jargon')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === 'jargon'
                ? 'bg-alert-red text-white'
                : 'bg-slate text-gray-400 hover:text-white'
            }`}
          >
            Jargon
          </button>
        </div>
      </div>

      {/* Transcript Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin space-y-3">
        {filteredTranscript.map((item, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.02 }}
            className={`p-3 rounded-lg ${
              item.flags && item.flags.length > 0
                ? getHighlightColor(item.flags) + ' pl-4'
                : 'bg-slate/30'
            }`}
          >
            {/* Header: Time and Speaker */}
            <div className="flex items-center gap-3 mb-2">
              <span className="font-mono text-xs text-gray-400">
                {item.time}
              </span>
              <span className={`font-semibold text-sm ${
                item.speaker === 'Clinician' ? 'text-blue-400' : 'text-amber-400'
              }`}>
                {item.speaker}
              </span>
            </div>

            {/* Text */}
            <p className="text-sm text-gray-200 mb-2 leading-relaxed">
              {item.text}
            </p>

            {/* Flags/Annotations */}
            {item.flags && item.flags.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {item.flags.map((flag, i) => (
                  <span
                    key={i}
                    className={`px-2 py-0.5 rounded text-xs font-medium border ${getFlagBadgeColor(flag)}`}
                  >
                    {flag}
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        ))}

        {filteredTranscript.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>No matching transcript entries</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnnotatedTranscript;
