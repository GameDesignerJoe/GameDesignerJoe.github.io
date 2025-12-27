import { NextRequest, NextResponse } from 'next/server';
import { fetchWithRetry } from '@/utils/fetchWithRetry';

interface FriendData {
  steamid: string;
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

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { steamIds } = body;
  
  if (!steamIds || !Array.isArray(steamIds) || steamIds.length === 0) {
    return NextResponse.json(
      { error: 'Steam IDs array is required' },
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
    console.log(`🔄 [API Retry] Retrying ${steamIds.length} friends:`, steamIds);
    
    const results: FriendData[] = [];
    
    // Process each friend with a small delay between requests to avoid rate limiting
    for (let i = 0; i < steamIds.length; i++) {
      const steamId = steamIds[i];
      const friendData: FriendData = {
        steamid: steamId,
        profileurl: `https://steamcommunity.com/profiles/${steamId}`,
        verificationAttempts: 1 // This is at least attempt #1 (will be incremented by merge logic)
      };
      
      try {
        // Get friend's persona name
        const personaUrl = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey}&steamids=${steamId}&format=json`;
        const personaResponse = await fetchWithRetry(personaUrl, undefined, {
          maxRetries: 3, // More retries for targeted requests
          initialDelayMs: 1000,
          backoffMultiplier: 2
        });
        
        if (personaResponse.ok) {
          const personaData = await personaResponse.json();
          if (personaData.response?.players?.[0]?.personaname) {
            friendData.personaname = personaData.response.players[0].personaname;
          } else {
            // Use last 4 digits of Steam ID for unique identification
            const last4 = steamId.slice(-4);
            friendData.personaname = `Private Profile ${last4}`;
          }
        } else {
          // API failed - use last 4 digits of Steam ID as fallback
          const last4 = steamId.slice(-4);
          friendData.personaname = `Private Profile ${last4}`;
        }
        
        // Get friend's game library
        const gamesUrl = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${apiKey}&steamid=${steamId}&include_appinfo=1&format=json`;
        const gamesResponse = await fetchWithRetry(gamesUrl, undefined, {
          maxRetries: 3,
          initialDelayMs: 1000,
          backoffMultiplier: 2
        });
        
        if (gamesResponse.ok) {
          const gamesData = await gamesResponse.json();
          if (gamesData.response?.games) {
            friendData.games = gamesData.response.games;
            console.log(`✅ [API Retry] Success for ${steamId} (${friendData.personaname}): ${friendData.games?.length || 0} games`);
          } else {
            friendData.error = 'Private library';
            console.log(`⚠️ [API Retry] Private library for ${steamId} (${friendData.personaname})`);
          }
        } else {
          friendData.error = 'Failed to fetch';
          console.log(`❌ [API Retry] Failed for ${steamId} (${friendData.personaname})`);
        }
        
        // Add delay between requests to avoid rate limiting (500ms)
        if (i < steamIds.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
      } catch (error) {
        friendData.error = 'API error';
        console.error(`❌ [API Retry] Error for ${steamId}:`, error);
      }
      
      results.push(friendData);
    }
    
    const successCount = results.filter(f => f.games && f.games.length > 0).length;
    console.log(`🏁 [API Retry] Complete: ${successCount}/${steamIds.length} successful`);
    
    return NextResponse.json({
      success: true,
      retried: steamIds.length,
      successful: successCount,
      friends: results
    });
    
  } catch (error) {
    console.error('❌ [API Retry] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to retry friends data',
        message: 'Network error occurred. Please try again.'
      },
      { status: 500 }
    );
  }
}
