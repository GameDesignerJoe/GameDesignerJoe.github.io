import { NextRequest, NextResponse } from 'next/server';
import { fetchWithRetry } from '@/utils/fetchWithRetry';

interface Friend {
  steamid: string;
  relationship: string;
  friend_since: number;
}

interface FriendWithGames extends Friend {
  personaname?: string;
  profileurl: string;
  games?: Array<{
    appid: number;
    name: string;
    playtime_forever: number;
  }>;
  error?: string;
  verificationAttempts?: number;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const steamId = searchParams.get('steamid');
  
  if (!steamId) {
    return NextResponse.json(
      { error: 'Steam ID is required' },
      { status: 400 }
    );
  }
  
  const apiKey = process.env.STEAM_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Steam API key not configured' },
      { status: 500 }
    );
  }
  
  try {
    console.log('🔍 [API] Fetching friends list for Steam ID:', steamId);
    
    // Step 1: Get friends list
    const friendsUrl = `https://api.steampowered.com/ISteamUser/GetFriendList/v1/?key=${apiKey}&steamid=${steamId}&relationship=friend&format=json`;
    
    // Use fetchWithRetry to handle intermittent connection issues with Steam API
    const friendsResponse = await fetchWithRetry(friendsUrl, undefined, {
      maxRetries: 2,
      initialDelayMs: 1000,
      backoffMultiplier: 2
    });
    
    if (!friendsResponse.ok) {
      console.error('Steam Friends API error:', {
        status: friendsResponse.status,
        statusText: friendsResponse.statusText,
        url: friendsUrl.replace(apiKey, 'HIDDEN')
      });
      
      return NextResponse.json(
        { 
          error: 'Failed to fetch friends list',
          message: 'Your friends list is set to private. To use social features, go to Steam → Profile → Edit Profile → Privacy Settings → Friends List → set to Public.',
          status: friendsResponse.status
        },
        { status: friendsResponse.status }
      );
    }
    
    const friendsData = await friendsResponse.json();
    
    if (!friendsData.friendslist || !friendsData.friendslist.friends) {
      return NextResponse.json(
        { 
          error: 'No friends found',
          message: 'Your friends list is empty or set to private.'
        },
        { status: 404 }
      );
    }
    
    const friends: Friend[] = friendsData.friendslist.friends;
    console.log('✅ [API] Found', friends.length, 'friends');
    
    // Step 2: Fetch game libraries for each friend (in parallel, but with batching)
    const BATCH_SIZE = 10; // Process 10 friends at a time to avoid overwhelming the API
    const friendsWithGames: FriendWithGames[] = [];
    
    console.log('🔄 [API] Starting to fetch friend libraries in batches of', BATCH_SIZE);
    
    for (let i = 0; i < friends.length; i += BATCH_SIZE) {
      const batch = friends.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(friends.length / BATCH_SIZE);
      
      console.log(`📦 [API] Processing batch ${batchNum}/${totalBatches} (friends ${i + 1}-${Math.min(i + BATCH_SIZE, friends.length)})`);
      const batchStart = Date.now();
      
      const batchPromises = batch.map(async (friend) => {
        const friendWithGames: FriendWithGames = { 
          ...friend,
          profileurl: `https://steamcommunity.com/profiles/${friend.steamid}`
        };
        
        try {
          // Get friend's persona name
          const personaUrl = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey}&steamids=${friend.steamid}&format=json`;
          const personaResponse = await fetchWithRetry(personaUrl, undefined, {
            maxRetries: 2,
            initialDelayMs: 1000,
            backoffMultiplier: 2
          });
          
          if (personaResponse.ok) {
            const personaData = await personaResponse.json();
            if (personaData.response?.players?.[0]?.personaname) {
              friendWithGames.personaname = personaData.response.players[0].personaname;
            } else {
              // Use last 4 digits of Steam ID for unique identification
              const last4 = friend.steamid.slice(-4);
              friendWithGames.personaname = `Private Profile ${last4}`;
              // Mark for verification - this might not actually be a private profile
              friendWithGames.verificationAttempts = 0;
            }
          } else {
            // API failed - use last 4 digits of Steam ID as fallback
            const last4 = friend.steamid.slice(-4);
            friendWithGames.personaname = `Private Profile ${last4}`;
            // Mark for verification - API failed, need to retry
            friendWithGames.verificationAttempts = 0;
          }
          
          // Get friend's game library
          const gamesUrl = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${apiKey}&steamid=${friend.steamid}&include_appinfo=1&format=json`;
          const gamesResponse = await fetchWithRetry(gamesUrl, undefined, {
            maxRetries: 2,
            initialDelayMs: 1000,
            backoffMultiplier: 2
          });
          
          if (gamesResponse.ok) {
            const gamesData = await gamesResponse.json();
            if (gamesData.response?.games) {
              friendWithGames.games = gamesData.response.games;
            } else {
              friendWithGames.error = 'Private library';
            }
          } else {
            friendWithGames.error = 'Failed to fetch';
          }
        } catch (error) {
          friendWithGames.error = 'API error';
        }
        
        return friendWithGames;
      });
      
      const batchResults = await Promise.all(batchPromises);
      friendsWithGames.push(...batchResults);
      
      const batchDuration = Date.now() - batchStart;
      const gamesCount = batchResults.filter(f => f.games && f.games.length > 0).length;
      console.log(`✅ [API] Batch ${batchNum} complete in ${batchDuration}ms (${gamesCount} friends with games)`);
    }
    
    console.log('🏁 [API] All batches complete. Total friends with games:', friendsWithGames.filter(f => f.games && f.games.length > 0).length);
    
    // Return summary data
    const result = {
      totalFriends: friends.length,
      friendsWithGames: friendsWithGames.filter(f => f.games && f.games.length > 0).length,
      friendsWithPrivateLibraries: friendsWithGames.filter(f => f.error === 'Private library').length,
      friends: friendsWithGames
    };
    
    console.log('📤 [API] Sending response:', {
      totalFriends: result.totalFriends,
      friendsWithGames: result.friendsWithGames,
      friendsWithPrivateLibraries: result.friendsWithPrivateLibraries
    });
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Steam Friends API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch friends data from Steam',
        message: 'Network error occurred. Please try again.'
      },
      { status: 500 }
    );
  }
}
