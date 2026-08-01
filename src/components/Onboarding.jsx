import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ChevronRight, ChevronLeft, Calculator, Target, Sparkles, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const Onboarding = () => {
  const { updateProfile, loading, error } = useApp();
  const [step, setStep] = useState(1);
  const [unitSystem, setUnitSystem] = useState('metric');

  // Metric fields
  const [name, setName] = useState('');
  const [age, setAge] = useState('28');
  const [weightKg, setWeightKg] = useState('75');
  const [heightCm, setHeightCm] = useState('175');

  // Imperial fields
  const [weightLbs, setWeightLbs] = useState('165');
  const [heightFt, setHeightFt] = useState('5');
  const [heightIn, setHeightIn] = useState('9');

  const [sex, setSex] = useState('male');
  const [activityLevel, setActivityLevel] = useState('moderate');
  const [goal, setGoal] = useState('lose');

  const [customCalorieTarget, setCustomCalorieTarget] = useState('');

  // Get finalized metric values for Mifflin-St Jeor
  const getFinalMetrics = () => {
    let finalWeight = Number(weightKg);
    let finalHeight = Number(heightCm);

    if (unitSystem === 'imperial') {
      finalWeight = Number(weightLbs) / 2.20462;
      finalHeight = (Number(heightFt) * 12 + Number(heightIn)) * 2.54;
    }

    return {
      weight: parseFloat(finalWeight.toFixed(1)),
      height: parseFloat(finalHeight.toFixed(1)),
      age: Number(age)
    };
  };

  // Preview target based on Mifflin-St Jeor
  const calculatePreviewTarget = () => {
    const { weight, height, age: finalAge } = getFinalMetrics();
    if (!weight || !height || !finalAge) return 2000;

    let bmr = 0;
    if (sex === 'male') {
      bmr = 10 * weight + 6.25 * height - 5 * finalAge + 5;
    } else {
      bmr = 10 * weight + 6.25 * height - 5 * finalAge - 161;
    }

    const multipliers = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      very_active: 1.9
    };
    const tdee = bmr * (multipliers[activityLevel] || 1.2);

    let target = tdee;
    if (goal === 'lose') {
      target = tdee - 500;
      if (target < 1200) target = 1200;
    } else if (goal === 'gain') {
      target = tdee + 500;
    }

    return Math.round(target);
  };

  const previewCalorieTarget = calculatePreviewTarget();

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleFinish = async () => {
    const { weight, height, age: finalAge } = getFinalMetrics();

    // Standard Protein 30%, Carbs 45%, Fat 25% splits depending on goal
    let protein = 30;
    let carbs = 45;
    let fat = 25;

    if (goal === 'gain') {
      protein = 25;
      carbs = 50;
      fat = 25;
    } else if (goal === 'lose') {
      protein = 35;
      carbs = 40;
      fat = 25;
    }

    const payload= {
      name: name.trim() || undefined,
      age,
      weight,
      height,
      sex,
      activityLevel,
      goal,
      macroProteinPercentage,
      macroCarbsPercentage,
      macroFatPercentage,
    };

    if (customCalorieTarget) {
      payload.customCalorieTarget = Number(customCalorieTarget);
    }

    await updateProfile(payload);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      {/* Header and Step Indicator */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-neutral-dark mb-2">Let's calculate your goals</h1>
        <p className="text-xs text-gray-500">We use the Mifflin-St Jeor formula for maximum nutritional safety</p>

        {/* Steps dots */}
        <div className="flex justify-center items-center gap-2 mt-4">
          {[1, 2, 3].map((num) => (
            <div
              key={num}
              className={`h-2 rounded-full transition-all duration-300 ${
                step === num ? "w-6 bg-primary" : "w-2 bg-gray-200"
              }`}
            />
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 text-red-600 p-4 rounded-xl text-xs font-medium border border-red-100">
          {error}
        </div>
      )}

      {/* Wizard form */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 min-h-[360px] flex flex-col justify-between">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ x, opacity: 0 }}
              animate={{ x, opacity: 1 }}
              exit={{ x, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Step 1: Bio-metrics</span>
                <div className="inline-flex rounded-lg bg-gray-100 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setUnitSystem('metric')}
                    className={`px-3 py-1 rounded-md font-medium transition ${
                      unitSystem === 'metric' ? 'bg-white text-primary shadow-sm' : 'text-gray-500'
                    }`}
                  >
                    Metric
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnitSystem('imperial')}
                    className={`px-3 py-1 rounded-md font-medium transition ${
                      unitSystem === 'imperial' ? 'bg-white text-primary shadow-sm' : 'text-gray-500'
                    }`}
                  >
                    Imperial
                  </button>
                </div>
              </div>

              {/* Name field */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Name (Optional)</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="What should we call you?"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary focus:bg-white transition-all"
                />
              </div>

              {/* Sex choice */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Biological Sex</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSex('male')}
                    className={`p-3 rounded-xl border text-sm font-medium transition text-center ${
                      sex === 'male' ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    Male
                  </button>
                  <button
                    type="button"
                    onClick={() => setSex('female')}
                    className={`p-3 rounded-xl border text-sm font-medium transition text-center ${
                      sex === 'female' ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    Female
                  </button>
                </div>
              </div>

              {/* Bio fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Age (years)</label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                {unitSystem === 'metric' ? (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Weight (kg)</label>
                    <input
                      type="number"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Weight (lbs)</label>
                    <input
                      type="number"
                      value={weightLbs}
                      onChange={(e) => setWeightLbs(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                )}
              </div>

              {unitSystem === 'metric' ? (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Height (cm)</label>
                  <input
                    type="number"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Height</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <input
                        type="number"
                        value={heightFt}
                        onChange={(e) => setHeightFt(e.target.value)}
                        className="w-full px-3 py-3 pr-8 rounded-xl border border-gray-200 text-sm focus:outline-none"
                      />
                      <span className="absolute right-3 top-3 text-xs text-gray-400">ft</span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        value={heightIn}
                        onChange={(e) => setHeightIn(e.target.value)}
                        className="w-full px-3 py-3 pr-8 rounded-xl border border-gray-200 text-sm focus:outline-none"
                      />
                      <span className="absolute right-3 top-3 text-xs text-gray-400">in</span>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ x, opacity: 0 }}
              animate={{ x, opacity: 1 }}
              exit={{ x, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Step 2: Activity Level</span>
              <p className="text-xs text-gray-400">This helps us estimate your Total Daily Energy Expenditure (TDEE).</p>

              <div className="space-y-2">
                {[
                  { id: 'sedentary', label: 'Sedentary', desc: 'Little or no exercise, desk job' },
                  { id: 'light', label: 'Lightly Active', desc: 'Light exercise or active hobbies 1-3 days/wk' },
                  { id: 'moderate', label: 'Moderately Active', desc: 'Moderate workouts or sports 3-5 days/wk' },
                  { id: 'active', label: 'Very Active', desc: 'Hard training or physical labor 6-7 days/wk' },
                  { id: 'very_active', label: 'Extra Active', desc: 'Very heavy physical work or professional training' },
                ].map((act) => (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => setActivityLevel(act.id)}
                    className={`w-full text-left p-3.5 rounded-2xl border text-sm transition ${
                      activityLevel === act.id
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-gray-100 bg-gray-50/50 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-semibold text-xs uppercase tracking-wide">{act.label}</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">{act.desc}</div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ x, opacity: 0 }}
              animate={{ x, opacity: 1 }}
              exit={{ x, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Step 3: Goals</span>
              <p className="text-xs text-gray-400">Your daily calorie budget adjusts dynamically to match your goals.</p>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'lose', label: 'Lose Weight', desc: '-500 kcal' },
                  { id: 'maintain', label: 'Maintain', desc: '0 kcal' },
                  { id: 'gain', label: 'Gain Muscle', desc: '+500 kcal' }
                ].map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGoal(g.id)}
                    className={`p-3.5 rounded-2xl border text-center transition flex flex-col justify-between h-24 ${
                      goal === g.id
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-gray-100 bg-gray-50/50 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className="font-bold text-xs uppercase tracking-wide block">{g.label}</span>
                    <span className="text-[10px] text-gray-400 block mt-1">{g.desc}</span>
                  </button>
                ))}
              </div>

              {/* Target Preview Ring */}
              <div className="bg-brand-bg/40 p-4 rounded-2xl border border-primary/10 text-center relative overflow-hidden">
                <div className="absolute right-2 top-2">
                  <Calculator className="w-4 h-4 text-primary/40 animate-pulse" />
                </div>
                <div className="text-[10px] font-semibold text-primary/80 uppercase tracking-wider">Estimated Target</div>
                <div className="text-2xl font-black text-neutral-dark my-1">
                  {previewCalorieTarget} <span className="text-xs font-normal text-gray-500">kcal/day</span>
                </div>
                <div className="text-[10px] text-gray-400">
                  Protein: {Math.round((previewCalorieTarget * (goal === 'lose' ? 0.35 : goal === 'gain' ? 0.25 : 0.30)) / 4)}g | 
                  Carbs: {Math.round((previewCalorieTarget * (goal === 'lose' ? 0.40 : goal === 'gain' ? 0.50 : 0.45)) / 4)}g | 
                  Fat: {Math.round((previewCalorieTarget * 0.25) / 9)}g
                </div>
              </div>

              {/* Custom target overwrite */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Or set custom target calories (Optional)
                </label>
                <input
                  type="number"
                  placeholder={`Override target, e.g. 1800`}
                  value={customCalorieTarget}
                  onChange={(e) => setCustomCalorieTarget(e.target.value)}
                  className="w-full px-4 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-50">
          {step > 1 && (
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={handleNext}
              className="flex-1 bg-primary hover:bg-primary-light text-white font-medium py-2.5 rounded-xl shadow-sm transition text-xs flex items-center justify-center gap-1"
            >
              Next Step <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              disabled={loading}
              className="flex-1 bg-primary hover:bg-primary-light text-white font-semibold py-2.5 rounded-xl shadow-md transition text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <>
                  <Check className="w-4 h-4" /> Calculate & Save
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
