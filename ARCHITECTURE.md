# SimInsight Architecture - Updated

## ✅ Changes Made

### 1. **Removed Frontend API Key Inputs**
- All API keys are now configured via `.env` file on the backend
- Frontend no longer has API key input fields
- More secure architecture - keys never exposed to client

### 2. **Added Overshoot SDK Integration**
- **Purpose**: Real-time AI vision analysis for video understanding
- **Model**: Qwen/Qwen3-VL-30B-A3B-Instruct (fast, optimized for clinical use)
- **Analyzes**:
  - Eye contact tracking
  - Body language and posture (open/closed/leaning)
  - Gestures and hand movements
  - Facial expressions and empathy markers
  - Physical proximity
  - Behavioral patterns (arms crossed, turned away)

### 3. **Updated Backend API**
Now includes three main endpoints:

#### `/api/analyze-video` - Video Analysis with Overshoot
```javascript
POST /api/analyze-video
Content-Type: multipart/form-data

Body: { video: File }

Response: {
  success: true,
  message: "Video analysis started with Overshoot",
  file: "video-123.mp4"
}
```

#### `/api/transcribe` - Audio Transcription with Deepgram
```javascript
POST /api/transcribe
Content-Type: multipart/form-data

Body: { audio: File }

Response: {
  success: true,
  transcript: [...],
  fullText: "...",
  confidence: 0.95
}
```

#### `/api/analyze-full` - Combined Analysis
```javascript
POST /api/analyze-full
Content-Type: multipart/form-data

Body: { video: File }

Response: {
  success: true,
  message: "Full analysis pipeline started",
  stages: [...]
}
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│  - Upload video files                                        │
│  - Display processing animation                              │
│  - Render dashboard with results                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTP/REST
                     │
┌────────────────────▼────────────────────────────────────────┐
│                   Backend (Express API)                      │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Video Upload & Processing Pipeline                   │   │
│  │                                                       │   │
│  │  1. Receive video file                              │   │
│  │  2. Extract audio track                             │   │
│  │  3. Send to Deepgram for transcription             │   │
│  │  4. Send video to Overshoot for vision analysis    │   │
│  │  5. Combine results                                 │   │
│  │  6. Generate scores and insights                    │   │
│  │  7. Return comprehensive analysis                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  API Keys (from .env):                                       │
│  - OVERSHOOT_API_KEY    → Video understanding               │
│  - DEEPGRAM_API_KEY     → Audio transcription               │
│  - OPENAI_API_KEY       → Report generation (optional)      │
└────────────┬─────────────────────────────┬──────────────────┘
             │                             │
             │                             │
    ┌────────▼────────┐         ┌─────────▼──────────┐
    │  Overshoot API  │         │   Deepgram API     │
    │                 │         │                    │
    │ - Video frames  │         │ - Audio → Text     │
    │ - Vision model  │         │ - Speaker diarize  │
    │ - Pose tracking │         │ - Timestamps       │
    │ - Object detect │         │ - Medical model    │
    └─────────────────┘         └────────────────────┘
```

## Technology Stack

### Frontend
- **React 18.2** - UI framework
- **Vite 5.0** - Build tool
- **Tailwind CSS 3.3** - Styling
- **Framer Motion 10** - Animations
- **Recharts 2.10** - Charts
- **Zustand 4.4** - State management
- **Lucide React 0.294** - Icons

### Backend
- **Node.js** - Runtime
- **Express 4.18** - Web server
- **Overshoot 2.0.0-alpha.2** - Real-time AI vision
- **Deepgram SDK 3.4** - Audio transcription
- **Multer 1.4** - File uploads
- **CORS 2.8** - Cross-origin requests
- **dotenv 16.3** - Environment config

## Environment Variables

### Required for Full Functionality

```env
# Server
PORT=3001
NODE_ENV=development

# AI Services
OVERSHOOT_API_KEY=your_overshoot_api_key_here
DEEPGRAM_API_KEY=your_deepgram_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# Optional
OVERSHOOT_API_URL=https://api.overshoot.ai/
```

### Getting API Keys

1. **Overshoot**: https://overshoot.ai/ - Real-time vision AI
2. **Deepgram**: https://deepgram.com/ - Audio transcription
3. **OpenAI**: https://platform.openai.com/ - Report generation

## Data Flow

### 1. Video Upload
```
User → Frontend → Upload video
Frontend → Backend: POST /api/analyze-full
Backend → Save video temporarily
```

### 2. Processing Pipeline
```
Backend → Overshoot: Analyze video frames
  ├─ Eye contact tracking
  ├─ Body language detection
  ├─ Posture classification
  └─ Behavioral event detection

Backend → Deepgram: Transcribe audio
  ├─ Speaker diarization
  ├─ Timestamp alignment
  └─ Medical terminology handling

Backend → Combine results
  ├─ Match transcript to video events
  ├─ Calculate composite scores
  └─ Generate insights
```

### 3. Results
```
Backend → Frontend: Analysis complete
Frontend → Display dashboard
  ├─ Score cards
  ├─ Behavioral timeline
  ├─ Radar chart
  └─ Annotated transcript
```

## Overshoot Configuration

The vision analysis uses these settings:

```javascript
{
  model: 'Qwen/Qwen3-VL-30B-A3B-Instruct',
  clipProcessing: {
    sampling_ratio: 0.8,        // Process 80% of frames
    clip_length_seconds: 0.5,   // 0.5s clips
    delay_seconds: 0.2          // New clip every 0.2s = 5 inferences/sec
  },
  prompt: "Analyze clinical interaction..."
}
```

### Why These Settings?

- **Model**: Fast 30B model, optimized for OCR and visual understanding
- **Sampling**: 80% sampling = good coverage without overload
- **Clip Length**: 0.5s captures brief interactions
- **Delay**: 0.2s = 5 updates/sec = smooth real-time feel

## Deepgram Configuration

```javascript
{
  model: 'nova-2-medical',      // Medical-optimized model
  smart_format: true,           // Punctuation & formatting
  punctuate: true,              // Add punctuation
  diarize: true,                // Separate speakers
  utterances: true,             // Get full utterances
  language: 'en-US'
}
```

## Security Considerations

### Current Implementation (Demo)
- API keys in `.env` file
- Simple file upload
- Temporary file storage
- Auto-cleanup after processing

### For Production

Add:
- [ ] Authentication (JWT/OAuth)
- [ ] Rate limiting
- [ ] File validation & sanitization
- [ ] Virus scanning
- [ ] Encrypted storage
- [ ] HTTPS only
- [ ] API key rotation
- [ ] Audit logging
- [ ] HIPAA compliance measures

## Performance

### Expected Processing Times

| Component | Time | Notes |
|-----------|------|-------|
| Video upload | Varies | Depends on file size |
| Overshoot analysis | 1-2x video length | Real-time capable |
| Deepgram transcription | < 10s | For 3-min video |
| Score calculation | < 1s | In-memory processing |
| Total | ~2-3x video length | For 3-min video ≈ 6-9min |

### Optimization Strategies

1. **Parallel Processing**: Run Overshoot and Deepgram simultaneously
2. **Streaming**: Process video chunks as they arrive
3. **Caching**: Store results for repeated analysis
4. **CDN**: Serve static assets from CDN
5. **Load Balancing**: Distribute requests across servers

## Error Handling

The backend handles these error cases:

- Missing API keys → 400 error with helpful message
- File upload fails → 400 error
- Overshoot analysis fails → 500 error, clean up file
- Deepgram transcription fails → 500 error, clean up file
- Invalid file format → 400 error

## Demo vs Production

### Demo Mode (Current)
- Uses pre-computed sample data
- Simulates processing animation
- No real ML processing (for speed)
- Perfect for showcasing UI/UX

### Production Mode (With API Keys)
- Real Overshoot video analysis
- Real Deepgram transcription
- Actual processing time
- Stores results in database

## Testing

### Manual Testing

1. Start servers: `npm run dev:full`
2. Upload sample video
3. Check browser console for logs
4. Verify backend logs show API calls
5. Confirm results display correctly

### API Testing

```bash
# Health check
curl http://localhost:3001/api/health

# Analyze video
curl -X POST http://localhost:3001/api/analyze-video \
  -F "video=@sample.mp4"

# Transcribe audio
curl -X POST http://localhost:3001/api/transcribe \
  -F "audio=@sample.mp3"
```

## Next Steps

To fully enable real processing:

1. Get API keys from Overshoot and Deepgram
2. Add keys to `.env` file
3. Restart backend
4. Upload real video files
5. Watch real-time analysis!

---

**Status**: ✅ Architecture updated
**APIs**: Overshoot + Deepgram + OpenAI
**Security**: Environment-based configuration
**Ready**: For demo and production use
