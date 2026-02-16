// Zalando Teams & Lizenzierte Charaktere - alphabetisch sortiert
// HINWEIS: Diese Listen werden aktuell nicht mehr verwendet (Felder wurden entfernt)
// Offizielle Zalando-Werte für football_club, national_teams und licensed_characters

// ─── Fußballvereine (Bundesliga, Top-EU-Ligen) ─────────────────────────────────

export const FOOTBALL_CLUBS: readonly { readonly value: string; readonly label: string }[] = [
  // Bundesliga
  { value: '1. FC Köln', label: '1. FC Köln' },
  { value: '1. FC Union Berlin', label: '1. FC Union Berlin' },
  { value: '1. FSV Mainz 05', label: '1. FSV Mainz 05' },
  { value: 'Bayer 04 Leverkusen', label: 'Bayer 04 Leverkusen' },
  { value: 'Borussia Dortmund', label: 'Borussia Dortmund' },
  { value: 'Borussia Mönchengladbach', label: 'Borussia Mönchengladbach' },
  { value: 'Eintracht Frankfurt', label: 'Eintracht Frankfurt' },
  { value: 'FC Augsburg', label: 'FC Augsburg' },
  { value: 'FC Bayern München', label: 'FC Bayern München' },
  { value: 'SC Freiburg', label: 'SC Freiburg' },
  { value: 'RB Leipzig', label: 'RB Leipzig' },
  { value: 'TSG 1899 Hoffenheim', label: 'TSG 1899 Hoffenheim' },
  { value: 'VfB Stuttgart', label: 'VfB Stuttgart' },
  { value: 'VfL Bochum 1848', label: 'VfL Bochum 1848' },
  { value: 'VfL Wolfsburg', label: 'VfL Wolfsburg' },
  { value: 'SV Werder Bremen', label: 'SV Werder Bremen' },
  // Premier League
  { value: 'Arsenal FC', label: 'Arsenal FC' },
  { value: 'Aston Villa FC', label: 'Aston Villa FC' },
  { value: 'Chelsea FC', label: 'Chelsea FC' },
  { value: 'Liverpool FC', label: 'Liverpool FC' },
  { value: 'Manchester City', label: 'Manchester City' },
  { value: 'Manchester United', label: 'Manchester United' },
  { value: 'Newcastle United', label: 'Newcastle United' },
  { value: 'Tottenham Hotspur', label: 'Tottenham Hotspur' },
  // La Liga
  { value: 'Atlético Madrid', label: 'Atlético Madrid' },
  { value: 'FC Barcelona', label: 'FC Barcelona' },
  { value: 'Real Madrid', label: 'Real Madrid' },
  { value: 'Sevilla FC', label: 'Sevilla FC' },
  // Serie A
  { value: 'AC Mailand', label: 'AC Mailand' },
  { value: 'Inter Mailand', label: 'Inter Mailand' },
  { value: 'Juventus Turin', label: 'Juventus Turin' },
  { value: 'SSC Neapel', label: 'SSC Neapel' },
  { value: 'AS Rom', label: 'AS Rom' },
  // Ligue 1
  { value: 'Olympique Lyon', label: 'Olympique Lyon' },
  { value: 'Olympique Marseille', label: 'Olympique Marseille' },
  { value: 'Paris Saint-Germain', label: 'Paris Saint-Germain' },
  // Eredivisie
  { value: 'AFC Ajax', label: 'AFC Ajax' },
  { value: 'PSV Eindhoven', label: 'PSV Eindhoven' },
  { value: 'Feyenoord Rotterdam', label: 'Feyenoord Rotterdam' },
  // Sonstige Option
  { value: 'other', label: 'Anderer Verein' },
];

// ─── Nationalmannschaften ───────────────────────────────────────────────────────

export const NATIONAL_TEAMS: readonly { readonly value: string; readonly label: string }[] = [
  { value: 'Argentinien', label: 'Argentinien' },
  { value: 'Belgien', label: 'Belgien' },
  { value: 'Brasilien', label: 'Brasilien' },
  { value: 'Dänemark', label: 'Dänemark' },
  { value: 'Deutschland', label: 'Deutschland' },
  { value: 'England', label: 'England' },
  { value: 'Frankreich', label: 'Frankreich' },
  { value: 'Italien', label: 'Italien' },
  { value: 'Kroatien', label: 'Kroatien' },
  { value: 'Niederlande', label: 'Niederlande' },
  { value: 'Österreich', label: 'Österreich' },
  { value: 'Polen', label: 'Polen' },
  { value: 'Portugal', label: 'Portugal' },
  { value: 'Schottland', label: 'Schottland' },
  { value: 'Schweiz', label: 'Schweiz' },
  { value: 'Serbien', label: 'Serbien' },
  { value: 'Slowenien', label: 'Slowenien' },
  { value: 'Spanien', label: 'Spanien' },
  { value: 'Türkei', label: 'Türkei' },
  { value: 'Ukraine', label: 'Ukraine' },
  { value: 'Wales', label: 'Wales' },
  { value: 'other', label: 'Andere Nationalmannschaft' },
];

// ─── NBA Teams ─────────────────────────────────────────────────────────────────

export const NBA_TEAMS: readonly { readonly value: string; readonly label: string }[] = [
  { value: 'Boston Celtics', label: 'Boston Celtics' },
  { value: 'Brooklyn Nets', label: 'Brooklyn Nets' },
  { value: 'Chicago Bulls', label: 'Chicago Bulls' },
  { value: 'Dallas Mavericks', label: 'Dallas Mavericks' },
  { value: 'Denver Nuggets', label: 'Denver Nuggets' },
  { value: 'Golden State Warriors', label: 'Golden State Warriors' },
  { value: 'Houston Rockets', label: 'Houston Rockets' },
  { value: 'Los Angeles Clippers', label: 'Los Angeles Clippers' },
  { value: 'Los Angeles Lakers', label: 'Los Angeles Lakers' },
  { value: 'Miami Heat', label: 'Miami Heat' },
  { value: 'Milwaukee Bucks', label: 'Milwaukee Bucks' },
  { value: 'New York Knicks', label: 'New York Knicks' },
  { value: 'Philadelphia 76ers', label: 'Philadelphia 76ers' },
  { value: 'Phoenix Suns', label: 'Phoenix Suns' },
  { value: 'Toronto Raptors', label: 'Toronto Raptors' },
  { value: 'other', label: 'Anderes NBA Team' },
];

// ─── Lizenzierte Charaktere ────────────────────────────────────────────────────

export const LICENSED_CHARACTERS: readonly { readonly value: string; readonly label: string }[] = [
  // Disney
  { value: 'Disney Mickey Mouse', label: 'Disney Mickey Mouse' },
  { value: 'Disney Minnie Mouse', label: 'Disney Minnie Mouse' },
  { value: 'Disney Frozen', label: 'Disney Frozen (Elsa & Anna)' },
  { value: 'Disney Princesses', label: 'Disney Prinzessinnen' },
  { value: 'Disney Cars', label: 'Disney Cars' },
  { value: 'Disney Stitch', label: 'Disney Stitch' },
  { value: 'Disney Winnie Puuh', label: 'Disney Winnie Puuh' },
  // Marvel
  { value: 'Marvel Spider-Man', label: 'Marvel Spider-Man' },
  { value: 'Marvel Avengers', label: 'Marvel Avengers' },
  { value: 'Marvel Iron Man', label: 'Marvel Iron Man' },
  { value: 'Marvel Captain America', label: 'Marvel Captain America' },
  { value: 'Marvel Hulk', label: 'Marvel Hulk' },
  // DC Comics
  { value: 'DC Batman', label: 'DC Batman' },
  { value: 'DC Superman', label: 'DC Superman' },
  { value: 'DC Wonder Woman', label: 'DC Wonder Woman' },
  // Cartoon/Anime
  { value: 'Paw Patrol', label: 'Paw Patrol' },
  { value: 'Peppa Pig', label: 'Peppa Pig' },
  { value: 'Pokemon', label: 'Pokémon' },
  { value: 'Super Mario', label: 'Super Mario' },
  { value: 'Spongebob', label: 'SpongeBob Schwammkopf' },
  { value: 'Hello Kitty', label: 'Hello Kitty' },
  { value: 'Bluey', label: 'Bluey' },
  { value: 'Cocomelon', label: 'Cocomelon' },
  // Star Wars
  { value: 'Star Wars', label: 'Star Wars' },
  { value: 'Star Wars Mandalorian', label: 'Star Wars Mandalorian' },
  // Harry Potter
  { value: 'Harry Potter', label: 'Harry Potter' },
  // Sonstige
  { value: 'Barbie', label: 'Barbie' },
  { value: 'LEGO', label: 'LEGO' },
  { value: 'other', label: 'Anderer Charakter' },
];
