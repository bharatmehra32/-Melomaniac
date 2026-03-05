# 🎵 Melomaniac - Full Song Music Streaming

A Spotify-like music streaming app with full song upload and playback capabilities.

## ✨ Features

- **Full Song Upload** - Upload your own music files (MP3, WAV, OGG, M4A, AAC, FLAC)
- **Smart Search** - Search combines your uploaded songs + iTunes previews
- **No Time Limits** - Your uploaded songs play completely, no 30-second previews
- **Spotify-like UI** - Modern, dark theme with sidebar navigation
- **Password Protection** - Secure access with customizable password
- **Favorites System** - Save your favorite tracks
- **Public Sharing** - Share your music library with others

## 🚀 How to Use

### 1. Access Your App
- **URL:** `http://localhost:3000`
- **Password:** `musicisprivacy` (or your custom password)

### 2. Upload Music
- Click **"Upload"** tab
- Click **"Choose Music Files"**
- Select your music files (up to 50MB each)
- Files appear in **"My Music"** tab

### 3. Search & Play
- Use the search bar to find songs
- **Green "Full Song"** = Your uploaded music (unlimited playback)
- **Gray "Preview (30s)"** = iTunes previews (30-second limit)
- Click any song to play

### 4. Share with Others
- Use ngrok or localtunnel to create public URLs
- Share the password with friends
- They can access your full music library!

## 📁 File Structure

```
melomaniac/
├── index.html          # Main UI
├── script.js           # Frontend logic
├── styles.css          # Spotify-like styling
├── server.js           # Backend API
├── uploads/            # Your music files
├── package.json        # Dependencies
└── .gitignore         # Git ignore rules
```

## 🔧 Technical Details

- **Backend:** Node.js + Express
- **File Upload:** Multer
- **Music API:** iTunes Search API
- **Frontend:** Vanilla JavaScript
- **Styling:** CSS with dark theme

## 🎯 Search Results Explained

When you search, you'll see:

### 🟢 Your Uploaded Songs (Full Playback)
- Stored locally in `/uploads` folder
- No time limits
- Play complete tracks
- Marked with HDD icon

### 🔘 iTunes Previews (30s Limit)
- Free previews from Apple Music
- 30-second samples only
- Marked with iTunes icon

## 🚀 Deployment

### Local Development
```bash
npm install
npm start
```

### Public Access
```bash
# Option 1: ngrok
./ngrok http 3000

# Option 2: LocalTunnel
npx localtunnel --port 3000
```

### GitHub Pages (Frontend Only)
1. Go to repository Settings → Pages
2. Select main branch → /(root)
3. Access at: `https://username.github.io/repo-name`

---

**Enjoy unlimited music streaming! 🎵**