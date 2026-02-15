# YouTube Video Import Setup

## Overview

SimInsight now supports importing videos directly from YouTube! Videos are automatically:
1. Downloaded from YouTube
2. Converted to MP4 format
3. Ready for analysis

## Prerequisites

### 1. FFmpeg Installation (Required)

FFmpeg is needed to merge video and audio streams from YouTube.

#### macOS
```bash
brew install ffmpeg
```

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install ffmpeg
```

#### Windows
Download from: https://ffmpeg.org/download.html

Verify installation:
```bash
ffmpeg -version
```

### 2. Dependencies (Already Installed)

The following npm packages are already included:
- `ytdl-core` - YouTube video downloader
- `fluent-ffmpeg` - FFmpeg wrapper for Node.js

## How It Works

### Frontend
1. User enters YouTube URL
2. Click "Import" button
3. Frontend sends URL to backend API
4. Shows loading state while processing

### Backend Process
```
YouTube URL
    ↓
Validate URL (ytdl-core)
    ↓
Get video info
    ↓
Download video stream (highest quality)
    ↓
Download audio stream (highest quality)
    ↓
Merge with FFmpeg
    ↓
Save as MP4
    ↓
Ready for analysis
```

## API Endpoint

### POST /api/youtube-import

**Request:**
```json
{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID"
}
```

**Response:**
```json
{
  "success": true,
  "title": "Video Title",
  "videoId": "VIDEO_ID",
  "filePath": "/path/to/video.mp4",
  "message": "YouTube video imported and converted to MP4 successfully"
}
```

**Error Response:**
```json
{
  "error": "Invalid YouTube URL",
  "details": "..."
}
```

## Supported YouTube URLs

All standard YouTube URL formats are supported:

- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/embed/VIDEO_ID`
- `https://m.youtube.com/watch?v=VIDEO_ID`

## Usage Example

### From Frontend

```javascript
const handleYouTubeImport = async (url) => {
  const response = await fetch('/api/youtube-import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });

  const data = await response.json();
  console.log('Imported:', data.title);
};
```

### From cURL

```bash
curl -X POST http://localhost:3001/api/youtube-import \
  -H "Content-Type: application/json" \
  -d '{"url": "https://youtube.com/watch?v=VIDEO_ID"}'
```

## Quality Settings

The backend is configured to download:
- **Video**: Highest quality video-only stream
- **Audio**: Highest quality audio-only stream
- **Output**: Merged MP4 with H.264 video and AAC audio

### Customizing Quality

Edit `server/index.js` to change quality settings:

```javascript
// For lower quality (faster download)
const videoStream = ytdl(url, {
  quality: '720p',
  filter: 'videoonly'
});

// For specific format
const videoStream = ytdl(url, {
  quality: 'highest',
  filter: format => format.container === 'mp4'
});
```

## File Storage

Downloaded videos are stored in:
```
/uploads/yt-{videoId}-{timestamp}.mp4
```

### Automatic Cleanup

Videos are automatically cleaned up after processing. To keep videos longer, modify the cleanup timeout in `server/index.js`.

## Error Handling

### Common Errors

**1. "FFmpeg not found"**
- Install FFmpeg (see Prerequisites)
- Restart the server

**2. "Invalid YouTube URL"**
- Check URL format
- Ensure video is not private/restricted

**3. "Download failed"**
- Video may be restricted in your region
- Try a different video
- Check internet connection

**4. "Merge failed"**
- FFmpeg installation issue
- Check FFmpeg permissions
- Try reinstalling FFmpeg

## Limitations

### YouTube API Limits
- No authentication required (uses public API)
- Subject to YouTube rate limits
- Some videos may be restricted by uploader

### File Size
- Large videos may take time to download
- Consider setting size limits in production
- Monitor disk space usage

### Copyright
- Only use videos you have rights to analyze
- Respect YouTube's Terms of Service
- For educational/research purposes only

## Production Considerations

### Add These Features

1. **Progress Tracking**
   ```javascript
   videoStream.on('progress', (chunkLength, downloaded, total) => {
     const percent = (downloaded / total * 100).toFixed(2);
     console.log(`Downloaded: ${percent}%`);
   });
   ```

2. **Rate Limiting**
   - Limit downloads per user/IP
   - Queue system for multiple requests
   - Cache popular videos

3. **Storage Management**
   - Set max storage quota
   - Auto-delete old videos
   - Use cloud storage (S3, GCS)

4. **Quality Options**
   - Let users choose quality
   - Optimize for mobile vs desktop
   - Adaptive bitrate streaming

5. **Authentication**
   - YouTube OAuth for private videos
   - User-specific download quotas
   - Access control

## Testing

### Test the Feature

1. Start the servers:
   ```bash
   npm run dev:full
   ```

2. Open http://localhost:3000

3. Paste a YouTube URL in the import field

4. Click "Import"

5. Check server logs for download progress

6. Video should be ready for analysis

### Test URLs

Use these public domain/creative commons videos for testing:
- NASA videos: https://www.youtube.com/NASA
- TED Talks: https://www.youtube.com/TED
- Khan Academy: https://www.youtube.com/khanacademy

## Troubleshooting

### Debug Mode

Enable detailed logging:

```javascript
// In server/index.js
ytdl.on('info', (info) => {
  console.log('Video info:', info);
});

ytdl.on('progress', (chunkLength, downloaded, total) => {
  console.log(`Progress: ${downloaded}/${total}`);
});
```

### Check FFmpeg

```bash
# Test FFmpeg
ffmpeg -version

# Test simple conversion
ffmpeg -i input.mp4 -c copy output.mp4
```

### Verify ytdl-core

```bash
# Test in Node.js
node -e "const ytdl = require('ytdl-core'); console.log(ytdl.validateURL('https://youtube.com/watch?v=dQw4w9WgXcQ'));"
```

## Security

### Best Practices

1. **Validate URLs**: Always validate before downloading
2. **Sanitize Filenames**: Prevent directory traversal
3. **Limit Size**: Set maximum file size
4. **Virus Scan**: Scan downloaded files
5. **Rate Limit**: Prevent abuse

### Example Rate Limiting

```javascript
import rateLimit from 'express-rate-limit';

const youtubeLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many YouTube imports, please try again later'
});

app.post('/api/youtube-import', youtubeLimit, async (req, res) => {
  // ... handler code
});
```

## Performance Tips

1. **Parallel Downloads**: Process multiple videos concurrently
2. **Stream Processing**: Don't wait for full download
3. **CDN Integration**: Cache processed results
4. **Background Jobs**: Use queue system (Bull, BeeQueue)
5. **Compression**: Compress before storage

## Next Steps

- ✅ YouTube URL import
- ✅ Automatic MP4 conversion
- ✅ Quality selection
- 🔄 Progress tracking UI
- 🔄 Thumbnail preview
- 🔄 Playlist support
- 🔄 Batch processing

---

**Status**: ✅ Fully Functional
**Requires**: FFmpeg installed on system
**Supports**: All public YouTube videos
