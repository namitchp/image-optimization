import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { Server } from 'socket.io';
import { promisify } from 'util';
const execPromise = promisify(exec);
export const ffmpeg = (app, server) => {
  const io = new Server(server, { cors: { origin: '*' } });

  const UPLOAD_DIR = 'uploads/video/original';
  const STREAM_DIR = 'uploads/video/stream';
  const MAX_SEGMENT_SIZE = 4 * 1024 * 1024; // 4 MB

  const storage = multer.diskStorage({
    // destination: (req, file, cb) => cb(null, UPLOAD_DIR),
      destination: (req, file, cb) => {
              const { folderName } = req.query;
              const filePath = `${UPLOAD_DIR}/${folderName}`;
              if (!fs.existsSync(filePath)) fs.mkdirSync(filePath, { recursive: true });
              cb(null, filePath);
            },
    filename: (req, file, cb) => {
        const folderName = req.query.folderName.replaceAll('/', '-');
      const ext = path.extname(file.originalname);
      const filename = path.basename(file.originalname, ext);
      cb(null, `${folderName}-${filename}-${Date.now()}${ext}`);
    },
  });

  const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
      const filetypes = /mp4|audio|mp3|wav/;
      const mimetype = filetypes.test(file.mimetype);
      const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
      if (mimetype && extname) {
        return cb(null, true);
      }
      cb(new Error(`File upload only supports the following filetypes: ${filetypes}`));
    },
  });

  app.post('/v0/video/upload', (req, res, next) => {
    if (!Object.keys(req.query).length) {
      return res.json({ message: 'What is folderName', valid: false });
    }
    next();
  }, upload.single('file'), async (req, res) => {
    try {
      const lessonId = req.file.filename.split('.')[0];
      const videoPath = req.file.path;
      const outputPath = `${STREAM_DIR}/${lessonId}`;
      const hlsPath = `${outputPath}/index.m3u8`;

      if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
      }

      const ffmpegCommand = `ffmpeg -i ${videoPath} -codec:v libx264 -codec:a aac -hls_time 20 -hls_playlist_type vod -hls_segment_filename "${outputPath}/segment%03d.ts" -start_number 0 -flush_packets 1 -fs ${MAX_SEGMENT_SIZE} -progress pipe:1 ${hlsPath}`;
      const ffmpegProcess = exec(ffmpegCommand);

      const fullUrl = `https://image.connectx.co.in/${hlsPath}`;
      res.json({
        message: 'Video converted to HLS format',
        videoUrl: fullUrl,
        lessonId,
      });

      ffmpegProcess.on('close', (code) => {
        if (code === 0) {
          console.log('FFmpeg process completed successfully.');
        } else {
          console.error(`FFmpeg process exited with code ${code}.`);
        }
      });
    } catch (error) {
      console.error('Error processing video upload:', error);
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  });
};
