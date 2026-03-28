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

    // Lock zoom to 1x and enable continuous autofocus if supported
    const track = stream.getVideoTracks()[0];
    try {
        const caps = track.getCapabilities?.();
        const advanced = [];
        if (caps?.zoom) {
            advanced.push({ zoom: caps.zoom.min });
        }
        if (caps?.focusMode?.includes('continuous')) {
            advanced.push({ focusMode: 'continuous' });
        }
        if (advanced.length > 0) {
            await track.applyConstraints({ advanced });
        }
    } catch (e) {}

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

export async function refocus() {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    try {
        const caps = track.getCapabilities?.();
        if (caps?.focusMode?.includes('manual') && caps?.focusMode?.includes('continuous')) {
            const advanced = [{ focusMode: 'manual' }];
            if (caps?.zoom) advanced.push({ zoom: caps.zoom.min });
            await track.applyConstraints({ advanced });
            await new Promise(r => setTimeout(r, 100));
            const advanced2 = [{ focusMode: 'continuous' }];
            if (caps?.zoom) advanced2.push({ zoom: caps.zoom.min });
            await track.applyConstraints({ advanced: advanced2 });
        }
    } catch (e) {}
}

export function getVideoElement() {
    return videoEl;
}
