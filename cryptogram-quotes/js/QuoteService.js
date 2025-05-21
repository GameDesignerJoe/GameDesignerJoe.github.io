class QuoteService {
    constructor() {
        this.API_ENDPOINTS = {
            primary: 'https://api.quotable.io/random',
            fallback: 'https://api.api-ninjas.com/v1/quotes'
        };
        this.themeCache = new Map();
        this.themes = [
            'NATURE',
            'SPACE',
            'MUSIC',
            'TECHNOLOGY',
            'ART',
            'BOOKS',
            'TRAVEL',
            'FOOD',
            'SPORTS',
            'HISTORY',
            'SCIENCE',
            'PHILOSOPHY',
            'MOVIES',
            'ANIMALS',
            'OCEAN',
            'FRIENDSHIP',
            'ADVENTURE',
            'CREATIVITY',
            'WISDOM',
            'DREAMS'
        ];
    }

    async getQuoteByTheme(theme) {
        try {
            console.log('Fetching quote for theme:', theme);
            
            // Check for Believer easter egg (case insensitive)
            if (theme.toUpperCase() === 'BELIEVER') {
                const believerQuotes = [
                    { text: "Buy this for me Daddy", author: "Unknown" },
                    { text: "Good Job, War", author: "Unknown" }
                ];
                // Use static property to track which quote to show next
                QuoteService.believerIndex = (QuoteService.believerIndex || 0) ^ 1;
                return {
                    ...believerQuotes[QuoteService.believerIndex],
                    success: true
                };
            }
            
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
                'NATURE': [
                    { text: "In every walk with nature one receives far more than he seeks", author: "John Muir" },
                    { text: "Look deep into nature and you will understand everything better", author: "Albert Einstein" },
                    { text: "The earth has music for those who listen", author: "William Shakespeare" }
                ],
                'SPACE': [
                    { text: "Look up at the stars and not down at your feet", author: "Stephen Hawking" },
                    { text: "The universe is under no obligation to make sense to you", author: "Neil deGrasse Tyson" },
                    { text: "Space is for everybody", author: "Christa McAuliffe" }
                ],
                'MUSIC': [
                    { text: "Music is the universal language of mankind", author: "Henry Wadsworth Longfellow" },
                    { text: "Where words fail music speaks", author: "Hans Christian Andersen" },
                    { text: "Life is one grand sweet song so start the music", author: "Ronald Reagan" }
                ],
                'TECHNOLOGY': [
                    { text: "Innovation distinguishes between a leader and a follower", author: "Steve Jobs" },
                    { text: "Technology is best when it brings people together", author: "Matt Mullenweg" },
                    { text: "The advance of technology is based on making it fit in so that you don't really even notice it", author: "Bill Gates" }
                ],
                'ART': [
                    { text: "Art enables us to find ourselves and lose ourselves at the same time", author: "Thomas Merton" },
                    { text: "Every artist was first an amateur", author: "Ralph Waldo Emerson" },
                    { text: "Art is not what you see, but what you make others see", author: "Edgar Degas" }
                ],
                'BOOKS': [
                    { text: "A room without books is like a body without a soul", author: "Marcus Tullius Cicero" },
                    { text: "There is no friend as loyal as a book", author: "Ernest Hemingway" },
                    { text: "Reading is to the mind what exercise is to the body", author: "Joseph Addison" }
                ],
                'TRAVEL': [
                    { text: "Travel makes one modest, you see what a tiny place you occupy in the world", author: "Gustave Flaubert" },
                    { text: "The world is a book and those who do not travel read only one page", author: "Saint Augustine" },
                    { text: "Adventure is worthwhile in itself", author: "Amelia Earhart" }
                ],
                'FOOD': [
                    { text: "One cannot think well, love well, sleep well, if one has not dined well", author: "Virginia Woolf" },
                    { text: "Food is our common ground, a universal experience", author: "James Beard" },
                    { text: "People who love to eat are always the best people", author: "Julia Child" }
                ],
                'SPORTS': [
                    { text: "Champions keep playing until they get it right", author: "Billie Jean King" },
                    { text: "You miss 100% of the shots you don't take", author: "Wayne Gretzky" },
                    { text: "It's not whether you get knocked down; it's whether you get up", author: "Vince Lombardi" }
                ],
                'HISTORY': [
                    { text: "Those who do not remember the past are condemned to repeat it", author: "George Santayana" },
                    { text: "History is written by the victors", author: "Winston Churchill" },
                    { text: "Study the past if you would define the future", author: "Confucius" }
                ],
                'SCIENCE': [
                    { text: "The good thing about science is that it's true whether or not you believe in it", author: "Neil deGrasse Tyson" },
                    { text: "Science is not only compatible with spirituality; it is a profound source of spirituality", author: "Carl Sagan" },
                    { text: "The important thing is not to stop questioning", author: "Albert Einstein" }
                ],
                'PHILOSOPHY': [
                    { text: "The unexamined life is not worth living", author: "Socrates" },
                    { text: "I think, therefore I am", author: "René Descartes" },
                    { text: "He who has a why to live can bear almost any how", author: "Friedrich Nietzsche" }
                ],
                'MOVIES': [
                    { text: "Cinema is a matter of what's in the frame and what's out", author: "Martin Scorsese" },
                    { text: "Movies are like an expensive form of therapy for me", author: "Tim Burton" },
                    { text: "Film is one of the three universal languages, the other two: mathematics and music", author: "Frank Capra" }
                ],
                'ANIMALS': [
                    { text: "Until one has loved an animal, a part of one's soul remains unawakened", author: "Anatole France" },
                    { text: "An animal's eyes have the power to speak a great language", author: "Martin Buber" },
                    { text: "Animals are such agreeable friends - they ask no questions; they pass no criticisms", author: "George Eliot" }
                ],
                'OCEAN': [
                    { text: "The sea, once it casts its spell, holds one in its net of wonder forever", author: "Jacques Cousteau" },
                    { text: "We are tied to the ocean. And when we go back to the sea we are going back from whence we came", author: "John F. Kennedy" },
                    { text: "The ocean stirs the heart, inspires the imagination and brings eternal joy to the soul", author: "Robert Wyland" }
                ],
                'FRIENDSHIP': [
                    { text: "A friend is one that knows you as you are, understands where you have been", author: "William Shakespeare" },
                    { text: "Friendship is born at that moment when one person says to another, 'What! You too?'", author: "C.S. Lewis" },
                    { text: "A real friend is one who walks in when the rest of the world walks out", author: "Walter Winchell" }
                ],
                'ADVENTURE': [
                    { text: "Life is either a daring adventure or nothing at all", author: "Helen Keller" },
                    { text: "Adventure is worthwhile in itself", author: "Amelia Earhart" },
                    { text: "Only those who risk going too far can possibly find out how far they can go", author: "T.S. Eliot" }
                ],
                'CREATIVITY': [
                    { text: "Creativity is intelligence having fun", author: "Albert Einstein" },
                    { text: "Every child is an artist. The problem is how to remain an artist once we grow up", author: "Pablo Picasso" },
                    { text: "You can't use up creativity. The more you use, the more you have", author: "Maya Angelou" }
                ],
                'WISDOM': [
                    { text: "The only true wisdom is in knowing you know nothing", author: "Socrates" },
                    { text: "By three methods we may learn wisdom: by reflection, by imitation, and by experience", author: "Confucius" },
                    { text: "The journey of a thousand miles begins with one step", author: "Lao Tzu" }
                ],
                'DREAMS': [
                    { text: "All our dreams can come true if we have the courage to pursue them", author: "Walt Disney" },
                    { text: "The future belongs to those who believe in the beauty of their dreams", author: "Eleanor Roosevelt" },
                    { text: "A dream you dream alone is only a dream. A dream you dream together is reality", author: "John Lennon" }
                ]
            };

            // Find quotes for the theme, or use general quotes if theme not found
            const themeQuotes = testQuotes[theme] || [
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
