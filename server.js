// server.js - Real-time Walkie Talkie WebSocket + Express Server
import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Track channels and connected clients
// channelKey -> Set<WebSocket>
const activeChannels = new Map();

const broadcastMetadata = (channelKey) => {
  const clients = activeChannels.get(channelKey);
  if (!clients) return;
  const count = clients.size;
  const metadata = JSON.stringify({
    type: 'metadata',
    channel: channelKey,
    users: count,
    timestamp: Date.now(),
  });

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(metadata);
      } catch (err) {
        console.error(`Error sending metadata to client:`, err);
      }
    }
  });
};

// WebSocket Server initialization
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  // Extract channel from URL, e.g. /ws/32-48 or /ws/channel-1
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const match = parsedUrl.pathname.match(/^\/ws\/(.+)$/);
  const channelKey = match ? decodeURIComponent(match[1]) : 'default';

  console.log(`[WS] Client joined channel: "${channelKey}" (IP: ${req.socket.remoteAddress})`);

  if (!activeChannels.has(channelKey)) {
    activeChannels.set(channelKey, new Set());
  }
  const channelClients = activeChannels.get(channelKey);
  channelClients.add(ws);

  // Mark client as alive for heartbeat
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  // Announce updated user count
  broadcastMetadata(channelKey);

  // Relay audio streams and messages to other users in the same channel
  ws.on('message', (message, isBinary) => {
    const clients = activeChannels.get(channelKey);
    if (!clients) return;

    clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        try {
          client.send(message, { binary: isBinary });
        } catch (err) {
          console.error(`[WS] Error forwarding message:`, err);
        }
      }
    });
  });

  ws.on('close', (code, reason) => {
    console.log(`[WS] Client disconnected from channel "${channelKey}" (Code: ${code})`);
    const clients = activeChannels.get(channelKey);
    if (clients) {
      clients.delete(ws);
      if (clients.size === 0) {
        activeChannels.delete(channelKey);
      } else {
        broadcastMetadata(channelKey);
      }
    }
  });

  ws.on('error', (err) => {
    console.error(`[WS] Client error on channel "${channelKey}":`, err.message);
  });
});

// Periodic heartbeat to prevent proxies (e.g. Render / Cloudflare) from closing idle WebSockets
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const channelSummary = {};
  for (const [key, clients] of activeChannels.entries()) {
    channelSummary[key] = clients.size;
  }
  res.json({
    status: 'online',
    service: 'walkie-talkie-core',
    timestamp: new Date().toISOString(),
    totalActiveChannels: activeChannels.size,
    channels: channelSummary,
  });
});

// Serve frontend build in production
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// For SPA routing fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      res.status(200).send('Walkie-Talkie Backend Running. Run `npm run build` to serve the web interface.');
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(`🎙️  WALKIE-TALKIE SERVER RUNNING`);
  console.log(`📡 HTTP & WS Port: ${PORT}`);
  console.log(`🌐 Local UI URL:   http://localhost:${PORT}`);
  console.log(`===============================================`);
});
