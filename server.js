require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
let bearerToken = null; // Cache token

// Generate Bearer token (app-only auth)
async function getBearerToken() {
  if (bearerToken) return bearerToken;
  const credentials = Buffer.from(`${process.env.X_API_KEY}:${process.env.X_API_SECRET}`).toString('base64');
  try {
    const response = await axios.post('https://api.twitter.com/oauth2/token', 'grant_type=client_credentials', {
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
    });
    bearerToken = response.data.access_token;
    return bearerToken;
  } catch (error) {
    throw new Error('Bearer token error: ' + (error.response?.data?.error || error.message));
  }
}

// Endpoint: GET /profile?username=elonmusk
app.get('/profile', async (req, res) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ error: 'Username required' });
  }

  try {
    const token = await getBearerToken();
    const apiUrl = `https://api.twitter.com/2/users/by/username/${username}`;
    const response = await axios.get(apiUrl, {
      params: {
        'user.fields': 'created_at,description,profile_image_url,public_metrics,name,location,verified,url,id',
      },
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = response.data.data;
    if (!data) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Construct JSON response
    const profileInfo = {
      username: data.username,
      id: data.id,
      name: data.name,
      avatar: data.profile_image_url || null,
      bio: data.description || null,
      followers_count: data.public_metrics?.followers_count || null,
      friends_count: data.public_metrics?.following_count || null, // "Following" in X terms
      created_at: data.created_at, // ISO timestamp, e.g., "2006-03-21T20:50:14.000Z"
      location: data.location || null,
      verified: data.verified || false,
      profile_url: data.url || `https://twitter.com/${data.username}`,
      tweet_count: data.public_metrics?.tweet_count || null,
      note: 'Data from X API v2. Protected accounts may return limited info.',
    };

    res.json(profileInfo);
  } catch (error) {
    res.status(500).json({ error: 'API error: ' + (error.response?.data?.errors?.[0]?.message || error.message) });
  }
});

app.listen(PORT, () => {
  console.log(`Server on port ${PORT}`);
});
