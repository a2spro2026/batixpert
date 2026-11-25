import { env, pipeline } from '@huggingface/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.wasmPaths = '/onnx/';
env.backends.onnx.wasm.numThreads = 1;

let transcriberPromise = null;
let session = null;

function loadTranscriber(onProgress) {
    if (!transcriberPromise) {
        transcriberPromise = pipeline('automatic-speech-recognition', 'Xenova/whisper-base', {
            quantized: true,
            progress_callback: (data) => {
                if (!onProgress) return;
                if (data.status === 'progress' && data.total) {
                    onProgress(Math.min(100, Math.round((data.loaded / data.total) * 100)));
                } else if (data.status === 'initiate' || data.status === 'download') {
                    onProgress(0);
                }
            },
        }).catch((error) => {
            transcriberPromise = null;
            throw error;
        });
    }
    return transcriberPromise;
}

function concat(chunks) {
    const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const audio = new Float32Array(length);
    let offset = 0;
    chunks.forEach((chunk) => {
        audio.set(chunk, offset);
        offset += chunk.length;
    });
    return audio;
}

function resample(input, fromRate, toRate) {
    if (fromRate === toRate) return input;
    const ratio = fromRate / toRate;
    const length = Math.max(1, Math.round(input.length / ratio));
    const output = new Float32Array(length);
    for (let i = 0; i < length; i += 1) {
        const position = i * ratio;
        const left = Math.floor(position);
        const right = Math.min(left + 1, input.length - 1);
        const weight = position - left;
        output[i] = input[left] * (1 - weight) + input[right] * weight;
    }
    return output;
}

function rms(samples) {
    let sum = 0;
    for (let i = 0; i < samples.length; i += 1) sum += samples[i] * samples[i];
    return Math.sqrt(sum / Math.max(samples.length, 1));
}

export function cleanTranscript(text) {
    return String(text || '')
        .replace(/\s+/g, ' ')
        .replace(/^(?:ghita|guita|gita|rita|guetta|guida|jita)[,.\s!:-]*/i, '')
        .replace(/\b(?:ghita|guita|gita|rita|guetta|guida|jita)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function beginRecording(onProgress, onAutoStop) {
    if (session) return Promise.resolve();
    const preparing = loadTranscriber(onProgress);
    return navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    }).then((stream) => {
        const context = new AudioContext();
        const source = context.createMediaStreamSource(stream);
        const processor = context.createScriptProcessor(4096, 1, 1);
        const mute = context.createGain();
        mute.gain.value = 0;
        const chunks = [];
        let spoken = false;
        let silentMs = 0;
        let totalMs = 0;
        let stopping = false;
        processor.onaudioprocess = (event) => {
            if (stopping) return;
            const frame = new Float32Array(event.inputBuffer.getChannelData(0));
            chunks.push(frame);
            const level = rms(frame);
            const frameMs = (frame.length / context.sampleRate) * 1000;
            totalMs += frameMs;
            if (level > 0.018) {
                spoken = true;
                silentMs = 0;
            } else if (spoken) {
                silentMs += frameMs;
            }
            if ((spoken && silentMs >= 1400) || totalMs >= 12000) {
                stopping = true;
                onAutoStop?.();
            }
        };
        source.connect(processor);
        processor.connect(mute);
        mute.connect(context.destination);
        session = { stream, context, source, processor, mute, chunks, preparing };
    });
}

export async function finishRecording() {
    if (!session) return '';
    const current = session;
    session = null;
    current.processor.disconnect();
    current.source.disconnect();
    current.mute.disconnect();
    current.stream.getTracks().forEach((track) => track.stop());
    const rate = current.context.sampleRate;
    const audio = concat(current.chunks);
    await current.context.close();
    if (audio.length < rate * 0.25) return '';

    const transcriber = await current.preparing;
    const samples = resample(audio, rate, 16000);
    const result = await transcriber(samples, {
        language: 'french',
        task: 'transcribe',
        chunk_length_s: 30,
        initial_prompt: 'Ghita, ouvre la section fournisseur, ouvre la section client, bon d\'achat, bon de vente, balance, relevé compte, plafond.',
    });
    return cleanTranscript(result?.text);
}

export function cancelRecording() {
    if (!session) return;
    const current = session;
    session = null;
    current.processor.disconnect();
    current.source.disconnect();
    current.mute.disconnect();
    current.stream.getTracks().forEach((track) => track.stop());
    current.context.close();
}
