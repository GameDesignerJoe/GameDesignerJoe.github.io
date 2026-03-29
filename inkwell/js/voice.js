// Voice-activated scanning — listens for "scan" keyword via Web Speech API

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = null;
let listening = false;
let onScanCallback = null;
let onStatusCallback = null;
let micStream = null; // Hold getUserMedia stream to keep mic active

const STORAGE_MIC = 'inkwell_mic_device';

export function isSupported() {
    return !!SpeechRecognition;
}

export function isListening() {
    return listening;
}

/** Get saved mic deviceId (empty string = default) */
export function getSavedMicId() {
    return localStorage.getItem(STORAGE_MIC) || '';
}

/** Save selected mic deviceId */
export function setSavedMicId(deviceId) {
    if (deviceId) {
        localStorage.setItem(STORAGE_MIC, deviceId);
    } else {
        localStorage.removeItem(STORAGE_MIC);
    }
}

/** Enumerate audio input devices (requires mic permission) */
export async function listMics() {
    try {
        // Request mic permission first so labels are populated
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());

        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.filter(d => d.kind === 'audioinput');
    } catch {
        return [];
    }
}

function status(msg, type) {
    if (onStatusCallback) onStatusCallback(msg, type);
}

/**
 * Activate a specific mic via getUserMedia before starting SpeechRecognition.
 * This makes the browser route audio from that device to the speech engine.
 */
async function activateMic(deviceId) {
    // Release any previous stream
    if (micStream) {
        micStream.getTracks().forEach(t => t.stop());
        micStream = null;
    }

    if (!deviceId) return; // Use default

    try {
        micStream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: { exact: deviceId } }
        });
        // Keep the stream alive — SpeechRecognition will use this device
    } catch (err) {
        status(`Mic select failed: ${err.message}`, 'error');
    }
}

/**
 * Start continuous listening for the "scan" keyword.
 * onScan() fires each time "scan" is detected.
 * onStatus(msg, type) fires on state changes for UI feedback.
 */
export async function startListening(onScan, onStatus) {
    if (!SpeechRecognition) return;
    if (listening) return;

    onScanCallback = onScan;
    onStatusCallback = onStatus || null;

    // Activate selected mic before starting recognition
    const selectedMic = getSavedMicId();
    await activateMic(selectedMic);

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
    // Release mic stream
    if (micStream) {
        micStream.getTracks().forEach(t => t.stop());
        micStream = null;
    }
    onScanCallback = null;
    onStatusCallback = null;
}
