import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize SQLite database
const dbPath = path.join(__dirname, '../data/siminsight.db');
const db = new Database(dbPath);

// Enable Write-Ahead Logging for better concurrency
db.pragma('journal_mode = WAL');

// Create tables on initialization
db.exec(`
  CREATE TABLE IF NOT EXISTS video_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id TEXT UNIQUE NOT NULL,
    source_type TEXT NOT NULL,
    source_url TEXT,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    duration_seconds REAL,
    title TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    access_count INTEGER DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_video_id ON video_cache(video_id);
  CREATE INDEX IF NOT EXISTS idx_created_at ON video_cache(created_at);

  CREATE TABLE IF NOT EXISTS analysis_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id TEXT UNIQUE NOT NULL,
    analysis_data TEXT NOT NULL,
    version TEXT DEFAULT '1.0',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_analysis_video_id ON analysis_cache(video_id);

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    video_url TEXT,
    duration_seconds REAL,
    overall_grade TEXT,
    overall_score REAL,
    session_data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_sessions_grade ON sessions(overall_grade);
`);

console.log('✓ SQLite database initialized:', dbPath);

export const VideoCacheDB = {
  /**
   * Check if video exists in cache and file still exists
   */
  getCachedVideo(videoId) {
    const stmt = db.prepare(`
      SELECT * FROM video_cache
      WHERE video_id = ?
    `);
    const cached = stmt.get(videoId);

    // Verify file still exists
    if (cached && fs.existsSync(cached.file_path)) {
      return cached;
    }

    // Clean up database entry if file was deleted
    if (cached && !fs.existsSync(cached.file_path)) {
      console.warn(`Cache entry exists but file missing: ${cached.file_path}`);
      this.removeCachedVideo(videoId);
      return null;
    }

    return null;
  },

  /**
   * Add video to cache or update access time if already exists
   */
  cacheVideo(videoData) {
    const stmt = db.prepare(`
      INSERT INTO video_cache (video_id, source_type, source_url, file_path, file_size, duration_seconds, title)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(video_id) DO UPDATE SET
        last_accessed_at = CURRENT_TIMESTAMP,
        access_count = access_count + 1
    `);

    return stmt.run(
      videoData.videoId,
      videoData.sourceType,
      videoData.sourceUrl,
      videoData.filePath,
      videoData.fileSize,
      videoData.duration,
      videoData.title
    );
  },

  /**
   * Update last accessed time and increment access count
   */
  touchVideo(videoId) {
    const stmt = db.prepare(`
      UPDATE video_cache
      SET last_accessed_at = CURRENT_TIMESTAMP,
          access_count = access_count + 1
      WHERE video_id = ?
    `);
    return stmt.run(videoId);
  },

  /**
   * Remove video from cache
   */
  removeCachedVideo(videoId) {
    const stmt = db.prepare(`
      DELETE FROM video_cache
      WHERE video_id = ?
    `);
    return stmt.run(videoId);
  },

  /**
   * Get all cached videos
   */
  getAllCachedVideos() {
    const stmt = db.prepare(`
      SELECT * FROM video_cache
      ORDER BY last_accessed_at DESC
    `);
    return stmt.all();
  },

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const stmt = db.prepare(`
      SELECT
        COUNT(*) as total_videos,
        SUM(file_size) as total_size_bytes,
        SUM(access_count) as total_accesses,
        AVG(access_count) as avg_accesses_per_video
      FROM video_cache
    `);
    return stmt.get();
  },

  /**
   * Clean up old cached videos (older than specified days)
   */
  cleanOldCache(daysOld = 30) {
    // Get list of old videos before deleting
    const oldVideosStmt = db.prepare(`
      SELECT video_id, file_path FROM video_cache
      WHERE created_at < datetime('now', '-' || ? || ' days')
    `);
    const oldVideos = oldVideosStmt.all(daysOld);

    // Delete from database
    const deleteStmt = db.prepare(`
      DELETE FROM video_cache
      WHERE created_at < datetime('now', '-' || ? || ' days')
    `);
    const result = deleteStmt.run(daysOld);

    // Delete physical files
    let filesDeleted = 0;
    oldVideos.forEach(({ video_id, file_path }) => {
      if (fs.existsSync(file_path)) {
        try {
          fs.unlinkSync(file_path);
          filesDeleted++;
          console.log(`Deleted old cached video: ${video_id}`);
        } catch (error) {
          console.error(`Failed to delete file ${file_path}:`, error.message);
        }
      }
    });

    return {
      databaseEntriesDeleted: result.changes,
      filesDeleted: filesDeleted
    };
  },

  /**
   * Get cached analysis result
   */
  getCachedAnalysis(videoId) {
    const stmt = db.prepare(`
      SELECT * FROM analysis_cache
      WHERE video_id = ?
    `);
    const cached = stmt.get(videoId);

    if (cached) {
      // Update last accessed timestamp
      const touchStmt = db.prepare(`
        UPDATE analysis_cache
        SET last_accessed_at = CURRENT_TIMESTAMP
        WHERE video_id = ?
      `);
      touchStmt.run(videoId);

      // Parse the JSON data
      return JSON.parse(cached.analysis_data);
    }

    return null;
  },

  /**
   * Store analysis result
   */
  storeAnalysis(videoId, analysisData) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO analysis_cache (video_id, analysis_data, created_at, last_accessed_at)
      VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
    return stmt.run(videoId, JSON.stringify(analysisData));
  },

  /**
   * Remove cached analysis
   */
  removeCachedAnalysis(videoId) {
    const stmt = db.prepare(`
      DELETE FROM analysis_cache
      WHERE video_id = ?
    `);
    return stmt.run(videoId);
  },

  /**
   * Save a session to permanent storage
   */
  saveSession(sessionData) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO sessions (id, title, video_url, duration_seconds, overall_grade, overall_score, session_data, created_at, last_viewed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM sessions WHERE id = ?), CURRENT_TIMESTAMP), CURRENT_TIMESTAMP)
    `);

    const overallGrade = sessionData.osceEvaluation?.overall?.grade || 'N/A';
    const overallScore = sessionData.osceEvaluation?.overall?.total_score || 0;

    return stmt.run(
      sessionData.id,
      sessionData.title,
      sessionData.videoUrl,
      sessionData.duration_seconds,
      overallGrade,
      overallScore,
      JSON.stringify(sessionData),
      sessionData.id // For COALESCE to preserve original created_at
    );
  },

  /**
   * Get all sessions ordered by most recent
   */
  getAllSessions() {
    const stmt = db.prepare(`
      SELECT
        id,
        title,
        video_url,
        duration_seconds,
        overall_grade,
        overall_score,
        created_at,
        last_viewed_at
      FROM sessions
      ORDER BY created_at DESC
    `);
    return stmt.all();
  },

  /**
   * Get a specific session by ID
   */
  getSession(sessionId) {
    const stmt = db.prepare(`
      SELECT * FROM sessions
      WHERE id = ?
    `);
    const session = stmt.get(sessionId);

    if (session) {
      // Update last viewed timestamp
      const touchStmt = db.prepare(`
        UPDATE sessions
        SET last_viewed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      touchStmt.run(sessionId);

      // Parse session data
      return JSON.parse(session.session_data);
    }

    return null;
  },

  /**
   * Delete a session
   */
  deleteSession(sessionId) {
    const stmt = db.prepare(`
      DELETE FROM sessions
      WHERE id = ?
    `);
    return stmt.run(sessionId);
  },

  /**
   * Get session statistics
   */
  getSessionStats() {
    const stmt = db.prepare(`
      SELECT
        COUNT(*) as total_sessions,
        AVG(overall_score) as avg_score,
        MAX(overall_score) as max_score,
        MIN(overall_score) as min_score
      FROM sessions
    `);
    return stmt.get();
  }
};

// Graceful shutdown
process.on('exit', () => {
  db.close();
});

process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});

export default VideoCacheDB;
