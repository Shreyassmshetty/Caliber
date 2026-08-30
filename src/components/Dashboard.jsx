import React, { useState } from 'react';
import { useApp, getLocalDateString, formatCalories } from '../context/AppContext';
import { ChevronLeft, ChevronRight, Droplet, Dumbbell, Flame, Plus, Trash2, Calendar, Coffee, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

export const Dashboard = ({ setActiveTab }) => {
  const {
    user,
    selectedDate,
    setSelectedDate,
    foodEntries,
    exercises,
    waterLog,
    updateWater,
    deleteFoodLog,
    deleteExerciseLog
  } = useApp();

  const [dateOffset, setDateOffset] = useState(0);

  // Parse calorie targets
  const calorieTarget = user?.profile?.dailyCalorieTarget || 2000;
  const hideRemaining = user?.profile?.hideCaloriesRemaining || false;

  const proteinPct = user?.profile?.macroProteinPercentage || 30;
  const carbsPct = user?.profile?.macroCarbsPercentage || 45;
  const fatPct = user?.profile?.macroFatPercentage || 25;

  // Calculate actual totals
  const totalFoodCalories = foodEntries.reduce((sum, item) => sum + (item.calories * item.quantity), 0);
  const totalExerciseCalories = exercises.reduce((sum, item) => sum + item.caloriesBurned, 0);
  const netCalories = totalFoodCalories - totalExerciseCalories;
  const remainingCalories = calorieTarget - totalFoodCalories + totalExerciseCalories;

  const totalProtein = foodEntries.reduce((sum, item) => sum + (item.protein * item.quantity), 0);
  const totalCarbs = foodEntries.reduce((sum, item) => sum + (item.carbs * item.quantity), 0);
  const totalFat = foodEntries.reduce((sum, item) => sum + (item.fat * item.quantity), 0);
  const totalSugar = foodEntries.reduce((sum, item) => sum + ((item.sugar || 0) * item.quantity), 0);

  // Target macros in grams
  const targetProteinGrams = Math.round((calorieTarget * (proteinPct / 100)) / 4);
  const targetCarbsGrams = Math.round((calorieTarget * (carbsPct / 100)) / 4);
  const targetFatGrams = Math.round((calorieTarget * (fatPct / 100)) / 9);

  // Shift date handler
  const shiftDate = (days) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    const newDateStr = getLocalDateString(current);
    setSelectedDate(newDateStr);
  };

  // Water logs
  const glasses = waterLog?.glasses || 0;
  const handleWaterUpdate = (change) => {
    const newCount = Math.max(0, glasses + change);
    updateWater(newCount);
  };

  // Dynamic progress percentage for visual rings
  const foodPercentage = Math.min(100, Math.round((totalFoodCalories / calorieTarget) * 100));
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (foodPercentage / 100) * circumference;

  // Meal lists helper
  const renderMealSection = (title, category, icon) => {
    const meals = foodEntries.filter(item => {
      const type = (item.mealType || '').toLowerCase();
      const cat = category.toLowerCase();
      if (cat === 'snacks') {
        return type === 'snack' || type === 'snacks';
      }
      return type === cat;
    });
    const categoryCalories = meals.reduce((sum, item) => sum + (item.calories * item.quantity), 0);

    return (
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-3">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm">{icon}</span>
            <span className="font-semibold text-xs text-gray-700 uppercase tracking-wide">{title}</span>
          </div>
          <span className="text-xs font-bold text-gray-500">{formatCalories(categoryCalories)} kcal</span>
        </div>

        {meals.length === 0 ? (
          <p className="text-[11px] text-gray-400 italic">No food logged yet.</p>
        ) : (
          <div className="space-y-1.5 divide-y divide-gray-50">
            {meals.map((meal) => (
              <div key={meal.id} className="flex justify-between items-center pt-1.5 text-xs">
                <div>
                  <span className="font-medium text-gray-800">{meal.foodName}</span>
                  <span className="text-[10px] text-gray-400 block">
                    {meal.quantity} × {meal.servingSize} • P:{Math.round(meal.protein)}g C:{Math.round(meal.carbs)}g F:{Math.round(meal.fat)}g S:{Math.round(meal.sugar || 0)}g
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-600">{formatCalories(meal.calories * meal.quantity)} kcal</span>
                  <button
                    onClick={() => deleteFoodLog(meal.id)}
                    className="p-1 text-gray-300 hover:text-red-500 rounded transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Render nicely formatted selected date display
  const getFormattedDateDisplay = () => {
    const todayStr = getLocalDateString();
    const yesStr = getLocalDateString(new Date(Date.now() - 86400000));

    if (selectedDate === todayStr) return "Today";
    if (selectedDate === yesStr) return "Yesterday";

    const parts = selectedDate.split('-');
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    let greeting = 'Good morning';
    if (hour >= 12 && hour < 17) {
      greeting = 'Good afternoon';
    } else if (hour >= 17 && hour < 21) {
      greeting = 'Good evening';
    } else if (hour >= 21 || hour < 4) {
      greeting = 'Good night';
    }

    const nameToUse = user?.profile?.name || (user?.email ? user.email.split('@')[0] : 'there');
    const formattedName = user?.profile?.name ? nameToUse : nameToUse.charAt(0).toUpperCase() + nameToUse.slice(1);

    return `${greeting}, ${formattedName}!`;
  };

  return (
    <div className="max-w-md mx-auto px-4 pb-12 space-y-5">
      {/* Greeting */}
      <div className="pt-2">
        <h2 className="text-xl font-black text-gray-800">{getGreeting()}</h2>
        <p className="text-xs text-gray-500 mt-1">Here is your daily summary.</p>
      </div>

      {/* Date Toggle Header */}
      <div className="flex justify-between items-center bg-white p-3 rounded-2xl shadow-sm border border-gray-100">
        <button
          onClick={() => shiftDate(-1)}
          className="p-2 hover:bg-gray-50 rounded-xl transition text-gray-500"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-sm font-bold text-neutral-dark">
          <Calendar className="w-4 h-4 text-primary" />
          <span>{getFormattedDateDisplay()}</span>
        </div>

        <button
          onClick={() => shiftDate(1)}
          className="p-2 hover:bg-gray-50 rounded-xl transition text-gray-500"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Main Rings / Circular Progress Widget */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 text-center relative overflow-hidden">
        {/* Top small counters */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-gray-50/50 p-2 rounded-xl text-center">
            <span className="text-[10px] text-gray-400 block uppercase font-semibold">Logged</span>
            <span className="text-sm font-bold text-gray-700">{formatCalories(totalFoodCalories)}</span>
            <span className="text-[9px] text-gray-400"> kcal</span>
          </div>
          <div className="bg-gray-50/50 p-2 rounded-xl text-center">
            <span className="text-[10px] text-gray-400 block uppercase font-semibold">Active</span>
            <span className="text-sm font-bold text-gray-700">+{formatCalories(totalExerciseCalories)}</span>
            <span className="text-[9px] text-gray-400"> kcal</span>
          </div>
          <div className="bg-gray-50/50 p-2 rounded-xl text-center">
            <span className="text-[10px] text-gray-400 block uppercase font-semibold">Budget</span>
            <span className="text-sm font-bold text-gray-700">{formatCalories(calorieTarget)}</span>
            <span className="text-[9px] text-gray-400"> kcal</span>
          </div>
        </div>

        {/* Dynamic Circle SVG */}
        <div className="relative inline-flex items-center justify-center my-2">
          <svg className="w-40 h-40">
            {/* Background ring */}
            <circle
              className="text-gray-100"
              strokeWidth="10"
              stroke="currentColor"
              fill="transparent"
              r={radius}
              cx="80"
              cy="80"
            />
            {/* Active ring */}
            <circle
              className="text-primary progress-ring-circle"
              strokeWidth="10"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              stroke="currentColor"
              fill="transparent"
              r={radius}
              cx="80"
              cy="80"
            />
          </svg>

          {/* Central calorie label */}
          <div className="absolute inset-0 flex flex-col justify-center items-center">
            {hideRemaining ? (
              <>
                <span className="text-xs text-gray-400 uppercase font-semibold">Logged</span>
                <span className="text-2xl font-black text-neutral-dark">{foodPercentage}%</span>
                <span className="text-[10px] text-primary font-medium mt-0.5">of day target</span>
              </>
            ) : (
              <>
                <span className="text-xs text-gray-400 uppercase font-semibold">Remaining</span>
                <span className={`text-2xl font-black ${remainingCalories < 0 ? 'text-amber-600' : 'text-neutral-dark'}`}>
                  {formatCalories(remainingCalories)}
                </span>
                <span className="text-[10px] text-gray-400">kcal</span>
              </>
            )}
          </div>
        </div>

        {/* Encouraging caption */}
        <div className="mt-4 flex items-center justify-center gap-1.5 bg-brand-bg/25 py-2 px-4 rounded-xl border border-primary/5 text-xs text-primary font-medium">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>
            {remainingCalories >= 0 
              ? `You're doing great! Keep locking your meals.` 
              : `A bit over your target, active exercise helps balance your day!`
            }
          </span>
        </div>
      </div>

      {/* Macros Tracker */}
      <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Macronutrients</h3>

        <div className="space-y-3">
          {/* Protein */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-semibold text-gray-600 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Protein
              </span>
              <span className="text-gray-400">
                <strong className="text-gray-700">{Math.round(totalProtein)}g</strong> / {targetProteinGrams}g
              </span>
            </div>
            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-500 h-2 rounded-full transition-all" 
                style={{ width: `${Math.min(100, (totalProtein / (targetProteinGrams || 1)) * 100)}%` }}
              />
            </div>
          </div>

          {/* Carbs */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-semibold text-gray-600 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span> Carbohydrates
              </span>
              <span className="text-gray-400">
                <strong className="text-gray-700">{Math.round(totalCarbs)}g</strong> / {targetCarbsGrams}g
              </span>
            </div>
            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-amber-500 h-2 rounded-full transition-all" 
                style={{ width: `${Math.min(100, (totalCarbs / (targetCarbsGrams || 1)) * 100)}%` }}
              />
            </div>
          </div>

          {/* Fat */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-semibold text-gray-600 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-400"></span> Fats
              </span>
              <span className="text-gray-400">
                <strong className="text-gray-700">{Math.round(totalFat)}g</strong> / {targetFatGrams}g
              </span>
            </div>
            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-rose-400 h-2 rounded-full transition-all" 
                style={{ width: `${Math.min(100, (totalFat / (targetFatGrams || 1)) * 100)}%` }}
              />
            </div>
          </div>

          {/* Sugar */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-semibold text-gray-600 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-pink-500"></span> Sugar
              </span>
              <span className="text-gray-400">
                <strong className="text-gray-700">{Math.round(totalSugar)}g</strong>
              </span>
            </div>
            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-pink-500 h-2 rounded-full transition-all" 
                style={{ width: `${Math.min(100, (totalSugar / 50) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Water Hydration Counter */}
      <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Water Hydration</h3>
          <p className="text-[11px] text-gray-400">Daily intake target: 8 glasses (2L)</p>

          <div className="flex gap-1.5 mt-3">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
              <Droplet
                key={num}
                className={`w-5.5 h-5.5 transition-colors ${
                  num <= glasses ? 'fill-blue-500 text-blue-500' : 'text-gray-200'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 bg-blue-50 p-2 rounded-2xl border border-blue-100">
          <button
            onClick={() => handleWaterUpdate(-1)}
            className="w-8 h-8 rounded-xl bg-white border border-blue-200 flex items-center justify-center font-bold text-blue-700 hover:bg-blue-100/50 active:scale-95 transition text-sm"
          >
            -
          </button>
          <span className="font-black text-blue-700 min-w-4 text-center text-sm">{glasses}</span>
          <button
            onClick={() => handleWaterUpdate(1)}
            className="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center font-bold hover:bg-primary-light active:scale-95 transition text-sm"
          >
            +
          </button>
        </div>
      </div>

      {/* Exercises Section */}
      <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Physical Activity</h3>
          <button
            onClick={() => setActiveTab('exercise')}
            className="text-[11px] font-bold text-primary hover:text-primary-light flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Log Active
          </button>
        </div>

        {exercises.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No exercise logs today.</p>
        ) : (
          <div className="space-y-2">
            {exercises.map((item) => (
              <div key={item.id} className="flex justify-between items-center p-2.5 rounded-xl bg-gray-50/50 border border-gray-100 text-xs">
                <div className="flex items-center gap-2">
                  <span className="bg-blue-50 text-blue-600 p-2 rounded-lg">
                    <Dumbbell className="w-4 h-4" />
                  </span>
                  <div>
                    <span className="font-semibold text-gray-700 block">{item.activityType}</span>
                    <span className="text-[10px] text-gray-400">{item.durationMinutes} minutes active</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-amber-600">-{formatCalories(item.caloriesBurned)} kcal</span>
                  <button
                    onClick={() => deleteExerciseLog(item.id)}
                    className="p-1 text-gray-300 hover:text-red-500 rounded transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Logging Overview (Meals) */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Meal Categories</h3>
          <button
            onClick={() => setActiveTab('food')}
            className="text-[11px] font-bold text-primary hover:text-primary-light flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add Food
          </button>
        </div>

        {renderMealSection("🍳 Breakfast", "breakfast", "🍳")}
        {renderMealSection("🥗 Lunch", "lunch", "🥗")}
        {renderMealSection("🥩 Dinner", "dinner", "🥩")}
        {renderMealSection("🍎 Snacks", "snacks", "🍎")}
      </div>
    </div>
  );
};
