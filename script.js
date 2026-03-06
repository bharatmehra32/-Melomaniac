// Player state
let currentTrack = null;
let playlist = [];
let currentIndex = 0;
let favorites = JSON.parse(localStorage.getItem('melomaniac_favorites')) || [];
let isPlaying = false;

const audioPlayer = document.getElementById('audio-player');
const playPauseBtn = document.getElementById('play-pause-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const likeBtn = document.getElementById('like-btn');
const uploadBtn = document.getElementById('upload-btn');
const musicUpload = document.getElementById('music-upload');

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    console.log('App initialized');
    loadUserInfo();
    setupTabNavigation();
    setupPlayerControls();
    setupUploadFunctionality();
    loadFeaturedTracks();
    loadMyMusic();
});

// Setup tab navigation
function setupTabNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');
    
    console.log('Found nav items:', navItems.length);
    console.log('Found tab contents:', tabContents.length);
    
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tab = item.getAttribute('data-tab');
            console.log('Switching to tab:', tab);
            
            // Remove active class from all items
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Hide all tabs
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Show selected tab
            const selectedTab = document.getElementById(`${tab}-tab`);
            if (selectedTab) {
                selectedTab.classList.add('active');
                
                // Load content for specific tabs
                if (tab === 'my-music') {
                    loadMyMusic();
                }
            }
        });
    });
}

// Fetch songs from backend API
async function searchTracks(query) {
    try {
        console.log('Searching for:', query);
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        console.log('Search results:', data);
        return data.data || [];
    } catch (error) {
        console.error('Error searching tracks:', error);
        return [];
    }
}

// Load featured tracks on startup
async function loadFeaturedTracks() {
    console.log('Loading featured tracks...');
    const container = document.getElementById('featured-tracks');
    
    // Show loading state
    container.innerHTML = '<p style="padding: 20px; color: var(--text-secondary);">Loading featured tracks...</p>';
    
    try {
        const response = await fetch('/api/featured');
        const data = await response.json();
        console.log('Featured tracks:', data.data);
        
        if (data.data && data.data.length > 0) {
            displayFeaturedTracks(data.data);
        } else {
            container.innerHTML = '<p style="padding: 20px; color: var(--text-secondary);">No tracks available</p>';
        }
    } catch (error) {
        console.error('Error loading featured tracks:', error);
        container.innerHTML = '<p style="padding: 20px; color: var(--text-secondary);">Error loading tracks</p>';
    }
}

// Display featured tracks
function displayFeaturedTracks(tracks) {
    const container = document.getElementById('featured-tracks');
    container.innerHTML = '';
    
    console.log('Displaying tracks:', tracks.length);
    
    if (!tracks || tracks.length === 0) {
        container.innerHTML = '<p style="padding: 20px; color: var(--text-secondary);">No tracks available</p>';
        return;
    }
    
    tracks.slice(0, 12).forEach(track => {
        if (track) {
            const card = createTrackCard(track);
            container.appendChild(card);
        }
    });
}

// Create track card
function createTrackCard(track) {
    if (!track) return null;
    
    const card = document.createElement('div');
    card.className = 'track-card';
    
    const coverUrl = track.album?.cover || `https://via.placeholder.com/180?text=${encodeURIComponent(track.title || 'Music')}`;
    
    card.innerHTML = `
        <img src="${coverUrl}" alt="${track.title || 'Song'}" class="track-image" onerror="this.src='https://via.placeholder.com/180?text=Music'">
        <div class="track-info">
            <div class="track-name">${track.title || 'Unknown Track'}</div>
            <div class="track-artist">${track.artist?.name || 'Unknown Artist'}</div>
        </div>
    `;
    
    card.addEventListener('click', () => {
        playTrack(track);
    });
    
    return card;
}

// Create track item for list view
function createTrackItem(track) {

    const item = document.createElement('div');
    item.className = 'track-item';

    const cover = track.album?.cover || 'https://via.placeholder.com/50?text=Music';

    let sourceText = "Preview";
    if (track.fullAvailable) sourceText = "Full Song";

    item.innerHTML = `
        <img src="${cover}">
        <div class="track-item-info">
            <div class="track-item-name">${track.title}</div>
            <div class="track-item-artist">${track.artist?.name || "Unknown"}</div>
            <div class="track-source">${sourceText}</div>
        </div>
        <button class="track-item-btn">
            ▶
        </button>
    `;

    item.querySelector('.track-item-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        playTrack(track);
    });
    return item;
}

// Play track
function playTrack(track) {

    if (!track) return;

    currentTrack = track;

    const source = track.url ? track.url : track.preview;

    if (!source) {
        alert("Track cannot be played");
        return;
    }

    audioPlayer.src = source;

    document.querySelector('.song-name').textContent =
        track.title || "Unknown Track";

    document.querySelector('.artist-name').textContent =
        track.artist && track.artist.name ? track.artist.name : "Unknown";

    document.getElementById('album-art').src =
        track.album && track.album.cover
            ? track.album.cover
            : "https://via.placeholder.com/56?text=Music";

    audioPlayer.play();
    isPlaying = true;

    updatePlayButton();
}
// Setup player controls
function setupPlayerControls() {
    playPauseBtn.addEventListener('click', togglePlayPause);
    prevBtn.addEventListener('click', playPrevious);
    nextBtn.addEventListener('click', playNext);
    likeBtn.addEventListener('click', toggleLike);
    
    // Search
    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });
    
    // Upload
    uploadBtn.addEventListener('click', () => {
        musicUpload.click();
    });
    
    musicUpload.addEventListener('change', handleFileUpload);
    
    // Audio player events
    audioPlayer.addEventListener('timeupdate', updateProgressBar);
    audioPlayer.addEventListener('ended', playNext);
    
    document.getElementById('progress-bar').addEventListener('change', (e) => {
        const time = (e.target.value / 100) * audioPlayer.duration;
        audioPlayer.currentTime = time;
    });
}

// Setup upload functionality
function setupUploadFunctionality() {
    // Upload functionality is already handled in setupPlayerControls
    // This function is here for consistency
}

// Player control functions
function togglePlayPause() {
    if (!currentTrack) {
        alert('Please select a track first');
        return;
    }
    
    if (isPlaying) {
        audioPlayer.pause();
        isPlaying = false;
    } else {
        audioPlayer.play();
        isPlaying = true;
    }
    updatePlayButton();
}

function playPrevious() {
    if (playlist.length > 0) {
        currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
        playTrack(playlist[currentIndex]);
    }
}

function playNext() {
    if (playlist.length > 0) {
        currentIndex = (currentIndex + 1) % playlist.length;
        playTrack(playlist[currentIndex]);
    }
}

function toggleLike() {
    if (!currentTrack) return;
    
    const index = favorites.findIndex(t => t.id === currentTrack.id);
    
    if (index > -1) {
        favorites.splice(index, 1);
    } else {
        favorites.push(currentTrack);
    }
    
    localStorage.setItem('melomaniac_favorites', JSON.stringify(favorites));
    updateLikeButton();
    updateFavorites();
}

function updatePlayButton() {
    const icon = isPlaying ? 'fa-pause' : 'fa-play';
    playPauseBtn.innerHTML = `<i class="fas ${icon}"></i>`;
}

function updateLikeButton() {
    if (!currentTrack) {
        likeBtn.innerHTML = '<i class="far fa-heart"></i>';
        return;
    }
    
    const isLiked = favorites.some(t => t.id === currentTrack.id);
    likeBtn.innerHTML = isLiked ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>';
}

function updateProgressBar() {
    const percent = audioPlayer.duration ? (audioPlayer.currentTime / audioPlayer.duration) * 100 : 0;
    document.getElementById('progress-bar').value = percent || 0;
    
    document.getElementById('current-time').textContent = formatTime(audioPlayer.currentTime);
    document.getElementById('duration').textContent = formatTime(audioPlayer.duration);
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// Search functionality
async function performSearch() {
    const query = searchInput.value.trim();
    if (!query) return;
    
    const container = document.getElementById('search-results');
    container.innerHTML = '<p style="padding: 20px; color: var(--text-secondary);">Searching...</p>';
    
    const results = await searchTracks(query);
    displaySearchResults(results);
    
    // Switch to search tab
    document.querySelector('[data-tab="search"]').click();
}

function displaySearchResults(tracks) {
    const container = document.getElementById('search-results');
    container.innerHTML = '';

    if (!tracks || tracks.length === 0) {
        container.innerHTML = '<p>No tracks found</p>';
        return;
    }

    // Group tracks by source
    const uploadedTracks = tracks.filter(track => track.source === 'upload');
    const fullTracks = tracks.filter(track => track.fullAvailable === true && track.source !== 'upload');
    const previewTracks = tracks.filter(track => track.fullAvailable === false);
    
    // Display uploaded tracks first
    if (uploadedTracks.length > 0) {
        const uploadedSection = document.createElement('div');
        uploadedSection.innerHTML = '<h3 style="color: var(--primary-color); margin: 20px 0 10px 0;"><i class="fas fa-hdd"></i> Your Uploaded Songs</h3>';
        container.appendChild(uploadedSection);
        
        uploadedTracks.forEach(track => {
            if (track) {
                const item = createTrackItem(track);
                if (item) {
                    container.appendChild(item);
                }
            }
        });
    }
    
    // Display full songs
    if (fullTracks.length > 0) {
        const fullSection = document.createElement('div');
        fullSection.innerHTML = '<h3 style="color: var(--primary-color); margin: 20px 0 10px 0;"><i class="fas fa-music"></i> Full Songs Available</h3>';
        container.appendChild(fullSection);
        
        fullTracks.forEach(track => {
            if (track) {
                const item = createTrackItem(track);
                if (item) {
                    container.appendChild(item);
                }
            }
        });
    }
    
    // Display preview tracks
    if (previewTracks.length > 0) {
        const previewSection = document.createElement('div');
        previewSection.innerHTML = '<h3 style="color: var(--text-secondary); margin: 20px 0 10px 0;"><i class="fab fa-itunes-note"></i> Preview Tracks (30s)</h3>';
        container.appendChild(previewSection);
        
        previewTracks.forEach(track => {
            if (track) {
                const item = createTrackItem(track);
                if (item) {
                    container.appendChild(item);
                }
            }
        });
    }
}

// Update favorites display
function updateFavorites() {
    const container = document.getElementById('favorites-list');
    container.innerHTML = '';
    
    if (!favorites || favorites.length === 0) {
        container.innerHTML = '<p style="padding: 20px; color: var(--text-secondary);">No favorites yet</p>';
        return;
    }
    
    favorites.forEach(track => {
        if (track) {
            const item = createTrackItem(track);
            if (item) {
                container.appendChild(item);
            }
        }
    });
}

// Handle file upload
async function handleFileUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const uploadBtn = document.getElementById('upload-btn');
    const originalText = uploadBtn.innerHTML;
    uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
    uploadBtn.disabled = true;
    
    try {
        for (const file of files) {
            const formData = new FormData();
            formData.append('music', file);
            
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log('Uploaded:', result.file.title);
            } else {
                alert(`Failed to upload ${file.name}: ${result.error}`);
            }
        }
        
        // Reload my music after upload
        loadMyMusic();
        alert('Upload complete!');
        
    } catch (error) {
        console.error('Upload error:', error);
        alert('Upload failed. Please try again.');
    } finally {
        uploadBtn.innerHTML = originalText;
        uploadBtn.disabled = false;
        // Clear the file input
        event.target.value = '';
    }
}

// Load user's uploaded music
async function loadMyMusic() {
    console.log('Loading my music...');
    const container = document.getElementById('my-music-list');
    
    try {
        const response = await fetch('/api/my-music');
        const data = await response.json();
        console.log('My music:', data.data);
        
        if (data.data && data.data.length > 0) {
            displayMyMusic(data.data);
        } else {
            container.innerHTML = '<p style="padding: 20px; color: var(--text-secondary);">No music uploaded yet. Click "Upload Music Files" to add your songs!</p>';
        }
    } catch (error) {
        console.error('Error loading my music:', error);
        container.innerHTML = '<p style="padding: 20px; color: var(--text-secondary);">Error loading your music</p>';
    }
}

// Display user's uploaded music
function displayMyMusic(songs) {
    const container = document.getElementById('my-music-list');
    container.innerHTML = '';
    
    console.log('Displaying my music:', songs.length);
    
    songs.forEach(song => {
        if (song) {
            const item = createTrackItem(song);
            if (item) {
                container.appendChild(item);
            }
        }
    });
}

// Load user information
async function loadUserInfo() {
    try {
        const response = await fetch('/api/user');
        const user = await response.json();

        const userInfoDiv = document.getElementById('user-info');
        if (userInfoDiv) {
            userInfoDiv.innerHTML = `
                <img src="${user.profile.avatar}" alt="Avatar" class="user-avatar">
                <div class="user-details">
                    <div class="user-name">${user.username}</div>
                    <div class="user-email">${user.email}</div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading user info:', error);
        // Redirect to login if not authenticated
        window.location.href = '/login';
    }
}

// Logout function
async function logout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = '/login';
    } catch (error) {
        console.error('Logout error:', error);
        window.location.href = '/login';
    }
}
