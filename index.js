import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { ffmpeg } from './ffmpeg.js';
import { imageOptimizationFun} from './imageOptimizer.js';
const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'))
app.use(express.urlencoded({ extended: false }));
// app.use(
//   cors({
//     origin: 'http://localhost:5173',
//     credentials: true,
//     methods: ['GET', 'POST'],
//   })
// );
app.get('/', function (req, res) {
    res.json({ message: 'Streaming and Image Optimization' });
  });
imageOptimizationFun(app);
ffmpeg(app);
app.listen(8001, function () {
  console.log('App is listening at port 8001...');
});























