import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import ImageKit from 'imagekit';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import Razorpay from 'razorpay';
import crypto from 'crypto';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const imagekit = new ImageKit({
  publicKey: process.env.VITE_IMAGEKIT_PUBLIC_KEY || '',
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY || '',
  urlEndpoint: process.env.VITE_IMAGEKIT_URL_ENDPOINT || '',
});

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_Sdb9QzH1sFzGWW',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'aN75HoAt8nP8O6XRyO2gV7Wv',
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  if (!process.env.VITE_IMAGEKIT_PUBLIC_KEY || !process.env.IMAGEKIT_PRIVATE_KEY || !process.env.VITE_IMAGEKIT_URL_ENDPOINT) {
    console.warn('WARNING: ImageKit environment variables are missing. Uploads will not work.');
  }

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // Razorpay Endpoints
  app.post('/api/payment/create-order', async (req, res) => {
    try {
      const { amount, currency = 'INR', receipt } = req.body;
      const options = {
        amount: amount * 100, // amount in the smallest currency unit
        currency,
        receipt,
      };
      const order = await razorpay.orders.create(options);
      res.json(order);
    } catch (error) {
      console.error('Razorpay Order Error:', error);
      res.status(500).json({ error: 'Failed to create order' });
    }
  });

  app.post('/api/payment/verify', async (req, res) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
      const body = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'aN75HoAt8nP8O6XRyO2gV7Wv')
        .update(body.toString())
        .digest('hex');

      if (expectedSignature === razorpay_signature) {
        res.json({ status: 'ok' });
      } else {
        res.status(400).json({ status: 'failed' });
      }
    } catch (error) {
      console.error('Razorpay Verify Error:', error);
      res.status(500).json({ error: 'Failed to verify payment' });
    }
  });

  // ImageKit Authentication Endpoint
  app.get('/api/imagekit/auth', (req, res) => {
    try {
      const result = imagekit.getAuthenticationParameters();
      console.log('ImageKit Auth Success');
      res.json(result);
    } catch (error) {
      console.error('ImageKit Auth Error:', error);
      res.status(500).json({ error: 'Failed to generate auth parameters' });
    }
  });

  // List ImageKit Files
  app.get('/api/imagekit/files', async (req, res) => {
    try {
      const { path = '/', limit = 100, skip = 0 } = req.query;
      const files = await imagekit.listFiles({
        path: path as string,
        limit: parseInt(limit as string),
        skip: parseInt(skip as string),
      });
      res.json(files);
    } catch (error) {
      console.error('ImageKit List Error:', error);
      res.status(500).json({ error: 'Failed to list files' });
    }
  });

  // Bulk Delete ImageKit Files
  app.post('/api/imagekit/files/bulk-delete', async (req, res) => {
    try {
      const { fileIds } = req.body;
      console.log('Attempting to delete ImageKit files:', fileIds);
      if (!fileIds || !Array.isArray(fileIds)) {
        return res.status(400).json({ error: 'fileIds must be an array' });
      }
      const result = await imagekit.bulkDeleteFiles(fileIds);
      console.log('ImageKit Bulk Delete Result:', result);
      res.json(result);
    } catch (error) {
      console.error('ImageKit Bulk Delete Error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
      res.status(500).json({ error: 'Failed to delete files' });
    }
  });

  // Upload Overlay Image
  app.post('/api/imagekit/upload-overlay', async (req, res) => {
    try {
      const { file, fileName } = req.body;
      if (!file) return res.status(400).json({ error: 'No file provided' });
      
      const result = await imagekit.upload({
        file, // base64
        fileName: fileName || `overlay_${Date.now()}.png`,
        folder: 'overlays',
        useUniqueFileName: true,
      });
      res.json(result);
    } catch (error) {
      console.error('ImageKit Upload Overlay Error:', error);
      res.status(500).json({ error: 'Failed to upload overlay' });
    }
  });

  // Proxy for downloading images to bypass CORS
  app.get('/api/proxy-download', async (req, res) => {
    try {
      const { url } = req.query;
      if (!url || typeof url !== 'string') {
        return res.status(400).send('URL is required');
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        return res.status(response.status).send('Failed to fetch image');
      }
      
      const contentType = response.headers.get('content-type');
      if (contentType) {
        res.setHeader('Content-Type', contentType);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (error) {
      console.error('Proxy Download Error:', error);
      res.status(500).send('Internal Server Error');
    }
  });

  // API routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
