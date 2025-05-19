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

            // For testing, return a default quote
            // Remove this block once API is properly set up
            console.log('Using default quote for testing');
            return {
                text: "The best Chinese food is made with love and tradition",
                author: "Ancient Proverb",
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
