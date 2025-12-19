import { NextRequest, NextResponse } from 'next/server';

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
    const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${apiKey}&steamid=${steamId}&include_appinfo=1&include_played_free_games=1&format=json`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data.response) {
      return NextResponse.json(
        { error: 'Invalid Steam ID or profile is private' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(data.response);
    
  } catch (error) {
    console.error('Steam API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch games from Steam' },
      { status: 500 }
    );
  }
}
