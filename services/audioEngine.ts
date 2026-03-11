
export class AudioEngine {
    private ctx: AudioContext | null = null;
    private source: AudioBufferSourceNode | null = null;
    private oscillators: AudioNode[] = [];
    private gainNode: GainNode | null = null;
    private isPlaying: boolean = false;
    private buffers: Map<string, AudioBuffer> = new Map();

    public init() {
        if (!this.ctx && typeof window !== 'undefined') {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
                this.ctx = new AudioContextClass();
            }
        }
        // Ensure we try to resume if it was suspended (browser policy)
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
    }

    private createNoiseBuffer(type: 'brown' | 'pink' | 'white') {
        if (!this.ctx) return null;
        if (this.buffers.has(type)) return this.buffers.get(type);

        const bufferSize = this.ctx.sampleRate * 2; 
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        if (type === 'white') {
            for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        } else if (type === 'pink') {
            let b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                b0 = 0.99886 * b0 + white * 0.0555179;
                b1 = 0.99332 * b1 + white * 0.0750759;
                b2 = 0.96900 * b2 + white * 0.1538520;
                b3 = 0.86650 * b3 + white * 0.3104856;
                b4 = 0.55000 * b4 + white * 0.5329522;
                b5 = -0.7616 * b5 - white * 0.0168980;
                data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
                data[i] *= 0.11; 
                b6 = white * 0.115926;
            }
        } else { 
            let lastOut = 0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                data[i] = (lastOut + (0.02 * white)) / 1.02;
                lastOut = data[i];
                data[i] *= 3.5; 
            }
        }
        this.buffers.set(type, buffer);
        return buffer;
    }

    playNoise(type: 'brown' | 'pink' | 'white', volume: number = 0.1) {
        // Only proceed if context exists (explicit init required via user gesture)
        if (!this.ctx) return;
        
        if (this.isPlaying) this.stop();

        const buffer = this.createNoiseBuffer(type);
        if (!buffer) return;

        this.source = this.ctx.createBufferSource();
        this.source.buffer = buffer;
        this.source.loop = true;

        this.gainNode = this.ctx.createGain();
        this.gainNode.gain.value = volume;

        this.source.connect(this.gainNode);
        this.gainNode.connect(this.ctx.destination);
        this.source.start();
        this.isPlaying = true;
    }

    playBinaural(baseFreq: number, beatFreq: number, volume: number = 0.1) {
        if (!this.ctx) return;
        
        if (this.isPlaying) this.stop();

        this.gainNode = this.ctx.createGain();
        this.gainNode.gain.value = volume;
        this.gainNode.connect(this.ctx.destination);

        // Left Oscillator (Base Freq)
        const oscL = this.ctx.createOscillator();
        oscL.type = 'sine';
        oscL.frequency.value = baseFreq;
        const panL = this.ctx.createStereoPanner();
        panL.pan.value = -1; // Pan Left
        oscL.connect(panL).connect(this.gainNode);

        // Right Oscillator (Base + Beat)
        const oscR = this.ctx.createOscillator();
        oscR.type = 'sine';
        oscR.frequency.value = baseFreq + beatFreq;
        const panR = this.ctx.createStereoPanner();
        panR.pan.value = 1; // Pan Right
        oscR.connect(panR).connect(this.gainNode);

        oscL.start();
        oscR.start();
        this.oscillators = [oscL, oscR];
        this.isPlaying = true;
    }

    stop() {
        if (this.source) {
            try { this.source.stop(); this.source.disconnect(); } catch (e) { }
            this.source = null;
        }
        this.oscillators.forEach(osc => {
             try { (osc as any).stop(); osc.disconnect(); } catch(e){}
        });
        this.oscillators = [];

        if (this.gainNode) { this.gainNode.disconnect(); this.gainNode = null; }
        this.isPlaying = false;
    }

    setVolume(val: number) {
        if (this.gainNode && this.ctx) {
            this.gainNode.gain.setTargetAtTime(val, this.ctx.currentTime, 0.1);
        }
    }
}

export const audioEngine = new AudioEngine();
