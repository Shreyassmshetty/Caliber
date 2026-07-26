import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');
const JWT_SECRET = process.env.JWT_SECRET || 'calorie-nutrition-tracker-secret-key-12345';

// Initialize Firestore safely with a fallback flag
let dbFirestore: Firestore | null = null;

export function handleFirestoreError(err: any, context?: string) {
  const errMsg = err?.message || String(err);
  const isApiDisabledOrPermDenied = 
    errMsg.includes('PERMISSION_DENIED') || 
    errMsg.includes('Cloud Firestore API has not been used') || 
    errMsg.includes('disabled') || 
    errMsg.includes('has not been used') ||
    errMsg.includes('code: 7') ||
    errMsg.includes('code 7');

  if (isApiDisabledOrPermDenied && dbFirestore !== null) {
    console.warn(`[Firestore Status] ${context ? context + ': ' : ''}Firestore API is disabled or permissions are missing. Disabling Firestore adapter permanently for this session and falling back to robust Local JSON database. Details: ${errMsg}`);
    dbFirestore = null;
  } else {
    console.warn(`[Firestore Warning] ${context ? context + ': ' : ''}Operation failed with error: ${errMsg}. Falling back to Local JSON database.`);
  }
}

try {
  const hasCreds = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_CONFIG;
  const isGcp = process.env.K_SERVICE || process.env.GOOGLE_CLOUD_PROJECT;
  
  if (hasCreds || isGcp) {
    if (getApps().length === 0) {
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        try {
          const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
          initializeApp({
            credential: cert(serviceAccount)
          });
        } catch (e) {
          initializeApp();
        }
      } else {
        initializeApp();
      }
    }
    dbFirestore = getFirestore();
    dbFirestore.settings({ ignoreUndefinedProperties: true });
    
    // Asynchronously probe Firestore database availability right away to avoid high latency on user requests
    dbFirestore.collection('_startup_probe').limit(1).get()
      .then(() => {
        console.log("Firestore startup connection probe succeeded. Persistent Cloud Firestore active.");
      })
      .catch((err) => {
        handleFirestoreError(err, 'Startup Connection Probe');
      });
  } else {
    console.log("No cloud credentials found. Running on robust Local JSON file database.");
  }
} catch (err) {
  console.warn("Could not connect to Firestore (Permission/Config). Operating on Local JSON database fallback. Error:", err);
}

// Predefined fallback foods list
export const LOCAL_FOODS = [
  { foodName: "Apple (medium)", calories: 95, protein: 0.5, carbs: 25, fat: 0.3, servingSize: "1 medium (182g)" },
  { foodName: "Banana (medium)", calories: 105, protein: 1.3, carbs: 27, fat: 0.4, servingSize: "1 medium (118g)" },
  { foodName: "Chicken Breast (grilled)", calories: 165, protein: 31, carbs: 0, fat: 3.6, servingSize: "100g" },
  { foodName: "Egg (large boiled)", calories: 78, protein: 6.3, carbs: 0.6, fat: 5.3, servingSize: "1 large (50g)" },
  { foodName: "White Rice (cooked)", calories: 205, protein: 4.2, carbs: 44.5, fat: 0.4, servingSize: "1 cup (158g)" },
  { foodName: "Brown Rice (cooked)", calories: 216, protein: 5.0, carbs: 44.8, fat: 1.8, servingSize: "1 cup (195g)" },
  { foodName: "Milk (2% fat)", calories: 122, protein: 8.1, carbs: 11.7, fat: 4.8, servingSize: "1 cup (244g)" },
  { foodName: "Salmon Fillet (baked)", calories: 206, protein: 22.0, carbs: 0, fat: 12.4, servingSize: "100g" },
  { foodName: "Avocado (medium)", calories: 240, protein: 3.0, carbs: 12.0, fat: 22.0, servingSize: "1 medium (150g)" },
  { foodName: "Oatmeal (cooked)", calories: 166, protein: 5.9, carbs: 28.1, fat: 3.6, servingSize: "1 cup (234g)" },
  { foodName: "Peanut Butter (creamy)", calories: 94, protein: 4.0, carbs: 3.1, fat: 8.1, servingSize: "1 tbsp (16g)" },
  { foodName: "Whole Wheat Bread", calories: 81, protein: 4.0, carbs: 13.8, fat: 1.1, servingSize: "1 slice (28g)" },
  { foodName: "Greek Yogurt (plain, non-fat)", calories: 90, protein: 15.5, carbs: 5.4, fat: 0.4, servingSize: "1 container (150g)" },
  { foodName: "Broccoli (steamed)", calories: 54, protein: 3.7, carbs: 10.0, fat: 0.6, servingSize: "1 cup (150g)" },
  { foodName: "Sweet Potato (baked)", calories: 112, protein: 2.0, carbs: 26.0, fat: 0.2, servingSize: "1 medium (114g)" },
  { foodName: "Olive Oil", calories: 119, protein: 0, carbs: 0, fat: 13.5, servingSize: "1 tbsp (13.5g)" },
  { foodName: "Ground Beef (lean 90/10)", calories: 200, protein: 26.0, carbs: 0, fat: 10.0, servingSize: "100g" },
  { foodName: "Tuna (canned in water)", calories: 116, protein: 26.0, carbs: 0, fat: 1.0, servingSize: "100g" },
  { foodName: "Pasta (cooked spaghetti)", calories: 220, protein: 8.1, carbs: 43.0, fat: 1.3, servingSize: "1 cup (140g)" },
  { foodName: "Almonds (raw)", calories: 164, protein: 6.0, carbs: 6.1, fat: 14.1, servingSize: "28g (23 nuts)" },
  { foodName: "Protein Powder (Whey)", calories: 120, protein: 24.0, carbs: 3.0, fat: 1.5, servingSize: "1 scoop (30g)" },
  { foodName: "Orange (medium)", calories: 62, protein: 1.2, carbs: 15.4, fat: 0.2, servingSize: "1 medium (131g)" },
  { foodName: "Blueberries (raw)", calories: 85, protein: 1.1, carbs: 21.0, fat: 0.5, servingSize: "1 cup (148g)" },
  { foodName: "Spinach (raw)", calories: 7, protein: 0.9, carbs: 1.1, fat: 0.1, servingSize: "1 cup (30g)" },
];

export interface Reminder {
  id: string;
  time: string;
  message: string;
  enabled: boolean;
}

export interface UserProfile {
  name?: string;
  age?: number;
  weight?: number;
  height?: number;
  sex?: 'male' | 'female';
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  goal?: 'lose' | 'maintain' | 'gain';
  dailyCalorieTarget?: number;
  macroProteinPercentage?: number;
  macroCarbsPercentage?: number;
  macroFatPercentage?: number;
  onboarded?: boolean;
  hideCaloriesRemaining?: boolean;
  reminders?: Reminder[];
  darkMode?: boolean;
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  profile: UserProfile;
}

export interface FoodEntry {
  id: string;
  userId: string;
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: string;
  quantity: number;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snacks';
  loggedAt: string; // ISO String
}

export interface ExerciseEntry {
  id: string;
  userId: string;
  activityType: string;
  durationMinutes: number;
  caloriesBurned: number;
  loggedAt: string; // ISO String
}

export interface CustomMealIngredient {
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  quantity: number;
  servingSize: string;
}

export interface CustomMeal {
  id: string;
  userId: string;
  mealName: string;
  ingredients: CustomMealIngredient[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  createdAt: string; // ISO String
}

export interface WaterLog {
  id: string;
  userId: string;
  glasses: number;
  dateStr: string; // YYYY-MM-DD
  updatedAt: string; // ISO String
}

export interface DatabaseSchema {
  users: User[];
  foodEntries: FoodEntry[];
  exercises: ExerciseEntry[];
  customMeals: CustomMeal[];
  waterLogs: WaterLog[];
}

// Ensure database file exists
export function initDb() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    const defaultData: DatabaseSchema = {
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
export function readDb(): DatabaseSchema {
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
export function writeDb(data: DatabaseSchema) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error writing database:", error);
  }
}

// Helper: Generate JWT token
export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '10y' });
}

// Helper: Verify JWT token
export function verifyToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string };
  } catch (err) {
    return null;
  }
}

// ==================== FIRESTORE ADAPTERS WITH LOCAL DB FALLBACK ====================

// 1. Get user by ID
export async function getUserById(id: string): Promise<User | null> {
  if (dbFirestore) {
    try {
      const doc = await dbFirestore.collection('users').doc(id).get();
      if (doc.exists) {
        const data = doc.data();
        return {
          id: doc.id,
          email: data?.email,
          passwordHash: data?.passwordHash,
          profile: data?.profile || {}
        } as User;
      }
    } catch (err) {
      handleFirestoreError(err, "getUserById");
    }
  }
  const db = readDb();
  return db.users.find(u => u.id === id) || null;
}

// 2. Get user by email
export async function getUserByEmail(email: string): Promise<User | null> {
  const normEmail = email.toLowerCase().trim();
  if (dbFirestore) {
    try {
      const snap = await dbFirestore.collection('users').where('email', '==', normEmail).limit(1).get();
      if (!snap.empty) {
        const doc = snap.docs[0];
        const data = doc.data();
        return {
          id: doc.id,
          email: data.email,
          passwordHash: data.passwordHash,
          profile: data.profile || {}
        } as User;
      }
    } catch (err) {
      handleFirestoreError(err, "getUserByEmail");
    }
  }
  const db = readDb();
  return db.users.find(u => u.email.toLowerCase() === normEmail) || null;
}

// 3. Create user
export async function createUser(user: User): Promise<void> {
  if (dbFirestore) {
    try {
      await dbFirestore.collection('users').doc(user.id).set({
        email: user.email,
        passwordHash: user.passwordHash,
        profile: user.profile
      });
      console.log(`User ${user.id} created in Firestore`);
      return;
    } catch (err) {
      handleFirestoreError(err, "createUser");
    }
  }
  const db = readDb();
  db.users.push(user);
  writeDb(db);
}

// 4. Update user profile
export async function updateUserProfile(userId: string, profile: UserProfile): Promise<void> {
  if (dbFirestore) {
    try {
      await dbFirestore.collection('users').doc(userId).update({ profile });
      console.log(`User profile updated in Firestore for ${userId}`);
      return;
    } catch (err) {
      handleFirestoreError(err, "updateUserProfile");
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
export async function getFoodEntries(userId: string, dateStr?: string): Promise<FoodEntry[]> {
  if (dbFirestore) {
    try {
      const snap = await dbFirestore.collection('users').doc(userId).collection('foodEntries').get();
      let entries = snap.docs.map(doc => ({ id: doc.id, userId, ...doc.data() } as FoodEntry));
      if (dateStr) {
        entries = entries.filter(e => e.loggedAt && e.loggedAt.startsWith(dateStr));
      }
      return entries;
    } catch (err) {
      handleFirestoreError(err, "getFoodEntries");
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
export async function logFoodEntry(entry: FoodEntry): Promise<void> {
  if (dbFirestore) {
    try {
      await dbFirestore.collection('users').doc(entry.userId).collection('foodEntries').doc(entry.id).set({
        foodName: entry.foodName,
        calories: entry.calories,
        protein: entry.protein,
        carbs: entry.carbs,
        fat: entry.fat,
        servingSize: entry.servingSize,
        quantity: entry.quantity,
        mealType: entry.mealType,
        loggedAt: entry.loggedAt,
        userId: entry.userId
      });
      console.log(`Food entry ${entry.id} saved to Firestore`);
      return;
    } catch (err) {
      handleFirestoreError(err, "logFoodEntry");
    }
  }
  const db = readDb();
  db.foodEntries.push(entry);
  writeDb(db);
}

// 7. Delete food entry
export async function deleteFoodEntry(userId: string, id: string): Promise<boolean> {
  if (dbFirestore) {
    try {
      await dbFirestore.collection('users').doc(userId).collection('foodEntries').doc(id).delete();
      console.log(`Food entry ${id} deleted from Firestore`);
      return true;
    } catch (err) {
      handleFirestoreError(err, "deleteFoodEntry");
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
export async function getExercises(userId: string, dateStr?: string): Promise<ExerciseEntry[]> {
  if (dbFirestore) {
    try {
      const snap = await dbFirestore.collection('users').doc(userId).collection('exercises').get();
      let entries = snap.docs.map(doc => ({ id: doc.id, userId, ...doc.data() } as ExerciseEntry));
      if (dateStr) {
        entries = entries.filter(e => e.loggedAt && e.loggedAt.startsWith(dateStr));
      }
      return entries;
    } catch (err) {
      handleFirestoreError(err, "getExercises");
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
export async function logExercise(entry: ExerciseEntry): Promise<void> {
  if (dbFirestore) {
    try {
      await dbFirestore.collection('users').doc(entry.userId).collection('exercises').doc(entry.id).set({
        activityType: entry.activityType,
        durationMinutes: entry.durationMinutes,
        caloriesBurned: entry.caloriesBurned,
        loggedAt: entry.loggedAt,
        userId: entry.userId
      });
      console.log(`Exercise entry ${entry.id} saved to Firestore`);
      return;
    } catch (err) {
      handleFirestoreError(err, "logExercise");
    }
  }
  const db = readDb();
  db.exercises.push(entry);
  writeDb(db);
}

// 10. Delete exercise
export async function deleteExercise(userId: string, id: string): Promise<boolean> {
  if (dbFirestore) {
    try {
      await dbFirestore.collection('users').doc(userId).collection('exercises').doc(id).delete();
      console.log(`Exercise entry ${id} deleted from Firestore`);
      return true;
    } catch (err) {
      handleFirestoreError(err, "deleteExercise");
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
export async function getCustomMeals(userId: string): Promise<CustomMeal[]> {
  if (dbFirestore) {
    try {
      const snap = await dbFirestore.collection('users').doc(userId).collection('customMeals').get();
      return snap.docs.map(doc => ({ id: doc.id, userId, ...doc.data() } as CustomMeal));
    } catch (err) {
      handleFirestoreError(err, "getCustomMeals");
    }
  }
  const db = readDb();
  return db.customMeals.filter(m => m.userId === userId);
}

// 12. Create custom meal
export async function createCustomMeal(meal: CustomMeal): Promise<void> {
  if (dbFirestore) {
    try {
      await dbFirestore.collection('users').doc(meal.userId).collection('customMeals').doc(meal.id).set({
        mealName: meal.mealName,
        ingredients: meal.ingredients,
        totalCalories: meal.totalCalories,
        totalProtein: meal.totalProtein,
        totalCarbs: meal.totalCarbs,
        totalFat: meal.totalFat,
        createdAt: meal.createdAt,
        userId: meal.userId
      });
      console.log(`Custom meal ${meal.id} saved to Firestore`);
      return;
    } catch (err) {
      handleFirestoreError(err, "createCustomMeal");
    }
  }
  const db = readDb();
  db.customMeals.push(meal);
  writeDb(db);
}

// 13. Delete custom meal
export async function deleteCustomMeal(userId: string, id: string): Promise<boolean> {
  if (dbFirestore) {
    try {
      await dbFirestore.collection('users').doc(userId).collection('customMeals').doc(id).delete();
      console.log(`Custom meal ${id} deleted from Firestore`);
      return true;
    } catch (err) {
      handleFirestoreError(err, "deleteCustomMeal");
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
export async function getWaterLog(userId: string, dateStr: string): Promise<WaterLog | null> {
  if (dbFirestore) {
    try {
      const doc = await dbFirestore.collection('users').doc(userId).collection('waterIntake').doc(dateStr).get();
      if (doc.exists) {
        return { id: doc.id, userId, dateStr, ...doc.data() } as WaterLog;
      }
    } catch (err) {
      handleFirestoreError(err, "getWaterLog");
    }
  }
  const db = readDb();
  return db.waterLogs.find(w => w.userId === userId && w.dateStr === dateStr) || null;
}

// 15. Update water log
export async function updateWaterLog(userId: string, dateStr: string, glasses: number): Promise<WaterLog> {
  const finalGlasses = Math.max(0, Number(glasses));
  if (dbFirestore) {
    try {
      const ref = dbFirestore.collection('users').doc(userId).collection('waterIntake').doc(dateStr);
      const data = {
        glasses: finalGlasses,
        updatedAt: new Date().toISOString()
      };
      await ref.set(data, { merge: true });
      console.log(`Water log updated in Firestore for user ${userId} date ${dateStr}`);
      return { id: dateStr, userId, dateStr, ...data } as WaterLog;
    } catch (err) {
      handleFirestoreError(err, "updateWaterLog");
    }
  }
  const db = readDb();
  let logIdx = db.waterLogs.findIndex(w => w.userId === userId && w.dateStr === dateStr);
  if (logIdx === -1) {
    const newLog: WaterLog = {
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

