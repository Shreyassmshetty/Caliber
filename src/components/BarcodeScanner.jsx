import React, { useState, useEffect, useRef } from 'react';
import { Camera, Search, RefreshCw, X, AlertCircle, Barcode, CheckCircle2 } from 'lucide-react';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';

export const BarcodeScanner = ({ onFoodFound, onClose }) => {
  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef(null);

  const stopCamera = () => {
    if (scannerRef.current) {
      try {
        if (typeof scannerRef.current.clear === 'function') {
          scannerRef.current.clear();
        } else if (typeof scannerRef.current.stop === 'function') {
          scannerRef.current.stop();
        }
      } catch (e) {
        console.error("Camera stop error:", e);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const apiBase = import.meta.env.VITE_API_BASE_URL || '';

  const lookupBarcode = async (code) => {
    const cleanCode = code ? code.trim() : '';
    if (!cleanCode) return;

    setLoading(true);
    setScanError(null);

    try {
      const response = await fetch(`${apiBase}/api/food/barcode/${encodeURIComponent(cleanCode)}`);
      const data = response.ok ? await response.json() : null;

      if (data && data.found && data.product) {
        onFoodFound({
          foodName: data.product.foodName,
          calories: Number(data.product.calories) || 0,
          protein: Number(data.product.protein) || 0,
          carbs: Number(data.product.carbs) || 0,
          fat: Number(data.product.fat) || 0,
          sugar: Number(data.product.sugar) || 0,
          servingSize: data.product.servingSize || "100g",
          source: data.product.source || 'Barcode (Open Food Facts)'
        });
        stopCamera();
      } else {
        setScanError(data?.error || `Barcode ${cleanCode} not found in Open Food Facts database.`);
      }
    } catch (err) {
      console.error("Barcode lookup error:", err);
      setScanError("Failed to look up barcode. Please check connection.");
    } finally {
      setLoading(false);
    }
  };

  const startCamera = () => {
    setIsScanning(true);
    setScanError(null);

    setTimeout(() => {
      try {
        const scanner = new Html5QrcodeScanner(
          "qr-reader-container",
          { fps: 10, qrbox: { width: 250, height: 250 } },
          /* verbose= */ false
        );

        scanner.render(
          (decodedText) => {
            setBarcode(decodedText);
            try {
              scanner.clear();
            } catch(e){}
            setIsScanning(false);
            lookupBarcode(decodedText);
          },
          () => {}
        );
        scannerRef.current = scanner;
      } catch (err) {
        console.error("Camera setup failed:", err);
        setScanError("Camera access required to scan. Ensure camera permissions are granted.");
        setIsScanning(false);
      }
    }, 150);
  };

  // Automatically start camera when component mounts
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xl text-center relative max-w-sm mx-auto animate-in fade-in zoom-in-95 duration-200">
      <button
        onClick={() => {
          stopCamera();
          onClose();
        }}
        className="absolute top-3.5 right-3.5 p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="mb-4">
        <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-xs font-bold mb-2">
          <Barcode className="w-4 h-4" />
          <span>Barcode Scanner</span>
        </div>
        <h3 className="text-sm font-bold text-gray-800">Scan Product Barcode</h3>
        <p className="text-[11px] text-gray-400 mt-0.5">Point camera at packaged food barcode or enter code below</p>
      </div>

      {scanError && (
        <div className="mb-3 bg-amber-50 text-amber-800 p-3 rounded-2xl text-[11px] font-medium border border-amber-200 flex items-start gap-2 text-left">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>{scanError}</span>
        </div>
      )}

      {/* Camera Stage */}
      {isScanning ? (
        <div className="bg-gray-900 rounded-2xl overflow-hidden aspect-square flex flex-col justify-center items-center text-white p-2 relative mb-4 shadow-inner">
          <div id="qr-reader-container" className="w-full h-full bg-black rounded-xl overflow-hidden"></div>
          <button
            onClick={stopCamera}
            className="absolute bottom-3 bg-black/60 hover:bg-black/80 text-white font-medium text-[11px] px-3.5 py-1.5 rounded-full backdrop-blur-md transition border border-white/20"
          >
            Cancel Camera
          </button>
        </div>
      ) : (
        <div className="bg-amber-50/50 p-6 rounded-2xl border border-dashed border-amber-200 flex flex-col items-center justify-center aspect-video mb-4">
          <Barcode className="w-10 h-10 text-amber-500/70 mb-2" />
          <button
            onClick={startCamera}
            className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm transition flex items-center gap-1.5"
          >
            <Camera className="w-4 h-4" />
            Enable Camera Scanner
          </button>
          <span className="text-[10px] text-gray-400 mt-2">Searches Open Food Facts India & Global</span>
        </div>
      )}

      {/* Manual Input Fallback */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Enter barcode e.g. 8901058852870"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && lookupBarcode(barcode)}
          className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 bg-gray-50/50"
        />
        <button
          onClick={() => lookupBarcode(barcode)}
          disabled={loading || !barcode.trim()}
          className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-4 rounded-xl text-xs flex items-center gap-1 shadow-sm disabled:opacity-50 transition"
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Search className="w-4 h-4" /> Scan
            </>
          )}
        </button>
      </div>
    </div>
  );
};
