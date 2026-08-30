import React, { useState, useMemo, useEffect } from 'react';
import { useApp, getLocalDateString, formatCalories } from '../context/AppContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, AlertCircle, CheckCircle, BarChart3, Calendar, Utensils, Flame, ChevronRight, ChevronLeft, Info } from 'lucide-react';

// Helper to calculate the Monday 00:00:00 date for any weekOffset (0 = current week, -1 = last week...)
const getMondayDate = (refDate, offset = 0) => {
  const d = new Date(refDate);
  const day = d.getDay(); // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  const diffToMonday = (day === 0 ? 6 : day - 1);
  d.setDate(d.getDate() - diffToMonday + (offset * 7));
  d.setHours(0, 0, 0, 0);
  return d;
};

export const Trends = () => {
  const {
    foodEntries,
    exercises,
    allFoodEntries,
    allExercises,
    fetchAllHistory,
    user,
    selectedDate,
    pendingQueue,
    setSelectedDate
  } = useApp();

  const calorieTarget = user?.profile?.dailyCalorieTarget || 2000;
  
  // 0 = Current Week (Mon - Sun), -1 = Previous Week, -2 = 2 Weeks Ago...
  const [weekOffset, setWeekOffset] = useState(0);

  // Load complete user history on mount
  useEffect(() => {
    if (fetchAllHistory) {
      fetchAllHistory();
    }
  }, [fetchAllHistory]);

  // Helper to extract YYYY-MM-DD from any date or timestamp
  const getEntryDate = (loggedAt) => {
    if (!loggedAt) return '';
    if (typeof loggedAt === 'string') {
      const match = loggedAt.match(/^(\d{4}-\d{2}-\d{2})/);
      if (match) return match[1];
      try {
        const d = new Date(loggedAt);
        if (!isNaN(d.getTime())) return getLocalDateString(d);
      } catch (e) {}
    }
    return '';
  };

  // Compute start (Monday) and end (Sunday) dates for the selected week
  const mondayDate = useMemo(() => getMondayDate(new Date(), weekOffset), [weekOffset]);
  const sundayDate = useMemo(() => {
    const s = new Date(mondayDate);
    s.setDate(mondayDate.getDate() + 6);
    return s;
  }, [mondayDate]);

  const weekLabel = useMemo(() => {
    if (weekOffset === 0) return 'This Week';
    if (weekOffset === -1) return 'Last Week';
    return `${Math.abs(weekOffset)} Weeks Ago`;
  }, [weekOffset]);

  const dateRangeFormatted = useMemo(() => {
    const startStr = mondayDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const endStr = sundayDate.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric',
      year: mondayDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined 
    });
    return `${startStr} – ${endStr}`;
  }, [mondayDate, sundayDate]);

  // Build the strict Monday-to-Sunday (7 days) logged data
  const weeklyData = useMemo(() => {
    const data = [];
    const todayStr = getLocalDateString(new Date());

    // Monday (index 0) to Sunday (index 6)
    for (let i = 0; i < 7; i++) {
      const d = new Date(mondayDate);
      d.setDate(mondayDate.getDate() + i);
      const dateStr = getLocalDateString(d);

      // Formatted date labels
      const dayName = d.toLocaleDateString(undefined, { weekday: 'short' });
      const fullDayName = d.toLocaleDateString(undefined, { weekday: 'long' });
      const monthDay = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const isWeekend = d.getDay() === 0 || d.getDay() === 6; // Sunday = 0, Saturday = 6
      const isToday = dateStr === todayStr;

      // 1. Gather all actual food items for this date
      const foodsMap = new Map();

      // From allFoodEntries
      (allFoodEntries || []).forEach(item => {
        const itemDate = getEntryDate(item.loggedAt);
        if (itemDate === dateStr) {
          foodsMap.set(item.id || `${item.foodName}_${item.loggedAt}`, item);
        }
      });

      // From current active foodEntries if this matches selectedDate
      if (selectedDate === dateStr && foodEntries?.length) {
        foodEntries.forEach(item => {
          foodsMap.set(item.id || `${item.foodName}_${item.loggedAt}`, item);
        });
      }

      // From localStorage cached day
      try {
        const cached = localStorage.getItem(`caliber_day_${dateStr}`);
        if (cached) {
          const { foodData } = JSON.parse(cached);
          if (Array.isArray(foodData)) {
            foodData.forEach(item => {
              foodsMap.set(item.id || `${item.foodName}_${item.loggedAt}`, item);
            });
          }
        }
      } catch (e) {}

      // From pendingQueue (offline un-synced logs)
      (pendingQueue || []).forEach(queueItem => {
        if (queueItem.type === 'LOG_FOOD' && queueItem.payload) {
          const itemDate = getEntryDate(queueItem.payload.loggedAt);
          if (itemDate === dateStr) {
            foodsMap.set(queueItem.id, queueItem.payload);
          }
        } else if (queueItem.type === 'DELETE_FOOD' && queueItem.payload?.id) {
          foodsMap.delete(queueItem.payload.id);
        }
      });

      const dayFoods = Array.from(foodsMap.values());
      const dayIntake = dayFoods.reduce((sum, item) => sum + (Number(item.calories || 0) * Number(item.quantity || 1)), 0);

      // 2. Gather all actual exercise items for this date
      const exercisesMap = new Map();

      (allExercises || []).forEach(item => {
        const itemDate = getEntryDate(item.loggedAt);
        if (itemDate === dateStr) {
          exercisesMap.set(item.id || `${item.activityType}_${item.loggedAt}`, item);
        }
      });

      if (selectedDate === dateStr && exercises?.length) {
        exercises.forEach(item => {
          exercisesMap.set(item.id || `${item.activityType}_${item.loggedAt}`, item);
        });
      }

      try {
        const cached = localStorage.getItem(`caliber_day_${dateStr}`);
        if (cached) {
          const { exerciseData } = JSON.parse(cached);
          if (Array.isArray(exerciseData)) {
            exerciseData.forEach(item => {
              exercisesMap.set(item.id || `${item.activityType}_${item.loggedAt}`, item);
            });
          }
        }
      } catch (e) {}

      (pendingQueue || []).forEach(queueItem => {
        if (queueItem.type === 'LOG_EXERCISE' && queueItem.payload) {
          const itemDate = getEntryDate(queueItem.payload.loggedAt);
          if (itemDate === dateStr) {
            exercisesMap.set(queueItem.id, queueItem.payload);
          }
        } else if (queueItem.type === 'DELETE_EXERCISE' && queueItem.payload?.id) {
          exercisesMap.delete(queueItem.payload.id);
        }
      });

      const dayExercises = Array.from(exercisesMap.values());
      const dayBurn = dayExercises.reduce((sum, item) => sum + Number(item.caloriesBurned || 0), 0);

      data.push({
        dateStr,
        dayName: isToday ? `${dayName} (Today)` : dayName,
        shortDayName: dayName,
        fullDayName,
        monthDay,
        isWeekend,
        isToday,
        Target: calorieTarget,
        Intake: dayIntake,
        ActiveBurn: dayBurn,
        NetIntake: dayIntake - dayBurn,
        hasLogs: dayFoods.length > 0 || dayExercises.length > 0,
        foodCount: dayFoods.length,
        exerciseCount: dayExercises.length
      });
    }

    return data;
  }, [mondayDate, foodEntries, exercises, allFoodEntries, allExercises, calorieTarget, selectedDate, pendingQueue]);

  // Insights generation: Weekend vs Weekday analysis from real logs
  const insights = useMemo(() => {
    const weekdayData = weeklyData.filter(d => !d.isWeekend);
    const weekendData = weeklyData.filter(d => d.isWeekend);

    const loggedWeekdays = weekdayData.filter(d => d.Intake > 0);
    const loggedWeekends = weekendData.filter(d => d.Intake > 0);
    const allLoggedDays = weeklyData.filter(d => d.Intake > 0 || d.ActiveBurn > 0);

    const avgWeekdayIntake = loggedWeekdays.length > 0
      ? Math.round(loggedWeekdays.reduce((sum, d) => sum + d.Intake, 0) / loggedWeekdays.length)
      : 0;

    const avgWeekendIntake = loggedWeekends.length > 0
      ? Math.round(loggedWeekends.reduce((sum, d) => sum + d.Intake, 0) / loggedWeekends.length)
      : 0;

    let diffPct = 0;
    if (avgWeekdayIntake > 0 && avgWeekendIntake > 0) {
      diffPct = Math.round(((avgWeekendIntake - avgWeekdayIntake) / avgWeekdayIntake) * 100);
    }

    let summaryText = "";
    let status = 'info';

    if (allLoggedDays.length === 0) {
      summaryText = `No food entries logged for ${weekLabel.toLowerCase()} (${dateRangeFormatted}). Start logging your meals to view your Monday–Sunday trend analysis!`;
      status = 'info';
    } else if (avgWeekdayIntake > 0 && avgWeekendIntake > 0) {
      if (diffPct > 5) {
        summaryText = `Your average intake was ${diffPct}% higher on weekends compared to weekdays during this week. Consider meal prepping to stay closer to your target!`;
        status = 'warning';
      } else if (diffPct < -5) {
        summaryText = `Your intake dropped by ${Math.abs(diffPct)}% on weekends during this week. Ensure you get adequate calories and protein on rest days.`;
        status = 'info';
      } else {
        summaryText = `Incredibly stable! Your weekend intake stayed within ${Math.abs(diffPct)}% of your weekday logs for this week. Exceptional consistency.`;
        status = 'good';
      }
    } else if (avgWeekdayIntake > 0 && avgWeekendIntake === 0) {
      summaryText = `Great weekday logging! Logging weekend meals as well will give you a complete picture of your Monday–Sunday calorie balance.`;
      status = 'info';
    } else if (avgWeekdayIntake === 0 && avgWeekendIntake > 0) {
      summaryText = `Weekend logs recorded! Keep logging your weekday meals to track your full Monday–Sunday consistency.`;
      status = 'info';
    } else {
      summaryText = `Keep logging daily meals to track your nutrition consistency against your ${formatCalories(calorieTarget)} kcal target.`;
      status = 'info';
    }

    // Days where the user logged food AND stayed within their target
    const meetsTargetDays = weeklyData.filter(d => d.Intake > 0 && d.Intake <= d.Target).length;
    const totalLoggedDaysCount = weeklyData.filter(d => d.Intake > 0).length;

    return {
      avgWeekdayIntake,
      avgWeekendIntake,
      diffPct,
      summaryText,
      status,
      meetsTargetDays,
      totalLoggedDaysCount,
      totalLoggedDays: allLoggedDays.length
    };
  }, [weeklyData, calorieTarget, weekLabel, dateRangeFormatted]);

  return (
    <div className="max-w-md mx-auto px-4 pb-12 space-y-4">
      {/* Week Selector Header Control */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setWeekOffset(prev => prev - 1)}
            className="p-2 rounded-2xl bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            title="Previous Week"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="text-center flex-1 mx-2">
            <div className="flex items-center justify-center gap-1.5">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold text-gray-800 dark:text-slate-100">{weekLabel}</span>
            </div>
            <span className="text-xs text-gray-500 dark:text-slate-400 font-medium block mt-0.5">
              {dateRangeFormatted}
            </span>
          </div>

          <button
            onClick={() => setWeekOffset(prev => Math.min(0, prev + 1))}
            disabled={weekOffset >= 0}
            className={`p-2 rounded-2xl transition-colors ${
              weekOffset >= 0
                ? 'bg-gray-50 dark:bg-slate-800/50 text-gray-300 dark:text-slate-600 cursor-not-allowed'
                : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'
            }`}
            title="Next Week"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Week Select Dropdown */}
        <div className="flex items-center gap-2">
          <select
            value={weekOffset}
            onChange={(e) => setWeekOffset(Number(e.target.value))}
            className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 py-2 px-3 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary w-full cursor-pointer"
          >
            {Array.from({ length: 12 }).map((_, i) => {
              const offset = -i;
              const mon = getMondayDate(new Date(), offset);
              const sun = new Date(mon);
              sun.setDate(mon.getDate() + 6);
              const start = mon.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
              const end = sun.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
              const label = offset === 0 
                ? `This Week (${start} – ${end})` 
                : offset === -1 
                ? `Last Week (${start} – ${end})` 
                : `${Math.abs(offset)} Weeks Ago (${start} – ${end})`;
              return (
                <option key={offset} value={offset}>
                  {label}
                </option>
              );
            })}
          </select>
          {weekOffset !== 0 && (
            <button
              onClick={() => setWeekOffset(0)}
              className="text-xs font-bold whitespace-nowrap text-primary bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3 py-2 rounded-2xl hover:bg-emerald-100 transition-colors"
            >
              This Week
            </button>
          )}
        </div>
      </div>

      {/* Monday to Sunday Chart View */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-primary" /> Calorie Trend (Mon – Sun)
          </h3>
          <span className="text-[10px] text-gray-400 dark:text-slate-500 font-medium">
            Target: {formatCalories(calorieTarget)} kcal/day
          </span>
        </div>

        {/* Recharts responsive stage */}
        <div className="w-full h-64 text-[10px] mt-4 font-mono">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis
                dataKey="shortDayName"
                stroke="#9ca3af"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                stroke="#9ca3af"
                axisLine={false}
                tickLine={false}
                domain={[0, 'auto']}
                tick={{ fontSize: 10 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid #e5e7eb',
                  fontSize: '12px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)'
                }}
                formatter={(value, name) => [`${formatCalories(value)} kcal`, name]}
                labelFormatter={(label, items) => {
                  const item = items?.[0]?.payload;
                  return item ? `${item.fullDayName} (${item.monthDay})${item.isToday ? ' - Today' : ''}` : label;
                }}
              />
              <Legend verticalAlign="top" height={36} iconType="circle" iconSize={6} />
              <Line
                name="Day Budget"
                type="monotone"
                dataKey="Target"
                stroke="#9ca3af"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
              />
              <Line
                name="Intake"
                type="monotone"
                dataKey="Intake"
                stroke="var(--color-primary, #10b981)"
                strokeWidth={2.5}
                dot={{ r: 3, strokeWidth: 1, fill: 'var(--color-primary, #10b981)' }}
                activeDot={{ r: 6 }}
              />
              <Line
                name="Active Burn"
                type="monotone"
                dataKey="ActiveBurn"
                stroke="#3b82f6"
                strokeWidth={1.5}
                dot={{ r: 3, strokeWidth: 1, fill: '#3b82f6' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Weekday vs Weekend Comparison Widget */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400">Weekly Insight Report</h3>

        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="bg-gray-50/50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-gray-100 dark:border-slate-800">
            <span className="text-[10px] text-gray-400 uppercase font-semibold">Weekday Avg</span>
            <span className="text-lg font-bold text-gray-700 dark:text-slate-200 block mt-1">
              {insights.avgWeekdayIntake > 0 ? `${formatCalories(insights.avgWeekdayIntake)} kcal` : 'No logs'}
            </span>
            <span className="text-[10px] text-gray-400">Mon – Fri</span>
          </div>
          <div className="bg-gray-50/50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-gray-100 dark:border-slate-800">
            <span className="text-[10px] text-gray-400 uppercase font-semibold">Weekend Avg</span>
            <span className="text-lg font-bold text-gray-700 dark:text-slate-200 block mt-1">
              {insights.avgWeekendIntake > 0 ? `${formatCalories(insights.avgWeekendIntake)} kcal` : 'No logs'}
            </span>
            <span className="text-[10px] text-gray-400">Sat – Sun</span>
          </div>
        </div>

        {/* Dynamic Warning/Encouragement Box */}
        <div className={`p-4 rounded-2xl border flex items-start gap-3 text-xs leading-relaxed ${
          insights.status === 'warning'
            ? 'bg-amber-50 text-amber-800 border-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50'
            : insights.status === 'good'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50'
            : 'bg-blue-50 text-blue-800 border-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50'
        }`}>
          <div className="mt-0.5">
            {insights.status === 'warning' ? (
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            ) : insights.status === 'good' ? (
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            )}
          </div>
          <div>
            <span className="font-bold block mb-0.5">Weekly Trend Analysis</span>
            <span>{insights.summaryText}</span>
          </div>
        </div>

        {/* Budget Consistency Score */}
        <div className="bg-gray-50/50 dark:bg-slate-800/50 p-4 rounded-2xl border border-gray-100 dark:border-slate-800 flex items-center justify-between text-xs">
          <div>
            <span className="font-bold text-gray-700 dark:text-slate-200 block">Consistency Score</span>
            <span className="text-[10px] text-gray-400">Days logged within budget target</span>
          </div>
          <div className="text-right">
            <span className="text-base font-black text-primary">
              {insights.meetsTargetDays} / {insights.totalLoggedDaysCount || 7} {insights.totalLoggedDaysCount > 0 ? 'logged days' : 'days'}
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block">
              {insights.totalLoggedDaysCount > 0
                ? `${Math.round((insights.meetsTargetDays / insights.totalLoggedDaysCount) * 100)}% Consistency`
                : '0% (No logs yet)'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};


