import React, { useState } from 'react';
import { signInWithGoogle } from '../services/firebase';
import { Button } from './common/Button';

interface LoginScreenProps {
    onLoginSuccess: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async () => {
        setIsLoading(true);
        setError(null);
        try {
            await signInWithGoogle();
            onLoginSuccess();
        } catch (err: any) {
            setError(err.message || 'Failed to sign in with Google.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />
            
            <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-8 rounded-2xl shadow-2xl relative z-10">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 mb-6 shadow-lg shadow-cyan-500/20">
                        <span className="text-3xl">🚀</span>
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Welcome</h1>
                    <p className="text-slate-400 text-sm">Sign in to sync your progress and access your dashboard.</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
                        {error}
                    </div>
                )}

                <div className="space-y-4">
                    <Button 
                        onClick={handleLogin} 
                        disabled={isLoading}
                        className="w-full py-4 flex items-center justify-center gap-3 text-base font-medium bg-white text-slate-900 hover:bg-slate-100 hover:scale-[1.02] transition-all"
                    >
                        {isLoading ? (
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
                        ) : (
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                        )}
                        <span>Continue with Google</span>
                    </Button>
                </div>

                <div className="mt-8 text-center">
                    <p className="text-xs text-slate-500">
                        By continuing, you agree to our Terms of Service and Privacy Policy.
                    </p>
                </div>
            </div>
        </div>
    );
};
