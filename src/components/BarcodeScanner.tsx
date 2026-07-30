import React, { useState, useEffect, useRef } from 'react';
import { Camera, Search, RefreshCw, X, AlertCircle } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface BarcodeScannerProps {
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

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onFoodFound, onClose }) => {
  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  // Lookup barcode on Open Food Facts API
  const lookupBarcode = async (code: string) => {
    if (!code) return;
    setLoading(true);
    setScanError(null);
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
      if (!response.ok) {
        throw new Error("Failed to scan product.");
      }
      const data = await response.json();
      if (data.status === 1 && data.product) {
        const prod = data.product;
        // Parse macros from nutriment list (standard 100g basis)
        const name = prod.product_name || `Scanned Item (${code})`;
        const brand = prod.brands ? ` - ${prod.brands}` : '';
        const serving = prod.serving_size || "100g";

        const nutriments = prod.nutriments || {};
        const calories = nutriments['energy-kcal_serving'] || nutriments['energy-kcal'] || 0;
        const protein = nutriments['proteins_serving'] || nutriments['proteins_100g'] || 0;
        const carbs = nutriments['carbohydrates_serving'] || nutriments['carbohydrates_100g'] || 0;
        const fat = nutriments['fat_serving'] || nutriments['fat_100g'] || 0;

        onFoodFound({
          foodName: `${name}${brand}`,
          calories: Math.round(Number(calories)),
          protein: parseFloat(Number(protein).toFixed(1)),
          carbs: parseFloat(Number(carbs).toFixed(1)),
          fat: parseFloat(Number(fat).toFixed(1)),
          servingSize: serving
        });
        stopCamera();
      } else {
        setScanError("Product not found in Open Food Facts database.");
      }
    } catch (err: any) {
      console.error(err);
      setScanError("Network error lookup up barcode.");
    } finally {
      setLoading(false);
    }
  };

  // Start Html5QrcodeScanner
  const startCamera = () => {
    setIsScanning(true);
    setScanError(null);
    // Delay initialization slightly to ensure container div is mounted
    setTimeout(() => {
      try {
        const scanner = new Html5QrcodeScanner(
          "qr-reader-container",
          { fps: 10, qrbox: { width: 250, height: 250 } },
          /* verbose= */ false
        );

        scanner.render(
          (decodedText) => {
            // Success call
            setBarcode(decodedText);
            scanner.clear();
            setIsScanning(false);
            lookupBarcode(decodedText);
          },
          (error) => {
            // Ignore ongoing frame noise
          }
        );
        scannerRef.current = scanner;
      } catch (err) {
        console.error("Camera setup failed:", err);
        setScanError("Camera access failed. Ensure permissions are allowed.");
        setIsScanning(false);
      }
    }, 100);
  };

  const stopCamera = () => {
    if (scannerRef.current) {
      try {
        scannerRef.current.clear();
      } catch (e) {
        console.error(e);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm text-center relative max-w-sm mx-auto">
      <button
        onClick={() => {
          stopCamera();
          onClose();
        }}
        className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-50 transition"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="mb-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700">Barcode Scanner</h3>
        <p className="text-[11px] text-gray-400 mt-1">Scan grocery items using your camera or enter manual code</p>
      </div>

      {scanError && (
        <div className="mb-3 bg-amber-50 text-amber-700 p-3 rounded-xl text-[11px] font-semibold border border-amber-100 flex items-center gap-1.5 justify-center">
          <AlertCircle className="w-4 h-4 text-amber-600" />
          <span>{scanError}</span>
        </div>
      )}

      {/* Camera Stage */}
      {isScanning ? (
        <div className="bg-gray-900 rounded-2xl overflow-hidden aspect-square flex flex-col justify-center items-center text-white p-4 relative mb-4">
          <div id="qr-reader-container" className="w-full h-full bg-black"></div>
          <button
            onClick={stopCamera}
            className="absolute bottom-4 bg-white/20 hover:bg-white/30 text-white font-semibold text-xs px-4 py-2 rounded-xl backdrop-blur-sm transition"
          >
            Cancel Camera
          </button>
        </div>
      ) : (
        <div className="bg-gray-50 p-6 rounded-2xl border border-dashed border-gray-200 flex flex-col items-center justify-center aspect-video mb-4">
          <Camera className="w-8 h-8 text-primary/40 mb-2" />
          <button
            onClick={startCamera}
            className="bg-primary hover:bg-primary-light text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm transition"
          >
            Enable Camera
          </button>
          <span className="text-[10px] text-gray-400 mt-1">Uses Open Food Facts DB</span>
        </div>
      )}

      {/* Manual Input Fallback */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="E.g., 737628011862"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={() => lookupBarcode(barcode)}
          disabled={loading || !barcode}
          className="bg-primary hover:bg-primary-light text-white font-medium px-4 rounded-xl text-xs flex items-center gap-1 shadow-sm disabled:opacity-50"
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Search className="w-4 h-4" /> Search
            </>
          )}
        </button>
      </div>
    </div>
  );
};
