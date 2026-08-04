import React, { useState, useRef } from 'react';
import { Camera, Upload, Sparkles, Check, RefreshCw, X, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const AIFoodScanner = ({ onFoodFound, onClose }) => {
  const { token } = useApp();
  const apiBase = import.meta.env.VITE_API_BASE_URL || '';
  const [previewUrl, setPreviewUrl] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [mimeType, setMimeType] = useState('image/jpeg');
  const [analyzing, setAnalyzing] = useState(false);
  const [aiError, setAiError] = useState(null);
  const fileInputRef = useRef(null);

  // Handle local file selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMimeType(file.type || 'image/jpeg');
    const reader = new FileReader();
    reader.onloadend = () => {
      const resultStr = reader.result;
      setPreviewUrl(resultStr);
      setImageBase64(resultStr);
      setAiError(null);
    };
    reader.readAsDataURL(file);
  };

  // Trigger file click
  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  // Perform AI analysis on backend using Gemini API
  const analyzeWithAI = async () => {
    if (!imageBase64 || !token) return;

    setAnalyzing(true);
    setAiError(null);

    try {
      const res = await fetch(`${apiBase}/api/ai/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          imageBase64,
          mimeType
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "AI could not identify this meal. Try manually or retrying.");
      }

      onFoodFound({
        foodName: data.foodName || "Estimated Meal",
        calories: Number(data.calories || 350),
        protein: Number(data.protein || 15),
        carbs: Number(data.carbs || 35),
        fat: Number(data.fat || 10),
        servingSize: data.servingSize || "1 portion"
      });
    } catch (err) {
      console.error(err);
      setAiError(err.message || "Failed to parse meal image. Make sure it's a clear photo of food.");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm text-center relative max-w-sm mx-auto">
      <button
        onClick={onClose}
        className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-50 transition"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="mb-4">
        <div className="inline-flex items-center justify-center bg-purple-50 text-purple-600 p-2.5 rounded-2xl mb-1.5 border border-purple-100">
          <Sparkles className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700">AI Food Snap</h3>
        <p className="text-[11px] text-gray-400 mt-1">Upload a photo of your food, and Gemini will estimate the calories and macros</p>
      </div>

      {aiError && (
        <div className="mb-3 bg-red-50 text-red-700 p-3 rounded-xl text-[11px] font-semibold border border-red-100 flex items-center gap-1.5 justify-center">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span>{aiError}</span>
        </div>
      )}

      {/* Upload/Preview Stage */}
      {previewUrl ? (
        <div className="space-y-4 mb-4">
          <div className="relative rounded-2xl overflow-hidden aspect-video border border-gray-100 bg-black">
            <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            <button
              onClick={() => {
                setPreviewUrl(null);
                setImageBase64(null);
              }}
              disabled={analyzing}
              className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={triggerUpload}
              disabled={analyzing}
              className="flex-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 font-bold text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-1"
            >
              <Upload className="w-4 h-4" /> Change
            </button>
            <button
              onClick={analyzeWithAI}
              disabled={analyzing}
              className="flex-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white font-bold text-xs py-2.5 rounded-xl shadow-md transition flex items-center justify-center gap-1.5"
            >
              {analyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Identifying...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 animate-bounce" /> Analyze with AI
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={triggerUpload}
          className="bg-purple-50/20 hover:bg-purple-50/50 border-2 border-dashed border-purple-200 p-8 rounded-2xl flex flex-col items-center justify-center cursor-pointer mb-4 transition"
        >
          <Camera className="w-10 h-10 text-purple-400 mb-2 animate-pulse" />
          <span className="text-xs font-bold text-purple-700">Take Photo or Upload Image</span>
          <span className="text-[10px] text-gray-400 mt-1">Accepts PNG, JPG</span>
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* Helpful reminder */}
      <div className="bg-amber-50/50 rounded-xl p-2.5 text-[10px] text-amber-800 border border-amber-100/30 text-left">
        💡 <strong>Tip:</strong> Crop the photo close to the food item, and ensure there is ample light for the highest prediction accuracy.
      </div>
    </div>
  );
};
