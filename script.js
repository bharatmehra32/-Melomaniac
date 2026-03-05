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

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    console.log('App initialized');
    setupTabNavigation();
    setupPlayerControls();
    loadFeaturedTracks();
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
    if (!track) return null;
    
    const item = document.createElement('div');
    item.className = 'track-item';
    
    const coverUrl = track.album?.cover || `https://via.placeholder.com/50?text=${encodeURIComponent((track.title || 'Song').substring(0, 2))}`;
    
    item.innerHTML = `
        <img src="${coverUrl}" alt="${track.title || 'Song'}" onerror="this.src='https://via.placeholder.com/50?text=M'">
        <div class="track-item-info">
            <div class="track-item-name">${track.title || 'Unknown Track'}</div>
            <div class="track-item-artist">${track.artist?.name || 'Unknown Artist'}</div>
        </div>
        <button class="track-item-btn" title="Play">
            <i class="fas fa-play"></i>
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
    audioPlayer.src = track.preview || track.url || '';
    
    console.log('Playing track:', track.title, 'URL:', audioPlayer.src);
    
    // Update player display - make sure it's visible
    const playerContainer = document.querySelector('.player-container');
    if (playerContainer) {
        playerContainer.style.display = 'flex';
    }
    
    document.querySelector('.song-name').textContent = track.title || 'Unknown Track';
    document.querySelector('.artist-name').textContent = track.artist?.name || 'Unknown Artist';
    
    const coverUrl = track.album?.cover || `https://via.placeholder.com/56?text=${encodeURIComponent((track.title || 'Music').substring(0, 2))}`;
    document.getElementById('album-art').src = coverUrl;
    
    try {
        audioPlayer.play().catch(error => {
            console.error('Playback error:', error);
            alert('Could not play track: ' + (error.message || 'Unknown error'));
        });
        isPlaying = true;
    } catch (error) {
        console.error('Play error:', error);
    }
    
    updatePlayButton();
    updateLikeButton();
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
    
    // Audio player events
    audioPlayer.addEventListener('timeupdate', updateProgressBar);
    audioPlayer.addEventListener('ended', playNext);
    
    document.getElementById('progress-bar').addEventListener('change', (e) => {
        const time = (e.target.value / 100) * audioPlayer.duration;
        audioPlayer.currentTime = time;
    });
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
        container.innerHTML = '<p style="padding: 20px; color: var(--text-secondary);">No tracks found</p>';
        return;
    }
    
    tracks.forEach(track => {
        if (track) {
            const item = createTrackItem(track);
            if (item) {
                container.appendChild(item);
            }
        }
    });
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
