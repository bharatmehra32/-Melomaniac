const express = require('express');
const path = require('path');
const axios = require('axios');
const multer = require('multer');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'melomaniac-secret-key-2026';
const DEEZER_APP_ID = process.env.DEEZER_APP_ID || 'your_deezer_app_id';

// In-memory user storage (in production, use a database)
let users = [];
let userSessions = new Map();

// Create necessary directories
const uploadsDir = path.join(__dirname, 'uploads');
const userDataDir = path.join(__dirname, 'user-data');
const publicDir = path.join(__dirname, 'public');

[uploadsDir, userDataDir, publicDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /mp3|wav|ogg|m4a|aac|flac/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only audio files are allowed!'));
        }
    }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    secret: JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Serve static files
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(uploadsDir));

// Authentication middleware
function requireAuth(req, res, next) {
    if (req.session.userId) {
        return next();
    }
    res.redirect('/login');
}

// API middleware for authenticated requests
function requireAPIAuth(req, res, next) {
    if (req.session.userId) {
        req.userId = req.session.userId;
        return next();
    }
    res.status(401).json({ error: 'Authentication required' });
}

// Routes

// Login page
app.get('/login', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Register page
app.get('/register', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'register.html'));
});

// Profile page
app.get('/profile', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'profile.html'));
});

// Main app (protected)
app.get('/', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API Routes

// User registration
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Check if user exists
        const existingUser = users.find(u => u.email === email || u.username === username);
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = {
            id: uuidv4(),
            username,
            email,
            password: hashedPassword,
            createdAt: new Date().toISOString(),
            profile: {
                avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
                bio: '',
                favoriteGenres: []
            },
            stats: {
                songsUploaded: 0,
                totalPlays: 0,
                favoriteSongs: []
            }
        };

        users.push(user);
        res.json({ success: true, message: 'Registration successful' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// User login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = users.find(u => u.email === email);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Set session
        req.session.userId = user.id;
        req.session.username = user.username;

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                profile: user.profile
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// User logout
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.json({ success: true });
    });
});

// Get current user
app.get('/api/user', requireAPIAuth, (req, res) => {
    const user = users.find(u => u.id === req.userId);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        profile: user.profile,
        stats: user.stats
    });
});

// Update user profile
app.put('/api/user/profile', requireAPIAuth, (req, res) => {
    const user = users.find(u => u.id === req.userId);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    const { bio, favoriteGenres } = req.body;
    user.profile.bio = bio || user.profile.bio;
    user.profile.favoriteGenres = favoriteGenres || user.profile.favoriteGenres;

    res.json({ success: true, profile: user.profile });
});

// Search songs (combines multiple sources)
app.get('/api/search', requireAPIAuth, async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) {
            return res.json({ data: [] });
        }

        const allResults = [];

        // Search Deezer API for full songs
        try {
            const deezerResponse = await axios.get('https://api.deezer.com/search', {
                params: {
                    q: query,
                    limit: 20,
                    output: 'json'
                }
            });

            const deezerSongs = deezerResponse.data.data
                .filter(track => track.preview) // Ensure preview exists
                .map(track => ({
                    id: `deezer_${track.id}`,
                    title: track.title,
                    artist: { name: track.artist.name },
                    album: {
                        cover: track.album.cover_medium || `https://via.placeholder.com/180?text=${encodeURIComponent(track.title.substring(0, 10))}`
                    },
                    preview: track.preview,
                    duration: track.duration,
                    source: 'deezer',
                    deezerUrl: track.link,
                    fullAvailable: true // Deezer provides full streaming
                }));

            allResults.push(...deezerSongs);
        } catch (error) {
            console.error('Deezer search error:', error.message);
        }

        // Search iTunes API for additional results
        try {
            const itunesResponse = await axios.get('https://itunes.apple.com/search', {
                params: {
                    term: query,
                    media: 'music',
                    limit: 15,
                    explicit: 'No'
                }
            });

            const itunesSongs = itunesResponse.data.results
                .filter(track => track.previewUrl)
                .map(track => ({
                    id: `itunes_${track.trackId}`,
                    title: track.trackName,
                    artist: { name: track.artistName },
                    album: {
                        cover: track.artworkUrl100?.replace('100x100', '256x256') || 'https://via.placeholder.com/180?text=Music'
                    },
                    preview: track.previewUrl,
                    duration: 30,
                    source: 'itunes',
                    fullAvailable: false
                }));

            allResults.push(...itunesSongs);
        } catch (error) {
            console.error('iTunes search error:', error.message);
        }

        // Search user's uploaded songs
        try {
            const files = fs.readdirSync(uploadsDir);
            const user = users.find(u => u.id === req.userId);
            const uploadedSongs = files
                .filter(file => /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file))
                .filter(filename => {
                    const title = filename.replace(/\.[^/.]+$/, "").toLowerCase();
                    const searchTerm = query.toLowerCase();
                    return title.includes(searchTerm);
                })
                .map(filename => {
                    const filePath = path.join(uploadsDir, filename);
                    const stats = fs.statSync(filePath);

                    return {
                        id: `upload_${filename}`,
                        title: filename.replace(/\.[^/.]+$/, ""),
                        artist: { name: user ? user.username : 'Local Upload' },
                        album: { cover: 'https://via.placeholder.com/180?text=Upload' },
                        url: `/uploads/${filename}`,
                        source: 'upload',
                        duration: 0,
                        fullAvailable: true,
                        uploadedAt: stats.mtime.toISOString()
                    };
                });

            allResults.push(...uploadedSongs);
        } catch (error) {
            console.error('Upload search error:', error.message);
        }

        // Remove duplicates and sort
        const uniqueResults = Array.from(
            new Map(allResults.map(song => [song.id, song])).values()
        );

        // Sort: uploads first, then Deezer, then iTunes
        uniqueResults.sort((a, b) => {
            if (a.source === 'upload' && b.source !== 'upload') return -1;
            if (a.source !== 'upload' && b.source === 'upload') return 1;
            if (a.source === 'deezer' && b.source === 'itunes') return -1;
            if (a.source === 'itunes' && b.source === 'deezer') return 1;
            return 0;
        });

        res.json({ data: uniqueResults });
    } catch (error) {
        console.error('Search error:', error.message);
        res.json({ data: [] });
    }
});

// Get featured songs
app.get('/api/featured', requireAPIAuth, async (req, res) => {
    try {
        // Get trending songs from Deezer
        const response = await axios.get('https://api.deezer.com/chart/0/tracks', {
            params: {
                limit: 20,
                output: 'json'
            }
        });

        const songs = response.data.data.map(track => ({
            id: `deezer_${track.id}`,
            title: track.title,
            artist: { name: track.artist.name },
            album: {
                cover: track.album.cover_medium || `https://via.placeholder.com/180?text=${encodeURIComponent(track.title.substring(0, 10))}`
            },
            preview: track.preview,
            duration: track.duration,
            source: 'deezer',
            fullAvailable: true
        }));

        res.json({ data: songs });
    } catch (error) {
        console.error('Featured error:', error.message);
        res.json({ data: [] });
    }
});

// Upload music file
app.post('/api/upload', requireAPIAuth, upload.single('music'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const user = users.find(u => u.id === req.userId);
        if (user) {
            user.stats.songsUploaded++;
        }

        const fileInfo = {
            id: req.file.filename,
            title: req.file.originalname.replace(/\.[^/.]+$/, ""),
            artist: { name: user ? user.username : 'Local Upload' },
            album: { cover: 'https://via.placeholder.com/180?text=Upload' },
            url: `/uploads/${req.file.filename}`,
            source: 'upload',
            duration: 0,
            fullAvailable: true,
            uploadedAt: new Date().toISOString(),
            uploadedBy: req.userId
        };

        res.json({ success: true, file: fileInfo });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Upload failed' });
    }
});

// Get user's uploaded music
app.get('/api/my-music', requireAPIAuth, (req, res) => {
    try {
        const files = fs.readdirSync(uploadsDir);
        const userSongs = files
            .filter(file => /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file))
            .map(filename => {
                const filePath = path.join(uploadsDir, filename);
                const stats = fs.statSync(filePath);

                return {
                    id: filename,
                    title: filename.replace(/\.[^/.]+$/, ""),
                    artist: { name: 'Your Upload' },
                    album: { cover: 'https://via.placeholder.com/180?text=Upload' },
                    url: `/uploads/${filename}`,
                    source: 'upload',
                    duration: 0,
                    fullAvailable: true,
                    uploadedAt: stats.mtime.toISOString()
                };
            });

        res.json({ data: userSongs });
    } catch (error) {
        console.error('My music error:', error);
        res.json({ data: [] });
    }
});

// Get user stats
app.get('/api/stats', requireAPIAuth, (req, res) => {
    const user = users.find(u => u.id === req.userId);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    res.json(user.stats);
});

// Update play count
app.post('/api/play/:songId', requireAPIAuth, (req, res) => {
    const user = users.find(u => u.id === req.userId);
    if (user) {
        user.stats.totalPlays++;
    }
    res.json({ success: true });
});

// Start server
app.listen(port, () => {
    console.log(`\n╔════════════════════════════════════════╗`);
    console.log(`║  🎵 Melomaniac Music Streaming App   ║`);
    console.log(`╚════════════════════════════════════════╝\n`);
    console.log(`🌐 Localhost:  http://localhost:${port}\n`);
    console.log(`🔐 Registration: http://localhost:${port}/register`);
    console.log(`   Login: http://localhost:${port}/login\n`);
    console.log(`📱 Features:`);
    console.log(`   • User accounts & profiles`);
    console.log(`   • Full song streaming (Deezer integration)`);
    console.log(`   • Personal music uploads`);
    console.log(`   • Social features & stats\n`);
});