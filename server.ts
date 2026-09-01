import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { handleCreateLineLink, handleLineWebhook, handleSendNotification, handleClearApproverLine } from './api-handlers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 3000;

app.use(express.json());

// API Endpoints
app.post('/api/create-line-link', handleCreateLineLink);
app.post('/api/clear-approver-line', handleClearApproverLine);
app.post('/api/line-webhook', handleLineWebhook);
app.post('/api/send-notification', handleSendNotification);

// Serve static files from the 'dist' directory
app.use(express.static(join(__dirname, 'dist')));

// Fallback to index.html for SPA routing (if needed)
app.use((req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${port}`);
});
