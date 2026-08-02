import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');
const JWT_SECRET = process.env.JWT_SECRET || 'calorie-nutrition-tracker-secret-key-12345';

// Initialize Supabase Client if environment variables are provided
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

let dbSupabase = null;

if (supabaseUrl && supabaseKey) {
  try {
    dbSupabase = createClient(supabaseUrl, supabaseKey);
    console.log(`[Supabase Status] Supabase database provider initialized successfully (${supabaseUrl})`);
  } catch (err) {
    console.warn("[Supabase Warning] Could not initialize Supabase client:", err);
  }
}

// Predefined fallback foods list
export const LOCAL_FOODS = [
  { foodName: "Apple (medium)", calories: 95, protein: 0.5, carbs: 25, fat: 0.3, servingSize: "1 medium (182g)" },
  { foodName: "Banana (medium)", calories: 105, protein: 1.3, carbs: 27, fat: 0.4, servingSize: "1 medium (118g)" },
  { foodName: "Chicken Breast (grilled)", calories: 165, protein: 31, carbs: 0, fat: 3.6, servingSize: "100g" },
  { foodName: "Egg (large boiled)", calories: 78, protein: 6.3, carbs: 0.6, fat: 5.3, servingSize: "1 large (50g)" },
  { foodName: "White Rice (cooked)", calories: 205, protein: 4.2, carbs: 44.5, fat: 0.4, servingSize: "1 cup (158g)" },
  { foodName: "Brown Rice (cooked)", calories: 215, protein: 5.0, carbs: 44.8, fat: 1.8, servingSize: "1 cup (195g)" },
  { foodName: "Milk (2% fat)", calories: 122, protein: 8.1, carbs: 11.7, fat: 4.8, servingSize: "1 cup (244g)" },
  { foodName: "Salmon Fillet (baked)", calories: 206, protein: 22.0, carbs: 0, fat: 12.4, servingSize: "100g" },
  { foodName: "Avocado (medium)", calories: 240, protein: 3.0, carbs: 12.0, fat: 22.0, servingSize: "1 medium (150g)" },
  { foodName: "Oatmeal (cooked)", calories: 166, protein: 5.9, carbs: 28.1, fat: 3.6, servingSize: "1 cup (234g)" },
  { foodName: "Peanut Butter (creamy)", calories: 94, protein: 4.0, carbs: 3.1, fat: 8.1, servingSize: "1 tbsp (16g)" },
  { foodName: "Whole Wheat Bread", calories: 69, protein: 3.6, carbs: 11.8, fat: 0.9, servingSize: "1 slice (28g)" },
  { foodName: "Greek Yogurt (plain, non-fat)", calories: 80, protein: 15.5, carbs: 6.4, fat: 0.4, servingSize: "1 container (150g)" },
  { foodName: "Broccoli (steamed)", calories: 54, protein: 3.7, carbs: 10.0, fat: 0.6, servingSize: "1 cup (150g)" },
  { foodName: "Sweet Potato (baked)", calories: 103, protein: 2.0, carbs: 24.0, fat: 0.2, servingSize: "1 medium (114g)" },
  { foodName: "Olive Oil", calories: 119, protein: 0, carbs: 0, fat: 13.5, servingSize: "1 tbsp (13.5g)" },
  { foodName: "Ground Beef (lean 90/10)", calories: 200, protein: 20.0, carbs: 0, fat: 10.0, servingSize: "100g" },
  { foodName: "Tuna (canned in water)", calories: 116, protein: 26.0, carbs: 0, fat: 1.0, servingSize: "100g" },
  { foodName: "Pasta (cooked spaghetti)", calories: 200, protein: 7.1, carbs: 40.0, fat: 1.3, servingSize: "1 cup (140g)" },
  { foodName: "Almonds (raw)", calories: 164, protein: 6.0, carbs: 6.1, fat: 14.1, servingSize: "28g (23 nuts)" },
  { foodName: "Protein Powder (Whey)", calories: 120, protein: 24.0, carbs: 3.0, fat: 1.5, servingSize: "1 scoop (30g)" },
  { foodName: "Orange (medium)", calories: 62, protein: 1.2, carbs: 15.4, fat: 0.2, servingSize: "1 medium (131g)" },
  { foodName: "Blueberries (raw)", calories: 84, protein: 1.1, carbs: 21.0, fat: 0.5, servingSize: "1 cup (148g)" },
  { foodName: "Spinach (raw)", calories: 7, protein: 0.9, carbs: 1.1, fat: 0.1, servingSize: "1 cup (30g)" }
];

// Ensure database file exists
export function initDb() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    const defaultData = {
      users: [],
      foodEntries: [],
      exercises: [],
      customMeals: [],
      waterLogs: [],
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2));
  }
}

// Read database
export function readDb() {
  initDb();
  try {
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error("Error reading database:", error);
    return { users: [], foodEntries: [], exercises: [], customMeals: [], waterLogs: [] };
  }
}

// Write database
export function writeDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error writing database:", error);
  }
}

// Token Helper functions
export function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

// ==================== DATABASE ADAPTERS (SUPABASE -> FIRESTORE -> LOCAL DB) ====================

// 1. Get user by ID
export async function getUserById(id) {
  if (dbSupabase) {
    try {
      const { data, error } = await dbSupabase.from('users').select('*').eq('id', id).maybeSingle();
      if (!error && data) {
        return {
          id: data.id,
          email: data.email,
          passwordHash: data.password_hash || data.passwordHash,
          profile: data.profile || {}
        };
      }
    } catch (err) {
      console.warn("[Supabase Warning] getUserById error:", err);
    }
  }
  const db = readDb();
  return db.users.find(u => u.id === id) || null;
}

// 2. Get user by email
export async function getUserByEmail(email) {
  const normEmail = email.toLowerCase().trim();
  if (dbSupabase) {
    try {
      const { data, error } = await dbSupabase.from('users').select('*').ilike('email', normEmail).maybeSingle();
      if (!error && data) {
        return {
          id: data.id,
          email: data.email,
          passwordHash: data.password_hash || data.passwordHash,
          profile: data.profile || {}
        };
      }
    } catch (err) {
      console.warn("[Supabase Warning] getUserByEmail error:", err);
    }
  }
  const db = readDb();
  return db.users.find(u => u.email.toLowerCase() === normEmail) || null;
}

// 3. Create user
export async function createUser(user) {
  if (dbSupabase) {
    try {
      const { error } = await dbSupabase.from('users').insert({
        id: user.id,
        email: user.email,
        password_hash: user.passwordHash,
        profile: user.profile
      });
      if (!error) {
        console.log(`User ${user.id} created in Supabase`);
        return;
      }
      console.warn("[Supabase Warning] createUser returned error:", error);
    } catch (err) {
      console.warn("[Supabase Warning] createUser error:", err);
    }
  }
  const db = readDb();
  db.users.push(user);
  writeDb(db);
}

// 4. Update user profile
export async function updateUserProfile(userId, profile) {
  if (dbSupabase) {
    try {
      const { error } = await dbSupabase.from('users').update({ profile }).eq('id', userId);
      if (!error) {
        console.log(`User profile updated in Supabase for ${userId}`);
        return;
      }
      console.warn("[Supabase Warning] updateUserProfile returned error:", error);
    } catch (err) {
      console.warn("[Supabase Warning] updateUserProfile error:", err);
    }
  }
  const db = readDb();
  const userIdx = db.users.findIndex(u => u.id === userId);
  if (userIdx !== -1) {
    db.users[userIdx].profile = profile;
    writeDb(db);
  }
}

// 5. Get food entries
export async function getFoodEntries(userId, dateStr) {
  if (dbSupabase) {
    try {
      const { data, error } = await dbSupabase.from('food_entries').select('*').eq('user_id', userId);
      if (!error && data) {
        let entries = data.map((d) => ({
          id: d.id,
          userId: d.user_id || d.userId,
          foodName: d.food_name || d.foodName,
          calories: Number(d.calories || 0),
          protein: Number(d.protein || 0),
          carbs: Number(d.carbs || 0),
          fat: Number(d.fat || 0),
          servingSize: d.serving_size || d.servingSize || '1 serving',
          quantity: Number(d.quantity || 1),
          mealType: d.meal_type || d.mealType,
          loggedAt: d.logged_at || d.loggedAt
        }));
        if (dateStr) {
          entries = entries.filter(e => e.loggedAt && e.loggedAt.startsWith(dateStr));
        }
        return entries;
      }
    } catch (err) {
      console.warn("[Supabase Warning] getFoodEntries error:", err);
    }
  }
  const db = readDb();
  let entries = db.foodEntries.filter(entry => entry.userId === userId);
  if (dateStr) {
    entries = entries.filter(entry => entry.loggedAt.startsWith(dateStr));
  }
  return entries;
}

// 6. Log food entry
export async function logFoodEntry(entry) {
  if (dbSupabase) {
    try {
      const { error } = await dbSupabase.from('food_entries').insert({
        id: entry.id,
        user_id: entry.userId,
        food_name: entry.foodName,
        calories: entry.calories,
        protein: entry.protein,
        carbs: entry.carbs,
        fat: entry.fat,
        serving_size: entry.servingSize,
        quantity: entry.quantity,
        meal_type: entry.mealType,
        logged_at: entry.loggedAt
      });
      if (!error) {
        console.log(`Food entry ${entry.id} saved to Supabase`);
        return;
      }
      console.warn("[Supabase Warning] logFoodEntry returned error:", error);
    } catch (err) {
      console.warn("[Supabase Warning] logFoodEntry error:", err);
    }
  }
  const db = readDb();
  db.foodEntries.push(entry);
  writeDb(db);
}

// 7. Delete food entry
export async function deleteFoodEntry(userId, id) {
  if (dbSupabase) {
    try {
      const { error } = await dbSupabase.from('food_entries').delete().eq('id', id).eq('user_id', userId);
      if (!error) {
        console.log(`Food entry ${id} deleted from Supabase`);
        return true;
      }
    } catch (err) {
      console.warn("[Supabase Warning] deleteFoodEntry error:", err);
    }
  }
  const db = readDb();
  const idx = db.foodEntries.findIndex(e => e.id === id && e.userId === userId);
  if (idx !== -1) {
    db.foodEntries.splice(idx, 1);
    writeDb(db);
    return true;
  }
  return false;
}

// 8. Get exercises
export async function getExercises(userId, dateStr) {
  if (dbSupabase) {
    try {
      const { data, error } = await dbSupabase.from('exercises').select('*').eq('user_id', userId);
      if (!error && data) {
        let entries = data.map((d) => ({
          id: d.id,
          userId: d.user_id || d.userId,
          activityType: d.activity_type || d.activityType,
          durationMinutes: Number(d.duration_minutes || d.durationMinutes || 0),
          caloriesBurned: Number(d.calories_burned || d.caloriesBurned || 0),
          loggedAt: d.logged_at || d.loggedAt
        }));
        if (dateStr) {
          entries = entries.filter(e => e.loggedAt && e.loggedAt.startsWith(dateStr));
        }
        return entries;
      }
    } catch (err) {
      console.warn("[Supabase Warning] getExercises error:", err);
    }
  }
  const db = readDb();
  let entries = db.exercises.filter(e => e.userId === userId);
  if (dateStr) {
    entries = entries.filter(e => e.loggedAt.startsWith(dateStr));
  }
  return entries;
}

// 9. Log exercise
export async function logExercise(entry) {
  if (dbSupabase) {
    try {
      const { error } = await dbSupabase.from('exercises').insert({
        id: entry.id,
        user_id: entry.userId,
        activity_type: entry.activityType,
        duration_minutes: entry.durationMinutes,
        calories_burned: entry.caloriesBurned,
        logged_at: entry.loggedAt
      });
      if (!error) {
        console.log(`Exercise entry ${entry.id} saved to Supabase`);
        return;
      }
      console.warn("[Supabase Warning] logExercise returned error:", error);
    } catch (err) {
      console.warn("[Supabase Warning] logExercise error:", err);
    }
  }
  const db = readDb();
  db.exercises.push(entry);
  writeDb(db);
}

// 10. Delete exercise
export async function deleteExercise(userId, id) {
  if (dbSupabase) {
    try {
      const { error } = await dbSupabase.from('exercises').delete().eq('id', id).eq('user_id', userId);
      if (!error) {
        console.log(`Exercise entry ${id} deleted from Supabase`);
        return true;
      }
    } catch (err) {
      console.warn("[Supabase Warning] deleteExercise error:", err);
    }
  }
  const db = readDb();
  const idx = db.exercises.findIndex(e => e.id === id && e.userId === userId);
  if (idx !== -1) {
    db.exercises.splice(idx, 1);
    writeDb(db);
    return true;
  }
  return false;
}

// 11. Get custom meals
export async function getCustomMeals(userId) {
  if (dbSupabase) {
    try {
      const { data, error } = await dbSupabase.from('custom_meals').select('*').eq('user_id', userId);
      if (!error && data) {
        return data.map((d) => ({
          id: d.id,
          userId: d.user_id || d.userId,
          mealName: d.meal_name || d.mealName,
          ingredients: d.ingredients || [],
          totalCalories: Number(d.total_calories || d.totalCalories || 0),
          totalProtein: Number(d.total_protein || d.totalProtein || 0),
          totalCarbs: Number(d.total_carbs || d.totalCarbs || 0),
          totalFat: Number(d.total_fat || d.totalFat || 0),
          createdAt: d.created_at || d.createdAt
        }));
      }
    } catch (err) {
      console.warn("[Supabase Warning] getCustomMeals error:", err);
    }
  }
  const db = readDb();
  return db.customMeals.filter(m => m.userId === userId);
}

// 12. Create custom meal
export async function createCustomMeal(meal) {
  if (dbSupabase) {
    try {
      const { error } = await dbSupabase.from('custom_meals').insert({
        id: meal.id,
        user_id: meal.userId,
        meal_name: meal.mealName,
        ingredients: meal.ingredients,
        total_calories: meal.totalCalories,
        total_protein: meal.totalProtein,
        total_carbs: meal.totalCarbs,
        total_fat: meal.totalFat,
        created_at: meal.createdAt
      });
      if (!error) {
        console.log(`Custom meal ${meal.id} saved to Supabase`);
        return;
      }
      console.warn("[Supabase Warning] createCustomMeal returned error:", error);
    } catch (err) {
      console.warn("[Supabase Warning] createCustomMeal error:", err);
    }
  }
  const db = readDb();
  db.customMeals.push(meal);
  writeDb(db);
}

// 13. Delete custom meal
export async function deleteCustomMeal(userId, id) {
  if (dbSupabase) {
    try {
      const { error } = await dbSupabase.from('custom_meals').delete().eq('id', id).eq('user_id', userId);
      if (!error) {
        console.log(`Custom meal ${id} deleted from Supabase`);
        return true;
      }
    } catch (err) {
      console.warn("[Supabase Warning] deleteCustomMeal error:", err);
    }
  }
  const db = readDb();
  const idx = db.customMeals.findIndex(m => m.id === id && m.userId === userId);
  if (idx !== -1) {
    db.customMeals.splice(idx, 1);
    writeDb(db);
    return true;
  }
  return false;
}

// 14. Get water log
export async function getWaterLog(userId, dateStr) {
  if (dbSupabase) {
    try {
      const { data, error } = await dbSupabase.from('water_logs').select('*').eq('user_id', userId).eq('date_str', dateStr).maybeSingle();
      if (!error && data) {
        return {
          id: data.id,
          userId: data.user_id || data.userId,
          dateStr: data.date_str || data.dateStr,
          glasses: Number(data.glasses || 0),
          updatedAt: data.updated_at || data.updatedAt
        };
      }
    } catch (err) {
      console.warn("[Supabase Warning] getWaterLog error:", err);
    }
  }
  const db = readDb();
  return db.waterLogs.find(w => w.userId === userId && w.dateStr === dateStr) || null;
}

// 15. Update water log
export async function updateWaterLog(userId, dateStr, glasses) {
  const finalGlasses = Math.max(0, Number(glasses));
  if (dbSupabase) {
    try {
      const logData = {
        id: `w_${userId}_${dateStr}`,
        user_id: userId,
        date_str: dateStr,
        glasses: finalGlasses,
        updated_at: new Date().toISOString()
      };
      const { data, error } = await dbSupabase.from('water_logs').upsert(logData, { onConflict: 'user_id,date_str' }).select().maybeSingle();
      if (!error) {
        console.log(`Water log updated in Supabase for user ${userId} date ${dateStr}`);
        return {
          id: data?.id || logData.id,
          userId,
          dateStr,
          glasses: finalGlasses,
          updatedAt: data?.updated_at || logData.updated_at
        };
      }
      console.warn("[Supabase Warning] updateWaterLog returned error:", error);
    } catch (err) {
      console.warn("[Supabase Warning] updateWaterLog error:", err);
    }
  }
  const db = readDb();
  let logIdx = db.waterLogs.findIndex(w => w.userId === userId && w.dateStr === dateStr);
  if (logIdx === -1) {
    const newLog = {
      id: `w_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      glasses: finalGlasses,
      dateStr,
      updatedAt: new Date().toISOString()
    };
    db.waterLogs.push(newLog);
    writeDb(db);
    return newLog;
  } else {
    db.waterLogs[logIdx].glasses = finalGlasses;
    db.waterLogs[logIdx].updatedAt = new Date().toISOString();
    writeDb(db);
    return db.waterLogs[logIdx];
  }
}
