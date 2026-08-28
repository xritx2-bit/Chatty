/**
 * Chatty — Express Server
 * Serves the chat UI and proxies requests to Google Gemini API.
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { GoogleGenAI } = require('@google/genai');
const { SYSTEM_PROMPT } = require('./system-prompt');

const app = express();
const PORT = 3000;

// --------------- Middleware ---------------

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Security headers (allowing iframe embedding for AI Studio preview)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Rate limiting: 60 requests per minute per IP
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many requests. Please wait a moment before sending another message.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// --------------- Gemini Setup ---------------

function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// --------------- API Routes ---------------

// Health check
app.get('/api/health', (req, res) => {
  const ai = getGenAI();
  res.json({
    status: 'ok',
    gemini: ai ? 'connected' : 'not configured',
    timestamp: new Date().toISOString(),
  });
});

// Chat endpoint with streaming
app.post('/api/chat', chatLimiter, async (req, res) => {
  try {
    const ai = getGenAI();
    if (!ai) {
      return res.status(503).json({
        error: 'Gemini API key is not configured. Please set GEMINI_API_KEY in your environment or Settings > Secrets.',
      });
    }

    const { message, history, media } = req.body;

    if (!message && !media) {
      return res.status(400).json({ error: 'Message or media is required.' });
    }

    if (message && message.length > 10000) {
      return res.status(400).json({ error: 'Message too long. Please keep it under 10,000 characters.' });
    }

    // Build contents array for multi-turn chat in @google/genai
    const contents = [];

    if (Array.isArray(history)) {
      for (const msg of history.slice(-20)) {
        if (msg.role && msg.content) {
          contents.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }],
          });
        }
      }
    }

    // Current turn parts
    const currentParts = [];
    if (message) {
      currentParts.push({ text: message });
    } else {
      currentParts.push({ text: 'Please analyze and explain this attachment.' });
    }

    if (media && media.data && media.mimeType) {
      currentParts.push({
        inlineData: {
          data: media.data,
          mimeType: media.mimeType,
        },
      });
    }

    contents.push({
      role: 'user',
      parts: currentParts,
    });

    // Stream the response
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const streamResponse = await ai.models.generateContentStream({
      model: 'gemini-3.7-flash',
      contents: contents,
      config: {
        systemInstruction: SYSTEM_PROMPT,
      },
    });

    for await (const chunk of streamResponse) {
      if (chunk.text) {
        res.write(chunk.text);
      }
    }

    res.end();
  } catch (error) {
    console.error('Chat error:', error);

    const errorMsg = error?.message || 'Internal error';

    if (errorMsg.includes('API_KEY_INVALID') || errorMsg.includes('API key not valid')) {
      if (!res.headersSent) {
        return res.status(401).json({ error: 'Invalid API key. Please check your GEMINI_API_KEY in Settings > Secrets.' });
      }
    }
    if (errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('429')) {
      if (!res.headersSent) {
        return res.status(429).json({ error: 'API rate limit reached. Please wait a moment and try again.' });
      }
    }
    if (errorMsg.includes('SAFETY') || errorMsg.includes('blocked')) {
      if (!res.headersSent) {
        return res.status(400).json({ error: 'The response was blocked by safety filters. Please rephrase your question.' });
      }
    }

    if (!res.headersSent) {
      res.status(500).json({ error: `Server Error: ${errorMsg}` });
    } else {
      res.end();
    }
  }
});

// Serve index.html for all other routes (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --------------- Start Server ---------------

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Chatty server running on http://0.0.0.0:${PORT}`);
});

module.exports = app;
