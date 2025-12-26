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
  const { steamId } = body;
  
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
    console.log(`🔍 [API Single] Verifying friend: ${steamId}`);
    
    const friendData: FriendData = {
      steamid: steamId,
      profileurl: `https://steamcommunity.com/profiles/${steamId}`,
      verificationAttempts: 1
    };
    
    // Get friend's persona name
    const personaUrl = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey}&steamids=${steamId}&format=json`;
    const personaResponse = await fetchWithRetry(personaUrl, undefined, {
      maxRetries: 3,
      initialDelayMs: 1000,
      backoffMultiplier: 2
    });
    
    if (personaResponse.ok) {
      const personaData = await personaResponse.json();
      if (personaData.response?.players?.[0]?.personaname) {
        friendData.personaname = personaData.response.players[0].personaname;
      } else {
        const last4 = steamId.slice(-4);
        friendData.personaname = `Private Profile ${last4}`;
      }
    } else {
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
        console.log(`✅ [API Single] Success: ${friendData.personaname} has ${friendData.games?.length || 0} games`);
      } else {
        friendData.error = 'Private library';
        console.log(`🔒 [API Single] Private: ${friendData.personaname}`);
      }
    } else {
      friendData.error = 'Failed to fetch';
      console.log(`❌ [API Single] Failed: ${friendData.personaname}`);
    }
    
    return NextResponse.json({
      success: true,
      friend: friendData
    });
    
  } catch (error) {
    console.error('❌ [API Single] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to verify friend',
        message: error instanceof Error ? error.message : 'Network error occurred'
      },
      { status: 500 }
    );
  }
}
