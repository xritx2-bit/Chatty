# 🧬 NBIC Study Buddy

An AI-powered study assistant for BTech-MTech integrated course students, covering **Nanotechnology, Biotechnology, AI/ML, and Cognitive Science**.

Built with ❤️ to help students learn smarter.

![Powered by Gemini](https://img.shields.io/badge/Powered%20by-Google%20Gemini-blue)
![Deploy on Railway](https://img.shields.io/badge/Deploy%20on-Railway-purple)

---

## ✨ Features

- 🤖 **ChatGPT-like experience** — streaming responses, markdown rendering, code highlighting
- 📚 **Expert in 4 NBIC domains** — Nano, Bio, AI/ML, Cognitive Science
- 📝 **Exam helpers** — auto-generate practice questions per subject
- 🎨 **Premium dark UI** — glassmorphism, animations, fully responsive
- ⚡ **Fast & Free** — uses Google Gemini free tier (no credit card needed)

---

## 🚀 Quick Start (Local)

### 1. Get a Free Gemini API Key

1. Go to [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Sign in with your Google account
3. Click **"Create API Key"** → copy it

### 2. Setup

```bash
# Clone the repo
git clone <your-repo-url>
cd Chatty

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Paste your API key in .env
# GEMINI_API_KEY=your_key_here

# Start the server
npm start
```

### 3. Open

Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🚂 Deploy on Railway

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit - NBIC Study Buddy"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/nbic-study-buddy.git
git push -u origin main
```

### Step 2: Deploy on Railway

1. Go to [https://railway.app](https://railway.app) and sign in with GitHub
2. Click **"New Project"** → **"Deploy from GitHub Repo"**
3. Select your repository
4. Go to **Variables** tab → Add:
   - `GEMINI_API_KEY` = your API key
5. Railway will auto-detect Node.js and deploy!
6. Click **"Generate Domain"** in Settings to get your public URL

### Step 3: Share!

Share the Railway URL with your colleagues. Done! 🎉

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express |
| AI | Google Gemini 2.0 Flash |
| Frontend | HTML + CSS + Vanilla JS |
| Hosting | Railway |

---

## 📁 Project Structure

```
Chatty/
├── public/
│   ├── index.html      # Chat UI
│   ├── styles.css       # Premium dark theme
│   └── app.js           # Frontend logic
├── server.js            # Express server + Gemini API
├── system-prompt.js     # AI tutor persona
├── package.json
├── railway.toml         # Railway config
├── Procfile             # Process file
├── .env.example         # Environment template
└── README.md
```

---

## 📝 License

MIT — Use it, share it, help your classmates! 🎓
