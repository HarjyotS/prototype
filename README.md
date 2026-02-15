# SimInsight - AI-Powered Clinical Interaction Analysis

An AI-powered system for analyzing clinical simulation recordings with multimodal analysis (video, audio, body language) and automated scoring for OSCE (Objective Structured Clinical Examination) evaluations.

## Features

- **Video Upload & Processing**: Upload clinical simulation recordings for automated analysis
- **YouTube Import**: Import videos directly from YouTube with automatic MP4 conversion
- **Real-time Transcription**: Powered by Deepgram API for medical-grade speech-to-text
- **Real-time Vision Analysis**: Powered by Overshoot AI for body language and behavioral tracking
- **Multimodal AI Analysis**:
  - Audio extraction & transcription
  - Speaker diarization & role detection
  - Pose estimation, gaze tracking & body language analysis
  - Linguistic & behavioral analysis
  - Composite score generation
- **Comprehensive Dashboard**:
  - 5 composite score cards with visual indicators
  - Interactive behavioral timeline with multi-track visualization
  - 8-dimension radar chart for interaction analytics
  - Annotated transcript with event highlighting
- **Detailed Metrics View**: Granular breakdown of all measurements
- **Comparison Analytics**:
  - Side-by-side session comparison
  - Longitudinal learner progress tracking
  - Cohort analytics and percentile rankings
- **Report Generation**: Export detailed analysis reports via API

## Tech Stack

### Frontend
- **React 18+** with hooks
- **Vite** for fast development and building
- **Tailwind CSS** for utility-first styling
- **Framer Motion** for smooth animations
- **Recharts** for data visualization
- **Zustand** for state management
- **Lucide React** for icons

### Backend
- **Node.js** with Express
- **Deepgram SDK** for audio transcription
- **Multer** for file uploads
- **dotenv** for environment configuration

## Installation

### Prerequisites
- Node.js 18+ and npm/yarn
- **FFmpeg** (required for YouTube imports): `brew install ffmpeg`
- (Optional) Overshoot API key for real-time vision analysis
- (Optional) Deepgram API key for real-time transcription
- (Optional) OpenAI API key for enhanced report generation

### Setup Steps

1. **Clone/Download the repository**
   ```bash
   cd /Users/harjyot/Desktop/prototype
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` file:
   ```env
   PORT=3001
   DEEPGRAM_API_KEY=your_deepgram_api_key_here
   OPENAI_API_KEY=your_openai_api_key_here
   NODE_ENV=development
   ```

   Note: API keys are optional for the demo. The application works with pre-computed sample data.

4. **Start the development servers**

   Option 1 - Run both frontend and backend together:
   ```bash
   npm run dev:full
   ```

   Option 2 - Run separately:
   ```bash
   # Terminal 1 - Frontend (Vite dev server)
   npm run dev

   # Terminal 2 - Backend API server
   npm run server
   ```

5. **Open the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001

## Usage

### Demo Mode (Pre-computed Analysis)

The application includes two pre-loaded sample recordings with complete analysis:

1. **Sample A: Good Communication**
   - Demonstrates patient-centered communication
   - High scores across all metrics
   - Excellent example for training

2. **Sample B: Poor Communication**
   - Demonstrates clinician-centered patterns
   - Lower scores highlighting areas for improvement
   - Useful for contrast and learning

**To analyze a sample:**
1. On the upload screen, click "Analyze" on any sample card
2. Watch the 5-stage processing animation (~10 seconds)
3. View the comprehensive dashboard with scores, timeline, analytics, and transcript
4. Switch between Dashboard, Details, and Comparison tabs
5. Export the report using the "Export Report" button

### Real Video Upload (with API Keys)

To process your own videos:

1. **Configure API Keys** in the upload screen or `.env` file
2. **Upload Video**: Drag and drop or click to browse (MP4, MOV, AVI up to 500MB)
3. **Processing**: The backend will:
   - Extract audio and transcribe with Deepgram
   - Analyze speaker patterns
   - Generate scores and insights
4. **View Results**: Automatically transitions to the dashboard

### API Endpoints

The backend server provides these endpoints:

- `GET /api/health` - Health check
- `POST /api/transcribe` - Transcribe audio file with Deepgram
  - Body: `multipart/form-data` with `audio` file and optional `deepgramApiKey`
- `POST /api/transcribe/live` - Setup for live transcription
- `POST /api/generate-report` - Generate comprehensive analysis report
  - Body: `{ sessionData: object, format: 'json' | 'pdf' }`

### Sample API Usage

**Transcribe Audio:**
```bash
curl -X POST http://localhost:3001/api/transcribe \
  -F "audio=@recording.mp3" \
  -F "deepgramApiKey=YOUR_KEY"
```

**Generate Report:**
```bash
curl -X POST http://localhost:3001/api/generate-report \
  -H "Content-Type: application/json" \
  -d '{"sessionData": {...}, "format": "json"}'
```

## Project Structure

```
prototype/
├── public/
│   └── data/
│       ├── sampleA.json          # Good communication sample data
│       └── sampleB.json          # Poor communication sample data
├── server/
│   └── index.js                  # Express backend server
├── src/
│   ├── components/
│   │   ├── UploadView.jsx        # Video upload interface
│   │   ├── ProcessingView.jsx    # 5-stage processing animation
│   │   ├── DashboardView.jsx     # Main dashboard layout
│   │   └── dashboard/
│   │       ├── ScoreCards.jsx    # Composite score visualizations
│   │       ├── BehavioralTimeline.jsx  # Multi-track timeline
│   │       ├── RadarChart.jsx    # Interaction analytics radar
│   │       ├── AnnotatedTranscript.jsx # Transcript with highlights
│   │       ├── DetailView.jsx    # Detailed metrics breakdown
│   │       └── ComparisonView.jsx # Comparison analytics
│   ├── store/
│   │   └── appStore.js           # Zustand state management
│   ├── App.jsx                   # Root component
│   ├── main.jsx                  # React entry point
│   └── index.css                 # Tailwind CSS
├── index_new.html                # HTML entry point
├── package.json
├── vite.config.js
├── tailwind.config.js
└── README.md
```

## Key Features Explained

### 5-Stage Processing Pipeline

The demo simulates a real ML pipeline:

1. **Audio Extraction & Transcription** (2s) - Deepgram medical model
2. **Speaker Diarization** (1.5s) - Separate clinician and patient speech
3. **Pose Estimation & Body Language** (2.5s) - Computer vision analysis
4. **Linguistic Analysis** (2s) - NLP for empathy, jargon, questions
5. **Score Generation** (1.5s) - Composite scoring algorithm

### Composite Scores

Five key metrics evaluate clinical communication:

- **Communication Quality** - Eye contact, questions, interruptions
- **Explanation Clarity** - Jargon usage, teach-back, plain language
- **Patient Engagement** - Speaking time, response latency
- **Body Language** - Posture, lean, gestures, proximity
- **Adherence Support** - Barrier probing, follow-up planning

### Behavioral Timeline

Multi-track visualization showing:
- Speaker segments (who's talking when)
- Gaze direction (patient, screen, elsewhere)
- Body language state (open, neutral, closed, turned away)
- Event markers (empathy, jargon, interruptions, etc.)

### Interaction Analytics Radar

8-dimensional assessment:
- Eye Contact Quality
- Question Quality
- Speaking Balance
- Language Clarity
- Empathy Indicators
- Active Listening
- Posture Openness
- Physical Engagement

## Development

### Build for Production

```bash
npm run build
```

Output will be in `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

### Environment Variables

- `PORT` - Backend server port (default: 3001)
- `DEEPGRAM_API_KEY` - For audio transcription
- `OPENAI_API_KEY` - For enhanced report generation
- `NODE_ENV` - development | production

## Troubleshooting

### Port Already in Use

If port 3000 or 3001 is occupied:

```bash
# Change ports in:
# - vite.config.js (frontend)
# - .env PORT variable (backend)
```

### Dependencies Not Installing

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### CORS Errors

The Vite dev server proxies `/api` requests to the backend. Ensure both servers are running.

## Future Enhancements

- [ ] WebSocket support for real-time transcription
- [ ] PDF report generation
- [ ] Video playback with synchronized transcript
- [ ] Custom rubric creation
- [ ] Multi-user authentication
- [ ] Database integration for session storage
- [ ] Advanced ML models for emotion detection
- [ ] Mobile-responsive design

## Credits

**Prepared by:** Harjyot Singh
**Affiliation:** Duke University | Robertson Scholar | Stanford Clinical Excellence Research Center (CERC)
**Date:** February 2026

## License

Confidential — For Laerdal Medical & Academic Partner Review Only

## Support

For questions or issues:
- Check the troubleshooting section
- Review the code comments
- Open an issue in the repository

---

**Note:** This is a technical demo showcasing the full pipeline from video input to scored dashboard. For production use, additional security, scalability, and compliance measures would be required.
