import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Sparkles, X, RefreshCw, AlertCircle, Volume2 } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface VoiceFoodInputProps {
  onFoodFound: (food: {
    foodName: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    servingSize: string;
  }) => void;
  onClose: () => void;
}

export const VoiceFoodInput: React.FC<VoiceFoodInputProps> = ({ onFoodFound, onClose }) => {
  const { token } = useApp();
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check Web Speech API availability
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setError('Microphone access denied. Please allow microphone access or type your meal below.');
        } else if (event.error !== 'no-speech') {
          setError(`Speech recognition error: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } catch (e) {
      console.error('Speech recognition initialization error:', e);
      setIsSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (err) {
          // Ignore cleanup error
        }
      }
    };
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      setError('Voice recognition is not supported in this browser. You can type your meal description below.');
      return;
    }

    setError(null);

    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.error(err);
      }
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error('Start recognition error:', err);
        // Might be already running
        try {
          recognitionRef.current.stop();
          setTimeout(() => {
            recognitionRef.current?.start();
            setIsListening(true);
          }, 200);
        } catch (e) {
          setError('Failed to start microphone. Please try typing instead.');
        }
      }
    }
  };

  const parseWithGemini = async () => {
    if (!transcript.trim() || !token) return;

    setAnalyzing(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/parse-voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          textPrompt: transcript.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to parse meal description.');
      }

      onFoodFound({
        foodName: data.foodName || 'Parsed Meal',
        calories: Number(data.calories || 300),
        protein: Number(data.protein || 15),
        carbs: Number(data.carbs || 30),
        fat: Number(data.fat || 10),
        servingSize: data.servingSize || '1 portion'
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error processing meal with AI. Please check network and try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xl text-center relative max-w-sm mx-auto">
      <button
        onClick={onClose}
        className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-50 transition"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="mb-4">
        <div className="inline-flex items-center justify-center bg-rose-50 text-rose-600 p-2.5 rounded-2xl mb-1.5 border border-rose-100">
          <Mic className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-800">Voice Meal Logger</h3>
        <p className="text-[11px] text-gray-400 mt-1">Speak or type what you ate, and Gemini will estimate calories and macros</p>
      </div>

      {error && (
        <div className="mb-3 bg-amber-50 text-amber-800 p-3 rounded-xl text-[11px] font-semibold border border-amber-200 flex items-center gap-1.5 text-left">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Mic Recording Button */}
      <div className="mb-4 flex flex-col items-center">
        <button
          type="button"
          onClick={toggleListening}
          className={`relative p-5 rounded-full transition-all duration-300 shadow-md ${
            isListening
              ? 'bg-red-500 text-white animate-pulse ring-8 ring-red-100'
              : 'bg-rose-600 hover:bg-rose-700 text-white'
          }`}
          title={isListening ? 'Stop Recording' : 'Start Recording Voice'}
        >
          {isListening ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
        </button>

        <span className="text-[11px] font-bold mt-2 text-gray-600 flex items-center gap-1">
          {isListening ? (
            <span className="text-red-500 font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
              Listening... Speak now
            </span>
          ) : (
            'Tap mic to speak'
          )}
        </span>
      </div>

      {/* Transcript Textarea Input */}
      <div className="mb-4 space-y-1 text-left">
        <label className="block text-[10px] font-bold text-gray-400 uppercase">
          Meal Description ({transcript.length} chars)
        </label>
        <textarea
          rows={3}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="E.g. 'I had 2 boiled eggs, a slice of avocado toast, and a cup of black coffee'"
          className="w-full p-3 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 resize-none"
        />
      </div>

      {/* Quick Example Presets */}
      <div className="mb-4 text-left">
        <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Quick Presets</span>
        <div className="flex flex-wrap gap-1">
          {[
            '2 scrambled eggs with butter',
            'Chicken salad bowl with olive oil',
            'Protein shake with almond milk & banana'
          ].map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setTranscript(preset)}
              className="text-[10px] bg-gray-50 hover:bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg border border-gray-100 transition truncate max-w-full"
            >
              "{preset}"
            </button>
          ))}
        </div>
      </div>

      {/* Action Button */}
      <button
        type="button"
        onClick={parseWithGemini}
        disabled={!transcript.trim() || analyzing}
        className="w-full bg-gradient-to-r from-rose-500 to-indigo-600 hover:opacity-95 text-white font-bold text-xs py-3 rounded-xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {analyzing ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" /> Gemini is analyzing macros...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" /> Calculate Macros with Gemini
          </>
        )}
      </button>

      {!isSupported && (
        <p className="text-[10px] text-gray-400 mt-2">
          Note: Direct voice dictation requires a supported browser (Chrome/Edge/Safari). You can always type your meal above.
        </p>
      )}
    </div>
  );
};
