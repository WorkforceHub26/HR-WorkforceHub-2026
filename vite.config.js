import { defineConfig } from 'vite';
import { resolve, join } from 'path';
import fs from 'fs';
import tailwindcss from '@tailwindcss/vite';
import { handleCreateLineLink, handleLineWebhook, handleSendNotification, handleClearApproverLine, handleRecordLoginLog, handleGetLoginLogs, handlePurgeLoginLogs, handleOcrScan, handleHrChatbot } from './api-handlers.js';

export default defineConfig({
  plugins: [
    tailwindcss(),
    {
      name: 'api-line-handler',
      configureServer(server) {
        server.middlewares.use('/api/create-line-link', (req, res) => {
          if (req.method === 'POST') handleCreateLineLink(req, res);
          else res.end();
        });
        server.middlewares.use('/api/clear-approver-line', (req, res) => {
          if (req.method === 'POST') handleClearApproverLine(req, res);
          else res.end();
        });
        server.middlewares.use('/api/line-webhook', (req, res) => {
          if (req.method === 'POST') handleLineWebhook(req, res);
          else res.end();
        });
        server.middlewares.use('/api/send-notification', (req, res) => {
          if (req.method === 'POST') handleSendNotification(req, res);
          else res.end();
        });
        server.middlewares.use('/api/record-login-log', (req, res) => {
          if (req.method === 'POST') handleRecordLoginLog(req, res);
          else res.end();
        });
        server.middlewares.use('/api/login-logs', (req, res) => {
          if (req.method === 'GET') handleGetLoginLogs(req, res);
          else res.end();
        });
        server.middlewares.use('/api/purge-login-logs', (req, res) => {
          if (req.method === 'POST') handlePurgeLoginLogs(req, res);
          else res.end();
        });
        server.middlewares.use('/api/ocr-scan', (req, res) => {
          if (req.method === 'POST') handleOcrScan(req, res);
          else res.end();
        });
        server.middlewares.use('/api/hr-chatbot', (req, res) => {
          if (req.method === 'POST') handleHrChatbot(req, res);
          else res.end();
        });
        server.middlewares.use((req, res, next) => {
          const urlPath = req.url.split('?')[0];
          if (urlPath === '/manifest.json') {
            const manifestPath = resolve(__dirname, 'manifest.json');
            if (fs.existsSync(manifestPath)) {
              const content = fs.readFileSync(manifestPath, 'utf8');
              res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
              res.setHeader('Cache-Control', 'no-cache');
              return res.end(content);
            }
          }
          if (urlPath === '/sw.js') {
            const swPath = resolve(__dirname, 'sw.js');
            if (fs.existsSync(swPath)) {
              const content = fs.readFileSync(swPath, 'utf8');
              res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
              res.setHeader('Cache-Control', 'no-cache');
              return res.end(content);
            }
          }
          next();
        });
      }
    }
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        userIndex: resolve(__dirname, 'pages/user/index-user.html'),
        userProfile: resolve(__dirname, 'pages/user/profile-user.html'),
        userLeave: resolve(__dirname, 'pages/user/leave-user.html'),
        userLeaveHistory: resolve(__dirname, 'pages/user/leave-history.html'),
        userLeaveRules: resolve(__dirname, 'pages/user/leave-rules.html'),
        userFullGuide: resolve(__dirname, 'pages/user/full-guide.html'),
        userHolidays: resolve(__dirname, 'pages/user/holidays.html'),
        hrHome: resolve(__dirname, 'pages/hr/home.html'),
        hrLeave: resolve(__dirname, 'pages/hr/hr.html'),
        hrManagement: resolve(__dirname, 'pages/hr/management.html'),
      },
    },
  },
});
