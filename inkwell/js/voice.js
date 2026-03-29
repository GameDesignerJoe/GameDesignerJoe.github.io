// Voice-activated scanning — listens for "scan" keyword via Web Speech API

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = null;
let listening = false;
let onScanCallback = null;
let onStatusCallback = null;

export function isSupported() {
    return !!SpeechRecognition;
}

export function isListening() {
    return listening;
}

function status(msg, type) {
    if (onStatusCallback) onStatusCallback(msg, type);
}

/**
 * Start continuous listening for the "scan" keyword.
 * onScan() fires each time "scan" is detected.
 * onStatus(msg, type) fires on state changes for UI feedback.
 */
export function startListening(onScan, onStatus) {
    if (!SpeechRecognition) return;
    if (listening) return;

    onScanCallback = onScan;
    onStatusCallback = onStatus || null;
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript.toLowerCase().trim();
            status(`Heard: "${transcript}"`, 'detected');
            if (transcript.includes('scan') && onScanCallback) {
                status('Voice: Scanning!', 'done');
                onScanCallback();
                // Brief pause to avoid double-triggers
                recognition.stop();
                setTimeout(() => {
                    if (listening) {
                        try {
                            recognition.start();
                            status('Listening… say "scan"', 'detected');
                        } catch {}
                    }
                }, 3000);
                return;
            }
        }
    };

    recognition.onerror = (event) => {
        if (event.error === 'no-speech') {
            // Normal — silence timeout, will auto-restart via onend
            return;
        }
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            status('Mic permission denied', 'error');
            stopListening();
            return;
        }
        if (event.error === 'network') {
            status('Speech API: network error', 'error');
            return;
        }
        status(`Mic error: ${event.error}`, 'error');
    };

    recognition.onstart = () => {
        status('Listening… say "scan"', 'detected');
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
        status(`Mic failed: ${err.message}`, 'error');
        listening = false;
    }
}

export function stopListening() {
    listening = false;
    if (recognition) {
        try { recognition.stop(); } catch {}
        recognition = null;
    }
    onScanCallback = null;
    onStatusCallback = null;
}
