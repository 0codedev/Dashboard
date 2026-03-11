import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, ThinkingLevel, Modality } from '@google/genai';

interface GeminiShowcaseProps {
    apiKey: string;
}

export const GeminiShowcase: React.FC<GeminiShowcaseProps> = ({ apiKey }) => {
    const [activeTab, setActiveTab] = useState('imageGen');
    const ai = new GoogleGenAI({ apiKey });

    // --- Image Generation (Nano Banana Pro) ---
    const [imagePrompt, setImagePrompt] = useState('');
    const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);

    const handleGenerateImagePro = async () => {
        if (!imagePrompt) return;
        setIsGeneratingImage(true);
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-3-pro-image-preview',
                contents: { parts: [{ text: imagePrompt }] },
                config: {
                    imageConfig: {
                        aspectRatio: "1:1",
                        imageSize: imageSize
                    }
                }
            });
            for (const part of response.candidates?.[0]?.content?.parts || []) {
                if (part.inlineData) {
                    setGeneratedImage(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`);
                    break;
                }
            }
        } catch (e) {
            console.error(e);
            alert("Error generating image.");
        } finally {
            setIsGeneratingImage(false);
        }
    };

    // --- Image Generation/Editing (Nano Banana 2) ---
    const [imagePrompt2, setImagePrompt2] = useState('');
    const [generatedImage2, setGeneratedImage2] = useState<string | null>(null);
    const [isGeneratingImage2, setIsGeneratingImage2] = useState(false);

    const handleGenerateImageFlash = async () => {
        if (!imagePrompt2) return;
        setIsGeneratingImage2(true);
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-3.1-flash-image-preview',
                contents: { parts: [{ text: imagePrompt2 }] },
                config: {
                    imageConfig: {
                        aspectRatio: "1:1",
                        imageSize: "1K"
                    }
                }
            });
            for (const part of response.candidates?.[0]?.content?.parts || []) {
                if (part.inlineData) {
                    setGeneratedImage2(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`);
                    break;
                }
            }
        } catch (e) {
            console.error(e);
            alert("Error generating image.");
        } finally {
            setIsGeneratingImage2(false);
        }
    };

    // --- Search Grounding ---
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResult, setSearchResult] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    const handleSearch = async () => {
        if (!searchQuery) return;
        setIsSearching(true);
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: searchQuery,
                config: {
                    tools: [{ googleSearch: {} }]
                }
            });
            setSearchResult(response.text || '');
        } catch (e) {
            console.error(e);
            setSearchResult("Error fetching search results.");
        } finally {
            setIsSearching(false);
        }
    };

    // --- AI Chatbot (Pro) ---
    const [chatQuery, setChatQuery] = useState('');
    const [chatResult, setChatResult] = useState('');
    const [isChatting, setIsChatting] = useState(false);

    const handleChat = async () => {
        if (!chatQuery) return;
        setIsChatting(true);
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-3.1-pro-preview',
                contents: chatQuery
            });
            setChatResult(response.text || '');
        } catch (e) {
            console.error(e);
            setChatResult("Error in chat.");
        } finally {
            setIsChatting(false);
        }
    };

    // --- Fast AI Responses (Flash Lite) ---
    const [fastQuery, setFastQuery] = useState('');
    const [fastResult, setFastResult] = useState('');
    const [isFastChatting, setIsFastChatting] = useState(false);

    const handleFastChat = async () => {
        if (!fastQuery) return;
        setIsFastChatting(true);
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-3.1-flash-lite-preview',
                contents: fastQuery
            });
            setFastResult(response.text || '');
        } catch (e) {
            console.error(e);
            setFastResult("Error in fast chat.");
        } finally {
            setIsFastChatting(false);
        }
    };

    // --- Thinking Mode (Pro) ---
    const [thinkQuery, setThinkQuery] = useState('');
    const [thinkResult, setThinkResult] = useState('');
    const [isThinking, setIsThinking] = useState(false);

    const handleThinkChat = async () => {
        if (!thinkQuery) return;
        setIsThinking(true);
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-3.1-pro-preview',
                contents: thinkQuery,
                config: {
                    thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
                }
            });
            setThinkResult(response.text || '');
        } catch (e) {
            console.error(e);
            setThinkResult("Error in thinking mode.");
        } finally {
            setIsThinking(false);
        }
    };

    // --- Audio Transcription ---
    const [isRecording, setIsRecording] = useState(false);
    const [transcription, setTranscription] = useState('');
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    audioChunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = async () => {
                    const base64Audio = (reader.result as string).split(',')[1];
                    try {
                        setTranscription("Transcribing...");
                        const response = await ai.models.generateContent({
                            model: 'gemini-3-flash-preview',
                            contents: [
                                { inlineData: { data: base64Audio, mimeType: 'audio/webm' } },
                                { text: 'Transcribe this audio.' }
                            ]
                        });
                        setTranscription(response.text || 'No transcription found.');
                    } catch (e) {
                        console.error(e);
                        setTranscription("Error transcribing audio.");
                    }
                };
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (e) {
            console.error(e);
            alert("Microphone access denied.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    // --- Generate Speech (TTS) ---
    const [ttsText, setTtsText] = useState('');
    const [isGeneratingSpeech, setIsGeneratingSpeech] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);

    const handleGenerateSpeech = async () => {
        if (!ttsText) return;
        setIsGeneratingSpeech(true);
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-preview-tts',
                contents: [{ parts: [{ text: ttsText }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: 'Kore' }
                        }
                    }
                }
            });
            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
                setAudioUrl(`data:audio/wav;base64,${base64Audio}`);
            }
        } catch (e) {
            console.error(e);
            alert("Error generating speech.");
        } finally {
            setIsGeneratingSpeech(false);
        }
    };

    // --- Image Understanding ---
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imageAnalysis, setImageAnalysis] = useState('');
    const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);

    const handleAnalyzeImage = async () => {
        if (!imageFile) return;
        setIsAnalyzingImage(true);
        try {
            const reader = new FileReader();
            reader.readAsDataURL(imageFile);
            reader.onloadend = async () => {
                const base64Image = (reader.result as string).split(',')[1];
                const response = await ai.models.generateContent({
                    model: 'gemini-3.1-pro-preview',
                    contents: [
                        { inlineData: { data: base64Image, mimeType: imageFile.type } },
                        { text: 'Analyze this image in detail.' }
                    ]
                });
                setImageAnalysis(response.text || '');
            };
        } catch (e) {
            console.error(e);
            setImageAnalysis("Error analyzing image.");
        } finally {
            setIsAnalyzingImage(false);
        }
    };

    // --- Video Understanding ---
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [videoAnalysis, setVideoAnalysis] = useState('');
    const [isAnalyzingVideo, setIsAnalyzingVideo] = useState(false);

    const handleAnalyzeVideo = async () => {
        if (!videoFile) return;
        setIsAnalyzingVideo(true);
        try {
            const reader = new FileReader();
            reader.readAsDataURL(videoFile);
            reader.onloadend = async () => {
                const base64Video = (reader.result as string).split(',')[1];
                const response = await ai.models.generateContent({
                    model: 'gemini-3.1-pro-preview',
                    contents: [
                        { inlineData: { data: base64Video, mimeType: videoFile.type } },
                        { text: 'Analyze this video in detail.' }
                    ]
                });
                setVideoAnalysis(response.text || '');
            };
        } catch (e) {
            console.error(e);
            setVideoAnalysis("Error analyzing video. Note: Large videos might fail due to size limits.");
        } finally {
            setIsAnalyzingVideo(false);
        }
    };

    return (
        <div className="p-6 bg-slate-900 text-white min-h-full overflow-y-auto">
            <h1 className="text-3xl font-bold mb-6 text-cyan-400">Gemini Features Showcase</h1>
            
            <div className="flex flex-wrap gap-2 mb-8">
                <button onClick={() => setActiveTab('imageGen')} className={`px-4 py-2 rounded-lg ${activeTab === 'imageGen' ? 'bg-cyan-600' : 'bg-slate-700'}`}>Image Gen</button>
                <button onClick={() => setActiveTab('search')} className={`px-4 py-2 rounded-lg ${activeTab === 'search' ? 'bg-cyan-600' : 'bg-slate-700'}`}>Search</button>
                <button onClick={() => setActiveTab('chat')} className={`px-4 py-2 rounded-lg ${activeTab === 'chat' ? 'bg-cyan-600' : 'bg-slate-700'}`}>Chat & Thinking</button>
                <button onClick={() => setActiveTab('audio')} className={`px-4 py-2 rounded-lg ${activeTab === 'audio' ? 'bg-cyan-600' : 'bg-slate-700'}`}>Audio & TTS</button>
                <button onClick={() => setActiveTab('vision')} className={`px-4 py-2 rounded-lg ${activeTab === 'vision' ? 'bg-cyan-600' : 'bg-slate-700'}`}>Vision & Video</button>
            </div>

            {activeTab === 'imageGen' && (
                <div className="space-y-8">
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                        <h2 className="text-xl font-bold mb-4">Nano Banana Pro (gemini-3-pro-image-preview)</h2>
                        <div className="flex gap-4 mb-4">
                            <input type="text" value={imagePrompt} onChange={e => setImagePrompt(e.target.value)} placeholder="Enter image prompt..." className="flex-1 bg-slate-700 p-2 rounded" />
                            <select value={imageSize} onChange={e => setImageSize(e.target.value as any)} className="bg-slate-700 p-2 rounded">
                                <option value="1K">1K</option>
                                <option value="2K">2K</option>
                                <option value="4K">4K</option>
                            </select>
                            <button onClick={handleGenerateImagePro} disabled={isGeneratingImage} className="bg-cyan-600 px-4 py-2 rounded disabled:opacity-50">
                                {isGeneratingImage ? 'Generating...' : 'Generate'}
                            </button>
                        </div>
                        {generatedImage && <img src={generatedImage} alt="Generated" className="max-w-md rounded-lg shadow-lg" />}
                    </div>

                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                        <h2 className="text-xl font-bold mb-4">Nano Banana 2 (gemini-3.1-flash-image-preview)</h2>
                        <div className="flex gap-4 mb-4">
                            <input type="text" value={imagePrompt2} onChange={e => setImagePrompt2(e.target.value)} placeholder="Enter image prompt..." className="flex-1 bg-slate-700 p-2 rounded" />
                            <button onClick={handleGenerateImageFlash} disabled={isGeneratingImage2} className="bg-cyan-600 px-4 py-2 rounded disabled:opacity-50">
                                {isGeneratingImage2 ? 'Generating...' : 'Generate'}
                            </button>
                        </div>
                        {generatedImage2 && <img src={generatedImage2} alt="Generated" className="max-w-md rounded-lg shadow-lg" />}
                    </div>
                </div>
            )}

            {activeTab === 'search' && (
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <h2 className="text-xl font-bold mb-4">Search Grounding (gemini-3-flash-preview)</h2>
                    <div className="flex gap-4 mb-4">
                        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Ask something about recent events..." className="flex-1 bg-slate-700 p-2 rounded" />
                        <button onClick={handleSearch} disabled={isSearching} className="bg-cyan-600 px-4 py-2 rounded disabled:opacity-50">
                            {isSearching ? 'Searching...' : 'Search'}
                        </button>
                    </div>
                    {searchResult && <div className="bg-slate-900 p-4 rounded whitespace-pre-wrap">{searchResult}</div>}
                </div>
            )}

            {activeTab === 'chat' && (
                <div className="space-y-8">
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                        <h2 className="text-xl font-bold mb-4">AI Chatbot (gemini-3.1-pro-preview)</h2>
                        <div className="flex gap-4 mb-4">
                            <input type="text" value={chatQuery} onChange={e => setChatQuery(e.target.value)} placeholder="Ask a complex question..." className="flex-1 bg-slate-700 p-2 rounded" />
                            <button onClick={handleChat} disabled={isChatting} className="bg-cyan-600 px-4 py-2 rounded disabled:opacity-50">
                                {isChatting ? 'Thinking...' : 'Ask Pro'}
                            </button>
                        </div>
                        {chatResult && <div className="bg-slate-900 p-4 rounded whitespace-pre-wrap">{chatResult}</div>}
                    </div>

                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                        <h2 className="text-xl font-bold mb-4">Fast Chat (gemini-3.1-flash-lite-preview)</h2>
                        <div className="flex gap-4 mb-4">
                            <input type="text" value={fastQuery} onChange={e => setFastQuery(e.target.value)} placeholder="Ask a quick question..." className="flex-1 bg-slate-700 p-2 rounded" />
                            <button onClick={handleFastChat} disabled={isFastChatting} className="bg-cyan-600 px-4 py-2 rounded disabled:opacity-50">
                                {isFastChatting ? 'Thinking...' : 'Ask Flash Lite'}
                            </button>
                        </div>
                        {fastResult && <div className="bg-slate-900 p-4 rounded whitespace-pre-wrap">{fastResult}</div>}
                    </div>

                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                        <h2 className="text-xl font-bold mb-4">Thinking Mode (gemini-3.1-pro-preview)</h2>
                        <div className="flex gap-4 mb-4">
                            <input type="text" value={thinkQuery} onChange={e => setThinkQuery(e.target.value)} placeholder="Ask a logic puzzle..." className="flex-1 bg-slate-700 p-2 rounded" />
                            <button onClick={handleThinkChat} disabled={isThinking} className="bg-cyan-600 px-4 py-2 rounded disabled:opacity-50">
                                {isThinking ? 'Thinking Deeply...' : 'Ask with Thinking'}
                            </button>
                        </div>
                        {thinkResult && <div className="bg-slate-900 p-4 rounded whitespace-pre-wrap">{thinkResult}</div>}
                    </div>
                </div>
            )}

            {activeTab === 'audio' && (
                <div className="space-y-8">
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                        <h2 className="text-xl font-bold mb-4">Audio Transcription (gemini-3-flash-preview)</h2>
                        <div className="flex gap-4 mb-4">
                            <button onMouseDown={startRecording} onMouseUp={stopRecording} onMouseLeave={stopRecording} className={`px-4 py-2 rounded ${isRecording ? 'bg-red-600' : 'bg-cyan-600'}`}>
                                {isRecording ? 'Recording... (Release to stop)' : 'Hold to Record'}
                            </button>
                        </div>
                        {transcription && <div className="bg-slate-900 p-4 rounded whitespace-pre-wrap">{transcription}</div>}
                    </div>

                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                        <h2 className="text-xl font-bold mb-4">Text to Speech (gemini-2.5-flash-preview-tts)</h2>
                        <div className="flex gap-4 mb-4">
                            <input type="text" value={ttsText} onChange={e => setTtsText(e.target.value)} placeholder="Enter text to speak..." className="flex-1 bg-slate-700 p-2 rounded" />
                            <button onClick={handleGenerateSpeech} disabled={isGeneratingSpeech} className="bg-cyan-600 px-4 py-2 rounded disabled:opacity-50">
                                {isGeneratingSpeech ? 'Generating...' : 'Generate Speech'}
                            </button>
                        </div>
                        {audioUrl && <audio src={audioUrl} controls className="w-full mt-4" />}
                    </div>
                </div>
            )}

            {activeTab === 'vision' && (
                <div className="space-y-8">
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                        <h2 className="text-xl font-bold mb-4">Image Understanding (gemini-3.1-pro-preview)</h2>
                        <div className="flex gap-4 mb-4">
                            <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} className="bg-slate-700 p-2 rounded" />
                            <button onClick={handleAnalyzeImage} disabled={isAnalyzingImage || !imageFile} className="bg-cyan-600 px-4 py-2 rounded disabled:opacity-50">
                                {isAnalyzingImage ? 'Analyzing...' : 'Analyze Image'}
                            </button>
                        </div>
                        {imageAnalysis && <div className="bg-slate-900 p-4 rounded whitespace-pre-wrap">{imageAnalysis}</div>}
                    </div>

                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                        <h2 className="text-xl font-bold mb-4">Video Understanding (gemini-3.1-pro-preview)</h2>
                        <div className="flex gap-4 mb-4">
                            <input type="file" accept="video/*" onChange={e => setVideoFile(e.target.files?.[0] || null)} className="bg-slate-700 p-2 rounded" />
                            <button onClick={handleAnalyzeVideo} disabled={isAnalyzingVideo || !videoFile} className="bg-cyan-600 px-4 py-2 rounded disabled:opacity-50">
                                {isAnalyzingVideo ? 'Analyzing...' : 'Analyze Video'}
                            </button>
                        </div>
                        {videoAnalysis && <div className="bg-slate-900 p-4 rounded whitespace-pre-wrap">{videoAnalysis}</div>}
                    </div>
                </div>
            )}
        </div>
    );
};
