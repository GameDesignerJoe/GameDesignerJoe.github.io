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
    
    if (!response.ok) {
      return NextResponse.json(
        { 
          error: 'Steam API request failed',
          errorType: 'API_ERROR',
          message: 'Unable to connect to Steam. Please try again later.'
        },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    
    // Check if response exists and has games array
    if (!data.response) {
      // This typically means either invalid Steam ID or private profile
      return NextResponse.json(
        { 
          error: 'Unable to load game library',
          errorType: 'PRIVATE_OR_INVALID',
          message: 'Your Steam profile may be private or the Steam ID is invalid.',
          helpUrl: '/help/steam-privacy-settings.png'
        },
        { status: 403 }
      );
    }
    
    // If response exists but no games property, profile might be valid but empty/private
    if (!data.response.hasOwnProperty('games')) {
      return NextResponse.json(
        { 
          error: 'Profile is private',
          errorType: 'PRIVATE_PROFILE',
          message: 'Your Steam game library is set to private. Please change your privacy settings to public.',
          helpUrl: '/help/steam-privacy-settings.png'
        },
        { status: 403 }
      );
    }
    
    return NextResponse.json(data.response);
    
  } catch (error) {
    console.error('Steam API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch games from Steam',
        errorType: 'NETWORK_ERROR',
        message: 'Network error occurred. Please check your connection and try again.'
      },
      { status: 500 }
    );
  }
}
