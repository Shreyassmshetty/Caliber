import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Search, Plus, Sparkles, Camera, BookOpen, PenTool, Check, Trash2, HelpCircle, Mic } from 'lucide-react';
import { BarcodeScanner } from './BarcodeScanner';
import { AIFoodScanner } from './AIFoodScanner';
import { VoiceFoodInput } from './VoiceFoodInput';

export const FoodLogger = () => {
  const { logFood, customMeals, saveCustomMeal, deleteCustomMeal } = useApp();
  const apiBase = import.meta.env.VITE_API_BASE_URL || '';

  // Navigation tab inside food logger
  const [activeTab, setActiveTab] = useState('search');

  // Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Selected food item for logging configuration
  const [selectedFood, setSelectedFood] = useState(null);
  const [logMealType, setLogMealType] = useState('breakfast');
  const [logQuantity, setLogQuantity] = useState(1);
  const [customServing, setCustomServing] = useState('');

  // Manual Logger State
  const [manualName, setManualName] = useState('');
  const [manualCalories, setManualCalories] = useState('');
  const [manualProtein, setManualProtein] = useState('');
  const [manualCarbs, setManualCarbs] = useState('');
  const [manualSugar, setManualSugar] = useState('');
  const [manualFat, setManualFat] = useState('');
  const [manualServing, setManualServing] = useState('1 serving');
  const [manualCategory, setManualCategory] = useState('breakfast');

  // Recipe Builder States
  const [recipeName, setRecipeName] = useState('');
  const [recipeIngredients, setRecipeIngredients] = useState([]);
  const [recipeIngredientSearch, setRecipeIngredientSearch] = useState('');
  const [recipeSearchLoading, setRecipeSearchLoading] = useState(false);
  const [recipeSearchResults, setRecipeSearchResults] = useState([]);

  // Modals
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showAIScanner, setShowAIScanner] = useState(false);
  const [showVoiceInput, setShowVoiceInput] = useState(false);

  // Notification feedback
  const [notification, setNotification] = useState(null);

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification(null);
    }, 3000);
  };

  const performSearch = async (query) => {
    setSearchLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/food/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSearchLoading(false);
    }
  };

  // Run search whenever query changes (with simple debouncing)
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim().length > 1) {
        performSearch(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 350);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Handle direct item selection from standard search, scanner, or OCR
  const handleSelectFood = (food) => {
    setSelectedFood({
      foodName: food.foodName,
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      sugar: food.sugar || 0,
      servingSize: food.servingSize
    });
    setLogQuantity(1);
    setCustomServing(food.servingSize);
  };

  const handleConfirmLog = async () => {
    if (!selectedFood) return;

    const finalLogged = {
      foodName: selectedFood.foodName,
      calories: Number(selectedFood.calories),
      protein: Number(selectedFood.protein || 0),
      carbs: Number(selectedFood.carbs || 0),
      fat: Number(selectedFood.fat || 0),
      sugar: Number(selectedFood.sugar || 0),
      servingSize: customServing || selectedFood.servingSize,
      quantity: Number(logQuantity),
      mealType: logMealType,
      loggedAt: new Date().toISOString()
    };

    const success = await logFood(finalLogged);
    if (success) {
      showNotification(`Logged "${selectedFood.foodName}" successfully!`);
      setSelectedFood(null);
      setSearchQuery('');
    } else {
      showNotification("Error logging food. Please try again.");
    }
  };

  // Manual Log Submission
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualName || !manualCalories) return;

    const payload = {
      foodName: manualName,
      calories: Number(manualCalories),
      protein: Number(manualProtein || 0),
      carbs: Number(manualCarbs || 0),
      sugar: Number(manualSugar || 0),
      fat: Number(manualFat || 0),
      servingSize: manualServing || "1 serving",
      quantity: 1,
      mealType: manualCategory,
      loggedAt: new Date().toISOString()
    };

    const success = await logFood(payload);
    if (success) {
      showNotification(`Logged manual "${manualName}" successfully!`);
      // Clear manual fields
      setManualName('');
      setManualCalories('');
      setManualProtein('');
      setManualCarbs('');
      setManualSugar('');
      setManualFat('');
      setManualServing('1 serving');
    }
  };

  // Recipe Builder Handlers
  const handleRecipeSearch = async (e) => {
    const val = e.target.value;
    setRecipeIngredientSearch(val);
    if (val.trim().length > 1) {
      setRecipeSearchLoading(true);
      try {
        const res = await fetch(`${apiBase}/api/food/search?q=${encodeURIComponent(val)}`);
        if (res.ok) {
          const data = await res.json();
          setRecipeSearchResults(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setRecipeSearchLoading(false);
      }
    } else {
      setRecipeSearchResults([]);
    }
  };

  const addIngredientToRecipe = (food) => {
    setRecipeIngredients(prev => [
      ...prev,
      {
        foodName: food.foodName,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        servingSize: food.servingSize,
        quantity: 1
      }
    ]);
    setRecipeIngredientSearch('');
    setRecipeSearchResults([]);
  };

  const updateIngredientQty = (index, qty) => {
    setRecipeIngredients(prev => {
      const copy = [...prev];
      copy[index].quantity = Math.max(0.1, qty);
      return copy;
    });
  };

  const removeIngredientFromRecipe = (index) => {
    setRecipeIngredients(prev => prev.filter((_, i) => i !== index));
  };

  const calculateRecipeTotals = () => {
    return recipeIngredients.reduce(
      (totals, ing) => {
        totals.calories += ing.calories * ing.quantity;
        totals.protein += ing.protein * ing.quantity;
        totals.carbs += ing.carbs * ing.quantity;
        totals.fat += ing.fat * ing.quantity;
        return totals;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  };

  const recipeTotals = calculateRecipeTotals();

  const handleSaveRecipe = async () => {
    if (!recipeName || recipeIngredients.length === 0) return;

    const payload = {
      mealName: recipeName,
      ingredients: recipeIngredients,
      totalCalories: recipeTotals.calories,
      totalProtein: recipeTotals.protein,
      totalCarbs: recipeTotals.carbs,
      totalFat: recipeTotals.fat
    };

    const success = await saveCustomMeal(payload);
    if (success) {
      showNotification(`Saved recipe "${recipeName}"!`);
      setRecipeName('');
      setRecipeIngredients([]);
      setActiveTab('recipes');
    }
  };

  // Log saved custom recipe directly
  const handleLogSavedRecipe = async (meal) => {
    const payload = {
      foodName: meal.mealName,
      calories: meal.totalCalories,
      protein: meal.totalProtein,
      carbs: meal.totalCarbs,
      fat: meal.totalFat,
      servingSize: "1 custom recipe portion",
      quantity: 1,
      mealType: logMealType, // uses current dashboard log category
      loggedAt: new Date().toISOString()
    };

    const success = await logFood(payload);
    if (success) {
      showNotification(`Logged recipe "${meal.mealName}" under ${logMealType}!`);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 pb-12 space-y-4">
      {/* Toast alert */}
      {notification && (
        <div className="fixed bottom-18 left-1/2 -translate-x-1/2 bg-neutral-dark text-white text-xs px-4 py-3 rounded-xl shadow-lg border border-gray-700 z-50 animate-bounce">
          {notification}
        </div>
      )}

      {/* Top inner-tabs nav bar */}
      <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-gray-100 text-xs">
        <button
          onClick={() => {
            setActiveTab('search');
            setSelectedFood(null);
          }}
          className={`flex-1 py-2 rounded-xl font-bold transition flex items-center justify-center gap-1 ${
            activeTab === 'search' ? 'bg-primary text-white' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Search className="w-3.5 h-3.5" /> FDC Search
        </button>
        <button
          onClick={() => setActiveTab('manual')}
          className={`flex-1 py-2 rounded-xl font-bold transition flex items-center justify-center gap-1 ${
            activeTab === 'manual' ? 'bg-primary text-white' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <PenTool className="w-3.5 h-3.5" /> Manual
        </button>
        <button
          onClick={() => setActiveTab('builder')}
          className={`flex-1 py-2 rounded-xl font-bold transition flex items-center justify-center gap-1 ${
            activeTab === 'builder' ? 'bg-primary text-white' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Plus className="w-3.5 h-3.5" /> Builder
        </button>
        <button
          onClick={() => setActiveTab('recipes')}
          className={`flex-1 py-2 rounded-xl font-bold transition flex items-center justify-center gap-1 ${
            activeTab === 'recipes' ? 'bg-primary text-white' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" /> Recipes
        </button>
      </div>

      {/* MODALS FOR CAMERA WORKFLOWS */}
      {showBarcodeScanner && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <BarcodeScanner
            onFoodFound={(food) => {
              handleSelectFood(food);
              setShowBarcodeScanner(false);
            }}
            onClose={() => setShowBarcodeScanner(false)}
          />
        </div>
      )}

      {showAIScanner && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <AIFoodScanner
            onFoodFound={(food) => {
              handleSelectFood(food);
              setShowAIScanner(false);
            }}
            onClose={() => setShowAIScanner(false)}
          />
        </div>
      )}

      {showVoiceInput && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <VoiceFoodInput
            onFoodFound={(food) => {
              handleSelectFood(food);
              setShowVoiceInput(false);
            }}
            onClose={() => setShowVoiceInput(false)}
          />
        </div>
      )}

      {/* VIEW DRAWERS */}

      {/* Tab 1: FDC Search Interface */}
      {activeTab === 'search' && !selectedFood && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
              <input
                type="text"
                placeholder="Search USDA database & common foods..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Smart Addon Buttons */}
            <button
              onClick={() => setShowVoiceInput(true)}
              className="bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 p-2.5 rounded-xl transition flex items-center justify-center"
              title="Describe meal by voice with AI"
            >
              <Mic className="w-5 h-5" />
            </button>

            <button
              onClick={() => setShowAIScanner(true)}
              className="bg-purple-50 text-purple-600 border border-purple-200 hover:bg-purple-100 p-2.5 rounded-xl transition flex items-center justify-center"
              title="Snap & Log food with AI"
            >
              <Camera className="w-5 h-5" />
            </button>

            <button
              onClick={() => setShowBarcodeScanner(true)}
              className="bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 p-2.5 rounded-xl transition flex items-center justify-center"
              title="Scan Grocery Barcode"
            >
              <BookOpen className="w-5 h-5" />
            </button>
          </div>

          {searchLoading ? (
            <div className="flex justify-center items-center py-12">
              <span className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></span>
            </div>
          ) : searchResults.length > 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50 overflow-hidden">
              {searchResults.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelectFood(item)}
                  className="p-3 hover:bg-gray-50 transition cursor-pointer flex justify-between items-center text-xs"
                >
                  <div className="flex-1 pr-3">
                    <span className="font-semibold text-gray-800 block truncate">{item.foodName}</span>
                    <span className="text-[10px] text-gray-400 mt-0.5 block">
                      Serving: {item.servingSize} • P:{Math.round(item.protein)}g C:{Math.round(item.carbs)}g F:{Math.round(item.fat)}g
                    </span>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <div>
                      <span className="font-bold text-gray-700 block">{item.calories}</span>
                      <span className="text-[9px] text-gray-400 block uppercase font-medium">kcal</span>
                    </div>
                    <span className="text-[10px] bg-primary/5 text-primary py-0.5 px-2 rounded-md font-semibold">
                      {item.source === 'USDA FDC' ? 'USDA' : 'Common'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : searchQuery.trim() ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500">No matching food found in database.</p>
              <p className="text-[11px] text-gray-400 mt-1">Try refining search or use "Manual" tab to add custom values.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Voice AI Meal Logger Card */}
              <div
                onClick={() => setShowVoiceInput(true)}
                className="bg-gradient-to-r from-rose-50 to-indigo-50 border border-rose-100 hover:border-rose-200 p-4 rounded-2xl cursor-pointer transition flex items-center justify-between group shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-rose-500 text-white p-2.5 rounded-xl group-hover:scale-105 transition shadow-sm">
                    <Mic className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-gray-800 flex items-center gap-1">
                      Voice Meal Description <Sparkles className="w-3.5 h-3.5 text-rose-500" />
                    </h4>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      "I had 2 eggs, avocado toast, and a coffee..."
                    </p>
                  </div>
                </div>
                <span className="text-[10px] bg-rose-600 text-white px-2.5 py-1 rounded-lg font-bold shadow-sm">
                  Speak
                </span>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-gray-100 space-y-4">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-gray-400 mb-1">Quick Presets</h4>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { name: "Coffee with Milk", cal: 45, p: 2, c: 4, f: 2, s: "1 cup" },
                    { name: "Scrambled Eggs (2)", cal: 180, p: 12, c: 2, f: 14, s: "2 large eggs" },
                    { name: "Snack Almonds", cal: 160, p: 6, c: 6, f: 14, s: "28g" },
                    { name: "Whey Shake", cal: 120, p: 24, c: 3, f: 1.5, s: "1 scoop in water" }
                  ].map((item, index) => (
                  <button
                    key={index}
                    onClick={() => handleSelectFood({
                      foodName: item.name,
                      calories: item.cal,
                      protein: item.p,
                      carbs: item.c,
                      fat: item.f,
                      servingSize: item.s
                    })}
                    className="p-3 text-left bg-gray-50 rounded-xl hover:bg-gray-100 border border-gray-100 transition"
                  >
                    <span className="font-bold text-[11px] text-gray-700 block truncate">{item.name}</span>
                    <span className="text-[10px] text-primary font-semibold block mt-1">{item.cal} kcal</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          )}
        </div>
      )}

      {/* EXPANDED LOGGING DRAWER (Once a food item is picked) */}
      {selectedFood && (
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] bg-primary/10 text-primary py-0.5 px-2 rounded-md font-bold uppercase tracking-wider">Confirm Log</span>
              <h3 className="text-sm font-bold text-neutral-dark mt-1.5">{selectedFood.foodName}</h3>
            </div>
            <button
              onClick={() => setSelectedFood(null)}
              className="text-xs text-gray-400 hover:text-gray-600 font-semibold"
            >
              Clear
            </button>
          </div>

          {/* Quick macro brief */}
          <div className="grid grid-cols-5 gap-1.5 bg-gray-50 p-2.5 rounded-xl text-center text-[11px]">
            <div>
              <span className="text-[9px] text-gray-400 block uppercase font-medium">Calories</span>
              <span className="font-bold text-gray-700">{Math.round(selectedFood.calories * logQuantity)} kcal</span>
            </div>
            <div>
              <span className="text-[9px] text-gray-400 block uppercase font-medium">Protein</span>
              <span className="font-bold text-emerald-600">{Math.round((selectedFood.protein || 0) * logQuantity)}g</span>
            </div>
            <div>
              <span className="text-[9px] text-gray-400 block uppercase font-medium">Carbs</span>
              <span className="font-bold text-amber-600">{Math.round((selectedFood.carbs || 0) * logQuantity)}g</span>
            </div>
            <div>
              <span className="text-[9px] text-gray-400 block uppercase font-medium">Sugar</span>
              <span className="font-bold text-pink-600">{Math.round((selectedFood.sugar || 0) * logQuantity)}g</span>
            </div>
            <div>
              <span className="text-[9px] text-gray-400 block uppercase font-medium">Fat</span>
              <span className="font-bold text-rose-500">{Math.round((selectedFood.fat || 0) * logQuantity)}g</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Serving portion</label>
                <input
                  type="text"
                  value={customServing}
                  onChange={(e) => setCustomServing(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Quantity / Servings</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={logQuantity}
                  onChange={(e) => setLogQuantity(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Category / Meal</label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: 'breakfast', label: '🍳 Bfast' },
                  { id: 'lunch', label: '🥗 Lunch' },
                  { id: 'dinner', label: '🥩 Dinner' },
                  { id: 'snack', label: '🍎 Snack' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setLogMealType(item.id)}
                    className={`py-2 text-[11px] font-semibold rounded-xl text-center transition ${
                      logMealType === item.id ? 'bg-primary text-white shadow-sm' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleConfirmLog}
              className="w-full bg-primary hover:bg-primary-light text-white font-bold py-3 rounded-xl shadow-sm transition text-xs flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" /> Log {Math.round(selectedFood.calories * logQuantity)} kcal
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: Manual Log Entry Form */}
      {activeTab === 'manual' && (
        <form onSubmit={handleManualSubmit} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-neutral-dark">Add Custom Log Entry</h3>

          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Food item name</label>
              <input
                type="text"
                required
                placeholder="E.g. Grilled Sandwich"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Calories (kcal)</label>
                <input
                  type="number"
                  required
                  placeholder="E.g. 320"
                  value={manualCalories}
                  onChange={(e) => setManualCalories(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-gray-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Portion size</label>
                <input
                  type="text"
                  placeholder="E.g. 1 plate, 150g"
                  value={manualServing}
                  onChange={(e) => setManualServing(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-gray-200 focus:outline-none"
                />
              </div>
            </div>

            {/* Macros group */}
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Protein (g)</label>
                <input
                  type="number"
                  placeholder="Optional"
                  value={manualProtein}
                  onChange={(e) => setManualProtein(e.target.value)}
                  className="w-full px-2 py-2.5 text-xs rounded-xl border border-gray-200 focus:outline-none text-center"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Carbs (g)</label>
                <input
                  type="number"
                  placeholder="Optional"
                  value={manualCarbs}
                  onChange={(e) => setManualCarbs(e.target.value)}
                  className="w-full px-2 py-2.5 text-xs rounded-xl border border-gray-200 focus:outline-none text-center"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Sugar (g)</label>
                <input
                  type="number"
                  placeholder="Optional"
                  value={manualSugar}
                  onChange={(e) => setManualSugar(e.target.value)}
                  className="w-full px-2 py-2.5 text-xs rounded-xl border border-gray-200 focus:outline-none text-center"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Fat (g)</label>
                <input
                  type="number"
                  placeholder="Optional"
                  value={manualFat}
                  onChange={(e) => setManualFat(e.target.value)}
                  className="w-full px-2 py-2.5 text-xs rounded-xl border border-gray-200 focus:outline-none text-center"
                />
              </div>
            </div>

            {/* Log Target Meal type */}
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Meal category</label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: 'Breakfast', label: 'Breakfast' },
                  { id: 'Lunch', label: 'Lunch' },
                  { id: 'Dinner', label: 'Dinner' },
                  { id: 'Snack', label: 'Snack' }
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setManualCategory(item.id)}
                    className={`py-2 text-[11px] font-semibold rounded-xl text-center transition ${
                      manualCategory === item.id ? 'bg-primary text-white shadow-sm' : 'bg-gray-50 text-gray-600'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-primary hover:bg-primary-light text-white font-bold py-3 rounded-xl transition text-xs shadow-sm flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" /> Save & Log Food
            </button>
          </div>
        </form>
      )}

      {/* Tab 3: Custom Recipe Builder */}
      {activeTab === 'builder' && (
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <div className="border-b border-gray-50 pb-2">
            <h3 className="text-sm font-bold text-neutral-dark">Custom Recipe Builder</h3>
            <p className="text-[10px] text-gray-400">Save custom multi-ingredient meals for quick, 1-tap logging</p>
          </div>

          <div className="space-y-3">
            {/* Recipe Name */}
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Recipe Name</label>
              <input
                type="text"
                placeholder="E.g. Daily Protein Smoothie"
                value={recipeName}
                onChange={(e) => setRecipeName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* List of current recipe ingredients */}
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">
                Ingredients ({recipeIngredients.length})
              </label>

              {recipeIngredients.length === 0 ? (
                <p className="text-[11px] text-gray-400 italic bg-gray-50 p-3 rounded-xl border border-dashed border-gray-100">
                  Search & add ingredients below.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {recipeIngredients.map((ing, index) => (
                    <div key={index} className="flex justify-between items-center bg-gray-50/50 p-2 rounded-xl text-[11px] border border-gray-100">
                      <div className="flex-1 min-w-0 pr-2">
                        <span className="font-semibold text-gray-700 block truncate">{ing.foodName}</span>
                        <span className="text-[9px] text-gray-400">
                          {Math.round(ing.calories * ing.quantity)} cal ({ing.servingSize})
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0.1"
                          step="0.1"
                          value={ing.quantity}
                          onChange={(e) => updateIngredientQty(index, Number(e.target.value))}
                          className="w-12 px-1.5 py-0.5 text-center text-[10px] rounded border border-gray-200"
                        />
                        <button
                          onClick={() => removeIngredientFromRecipe(index)}
                          className="p-1 text-gray-300 hover:text-red-500 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Dynamic summary totals preview */}
            {recipeIngredients.length > 0 && (
              <div className="bg-primary/5 p-3 rounded-xl border border-primary/10 text-center text-xs">
                <div className="font-bold text-[10px] text-primary uppercase tracking-wider mb-1.5">Recipe Totals</div>
                <div className="grid grid-cols-4 gap-1 font-bold text-gray-700 text-[11px]">
                  <div>
                    <span className="text-[9px] text-gray-400 block font-normal uppercase">Calories</span>
                    <span>{Math.round(recipeTotals.calories)} cal</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-400 block font-normal uppercase">Protein</span>
                    <span>{Math.round(recipeTotals.protein)}g</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-400 block font-normal uppercase">Carbs</span>
                    <span>{Math.round(recipeTotals.carbs)}g</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-400 block font-normal uppercase">Fat</span>
                    <span>{Math.round(recipeTotals.fat)}g</span>
                  </div>
                </div>
              </div>
            )}

            {/* Search Ingredient field */}
            <div className="relative">
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Search & Add Ingredient</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Type to search ingredients..."
                  value={recipeIngredientSearch}
                  onChange={handleRecipeSearch}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-xs focus:outline-none"
                />
              </div>

              {recipeSearchLoading ? (
                <div className="absolute right-3 top-7.5">
                  <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin block"></span>
                </div>
              ) : null}

              {recipeSearchResults.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto z-20 text-[11px]">
                  {recipeSearchResults.map((food, idx) => (
                    <div
                      key={idx}
                      onClick={() => addIngredientToRecipe(food)}
                      className="p-2.5 hover:bg-gray-50 cursor-pointer transition flex justify-between border-b border-gray-50"
                    >
                      <span className="font-medium text-gray-700 truncate pr-2">{food.foodName}</span>
                      <span className="font-bold text-primary shrink-0">{food.calories} cal</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={handleSaveRecipe}
              disabled={!recipeName || recipeIngredients.length === 0}
              className="w-full bg-primary hover:bg-primary-light text-white font-bold py-3 rounded-xl shadow-sm transition text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Custom Recipe
            </button>
          </div>
        </div>
      )}

      {/* Tab 4: My Saved Recipes List */}
      {activeTab === 'recipes' && (
        <div className="space-y-3">
          {/* Active Category choice indicator */}
          <div className="bg-white p-3 rounded-2xl border border-gray-100 flex items-center justify-between text-xs">
            <span className="font-bold text-gray-500 uppercase tracking-wide">Target Category:</span>
            <div className="flex gap-1">
              {[
                { id: 'breakfast', label: '🍳 Bfast' },
                { id: 'lunch', label: '🥗 Lunch' },
                { id: 'dinner', label: '🥩 Dinner' },
                { id: 'snack', label: '🍎 Snack' }
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setLogMealType(item.id)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                    logMealType === item.id ? 'bg-primary/15 text-primary' : 'bg-gray-50 text-gray-500'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {customMeals.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-3xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500">No saved recipes yet.</p>
              <button
                onClick={() => setActiveTab('builder')}
                className="mt-3 bg-primary text-white text-xs font-bold px-4 py-2 rounded-xl"
              >
                Open Recipe Builder
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {customMeals.map((meal) => (
                <div key={meal.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-bold text-xs text-gray-800">{meal.mealName}</h4>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {meal.ingredients?.length || 0} ingredients • P:{Math.round(meal.totalProtein)}g C:{Math.round(meal.totalCarbs)}g F:{Math.round(meal.totalFat)}g
                      </p>
                    </div>
                    <button
                      onClick={() => deleteCustomMeal(meal.id)}
                      className="p-1 text-gray-300 hover:text-red-500 rounded transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-gray-50 mt-1.5 text-xs">
                    <span className="font-bold text-primary">{Math.round(meal.totalCalories)} kcal</span>
                    <button
                      onClick={() => handleLogSavedRecipe(meal)}
                      className="bg-primary hover:bg-primary-light text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-sm transition"
                    >
                      1-Tap Log
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
