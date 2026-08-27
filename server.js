/**
 * Chatty — Express Server
 * Serves the chat UI and proxies requests to Google Gemini API.
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { SYSTEM_PROMPT } = require('./system-prompt');

const app = express();
const PORT = process.env.PORT || 3000;

// --------------- Middleware ---------------

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Rate limiting: 30 requests per minute per IP
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many requests. Please wait a moment before sending another message.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// --------------- Gemini Setup ---------------

let genAI = null;
let model = null;

function initializeGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    console.warn('⚠️  GEMINI_API_KEY not set. Chat will return an error message.');
    return false;
  }
  genAI = new GoogleGenerativeAI(apiKey);
  model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: SYSTEM_PROMPT,
  });
  console.log('✅ Gemini API initialized successfully');
  return true;
}

const geminiReady = initializeGemini();

// --------------- API Routes ---------------

// Health check for Railway
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    gemini: geminiReady ? 'connected' : 'not configured',
    timestamp: new Date().toISOString(),
  });
});

// Chat endpoint with streaming
app.post('/api/chat', chatLimiter, async (req, res) => {
  try {
    if (!geminiReady) {
      return res.status(503).json({
        error: 'API key not configured. Please set GEMINI_API_KEY environment variable.',
      });
    }

    const { message, history } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    if (message.length > 10000) {
      return res.status(400).json({ error: 'Message too long. Please keep it under 10,000 characters.' });
    }

    // Build conversation history for Gemini
    const chatHistory = [];
    if (Array.isArray(history)) {
      for (const msg of history.slice(-20)) { // Keep last 20 messages for context
        if (msg.role && msg.content) {
          chatHistory.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }],
          });
        }
      }
    }

    // Start chat with history
    const chat = model.startChat({ history: chatHistory });

    // Stream the response
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const result = await chat.sendMessageStream(message);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        res.write(text);
      }
    }

    res.end();
  } catch (error) {
    console.error('Chat error:', error.message);

    // Handle specific Gemini errors
    if (error.message?.includes('API_KEY_INVALID')) {
      return res.status(401).json({ error: 'Invalid API key. Please check your GEMINI_API_KEY.' });
    }
    if (error.message?.includes('RATE_LIMIT_EXCEEDED')) {
      return res.status(429).json({ error: 'API rate limit reached. Please wait a moment and try again.' });
    }
    if (error.message?.includes('SAFETY')) {
      return res.status(400).json({ error: 'The response was blocked by safety filters. Please rephrase your question.' });
    }

    if (!res.headersSent) {
      res.status(500).json({ error: `Server Error: ${error.message}` });
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

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════════╗
    ║        🧬 Chatty Server                   ║
    ║                                           ║
    ║   Running on: http://localhost:${PORT}       ║
    ║   Gemini:     ${geminiReady ? '✅ Connected' : '❌ Not configured'}            ║
    ╚═══════════════════════════════════════════╝
    `);
  });
}

module.exports = app;
