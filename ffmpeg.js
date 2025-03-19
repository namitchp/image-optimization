import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { exec } from 'child_process';
import { Server } from 'socket.io';
import { promisify } from 'util';
const execPromise = promisify(exec);
export const ffmpeg = (app, server) => {
  const io = new Server(server, { cors: { origin: '*' } });
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, './uploads/video/original');
    },
    filename: function (req, file, cb) {
      const { folderName } = req.query;
      var ext = path.extname(file.originalname);
      var filename = path.basename(file.originalname, ext);
      cb(null, `${folderName || 'folder'}-${filename}-${Date.now()}${ext}`);
    },
  });
  const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
      console.log(file.originalname);
      console.log(file.mimetype);
      // Set the filetypes, it is optional
      var filetypes = /mp4|audio|mp3|wav/;
      var mimetype = filetypes.test(file.mimetype);
      var extname = filetypes.test(
        path.extname(file.originalname).toLowerCase()
      );
      if (mimetype && extname) {
        return cb(null, true);
      }
      cb(
        'Error: File upload only supports the ' +
          'following filetypes - ' +
          filetypes
      );
    },
  });

  app.post('/v0/video/upload',upload.single('file'),async function (req, res) {
      const lessonId = req.file.filename.split('.')[0];
      const videoPath = req.file.path;
      const outputPath = `uploads/video/stream/${lessonId}`;
      const hlsPath = `${outputPath}/index.m3u8`;
      if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
      }
      const maxSegmentSize = 4 * 1024 * 1024; // 4 MB
      const ffmpegCommand = `ffmpeg -i ${videoPath} -codec:v libx264 -codec:a aac -hls_time 20 -hls_playlist_type vod -hls_segment_filename "${outputPath}/segment%03d.ts" -start_number 0 -flush_packets 1 -fs ${maxSegmentSize} -progress pipe:1 ${hlsPath}`;
      const ffmpegProcess = exec(ffmpegCommand);
      const fullUrl = `${req.protocol}://${req.get('host')}/${hlsPath}`;
      res.json({
        message: 'Video converted to HLS format',
        videoUrl: fullUrl,
        lessonId: lessonId,
      });
      ffmpegProcess.on('close', (code) => {
        console.log(code);
      });
    }
  );
};
