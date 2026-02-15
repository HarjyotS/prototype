import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from './store/appStore';
import UploadView from './components/UploadView';
import ProcessingView from './components/ProcessingView';
import DashboardView from './components/DashboardView';

function App() {
  const { currentView } = useAppStore();

  return (
    <div className="min-h-screen bg-deep-navy">
      <AnimatePresence mode="wait">
        {currentView === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <UploadView />
          </motion.div>
        )}

        {currentView === 'processing' && (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <ProcessingView />
          </motion.div>
        )}

        {currentView === 'dashboard' && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <DashboardView />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
