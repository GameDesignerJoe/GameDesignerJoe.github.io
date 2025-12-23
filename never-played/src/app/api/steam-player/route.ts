import { NextRequest, NextResponse } from 'next/server';
import { fetchWithRetry } from '@/utils/fetchWithRetry';

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
    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey}&steamids=${steamId}`;
    
    // Use fetchWithRetry to handle intermittent connection issues with Steam API
    const response = await fetchWithRetry(url, undefined, {
      maxRetries: 2,
      initialDelayMs: 1000,
      backoffMultiplier: 2
    });
    
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Steam API request failed' },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    
    if (!data.response?.players || data.response.players.length === 0) {
      return NextResponse.json(
        { error: 'Player not found' },
        { status: 404 }
      );
    }
    
    const player = data.response.players[0];
    
    return NextResponse.json({
      personaname: player.personaname,
      profileurl: player.profileurl,
      avatar: player.avatar,
      avatarmedium: player.avatarmedium,
      avatarfull: player.avatarfull
    });
    
  } catch (error) {
    console.error('Steam API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch player data from Steam' },
      { status: 500 }
    );
  }
}
