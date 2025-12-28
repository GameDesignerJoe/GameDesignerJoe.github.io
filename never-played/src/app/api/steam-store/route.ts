import { NextRequest, NextResponse } from 'next/server';
import { fetchWithRetry } from '@/utils/fetchWithRetry';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const appid = searchParams.get('appid');
  const mode = searchParams.get('mode') || 'full'; // 'minimal' or 'full'
  
  if (!appid) {
    return NextResponse.json(
      { error: 'App ID is required' },
      { status: 400 }
    );
  }
  
  try {
    const url = `https://store.steampowered.com/api/appdetails?appids=${appid}`;
    
    // Use fetchWithRetry to handle intermittent connection issues with Steam API
    const response = await fetchWithRetry(url, undefined, {
      maxRetries: 2,
      initialDelayMs: 1000,
      backoffMultiplier: 2
    });
    
    // Check if we got an HTML error page (rate limiting)
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/html')) {
      console.warn(`[Steam Store API] Rate limited for appid ${appid} - got HTML response`);
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
    
    // Filter categories to only include relevant ones
    const INCLUDED_CATEGORIES = [
      'Single-player',
      'Multi-player',
      'Co-op',
      'Online Co-op',
      'Steam Achievements',
      'VR Supported',
      'VR Only'
    ];
    
    const categories = game.categories
      ?.map((c: any) => c.description)
      .filter((desc: string) => INCLUDED_CATEGORIES.includes(desc)) || [];
    
    // Build response based on mode
    // MINIMAL mode: Only essential fields for filtering/sorting (70-80% smaller cache)
    // FULL mode: All fields including description for showcase display
    const storeInfo: any = {
      genres: game.genres?.map((g: any) => g.description) || [],
      header_image: game.header_image || null,
      release_date: {
        date: game.release_date?.date || null,
        coming_soon: game.release_date?.coming_soon || false
      },
      recommendations: game.recommendations?.total || null,
    };
    
    // Add full details only in 'full' mode (for showcase display)
    if (mode === 'full') {
      storeInfo.name = game.name || null;
      storeInfo.short_description = game.short_description || null;
      storeInfo.categories = categories;
      storeInfo.metacritic = game.metacritic?.score || null;
      storeInfo.developers = game.developers || [];
      storeInfo.publishers = game.publishers || [];
      storeInfo.positive_reviews = game.positive || null;
      storeInfo.negative_reviews = game.negative || null;
      storeInfo.review_score = game.review_score || null;
      storeInfo.review_score_desc = game.review_score_desc || null;
      storeInfo.movies = game.movies?.map((movie: any) => {
        const webm_480 = movie.webm?.['480'] || movie.webm?.max || movie.webm;
        const mp4_480 = movie.mp4?.['480'] || movie.mp4?.max || movie.mp4;
        const mp4_max = movie.mp4?.max || movie.mp4;
        
        return {
          id: movie.id,
          name: movie.name,
          thumbnail: movie.thumbnail,
          webm_480,
          mp4_480,
          mp4_max
        };
      }) || [];
    }
    
    return NextResponse.json(storeInfo);
    
  } catch (error) {
    console.error(`[Steam Store API] Error fetching appid ${appid}:`, error);
    console.error(`[Steam Store API] Error details:`, {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
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
