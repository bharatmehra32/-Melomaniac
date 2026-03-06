const express = require('express');
const path = require('path');
const axios = require('axios');
const multer = require('multer');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const { v4: uuidv4 } = require('uuid');
const { searchSong } = require('./youtube_api');
require('dotenv').config();

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
const usersFilePath = path.join(userDataDir, 'users.json');

[uploadsDir, userDataDir, publicDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
});

// Load users from file on startup
function loadUsers() {
    try {
        if (fs.existsSync(usersFilePath)) {
            const data = fs.readFileSync(usersFilePath, 'utf8');
            users = JSON.parse(data);
            console.log(`✓ Loaded ${users.length} users from storage`);
        } else {
            console.log('ℹ No existing user data found, starting fresh');
        }
    } catch (error) {
        console.error('Error loading users:', error.message);
        users = [];
    }
}

// Save users to file
function saveUsers() {
    try {
        fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
    } catch (error) {
        console.error('Error saving users:', error.message);
    }
}

// Load users on startup
loadUsers();

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
        saveUsers();
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

        let allResults = [];

        // Search Free Music Archive API
        try {
            const fmaResponse = await axios.get('https://freemusicarchive.org/api/get/songs.json', {
                params: {
                    api_key: 'freemusicarchive',
                    limit: 25,
                    with: ['artist', 'album'],
                    sort: 'rating_recent'
                },
                timeout: 8000
            });

            const fmaSongs = (fmaResponse.data.data || [])
                .filter(track => track.track_file_url && track.track_title)
                .filter(track => {
                    const searchLower = query.toLowerCase();
                    return track.track_title_lower?.includes(searchLower) || 
                           track.artist?.artist_name?.toLowerCase().includes(searchLower);
                })
                .slice(0, 15)
                .map(track => ({
                    id: `fma_${track.id}`,
                    title: track.track_title,
                    artist: { name: track.artist?.artist_name || 'Artist' },
                    album: {
                        cover: track.album?.album_images?.[0]?.image || `https://via.placeholder.com/180?text=${encodeURIComponent(track.track_title.substring(0, 10))}`
                    },
                    preview: track.track_listen_url,
                    url: track.track_file_url,
                    duration: track.track_duration / 1000,
                    source: 'fma',
                    fullAvailable: true
                }));

            allResults.push(...fmaSongs);
        } catch (error) {
            console.warn("FMA search error:", error.message);
        }

        // Search Jamendo API (full streaming)
        try {
            const jamendoResponse = await axios.get('https://api.jamendo.com/v3.0/tracks', {
                params: {
                    client_id: '23c46d76',
                    format: 'json',
                    limit: 20,
                    order: 'popularity_total',
                    include: 'musicinfo',
                    search: query
                },
                timeout: 8000
            });

            const jamendoSongs = (jamendoResponse.data.results || [])
                .filter(track => track.audio && track.name)
                .map(track => ({
                    id: `jamendo_${track.id}`,
                    title: track.name,
                    artist: { name: track.artist_name },
                    album: {
                        cover: track.image || `https://via.placeholder.com/180?text=${encodeURIComponent(track.name.substring(0, 10))}`
                    },
                    preview: track.audio,
                    url: track.audio,
                    duration: parseInt(track.duration) || 180,
                    source: 'jamendo',
                    fullAvailable: true,
                    license: track.musicinfo?.license?.title || 'CC BY'
                }));

            allResults.push(...jamendoSongs);
        } catch (error) {
            console.warn('Jamendo search error:', error.message);
        }

        // Search Archive.org for free music
        try {
            const archiveResponse = await axios.get('https://archive.org/advancedsearch.php', {
                params: {
                    q: `${query} AND mediatype:audio`,
                    fl: 'identifier,title,creator',
                    sort: 'downloads desc',
                    rows: 15,
                    output: 'json'
                },
                timeout: 8000
            });

            if (archiveResponse.data && archiveResponse.data.response && archiveResponse.data.response.docs) {
                const archiveSongs = archiveResponse.data.response.docs
                    .filter(item => item.title)
                    .map(item => ({
                        id: `archive_${item.identifier}`,
                        title: item.title,
                        artist: { name: item.creator || 'Internet Archive' },
                        album: {
                            cover: `https://archive.org/services/img/${item.identifier}` || 'https://via.placeholder.com/180?text=Archive'
                        },
                        preview: `https://archive.org/download/${item.identifier}/${item.identifier}_vbr.mp3`,
                        url: `https://archive.org/download/${item.identifier}/${item.identifier}_vbr.mp3`,
                        duration: 0,
                        source: 'archive',
                        fullAvailable: true
                    }));

                allResults.push(...archiveSongs);
            }
        } catch (error) {
            console.warn('Archive.org search error:', error.message);
        }

        // Search Deezer API (30-second previews only)
        try {
            const deezerResponse = await axios.get('https://api.deezer.com/search', {
                params: {
                    q: query,
                    limit: 10,
                    output: 'json'
                },
                timeout: 5000
            });

            const deezerSongs = (deezerResponse.data.data || [])
                .filter(track => track.preview)
                .map(track => ({
                    id: `deezer_${track.id}`,
                    title: track.title,
                    artist: { name: track.artist.name },
                    album: {
                        cover: track.album.cover_medium || `https://via.placeholder.com/180?text=${encodeURIComponent(track.title.substring(0, 10))}`
                    },
                    preview: track.preview,
                    url: track.preview,
                    duration: track.duration,
                    source: 'deezer',
                    deezerUrl: track.link,
                    fullAvailable: false
                }));

            allResults.push(...deezerSongs);
        } catch (error) {
            console.warn('Deezer search error:', error.message);
        }

        // Search iTunes API (30-second previews only)
        try {
            const itunesResponse = await axios.get('https://itunes.apple.com/search', {
                params: {
                    term: query,
                    media: 'music',
                    limit: 10,
                    explicit: 'No'
                },
                timeout: 5000
            });

            const itunesSongs = (itunesResponse.data.results || [])
                .filter(track => track.previewUrl)
                .map(track => ({
                    id: `itunes_${track.trackId}`,
                    title: track.trackName,
                    artist: { name: track.artistName },
                    album: {
                        cover: track.artworkUrl100?.replace('100x100', '256x256') || 'https://via.placeholder.com/180?text=Music'
                    },
                    preview: track.previewUrl,
                    url: track.previewUrl,
                    duration: 30,
                    source: 'itunes',
                    fullAvailable: false
                }));

            allResults.push(...itunesSongs);
        } catch (error) {
            console.warn('iTunes search error:', error.message);
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
                        preview: `/uploads/${filename}`,
                        source: 'upload',
                        duration: 0,
                        fullAvailable: true,
                        uploadedAt: stats.mtime.toISOString()
                    };
                });

            allResults.push(...uploadedSongs);
        } catch (error) {
            console.warn('Upload search error:', error.message);
        }

        // Add reliable sample songs as fallback for full streaming
        // These work even when external APIs fail
        const searchQuery = query.toLowerCase();
        const sampleSongsSearch = [
            { title: 'Sunny Afternoon', artist: 'Kevin MacLeod', keyword: 'sunny' },
            { title: 'Carefree', artist: 'Kevin MacLeod', keyword: 'carefree' },
            { title: 'The Lift', artist: 'Kevin MacLeod', keyword: 'lift' },
            { title: 'Figtop', artist: 'Kevin MacLeod', keyword: 'figtop' },
            { title: 'Fluffing a Duck', artist: 'Kevin MacLeod', keyword: 'duck' },
            { title: 'Gymnopedie No. 1', artist: 'Kevin MacLeod', keyword: 'gymnopedie' },
            { title: 'Impact Intermezzo', artist: 'Kevin MacLeod', keyword: 'impact' },
            { title: 'Latino', artist: 'Kevin MacLeod', keyword: 'latino' }
        ];

        const matchingSamples = sampleSongsSearch.filter(s => 
            s.title.toLowerCase().includes(searchQuery) || 
            s.artist.toLowerCase().includes(searchQuery) ||
            s.keyword.includes(searchQuery)
        );

        matchingSamples.forEach(s => {
            allResults.push({
                id: `sample_${s.keyword}`,
                title: s.title,
                artist: { name: s.artist },
                album: { cover: `https://via.placeholder.com/180?text=${encodeURIComponent(s.title.substring(0, 10))}` },
                preview: `https://incompetech.com/music/royalty-free/mp3-royalty-free/${encodeURIComponent(s.title)}.mp3`,
                url: `https://incompetech.com/music/royalty-free/mp3-royalty-free/${encodeURIComponent(s.title)}.mp3`,
                duration: 180,
                source: 'cc',
                fullAvailable: true
            });
        });

        // Remove duplicates
        const uniqueResults = Array.from(
            new Map(allResults.map(song => [song.id, song])).values()
        );

        // Sort: prioritize full-length sources first, then by source quality
        // Priority: upload > fma > jamendo > archive > deezer > itunes
        const sourcePriority = {
            'upload': 1,
            'fma': 2,
            'jamendo': 3,
            'archive': 4,
            'deezer': 5,
            'itunes': 6
        };

        uniqueResults.sort((a, b) => {
            // First: prioritize full songs over previews
            if (a.fullAvailable !== b.fullAvailable) {
                return a.fullAvailable ? -1 : 1;
            }
            // Second: sort by source priority
            const aPriority = sourcePriority[a.source] || 99;
            const bPriority = sourcePriority[b.source] || 99;
            return aPriority - bPriority;
        });

        res.json({ data: uniqueResults });
    } catch (error) {
        console.error('Search error:', error.message);
        res.json({ data: [] });
    }
});

// Get featured songs - PRIORITIZING TAYLOR SWIFT AND POPULAR ARTISTS (OPTIMIZED)
app.get('/api/featured', async (req, res) => {
    let allSongs = [];
    let popularSongs = [];
    
    // 1. FIRST: Add Taylor Swift and top popular artists from Deezer (30-second previews) - REDUCED for speed
    const popularArtists = [
        'Taylor Swift', 'The Weeknd', 'Drake', 'Billie Eilish', 
        'Ed Sheeran', 'Dua Lipa', 'Ariana Grande', 'Harry Styles'
    ];
    
    // Fetch all artists in parallel for speed
    const deezerPromises = popularArtists.map(artist => 
        axios.get('https://api.deezer.com/search', {
            params: { q: artist, limit: 10, output: 'json' },
            timeout: 5000
        }).then(response => {
            const songs = (response.data.data || [])
                .filter(track => track.preview)
                .slice(0, 5)
                .map(track => ({
                    id: `deezer_${track.id}`,
                    title: track.title,
                    artist: { name: track.artist.name },
                    album: { cover: track.album.cover_medium || track.album.cover || `https://via.placeholder.com/180?text=${encodeURIComponent(track.title.substring(0, 10))}` },
                    preview: track.preview,
                    url: track.preview,
                    duration: track.duration,
                    source: 'deezer',
                    deezerUrl: track.link,
                    fullAvailable: false,
                    isPopular: true
                }));
            return songs;
        }).catch(error => {
            console.warn(`Deezer API failed for ${artist}:`, error.message);
            return [];
        })
    );
    
    const deezerResults = await Promise.all(deezerPromises);
    deezerResults.forEach(songs => popularSongs.push(...songs));
    
    // 2. Also add iTunes for top 4 artists - parallel
    const itunesArtists = ['Taylor Swift', 'The Weeknd', 'Drake', 'Ed Sheeran'];
    const itunesPromises = itunesArtists.map(artist => 
        axios.get('https://itunes.apple.com/search', {
            params: { term: artist, media: 'music', limit: 8, explicit: 'No' },
            timeout: 5000
        }).then(response => {
            const songs = (response.data.results || [])
                .filter(track => track.previewUrl)
                .slice(0, 5)
                .map(track => ({
                    id: `itunes_${track.trackId}`,
                    title: track.trackName,
                    artist: { name: track.artistName },
                    album: { cover: track.artworkUrl100?.replace('100x100', '256x256') || 'https://via.placeholder.com/180?text=Music' },
                    preview: track.previewUrl,
                    url: track.previewUrl,
                    duration: 30,
                    source: 'itunes',
                    fullAvailable: false,
                    isPopular: true
                }));
            return songs;
        }).catch(error => {
            console.warn(`iTunes API failed for ${artist}:`, error.message);
            return [];
        })
    );
    
    const itunesResults = await Promise.all(itunesPromises);
    itunesResults.forEach(songs => popularSongs.push(...songs));
    
    // 3. Add sample CC songs as reliable fallback - no API call needed
    const sampleSongs = [
        { title: 'Sunny Afternoon', artist: 'Kevin MacLeod' },
        { title: 'Carefree', artist: 'Kevin MacLeod' },
        { title: 'The Lift', artist: 'Kevin MacLeod' },
        { title: 'Fluffing a Duck', artist: 'Kevin MacLeod' },
        { title: 'Gymnopedie No. 1', artist: 'Kevin MacLeod' }
    ];
    
    sampleSongs.forEach((s, i) => {
        allSongs.push({
            id: `sample_${i}`,
            title: s.title,
            artist: { name: s.artist },
            album: { cover: `https://via.placeholder.com/180?text=${encodeURIComponent(s.title.substring(0, 10))}` },
            preview: `https://incompetech.com/music/royalty-free/mp3-royalty-free/${encodeURIComponent(s.title)}.mp3`,
            url: `https://incompetech.com/music/royalty-free/mp3-royalty-free/${encodeURIComponent(s.title)}.mp3`,
            duration: 180,
            source: 'cc',
            fullAvailable: true,
            isPopular: false
        });
    });

    // Remove duplicates
    const uniquePopular = Array.from(new Map(popularSongs.map(song => [song.id, song])).values());
    const uniqueAll = Array.from(new Map(allSongs.map(song => [song.id, song])).values());
    
    // Combine: popular artists first, then other music
    const finalSongs = [...uniquePopular, ...uniqueAll];
    
    console.log(`✓ Total featured tracks: ${finalSongs.length} (${uniquePopular.length} popular)`);
    res.json({ data: finalSongs });
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

// DEBUG: Show all registered accounts
app.get('/api/debug/accounts', (req, res) => {
    const accounts = users.map(u => ({
        id: u.id,
        username: u.username,
        email: u.email,
        createdAt: u.createdAt
    }));
    res.json({ 
        totalAccounts: users.length,
        accounts: accounts
    });
});

// DEBUG: Clear all accounts (reset)
app.post('/api/debug/reset', (req, res) => {
    users = [];
    saveUsers();
    res.json({ message: 'All accounts cleared', totalAccounts: 0 });
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