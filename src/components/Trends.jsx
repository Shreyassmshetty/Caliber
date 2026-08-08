import React, { useMemo, useEffect } from 'react';
import { useApp, getLocalDateString } from '../context/AppContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, AlertCircle, CheckCircle, BarChart3, Calendar, Utensils, Flame, ChevronRight, Info } from 'lucide-react';

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

  // Build the 7-day actual logged data
  const weeklyData = useMemo(() => {
    const data = [];
    const today = new Date();

    // Days index list (0 is 6 days ago, 6 is today)
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = getLocalDateString(d);

      // Formatted date labels
      const dayName = d.toLocaleDateString(undefined, { weekday: 'short' });
      const fullDayName = d.toLocaleDateString(undefined, { weekday: 'long' });
      const monthDay = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const isToday = i === 0;

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
        dayName: isToday ? 'Today' : dayName,
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
  }, [foodEntries, exercises, allFoodEntries, allExercises, calorieTarget, selectedDate, pendingQueue]);

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
      summaryText = "No food entries logged in the past 7 days. Start logging your meals to see your daily intake trends, weekend comparisons, and consistency metrics!";
      status = 'info';
    } else if (avgWeekdayIntake > 0 && avgWeekendIntake > 0) {
      if (diffPct > 5) {
        summaryText = `Your average intake was ${diffPct}% higher on weekends compared to weekdays. Consider meal prepping to stay closer to your target!`;
        status = 'warning';
      } else if (diffPct < -5) {
        summaryText = `Your intake drops by ${Math.abs(diffPct)}% on weekends. Ensure you are getting adequate calories and protein on rest days.`;
        status = 'info';
      } else {
        summaryText = `Incredibly stable! Your weekend intake stays within ${Math.abs(diffPct)}% of your weekday logs. Exceptional consistency.`;
        status = 'good';
      }
    } else if (avgWeekdayIntake > 0 && avgWeekendIntake === 0) {
      summaryText = `Great weekday logging habit! Logging weekend meals as well will give you a complete picture of your weekly calorie balance.`;
      status = 'info';
    } else if (avgWeekdayIntake === 0 && avgWeekendIntake > 0) {
      summaryText = `Weekend logs recorded! Keep logging your weekday meals to track your full weekly consistency.`;
      status = 'info';
    } else {
      summaryText = `Keep logging daily meals to track your nutrition consistency against your ${calorieTarget} kcal target.`;
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
  }, [weeklyData, calorieTarget]);

  return (
    <div className="max-w-md mx-auto px-4 pb-12 space-y-4">
      {/* 7-Day Chart view */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-primary" /> Calorie trend (Last 7 Days)
          </h3>
          <span className="text-[10px] text-gray-400 dark:text-slate-500 font-medium">
            Target: {calorieTarget} kcal/day
          </span>
        </div>

        {/* Recharts responsive stage */}
        <div className="w-full h-64 text-[10px] mt-4 font-mono">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis
                dataKey="dayName"
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
                formatter={(value, name) => [`${value} kcal`, name]}
                labelFormatter={(label, items) => {
                  const item = items?.[0]?.payload;
                  return item ? `${item.fullDayName} (${item.monthDay})` : label;
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
              {insights.avgWeekdayIntake > 0 ? `${insights.avgWeekdayIntake} kcal` : 'No logs'}
            </span>
            <span className="text-[10px] text-gray-400">Mon - Fri</span>
          </div>
          <div className="bg-gray-50/50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-gray-100 dark:border-slate-800">
            <span className="text-[10px] text-gray-400 uppercase font-semibold">Weekend Avg</span>
            <span className="text-lg font-bold text-gray-700 dark:text-slate-200 block mt-1">
              {insights.avgWeekendIntake > 0 ? `${insights.avgWeekendIntake} kcal` : 'No logs'}
            </span>
            <span className="text-[10px] text-gray-400">Sat - Sun</span>
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
            <span className="font-bold block mb-0.5">Weekend Trend Analysis</span>
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

