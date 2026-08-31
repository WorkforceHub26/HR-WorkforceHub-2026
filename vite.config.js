import { defineConfig } from 'vite';
import { resolve } from 'path';
import tailwindcss from '@tailwindcss/vite';
import { handleCreateLineLink, handleLineWebhook, handleSendNotification } from './api-handlers.js';

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
        server.middlewares.use('/api/line-webhook', (req, res) => {
          if (req.method === 'POST') handleLineWebhook(req, res);
          else res.end();
        });
        server.middlewares.use('/api/send-notification', (req, res) => {
          if (req.method === 'POST') handleSendNotification(req, res);
          else res.end();
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
        userHolidays: resolve(__dirname, 'pages/user/holidays.html'),
        hrHome: resolve(__dirname, 'pages/hr/home.html'),
        hrLeave: resolve(__dirname, 'pages/hr/hr.html'),
        hrManagement: resolve(__dirname, 'pages/hr/management.html'),
      },
    },
  },
});
