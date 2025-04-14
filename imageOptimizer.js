import multer from 'multer';
import sharp from 'sharp';
import * as fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
class imageOptimizer {
  imageUpload() {
    const fileSize = 20; // Max file size in MB
    return multer({
      storage: multer.diskStorage({
        destination: (req, file, cb) => {
          const { folderName } = req.query;
          const filePath = `uploads/image/original/${folderName}`;
          if (!fs.existsSync(filePath)) fs.mkdirSync(filePath, { recursive: true });
          cb(null, filePath);
        },
        filename: (req, file, cb) => {
          const ext = path.extname(file.originalname);
          const filename = path.basename(file.originalname, ext);
          cb(null, `${filename.replaceAll(' ', '')}-${Date.now()}${ext}`);
        },
      }),
      limits: { fileSize: 1024 * 1024 * fileSize },
      fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|pdf/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) return cb(null, true);
        cb('Error: File upload only supports the following filetypes - ' + filetypes);
      },
    });
  }
  imageGet(query, res) {
    const imagePath = this.fileAccess(query, res);
    return imagePath.valid
      ? this.transformedImageFun(imagePath.message, res)
      : this.originalImage(query, imagePath, res);
  }
  async originalImage(query, imagePath, res) {
    const { width, height, quality, format } = query;
    const formatOptions = {
      jpeg: { contentType: 'jpeg', isLossy: true },
      gif: { contentType: 'gif', isLossy: false },
      webp: { contentType: 'webp', isLossy: true },
      png: { contentType: 'png', isLossy: false },
      avif: { contentType: 'avif', isLossy: true },
    };
    const { contentType, isLossy } = formatOptions[format] || formatOptions['jpeg'];

    let transformedImage = sharp(imagePath.message, { failOn: 'none', animated: true });
    const resizingOptions = {};
    if (width !== 'auto') resizingOptions.width = +width;
    if (height !== 'auto') resizingOptions.height = +height;
    if (Object.keys(resizingOptions).length) transformedImage = transformedImage.resize(resizingOptions);

    if (quality !== 'auto' && isLossy) {
      transformedImage = transformedImage.toFormat(contentType, { quality: parseInt(quality) });
    } else {
      transformedImage = transformedImage.toFormat(contentType);
    }

    const directoryPathTransformed = `${this.fetchDirectory('transformed')}/${imagePath.fileName}`;
    const transformedImageBuffer = await transformedImage.toBuffer();
    sharp(transformedImageBuffer).toFile(directoryPathTransformed, (err) => {
      if (err) return res.status(500).send({ message: 'Image not found' });
      this.transformedImageFun(directoryPathTransformed, res);
    });
  }

  transformedImageFun(imagePath, res) {
    res.status(200).sendFile(imagePath, (err) => {
      if (err) res.status(404).send('Image not found');
    });
  }

  fetchDirectory(type) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const imagePath = path.join(__dirname, `./uploads/image/${type}`);
    if (!fs.existsSync(imagePath)) fs.mkdirSync(imagePath, { recursive: true });
    return imagePath;
  }

  fileAccess(reqObj, res) {
    const { name, width, height, quality, format } = reqObj;
    const fileName = `${name.replaceAll("/", '-')}&width=${width}&height=${height}&quality=${quality}.${
      format === 'auto' ? 'jpeg' : format
    }`;
    let accessFolder = `${this.fetchDirectory('transformed')}/${fileName}`;
    if (fs.existsSync(accessFolder)) return { message: accessFolder, valid: true, fileName };

    accessFolder = `${this.fetchDirectory('original')}/${name}`;
    if (fs.existsSync(accessFolder)) return { message: accessFolder, valid: false, fileName };

    res.status(404).send({ message: 'Image not found' });
  }
}

export const imageOptimizationFun = (app) => {
  const classOptimization = new imageOptimizer();

  app.post(
    '/v0/image/upload',
    (req, res, next) => {
      if (!Object.keys(req.query).length) {
        return res.json({ message: 'What is folderName', valid: false });
      }
      next();
    },
    classOptimization.imageUpload().single('file'),
    (req, res) => {
      const filePath = req.file.path.split("original/")[1];
      const fullUrl = `https://image.connectx.co.in/v0/image/get?name=${filePath}&format=auto&width=auto&height=auto&quality=auto`;
      // const fullUrl = `https://image.quickgst.in/v0/image/get?name=${filePath}&format=auto&width=auto&height=auto&quality=auto`;
      res.status(200).json({
        message: 'Success',
        data: `https://image.connectx.co.in/v0/image/get?name=${filePath}`,
        // data: `https://image.quickgst.in/v0/image/get?name=${filePath}`,
        url: fullUrl,
      });
    }
  );

  app.get('/v0/image/get', (req, res) => {
    const obj = { ...req.query, width: req.query.width || 'auto', height: req.query.height || 'auto', quality: req.query.quality || 'auto', format: req.query.format || 'auto' };

        const supportedFormats = ['.jpeg', '.gif', '.webp', '.png', '.avif'];
        const fileExtension = path.extname(obj.name).toLowerCase();
    
        if (supportedFormats.includes(fileExtension)) {
          classOptimization.imageGet(obj, res);
        } else {
          const accessFolder = `${classOptimization.fetchDirectory('original')}/${obj.name}`;
          if (fs.existsSync(accessFolder)) {
            classOptimization.transformedImageFun(accessFolder, res);
          } else {
            res.status(404).send({ message: 'File not found' });
          }
        }
    // classOptimization.imageGet(obj, res);
  });
};
