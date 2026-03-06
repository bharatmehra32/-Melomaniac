const axios = require("axios");

const API_KEY = process.env.YOUTUBE_API_KEY || "YOUR_YOUTUBE_API_KEY";

async function searchSong(query) {
    const url = `https://www.googleapis.com/youtube/v3/search`;

    try {
        const response = await axios.get(url, {
            params: {
                part: "snippet",
                q: query,
                key: API_KEY,
                type: "video",
                maxResults: 1
            }
        });

        if (response.data.items && response.data.items[0]) {
            return response.data.items[0].id.videoId;
        }
        return null;
    } catch (error) {
        console.error('YouTube API error:', error.message);
        return null;
    }
}

module.exports = { searchSong };
