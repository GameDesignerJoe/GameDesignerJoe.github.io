// Steam Web API types

export interface SteamGame {
  appid: number;
  name: string;
  playtime_forever: number; // Total minutes played
  playtime_2weeks?: number; // Minutes played last 2 weeks
  img_icon_url: string;
  img_logo_url: string;
  has_community_visible_stats?: boolean;
  rtime_last_played?: number; // Unix timestamp
  
  // v1.5 additions - enriched from external APIs
  metacritic?: number; // From Steam Store API
  hoursTobeat?: number; // From SteamSpy median_forever / 60
  tags?: string[]; // From SteamSpy
  recommendations?: number; // From Steam Store API (fallback rating)
}

export interface SteamLibraryResponse {
  response: {
    game_count: number;
    games: SteamGame[];
  };
}
