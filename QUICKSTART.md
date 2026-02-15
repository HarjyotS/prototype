# SimInsight Quick Start Guide

Get SimInsight running in under 5 minutes!

## 🚀 Quick Setup

### 1. Install Dependencies

```bash
npm install
```

This installs all required packages for both frontend and backend.

### 2. Run the Application

**Option A: Run Everything Together (Recommended)**
```bash
npm run dev:full
```

This starts both the frontend (port 3000) and backend (port 3001) simultaneously.

**Option B: Run Separately**
```bash
# Terminal 1 - Frontend
npm run dev

# Terminal 2 - Backend
npm run server
```

### 3. Open in Browser

Navigate to: **http://localhost:3000**

## 🎯 Try the Demo

### Sample Analysis (No API Keys Required)

1. You'll see the upload screen with 3 sample videos
2. Click **"Analyze"** on any sample (A, B, or C)
3. Watch the 5-stage processing animation (~10 seconds)
4. Explore the dashboard with:
   - Score cards
   - Behavioral timeline
   - Radar chart
   - Annotated transcript
5. Click tabs to switch between **Dashboard**, **Details**, and **Comparison** views
6. Click **"Export Report"** to download analysis as JSON

### With Real Transcription (Optional)

To enable real audio transcription:

1. Get a free Deepgram API key from https://deepgram.com
2. Create `.env` file (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```
3. Add your API key to `.env`:
   ```
   DEEPGRAM_API_KEY=your_key_here
   ```
4. Restart the servers
5. Now you can upload real video/audio files!

## 📊 Understanding the Dashboard

### Score Cards (Top Section)
- 5 composite metrics with donut chart visualizations
- Color-coded: Green (75-100), Amber (50-74), Red (0-49)
- Shows key drivers for each score

### Behavioral Timeline (Middle)
- **Speaker Track**: Blue = Clinician, Orange = Patient
- **Gaze Track**: Green = Patient, Yellow = Screen, Red = Away
- **Body Language**: Green = Open, Blue = Neutral, Orange = Closed, Red = Away
- **Events**: Hover over markers to see details

### Radar Chart (Bottom Left)
- 8 dimensions of interaction quality
- Current session (solid) vs Benchmark (dashed)

### Transcript (Bottom Right)
- Color-coded by event type
- Search and filter capabilities
- Click flags to see details

## 🔧 Troubleshooting

### "Port already in use"
Another app is using port 3000 or 3001. Either:
- Stop the other app
- Or change ports in `vite.config.js` and `.env`

### Dependencies won't install
```bash
rm -rf node_modules package-lock.json
npm install
```

### Frontend and backend not connecting
Make sure both are running on correct ports:
- Frontend: http://localhost:3000
- Backend: http://localhost:3001

Check the terminal for any error messages.

## 📁 Sample Data

Two complete samples are included:
- `public/data/sampleA.json` - Good communication (high scores)
- `public/data/sampleB.json` - Poor communication (low scores)

These contain pre-computed analysis results for instant demo.

## 🎥 Next Steps

1. Explore the **Details** tab for metric breakdowns
2. Check the **Comparison** view for:
   - Session comparison (A vs B)
   - Learner progress over time
   - Cohort analytics
3. Try exporting a report
4. Review the code in `/src/components/dashboard/` to understand the implementation

## 📚 Resources

- Full documentation: See `README.md`
- API reference: Backend endpoints in `server/index.js`
- Sample data format: Check `public/data/sampleA.json`

## 💡 Tips

- The processing animation is simulated (no real ML in demo mode)
- Real video processing requires API keys
- All charts are interactive - hover and click to explore
- Timeline events show detailed tooltips on hover

---

**Need help?** Check `README.md` for detailed documentation or review the code comments.

Enjoy analyzing clinical interactions! 🏥✨
