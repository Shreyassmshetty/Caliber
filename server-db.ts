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

// Predefined fallback foods list with emphasis on Indian & Global nutrition
export const LOCAL_FOODS = [
  // --- Indian Breads & Breakfast ---
  { foodName: "Roti / Chapati (Whole Wheat)", calories: 80, protein: 3.1, carbs: 15.2, fat: 0.9, sugar: 0.2, servingSize: "1 roti (30g)" },
  { foodName: "Plain Paratha", calories: 180, protein: 4.2, carbs: 24.5, fat: 7.5, sugar: 0.3, servingSize: "1 paratha (60g)" },
  { foodName: "Aloo Paratha", calories: 230, protein: 5.1, carbs: 32.0, fat: 9.2, sugar: 0.8, servingSize: "1 paratha (100g)" },
  { foodName: "Paneer Paratha", calories: 280, protein: 9.5, carbs: 28.0, fat: 14.8, sugar: 0.9, servingSize: "1 paratha (110g)" },
  { foodName: "Plain Naan", calories: 260, protein: 8.0, carbs: 45.0, fat: 5.0, sugar: 2.1, servingSize: "1 naan (90g)" },
  { foodName: "Garlic Butter Naan", calories: 310, protein: 8.5, carbs: 46.0, fat: 10.5, sugar: 2.2, servingSize: "1 naan (100g)" },
  { foodName: "Puri / Poori", calories: 100, protein: 1.8, carbs: 12.5, fat: 5.0, sugar: 0.2, servingSize: "1 puri (25g)" },
  { foodName: "Bhatura", calories: 290, protein: 6.5, carbs: 40.0, fat: 12.0, sugar: 1.5, servingSize: "1 bhatura (90g)" },
  { foodName: "Plain Dosa", calories: 133, protein: 2.8, carbs: 22.6, fat: 3.7, sugar: 0.2, servingSize: "1 dosa (80g)" },
  { foodName: "Masala Dosa", calories: 250, protein: 5.2, carbs: 38.0, fat: 8.8, sugar: 1.1, servingSize: "1 dosa (150g)" },
  { foodName: "Rava Dosa", calories: 180, protein: 3.8, carbs: 28.0, fat: 6.0, sugar: 0.5, servingSize: "1 dosa (100g)" },
  { foodName: "Steamed Idli", calories: 58, protein: 2.0, carbs: 12.0, fat: 0.2, sugar: 0.1, servingSize: "1 idli (40g)" },
  { foodName: "Uttapam (Onion Tomato)", calories: 190, protein: 4.8, carbs: 32.0, fat: 4.8, sugar: 1.8, servingSize: "1 uttapam (120g)" },
  { foodName: "Appam", calories: 120, protein: 2.1, carbs: 23.0, fat: 2.0, sugar: 1.0, servingSize: "1 appam (75g)" },
  { foodName: "Poha (Flattened Rice)", calories: 180, protein: 3.2, carbs: 31.0, fat: 5.2, sugar: 1.5, servingSize: "1 bowl (150g)" },
  { foodName: "Upma (Rava)", calories: 195, protein: 4.5, carbs: 30.0, fat: 6.5, sugar: 1.2, servingSize: "1 bowl (150g)" },
  { foodName: "Thepla (Methi)", calories: 120, protein: 3.0, carbs: 18.0, fat: 4.2, sugar: 0.5, servingSize: "1 thepla (45g)" },
  { foodName: "Sabudana Khichdi", calories: 240, protein: 2.5, carbs: 42.0, fat: 7.2, sugar: 0.8, servingSize: "1 bowl (150g)" },

  // --- Indian Dals, Curries & Vegetables ---
  { foodName: "Dal Tadka (Yellow Lentils)", calories: 150, protein: 7.5, carbs: 20.0, fat: 4.5, sugar: 1.0, servingSize: "1 cup (200g)" },
  { foodName: "Dal Makhani", calories: 260, protein: 9.0, carbs: 24.0, fat: 14.0, sugar: 2.1, servingSize: "1 cup (200g)" },
  { foodName: "Chana Masala / Chole", calories: 220, protein: 9.8, carbs: 32.0, fat: 6.5, sugar: 2.5, servingSize: "1 cup (200g)" },
  { foodName: "Rajma Masala (Kidney Beans)", calories: 210, protein: 9.2, carbs: 30.0, fat: 5.8, sugar: 2.2, servingSize: "1 cup (200g)" },
  { foodName: "Paneer Butter Masala", calories: 340, protein: 12.5, carbs: 14.0, fat: 26.0, sugar: 4.2, servingSize: "1 cup (200g)" },
  { foodName: "Palak Paneer", calories: 230, protein: 11.0, carbs: 9.0, fat: 17.0, sugar: 2.0, servingSize: "1 cup (200g)" },
  { foodName: "Kadai Paneer", calories: 290, protein: 13.0, carbs: 11.0, fat: 22.0, sugar: 3.0, servingSize: "1 cup (200g)" },
  { foodName: "Shahi Paneer", calories: 320, protein: 11.5, carbs: 15.0, fat: 24.0, sugar: 4.8, servingSize: "1 cup (200g)" },
  { foodName: "Aloo Gobi", calories: 160, protein: 3.8, carbs: 22.0, fat: 7.0, sugar: 3.1, servingSize: "1 cup (180g)" },
  { foodName: "Bhindi Masala (Okra)", calories: 130, protein: 3.0, carbs: 12.0, fat: 8.0, sugar: 2.4, servingSize: "1 cup (150g)" },
  { foodName: "Baingan Bharta (Eggplant)", calories: 140, protein: 2.8, carbs: 14.0, fat: 8.5, sugar: 4.0, servingSize: "1 cup (180g)" },
  { foodName: "Mix Veg Curry", calories: 150, protein: 3.5, carbs: 18.0, fat: 7.5, sugar: 3.5, servingSize: "1 cup (200g)" },
  { foodName: "Sambar", calories: 110, protein: 4.5, carbs: 17.0, fat: 2.8, sugar: 2.5, servingSize: "1 cup (200g)" },
  { foodName: "Rasam", calories: 60, protein: 1.5, carbs: 9.0, fat: 2.0, sugar: 1.5, servingSize: "1 cup (200g)" },
  { foodName: "Kadhi Pakora", calories: 210, protein: 6.2, carbs: 21.0, fat: 11.5, sugar: 3.0, servingSize: "1 cup (200g)" },

  // --- Indian Rice & Biryani ---
  { foodName: "Chicken Biryani", calories: 360, protein: 22.0, carbs: 42.0, fat: 11.5, sugar: 1.2, servingSize: "1 plate (300g)" },
  { foodName: "Mutton Biryani", calories: 420, protein: 24.0, carbs: 44.0, fat: 17.0, sugar: 1.5, servingSize: "1 plate (300g)" },
  { foodName: "Veg Biryani", calories: 280, protein: 6.5, carbs: 48.0, fat: 7.5, sugar: 2.0, servingSize: "1 plate (280g)" },
  { foodName: "Egg Biryani", calories: 320, protein: 14.0, carbs: 43.0, fat: 10.0, sugar: 1.2, servingSize: "1 plate (290g)" },
  { foodName: "Jeera Rice", calories: 210, protein: 4.0, carbs: 42.0, fat: 3.2, sugar: 0.1, servingSize: "1 cup (180g)" },
  { foodName: "Curd Rice", calories: 200, protein: 5.5, carbs: 32.0, fat: 5.8, sugar: 3.0, servingSize: "1 cup (200g)" },
  { foodName: "Khichdi (Moong Dal)", calories: 190, protein: 6.8, carbs: 34.0, fat: 3.5, sugar: 0.8, servingSize: "1 cup (200g)" },
  { foodName: "Lemon Rice", calories: 230, protein: 4.2, carbs: 41.0, fat: 6.0, sugar: 0.5, servingSize: "1 cup (180g)" },
  { foodName: "Basmati Rice (Cooked)", calories: 205, protein: 4.3, carbs: 44.5, fat: 0.4, sugar: 0.1, servingSize: "1 cup (158g)" },

  // --- Indian Non-Veg Dishes ---
  { foodName: "Butter Chicken (Murgh Makhani)", calories: 380, protein: 28.0, carbs: 12.0, fat: 24.0, sugar: 4.5, servingSize: "1 cup (220g)" },
  { foodName: "Chicken Tikka Masala", calories: 340, protein: 29.0, carbs: 10.0, fat: 20.0, sugar: 3.8, servingSize: "1 cup (220g)" },
  { foodName: "Home-style Chicken Curry", calories: 260, protein: 26.0, carbs: 8.0, fat: 14.0, sugar: 1.8, servingSize: "1 cup (220g)" },
  { foodName: "Tandoori Chicken", calories: 220, protein: 30.0, carbs: 3.0, fat: 9.5, sugar: 0.5, servingSize: "1 leg piece (150g)" },
  { foodName: "Chicken Tikka (Dry)", calories: 210, protein: 32.0, carbs: 4.0, fat: 7.2, sugar: 0.8, servingSize: "6 pieces (150g)" },
  { foodName: "Mutton Curry / Rogan Josh", calories: 350, protein: 27.0, carbs: 7.0, fat: 24.0, sugar: 1.2, servingSize: "1 cup (220g)" },
  { foodName: "Egg Curry (2 Eggs)", calories: 240, protein: 14.5, carbs: 8.0, fat: 16.5, sugar: 2.0, servingSize: "1 cup (200g)" },
  { foodName: "Egg Bhurji (2 Eggs)", calories: 210, protein: 13.5, carbs: 4.0, fat: 15.0, sugar: 1.2, servingSize: "1 plate (140g)" },
  { foodName: "Indian Fish Curry", calories: 220, protein: 24.0, carbs: 6.0, fat: 11.0, sugar: 1.0, servingSize: "1 cup (200g)" },
  { foodName: "Fish Fry (Rava Fry)", calories: 250, protein: 23.0, carbs: 11.0, fat: 12.5, sugar: 0.2, servingSize: "1 fillet (130g)" },

  // --- Indian Snacks & Street Food ---
  { foodName: "Samosa (Potato)", calories: 262, protein: 3.5, carbs: 32.0, fat: 13.5, sugar: 1.8, servingSize: "1 samosa (90g)" },
  { foodName: "Pav Bhaji", calories: 380, protein: 8.5, carbs: 54.0, fat: 15.0, sugar: 6.0, servingSize: "Bhaji + 2 Pavs (280g)" },
  { foodName: "Vada Pav", calories: 290, protein: 6.0, carbs: 42.0, fat: 11.0, sugar: 3.0, servingSize: "1 vada pav (120g)" },
  { foodName: "Medu Vada", calories: 150, protein: 4.0, carbs: 16.0, fat: 8.0, sugar: 0.2, servingSize: "1 vada (50g)" },
  { foodName: "Khaman Dhokla", calories: 160, protein: 5.5, carbs: 26.0, fat: 4.0, sugar: 4.5, servingSize: "2 pieces (80g)" },
  { foodName: "Pani Puri / Golgappa", calories: 180, protein: 2.5, carbs: 28.0, fat: 6.5, sugar: 2.0, servingSize: "6 puris (120g)" },
  { foodName: "Bhel Puri", calories: 210, protein: 4.2, carbs: 36.0, fat: 5.8, sugar: 3.5, servingSize: "1 plate (150g)" },
  { foodName: "Onion Pakora / Bhajji", calories: 220, protein: 4.0, carbs: 22.0, fat: 13.0, sugar: 2.0, servingSize: "4 pieces (100g)" },
  { foodName: "Paneer Tikka (Grilled)", calories: 240, protein: 14.0, carbs: 7.0, fat: 17.0, sugar: 1.5, servingSize: "5 pieces (150g)" },

  // --- Indian Sweets & Beverages ---
  { foodName: "Gulab Jamun", calories: 150, protein: 2.2, carbs: 24.0, fat: 5.2, sugar: 18.0, servingSize: "1 piece (50g)" },
  { foodName: "Rasgulla", calories: 125, protein: 2.8, carbs: 23.0, fat: 2.2, sugar: 17.5, servingSize: "1 piece (50g)" },
  { foodName: "Rice Kheer / Payasam", calories: 220, protein: 5.5, carbs: 34.0, fat: 7.2, sugar: 22.0, servingSize: "1 cup (180g)" },
  { foodName: "Gajar Ka Halwa", calories: 280, protein: 4.8, carbs: 38.0, fat: 12.5, sugar: 26.0, servingSize: "1 bowl (150g)" },
  { foodName: "Moong Dal Halwa", calories: 320, protein: 6.0, carbs: 39.0, fat: 16.0, sugar: 24.0, servingSize: "1 bowl (120g)" },
  { foodName: "Jalebi", calories: 180, protein: 1.0, carbs: 36.0, fat: 3.8, sugar: 28.0, servingSize: "2 pieces (50g)" },
  { foodName: "Mango Lassi", calories: 210, protein: 5.2, carbs: 34.0, fat: 6.0, sugar: 28.0, servingSize: "1 glass (250ml)" },
  { foodName: "Sweet Lassi", calories: 190, protein: 6.0, carbs: 28.0, fat: 6.2, sugar: 24.0, servingSize: "1 glass (250ml)" },
  { foodName: "Masala Chaas / Spiced Buttermilk", calories: 45, protein: 2.5, carbs: 3.8, fat: 2.2, sugar: 3.5, servingSize: "1 glass (250ml)" },
  { foodName: "Masala Chai (with Milk & Sugar)", calories: 90, protein: 2.8, carbs: 12.0, fat: 3.2, sugar: 10.0, servingSize: "1 cup (150ml)" },

  // --- Indian Staples & Dairy ---
  { foodName: "Paneer (Raw Cottage Cheese)", calories: 265, protein: 18.3, carbs: 1.2, fat: 20.8, sugar: 1.0, servingSize: "100g" },
  { foodName: "Fresh Dahi / Curd", calories: 98, protein: 11.0, carbs: 3.4, fat: 4.3, sugar: 3.4, servingSize: "1 cup (200g)" },
  { foodName: "Desi Ghee", calories: 112, protein: 0, carbs: 0, fat: 12.7, sugar: 0, servingSize: "1 tbsp (14g)" },

  // --- Western & Global Basics ---
  { foodName: "Apple (medium)", calories: 95, protein: 0.5, carbs: 25, fat: 0.3, sugar: 19, servingSize: "1 medium (182g)" },
  { foodName: "Banana (medium)", calories: 105, protein: 1.3, carbs: 27, fat: 0.4, sugar: 14, servingSize: "1 medium (118g)" },
  { foodName: "Orange (medium)", calories: 62, protein: 1.2, carbs: 15.4, fat: 0.2, sugar: 12.2, servingSize: "1 medium (131g)" },
  { foodName: "Avocado (medium)", calories: 240, protein: 3.0, carbs: 12.0, fat: 22.0, sugar: 1.3, servingSize: "1 medium (150g)" },
  { foodName: "Chicken Breast (grilled)", calories: 165, protein: 31, carbs: 0, fat: 3.6, sugar: 0, servingSize: "100g" },
  { foodName: "Egg (large boiled)", calories: 78, protein: 6.3, carbs: 0.6, fat: 5.3, sugar: 0.6, servingSize: "1 large (50g)" },
  { foodName: "Salmon Fillet (baked)", calories: 206, protein: 22.0, carbs: 0, fat: 12.4, sugar: 0, servingSize: "100g" },
  { foodName: "Oatmeal (cooked)", calories: 166, protein: 5.9, carbs: 28.1, fat: 3.6, sugar: 1.1, servingSize: "1 cup (234g)" },
  { foodName: "Broccoli (steamed)", calories: 54, protein: 3.7, carbs: 10.0, fat: 0.6, sugar: 2.2, servingSize: "1 cup (150g)" },
  { foodName: "Sweet Potato (baked)", calories: 103, protein: 2.0, carbs: 24.0, fat: 0.2, sugar: 7.4, servingSize: "1 medium (114g)" },
  { foodName: "Almonds (raw)", calories: 164, protein: 6.0, carbs: 6.1, fat: 14.1, sugar: 1.2, servingSize: "28g (23 nuts)" },
  { foodName: "Whey Protein Shake", calories: 140, protein: 25.0, carbs: 4.0, fat: 2.0, sugar: 1.5, servingSize: "1 shake (300ml)" },
  { foodName: "Whey Protein Powder", calories: 120, protein: 24.0, carbs: 3.0, fat: 1.5, sugar: 1.0, servingSize: "1 scoop (30g)" }
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

function matchesDate(loggedAt, dateStr) {
  if (!loggedAt || !dateStr) return false;
  if (typeof loggedAt === 'string') {
    if (loggedAt.startsWith(dateStr)) return true;
    const match = loggedAt.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match && match[1] === dateStr) return true;
  }
  try {
    const d = new Date(loggedAt);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      if (`${year}-${month}-${day}` === dateStr) return true;

      const uYear = d.getUTCFullYear();
      const uMonth = String(d.getUTCMonth() + 1).padStart(2, '0');
      const uDay = String(d.getUTCDate()).padStart(2, '0');
      if (`${uYear}-${uMonth}-${uDay}` === dateStr) return true;
    }
  } catch (e) {}
  return false;
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
          sugar: Number(d.sugar || 0),
          servingSize: d.serving_size || d.servingSize || '1 serving',
          quantity: Number(d.quantity || 1),
          mealType: d.meal_type || d.mealType,
          loggedAt: d.logged_at || d.loggedAt
        }));
        if (dateStr) {
          entries = entries.filter(e => e.loggedAt && matchesDate(e.loggedAt, dateStr));
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
    entries = entries.filter(entry => matchesDate(entry.loggedAt, dateStr));
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
        sugar: entry.sugar,
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
          entries = entries.filter(e => e.loggedAt && matchesDate(e.loggedAt, dateStr));
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
    entries = entries.filter(e => matchesDate(e.loggedAt, dateStr));
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
