import React, { useState } from 'react';
import { Card } from './common/Card';
import { Input } from './common/Input';
import { Button } from './common/Button';


interface ApiKeyManagerProps {
    onKeySubmit: (key: string) => void;
}

export const ApiKeyManager: React.FC<ApiKeyManagerProps> = ({ onKeySubmit }) => {
    const [inputKey, setInputKey] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputKey.trim() === '') {
            setError('API Key cannot be empty.');
            return;
        }
        setError('');
        onKeySubmit(inputKey.trim());
    };

    return (
        <div className="min-h-screen bg-slate-900 text-gray-100 flex items-center justify-center p-4">
            <Card className="w-full max-w-md animate-scale-in">
                <div className="text-center mb-6">
                    <h1 className="text-3xl font-bold text-cyan-400">Welcome</h1>
                    <p className="text-gray-400 mt-2">Enter your Gemini API Key to begin.</p>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="api-key-input" className="text-sm font-medium text-gray-300">
                            Your API Key
                        </label>
                        <Input
                            id="api-key-input"
                            type="password"
                            value={inputKey}
                            onChange={(e) => setInputKey(e.target.value)}
                            placeholder="Enter your secret API Key"
                            className="mt-2"
                        />
                        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
                    </div>
                    
                    <Button
                        type="submit"
                        variant="primary"
                        className="w-full !py-3 shadow-lg hover:shadow-cyan-500/50"
                    >
                        Save & Continue
                    </Button>
                </form>

                <div className="mt-6 text-xs text-gray-500 text-center">
                    <p>
                        You can get your API key from{' '}
                        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:underline">
                             Google AI Studio
                        </a>.
                    </p>
                    <p className="mt-1">Your key will be stored securely in your browser's local storage and will not be shared.</p>
                </div>
            </Card>
        </div>
    );
};