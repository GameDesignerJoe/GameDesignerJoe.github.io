// Voice-activated scanning — listens for "scan" keyword via Web Speech API

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = null;
let listening = false;
let onScanCallback = null;

export function isSupported() {
    return !!SpeechRecognition;
}

export function isListening() {
    return listening;
}

/**
 * Start continuous listening for the "scan" keyword.
 * Calls onScan() each time it's detected.
 */
export function startListening(onScan) {
    if (!SpeechRecognition) return;
    if (listening) return;

    onScanCallback = onScan;
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript.toLowerCase().trim();
            if (transcript.includes('scan') && onScanCallback) {
                onScanCallback();
                // Brief pause to avoid double-triggers
                recognition.stop();
                setTimeout(() => {
                    if (listening) {
                        try { recognition.start(); } catch {}
                    }
                }, 2000);
                return;
            }
        }
    };

    recognition.onerror = (event) => {
        // "no-speech" is normal — just means silence, keep listening
        if (event.error === 'no-speech') return;
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
            stopListening();
        }
    };

    // Auto-restart on end (browser stops after silence)
    recognition.onend = () => {
        if (listening) {
            try { recognition.start(); } catch {}
        }
    };

    try {
        recognition.start();
        listening = true;
    } catch (err) {
        console.error('Failed to start speech recognition:', err);
    }
}

export function stopListening() {
    listening = false;
    if (recognition) {
        try { recognition.stop(); } catch {}
        recognition = null;
    }
    onScanCallback = null;
}
