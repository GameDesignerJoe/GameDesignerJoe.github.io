import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const appid = searchParams.get('appid');
  
  if (!appid) {
    return NextResponse.json(
      { error: 'App ID is required' },
      { status: 400 }
    );
  }
  
  try {
    const url = `https://store.steampowered.com/api/appdetails?appids=${appid}`;
    
    const response = await fetch(url, {
      next: { revalidate: 604800 } // Cache for 7 days
    });
    
    // Check if we got an HTML error page (rate limiting)
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/html')) {
      console.warn(`[Steam Store API] Rate limited for appid ${appid}`);
      return NextResponse.json(
        { 
          error: 'Rate limited',
          message: 'Steam API temporarily unavailable. Please try again in a moment.'
        },
        { status: 503 }
      );
    }
    
    const data = await response.json();
    
    // Steam Store API returns: { "appid": { success: true/false, data: {...} } }
    const gameData = data[appid];
    
    if (!gameData || !gameData.success || !gameData.data) {
      return NextResponse.json(
        { 
          error: 'Game not found or unavailable',
          message: 'This game may be region-locked, removed, or not yet released.'
        },
        { status: 404 }
      );
    }
    
    const game = gameData.data;
    
    // Extract the data we need for v1.5
    const storeInfo = {
      metacritic: game.metacritic?.score || null,
      recommendations: game.recommendations?.total || null,
      name: game.name || null,
      genres: game.genres?.map((g: any) => g.description) || [],
      header_image: game.header_image || null,
    };
    
    return NextResponse.json(storeInfo);
    
  } catch (error) {
    console.error(`[Steam Store API] Error fetching appid ${appid}:`, error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch game details from Steam Store',
        message: 'An error occurred while connecting to Steam.',
        appid: appid
      },
      { status: 500 }
    );
  }
}
