import express from 'express';
import cors from 'cors';
import { ffmpeg } from './ffmpeg.js';
import { imageOptimizationFun } from './imageOptimizer.js';
import LokiTransport from 'winston-loki';
import { createLogger, format, transports } from 'winston';
import {
  collectDefaultMetrics,
  register,
  Histogram,
  Counter,
} from 'prom-client';
const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));
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
collectDefaultMetrics();
const options = {
  transports: [
    new LokiTransport({
      labels: { app: 'ImageOptimization', service: 'connectx-service' },
      host: 'http://148.72.168.56:3100',
      // host: 'http://192.168.1.68:3100',
    }),
  ],
};
export const lokiLogger = createLogger(options);
app.get('/metrics', async (_req, res) => {
  console.log('Metrics');
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err);
  }
});

const reqResTime = new Histogram({
  name: 'http_req_res_time_bucket_ImageOptimization',
  help: 'Request and Response Time',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [10, 50, 100, 300, 500, 800, 1000, 2000],
});
const totalRequest = new Counter({
  name: 'http_request_count_ImageOptimization',
  help: 'Total Request Count',
});
app.use((req, res, next) => {
  const start = Date.now();
  // const originalSend = res.send;
  // res.send = function (body: any) {
  //     // console.log('Response Body:', body.message);
  //     res.message = body.message; // Capture the response body
  //     return originalSend.call(this, body);
  // };
  res.on('finish', () => {
    const logMessage = `Log:${req?.user?.name} ,${req?.user?.mobile} , Path: ${req.path}, Status: ${res.statusCode}`;
    if (res.statusCode >= 400) {
      lokiLogger.error(logMessage);
    } else {
      lokiLogger.info(logMessage);
    }
    const duration = Date.now() - start;
    totalRequest.inc();
    reqResTime
      .labels(req.method, req.url, res.statusCode.toString())
      .observe(duration / 1000);
  });
  next();
});
app.use((req, res, next) => {
  if (!req.url.startsWith('/v0')) {
      return res.status(404).json({ error: 'Endpoint not found' });
  }
  next();
});
imageOptimizationFun(app);
ffmpeg(app);
app.listen(8001, function () {
  console.log('App is listening at port 8001...');
});
