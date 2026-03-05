const express = require('express');
const path = require('path');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

// Simple password protection
const PASSWORD = 'melomaniac123'; // CHANGE THIS PASSWORD!
const authorizedSessions = new Set();

// Middleware to protect routes
app.use((req, res, next) => {
    // Skip protection for API endpoints
    if (req.path.startsWith('/api/')) {
        return next();
    }
    
    // Skip protection for static assets
    if (req.path.match(/\.(css|js|jpg|jpeg|png|gif|svg|ico)$/)) {
        return next();
    }
    
    // Always allow localhost
    const host = req.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') {
        return next();
    }
    
    // Check for password in query
    const pwd = req.query.pwd;
    if (pwd === PASSWORD) {
        authorizedSessions.add(req.ip);
        return res.redirect(req.path);
    }
    
    // Check if already authorized (same IP)
    if (authorizedSessions.has(req.ip)) {
        return next();
    }
    
    // Show password screen
    return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Melomaniac - Password</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    font-family: 'Segoe UI', Tahoma, Geneva, sans-serif;
                }
                .container {
                    background: white;
                    padding: 50px 40px;
                    border-radius: 15px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    text-align: center;
                    max-width: 400px;
                    width: 90%;
                }
                .container h1 {
                    color: #7c3aed;
                    font-size: 36px;
                    margin-bottom: 10px;
                }
                .container p {
                    color: #666;
                    font-size: 14px;
                    margin-bottom: 30px;
                    line-height: 1.5;
                }
                .form-group {
                    margin-bottom: 20px;
                }
                .container input {
                    width: 100%;
                    padding: 14px;
                    border: 2px solid #ddd;
                    border-radius: 8px;
                    font-size: 16px;
                    transition: all 0.3s;
                }
                .container input:focus {
                    outline: none;
                    border-color: #7c3aed;
                    box-shadow: 0 0 10px rgba(124, 58, 237, 0.2);
                }
                .container button {
                    width: 100%;
                    padding: 14px;
                    background: #7c3aed;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                .container button:hover {
                    background: #6d28d9;
                    transform: translateY(-2px);
                    box-shadow: 0 10px 20px rgba(124, 58, 237, 0.3);
                }
                .container button:active {
                    transform: translateY(0);
                }
                .info {
                    margin-top: 20px;
                    padding-top: 20px;
                    border-top: 1px solid #eee;
                    font-size: 12px;
                    color: #999;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🎵 Melomaniac</h1>
                <p>This is a private music player.<br>Enter the password to continue:</p>
                <form onsubmit="handleSubmit(event)">
                    <div class="form-group">
                        <input 
                            type="password" 
                            id="password" 
                            placeholder="Enter password" 
                            required 
                            autofocus
                            autocomplete="off"
                        >
                    </div>
                    <button type="submit">🔓 Access Now</button>
                </form>
                <div class="info">
                    This is a private instance.<br>
                    Ask the owner for the password.
                </div>
            </div>
            <script>
                function handleSubmit(e) {
                    e.preventDefault();
                    const pwd = document.getElementById('password').value;
                    window.location.href = '/?pwd=' + encodeURIComponent(pwd);
                }
            </script>
        </body>
        </html>
    `);
});

// Serve static files
app.use(express.static(path.join(__dirname)));

// API endpoint - search songs
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) {
            return res.json({ data: [] });
        }

        const response = await axios.get('https://itunes.apple.com/search', {
            params: {
                term: query,
                media: 'music',
                limit: 50,
                explicit: 'No'
            }
        });

        const songs = response.data.results
            .filter(track => track.previewUrl)
            .map(track => ({
                id: track.trackId,
                title: track.trackName,
                artist: { name: track.artistName },
                album: { 
                    cover: track.artworkUrl100?.replace('100x100', '256x256') || 'https://via.placeholder.com/180?text=Music'
                },
                preview: track.previewUrl
            }));

        res.json({ data: songs });
    } catch (error) {
        console.error('Search error:', error.message);
        res.json({ data: [] });
    }
});

// API endpoint - featured songs
app.get('/api/featured', async (req, res) => {
    try {
        const queries = ['popular', 'trending', 'top 40'];
        const allSongs = [];

        for (const query of queries) {
            if (allSongs.length >= 20) break;
            try {
                const response = await axios.get('https://itunes.apple.com/search', {
                    params: {
                        term: query,
                        media: 'music',
                        limit: 10,
                        explicit: 'No'
                    }
                });

                const songs = response.data.results
                    .filter(track => track.previewUrl)
                    .map(track => ({
                        id: track.trackId,
                        title: track.trackName,
                        artist: { name: track.artistName },
                        album: { 
                            cover: track.artworkUrl100?.replace('100x100', '256x256') || 'https://via.placeholder.com/180?text=Music'
                        },
                        preview: track.previewUrl
                    }));

                allSongs.push(...songs);
            } catch (e) {
                console.error(`Error fetching ${query}:`, e.message);
            }
        }

        const uniqueSongs = Array.from(
            new Map(allSongs.map(song => [song.id, song])).values()
        );

        res.json({ data: uniqueSongs.slice(0, 20) });
    } catch (error) {
        console.error('Featured error:', error.message);
        res.json({ data: [] });
    }
});

// Start server
app.listen(port, () => {
    console.log(`\n╔════════════════════════════════════════╗`);
    console.log(`║  🎵 Melomaniac Music Streaming App   ║`);
    console.log(`╚════════════════════════════════════════╝\n`);
    console.log(`🌐 Localhost:  http://localhost:${port}\n`);
    console.log(`🔐 Password: ${PASSWORD}`);
    console.log(`   (Share your public tunnel URL with others)`);
    console.log(`   (They'll need to enter this password)\n`);
});
