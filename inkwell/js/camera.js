let stream = null;
let videoEl = null;

export async function startCamera() {
    videoEl = document.getElementById('camera-feed');

    // Try rear camera at high resolution first, fall back to any camera
    const constraints = {
        video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
        },
        audio: false
    };

    try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
        // Fallback: any camera
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }

    videoEl.srcObject = stream;
    await videoEl.play();

    return videoEl;
}

export function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
    }
    if (videoEl) {
        videoEl.srcObject = null;
    }
}

export function getVideoElement() {
    return videoEl;
}
