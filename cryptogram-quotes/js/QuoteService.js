class QuoteService {
    constructor() {
        this.API_ENDPOINTS = {
            primary: 'https://api.quotable.io/random',
            fallback: 'https://api.api-ninjas.com/v1/quotes'
        };
        this.themeCache = new Map();
    }

    async getQuoteByTheme(theme) {
        try {
            console.log('Fetching quote for theme:', theme);
            
            // Check cache first
            if (this.themeCache.has(theme)) {
                const cachedQuotes = this.themeCache.get(theme);
                if (cachedQuotes.length > 0) {
                    console.log('Using cached quote');
                    return cachedQuotes.pop();
                }
            }

            // For testing, return themed quotes
            // Remove this block once API is properly set up
            console.log('Using themed test quote');
            const testQuotes = {
                'chinese food': [
                    { text: "The best Chinese food is made with love and tradition", author: "Ancient Proverb" },
                    { text: "A good wok is a chef's best friend", author: "Chinese Saying" },
                    { text: "Dim sum is a journey of small delights", author: "Food Proverb" }
                ],
                'space': [
                    { text: "Look up at the stars and not down at your feet", author: "Stephen Hawking" },
                    { text: "The universe is under no obligation to make sense to you", author: "Neil deGrasse Tyson" },
                    { text: "Space is for everybody", author: "Christa McAuliffe" }
                ],
                'music': [
                    { text: "Music is the universal language of mankind", author: "Henry Wadsworth Longfellow" },
                    { text: "Where words fail music speaks", author: "Hans Christian Andersen" },
                    { text: "Life is one grand sweet song so start the music", author: "Ronald Reagan" }
                ],
                'nature': [
                    { text: "In every walk with nature one receives far more than he seeks", author: "John Muir" },
                    { text: "Look deep into nature and you will understand everything better", author: "Albert Einstein" },
                    { text: "The earth has music for those who listen", author: "William Shakespeare" }
                ]
            };

            // Convert theme to lowercase for matching
            const lowerTheme = theme.toLowerCase();
            
            // Find quotes for the theme, or use general quotes if theme not found
            const themeQuotes = testQuotes[lowerTheme] || [
                { text: "Life is what happens while you're busy making other plans", author: "John Lennon" },
                { text: "The only way to do great work is to love what you do", author: "Steve Jobs" },
                { text: "Be the change you wish to see in the world", author: "Mahatma Gandhi" }
            ];

            // Pick a random quote from the theme
            const randomQuote = themeQuotes[Math.floor(Math.random() * themeQuotes.length)];
            return {
                ...randomQuote,
                success: true
            };

            // Uncomment this block when ready to use the API
            /*
            // Fetch new quote
            const response = await fetch(`${this.API_ENDPOINTS.primary}?tags=${encodeURIComponent(theme)}`);
            const data = await response.json();
            console.log('API response:', data);

            if (data.content) {
                const quote = {
                    text: data.content,
                    author: data.author,
                    success: true
                };
                console.log('Found quote:', quote);
                return quote;
            }

            // If no quote found, try fallback
            return await this.getFallbackQuote(theme);
            */
        } catch (error) {
            console.error('Error fetching quote:', error);
            return {
                text: "The best preparation for tomorrow is doing your best today.",
                author: "H. Jackson Brown Jr.",
                success: false
            };
        }
    }

    async getFallbackQuote(theme) {
        try {
            const response = await fetch(`${this.API_ENDPOINTS.fallback}?category=${encodeURIComponent(theme)}`, {
                headers: {
                    'X-Api-Key': 'YOUR_API_NINJAS_KEY' // Would need to be configured
                }
            });
            const data = await response.json();

            if (data && data.length > 0) {
                return {
                    text: data[0].quote,
                    author: data[0].author,
                    success: true
                };
            }

            return this.getDefaultQuote();
        } catch (error) {
            console.error('Error fetching fallback quote:', error);
            return this.getDefaultQuote();
        }
    }

    getDefaultQuote() {
        const defaultQuotes = [
            {
                text: "The best preparation for tomorrow is doing your best today.",
                author: "H. Jackson Brown Jr."
            },
            {
                text: "Life is what happens while you're busy making other plans.",
                author: "John Lennon"
            },
            {
                text: "The only way to do great work is to love what you do.",
                author: "Steve Jobs"
            }
        ];

        return {
            ...defaultQuotes[Math.floor(Math.random() * defaultQuotes.length)],
            success: false
        };
    }

    // Cache management methods
    cacheQuote(theme, quote) {
        if (!this.themeCache.has(theme)) {
            this.themeCache.set(theme, []);
        }
        this.themeCache.get(theme).push(quote);
    }

    clearCache() {
        this.themeCache.clear();
    }
}
