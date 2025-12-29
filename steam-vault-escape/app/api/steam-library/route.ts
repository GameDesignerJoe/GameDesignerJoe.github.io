import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const steamId = request.nextUrl.searchParams.get('steamid');
  const apiKey = process.env.STEAM_API_KEY;
  
  if (!steamId) {
    return NextResponse.json(
      { error: 'Steam ID is required' },
      { status: 400 }
    );
  }
  
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Steam API key not configured' },
      { status: 500 }
    );
  }
  
  try {
    const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${apiKey}&steamid=${steamId}&include_appinfo=1&include_played_free_games=1&format=json`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Steam API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    return NextResponse.json(data.response);
  } catch (error) {
    console.error('Failed to fetch Steam library:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Steam library' },
      { status: 500 }
    );
  }
}
