// src/state/game/compassState.js

export const CompassState = {
    isActive: false,
    settling: false,
    currentRotation: 0,
    swayAmount: 0,
    animationFrame: null,

    methods: {
        activate() {
            this.isActive = true;
        },

        deactivate() {
            this.isActive = false;
            if (this.animationFrame) {
                cancelAnimationFrame(this.animationFrame);
                this.animationFrame = null;
            }
        },

        setSettling(value) {
            this.settling = value;
        },

        setRotation(angle) {
            this.currentRotation = angle;
        },

        setSwayAmount(amount) {
            this.swayAmount = amount;
        },

        reset() {
            this.isActive = false;
            this.settling = false;
            this.currentRotation = 0;
            this.swayAmount = 0;
            if (this.animationFrame) {
                cancelAnimationFrame(this.animationFrame);
                this.animationFrame = null;
            }
        }
    }
};

// Bind all methods to CompassState
Object.getOwnPropertyNames(CompassState.methods)
    .forEach(method => {
        CompassState.methods[method] = CompassState.methods[method].bind(CompassState);
    });

export default CompassState;