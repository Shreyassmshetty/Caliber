import express, { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import bcrypt from "bcryptjs";
import { GoogleGenAI, Type } from "@google/genai";
import {
  initDb,
  readDb,
  writeDb,
  generateToken,
  verifyToken,
  LOCAL_FOODS,
  User,
  FoodEntry,
  ExerciseEntry,
  CustomMeal,
  WaterLog,
  UserProfile,
  getUserById,
  getUserByEmail,
  createUser,
  updateUserProfile,
  getFoodEntries,
  logFoodEntry,
  deleteFoodEntry,
  getExercises,
  logExercise,
  deleteExercise,
  getCustomMeals,
  createCustomMeal,
  deleteCustomMeal,
  getWaterLog,
  updateWaterLog
} from "./server-db.js";

// Initialize local database on start
initDb();

const app = express();
const PORT = 3000;

// Enable JSON parse with higher limit for photo upload
app.use(express.json({ limit: '10mb' }));

// Middleware: Authenticate user via JWT in Authorization header
export interface AuthenticatedRequest extends Request {
  userId?: string;
}

function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: "Access token required" });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(403).json({ error: "Invalid or expired token" });
    return;
  }

  req.userId = payload.userId;
  next();
}

// ==================== AUTH ENDPOINTS ====================

// Sign Up
app.post("/api/auth/signup", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const existingUser = await getUserByEmail(email);

  if (existingUser) {
    res.status(400).json({ error: "User already exists with this email" });
    return;
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const newUser: User = {
    id: `u_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    email: email.toLowerCase(),
    passwordHash,
    profile: {
      onboarded: false,
      hideCaloriesRemaining: false,
      macroProteinPercentage: 30,
      macroCarbsPercentage: 45,
      macroFatPercentage: 25,
    }
  };

  await createUser(newUser);

  const token = generateToken(newUser.id);
  res.status(201).json({
    token,
    user: {
      id: newUser.id,
      email: newUser.email,
      profile: newUser.profile
    }
  });
});

// Log In
app.post("/api/auth/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const user = await getUserByEmail(email);

  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = generateToken(user.id);
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      profile: user.profile
    }
  });
});

// Get Current User (Me)
app.get("/api/auth/me", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const user = await getUserById(req.userId!);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    email: user.email,
    profile: user.profile
  });
});

// ==================== GOOGLE LOGIN ENDPOINTS ====================

// Get Google Login URL
app.get("/api/auth/google/url", (req: Request, res: Response) => {
  const { redirect_uri } = req.query;
  if (!redirect_uri) {
    res.status(400).json({ error: "redirect_uri query parameter is required" });
    return;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    // If credentials are not set, direct the popup to our sandbox simulator interface.
    const sandboxUrl = `${redirect_uri}?is_sandbox=true`;
    res.json({ url: sandboxUrl });
    return;
  }

  // Real Google OAuth URL
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect_uri as string,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",
    state: redirect_uri as string,
    access_type: "offline",
    prompt: "consent"
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  res.json({ url: authUrl });
});

// Post endpoint to complete simulated Google Login
app.post("/api/auth/google/simulate", async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  const normalizedEmail = email.toLowerCase().trim();
  let user = await getUserByEmail(normalizedEmail);

  if (!user) {
    user = {
      id: `u_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email: normalizedEmail,
      passwordHash: `google_simulated_${Date.now()}`,
      profile: {
        onboarded: false,
        hideCaloriesRemaining: false,
        macroProteinPercentage: 30,
        macroCarbsPercentage: 45,
        macroFatPercentage: 25,
      }
    };
    await createUser(user);
  }

  const token = generateToken(user.id);
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      profile: user.profile
    }
  });
});

// Google OAuth callback (supports trailing slash variants)
app.get(["/auth/google/callback", "/auth/google/callback/"], async (req: Request, res: Response) => {
  const { code, state, error, is_sandbox } = req.query;

  // 1. Check if sandbox/simulator mode is requested or credentials are missing
  if (is_sandbox === "true" || (!process.env.GOOGLE_CLIENT_ID && !code)) {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Google Sign-In Sandbox</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script src="https://cdn.tailwindcss.com"></script>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
          <style>
            body { font-family: 'Inter', sans-serif; }
          </style>
        </head>
        <body class="bg-gray-50 flex items-center justify-center min-h-screen p-4">
          <div class="max-w-md w-full bg-white rounded-3xl shadow-xl border border-gray-100 p-8 text-center">
            <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-orange-50 text-orange-600 mb-6">
              <svg class="w-8 h-8" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
              </svg>
            </div>
            <h2 class="text-2xl font-bold text-gray-900 tracking-tight mb-2">
              Google Auth Sandbox
            </h2>
            <p class="text-sm text-gray-500 mb-6 leading-relaxed">
              Google login is fully integrated! Real credentials are not configured yet, so you can test the entire onboarding and tracking experience in this developer sandbox.
            </p>

            <form id="sandbox-form" class="space-y-4">
              <div class="text-left">
                <label class="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                  Simulated User Email
                </label>
                <input
                  type="email"
                  id="email"
                  required
                  value="shreyassmshetty@gmail.com"
                  placeholder="user@example.com"
                  class="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition"
                />
              </div>
              <button
                type="submit"
                class="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl shadow-md transition duration-200 text-sm"
              >
                Simulate Google Login
              </button>
            </form>

            <div class="mt-6 pt-6 border-t border-gray-100 text-left">
              <p class="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2">How to go live:</p>
              <ol class="text-xs text-gray-500 space-y-1 list-decimal pl-4">
                <li>Create OAuth 2.0 credentials in Google Cloud Console</li>
                <li>Set Authorized Redirect URIs to match your app URL</li>
                <li>Add <code class="bg-gray-100 px-1 rounded font-mono">GOOGLE_CLIENT_ID</code> and <code class="bg-gray-100 px-1 rounded font-mono">GOOGLE_CLIENT_SECRET</code> in Settings</li>
              </ol>
            </div>
          </div>

          <script>
            document.getElementById('sandbox-form').addEventListener('submit', async (e) => {
              e.preventDefault();
              const emailInput = document.getElementById('email').value.trim();
              
              if (!emailInput) return;

              try {
                const response = await fetch('/api/auth/google/simulate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email: emailInput })
                });

                if (response.ok) {
                  const data = await response.json();
                  if (window.opener) {
                    window.opener.postMessage({
                      type: 'GOOGLE_AUTH_SUCCESS',
                      token: data.token,
                      user: data.user
                    }, '*');
                    window.close();
                  } else {
                    localStorage.setItem('cnt_token', data.token);
                    window.location.href = '/';
                  }
                } else {
                  const errData = await response.json();
                  alert('Simulation failed: ' + (errData.error || 'Unknown error'));
                }
              } catch (err) {
                alert('Network error in simulator: ' + err.message);
              }
            });
          </script>
        </body>
      </html>
    `);
    return;
  }

  // 2. Real Google OAuth Callback flow
  if (error) {
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'GOOGLE_AUTH_ERROR', error: '${error}' }, '*');
              window.close();
            }
          </script>
          <p>Authentication failed: ${error}</p>
        </body>
      </html>
    `);
    return;
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    const redirectUri = state as string; // State holds our dynamic redirectUri!

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error("Missing Google OAuth credentials or redirect configuration");
    }

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: code as string,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      })
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error("Google token exchange error details:", errBody);
      throw new Error("Failed to exchange code for tokens");
    }

    const tokens = await tokenRes.json();
    const { access_token } = tokens;

    // Fetch user profile info
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { "Authorization": `Bearer ${access_token}` }
    });

    if (!profileRes.ok) {
      throw new Error("Failed to fetch user profile info from Google");
    }

    const googleUser = await profileRes.json();
    const { email } = googleUser;

    if (!email) {
      throw new Error("Email address not returned by Google");
    }

    // Sign in / Sign up user in our database
    let user = await getUserByEmail(email);

    if (!user) {
      user = {
        id: `u_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        email: email.toLowerCase().trim(),
        passwordHash: `google_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        profile: {
          onboarded: false,
          hideCaloriesRemaining: false,
          macroProteinPercentage: 30,
          macroCarbsPercentage: 45,
          macroFatPercentage: 25,
        }
      };
      await createUser(user);
    }

    const jwtToken = generateToken(user.id);

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'GOOGLE_AUTH_SUCCESS',
                token: '${jwtToken}',
                user: {
                  id: '${user.id}',
                  email: '${user.email}',
                  profile: ${JSON.stringify(user.profile)}
                }
              }, '*');
              window.close();
            } else {
              localStorage.setItem('cnt_token', '${jwtToken}');
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `);

  } catch (err: any) {
    console.error("Google OAuth callback error", err);
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'GOOGLE_AUTH_ERROR', error: '${err?.message || "Internal server error during authentication"}' }, '*');
              window.close();
            }
          </script>
          <p>Authentication failed: ${err?.message || "Internal server error"}</p>
        </body>
      </html>
    `);
  }
});

// ==================== ONBOARDING & PROFILE ENDPOINTS ====================

// Update Profile & Targets (Mifflin-St Jeor Calculation)
app.post("/api/profile/update", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const {
    name,
    age,
    weight, // kg
    height, // cm
    sex, // male / female
    activityLevel, // sedentary, light, moderate, active, very_active
    goal, // lose, maintain, gain
    macroProteinPercentage,
    macroCarbsPercentage,
    macroFatPercentage,
    hideCaloriesRemaining,
    customCalorieTarget,
    reminders,
    darkMode
  } = req.body;

  const user = await getUserById(req.userId!);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const oldProfile = user.profile;

  // Merge profile inputs
  const profile: UserProfile = {
    ...oldProfile,
    ...(name !== undefined && { name }),
    ...(age !== undefined && { age: Number(age) }),
    ...(weight !== undefined && { weight: Number(weight) }),
    ...(height !== undefined && { height: Number(height) }),
    ...(sex !== undefined && { sex }),
    ...(activityLevel !== undefined && { activityLevel }),
    ...(goal !== undefined && { goal }),
    ...(macroProteinPercentage !== undefined && { macroProteinPercentage: Number(macroProteinPercentage) }),
    ...(macroCarbsPercentage !== undefined && { macroCarbsPercentage: Number(macroCarbsPercentage) }),
    ...(macroFatPercentage !== undefined && { macroFatPercentage: Number(macroFatPercentage) }),
    ...(hideCaloriesRemaining !== undefined && { hideCaloriesRemaining: Boolean(hideCaloriesRemaining) }),
    ...(reminders !== undefined && { reminders }),
    ...(darkMode !== undefined && { darkMode: Boolean(darkMode) }),
    onboarded: true
  };

  // Calorie Target Calculation (Mifflin-St Jeor)
  if (profile.weight && profile.height && profile.age && profile.sex && profile.activityLevel && profile.goal) {
    // BMR
    let bmr = 0;
    if (profile.sex === 'male') {
      bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5;
    } else {
      bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age - 161;
    }

    // Activity Multiplier
    const multipliers = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      very_active: 1.9
    };
    const tdee = bmr * (multipliers[profile.activityLevel] || 1.2);

    // Goal adjustments
    let target = tdee;
    if (profile.goal === 'lose') {
      target = tdee - 500;
      if (target < 1200) target = 1200; // Minimum safety boundary
    } else if (profile.goal === 'gain') {
      target = tdee + 500;
    }

    profile.dailyCalorieTarget = Math.round(target);
  }

  // Override calorie target if specifically requested
  if (customCalorieTarget !== undefined) {
    profile.dailyCalorieTarget = Number(customCalorieTarget);
  }

  // Ensure default macro split if not defined
  if (profile.macroProteinPercentage === undefined) profile.macroProteinPercentage = 30;
  if (profile.macroCarbsPercentage === undefined) profile.macroCarbsPercentage = 45;
  if (profile.macroFatPercentage === undefined) profile.macroFatPercentage = 25;

  await updateUserProfile(req.userId!, profile);

  res.json({
    message: "Profile updated successfully",
    profile
  });
});

// ==================== FOOD LOGGING & SEARCH ENDPOINTS ====================

// Search food database (USDA with fallback to local)
app.get("/api/food/search", async (req: Request, res: Response) => {
  const query = (req.query.q as string || '').trim().toLowerCase();

  if (!query) {
    res.json([]);
    return;
  }

  // Filter local database items first as candidate results
  const localResults = LOCAL_FOODS.filter(food =>
    food.foodName.toLowerCase().includes(query)
  ).map(item => ({
    foodName: item.foodName,
    calories: item.calories,
    protein: item.protein,
    carbs: item.carbs,
    fat: item.fat,
    servingSize: item.servingSize,
    source: 'Local Database'
  }));

  // Attempt USDA API search
  const usdaApiKey = process.env.USDA_API_KEY || 'DEMO_KEY';
  let usdaResults: any[] = [];

  try {
    const usdaUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${usdaApiKey}&query=${encodeURIComponent(query)}&pageSize=15`;
    const response = await fetch(usdaUrl);

    if (response.ok) {
      const data = await response.json();
      if (data && data.foods && Array.isArray(data.foods)) {
        usdaResults = data.foods.map((food: any) => {
          // Parse nutrients
          const getNutrient = (idOrName: string) => {
            const nutrient = food.foodNutrients?.find((n: any) => {
              const nameMatch = n.nutrientName?.toLowerCase().includes(idOrName.toLowerCase());
              return n.nutrientId === Number(idOrName) || nameMatch;
            });
            return nutrient ? Number(nutrient.value) : 0;
          };

          const calories = getNutrient('208') || getNutrient('Energy') || getNutrient('1008') || 0;
          const protein = getNutrient('203') || getNutrient('Protein') || getNutrient('1003') || 0;
          const carbs = getNutrient('205') || getNutrient('Carbohydrate') || getNutrient('1005') || 0;
          const fat = getNutrient('204') || getNutrient('Total lipid') || getNutrient('1004') || 0;

          // Build elegant display name
          let servingSize = "100g";
          if (food.servingSize && food.servingSizeUnit) {
            servingSize = `${food.servingSize} ${food.servingSizeUnit}`;
            if (food.householdServingFullText) {
              servingSize += ` (${food.householdServingFullText})`;
            }
          } else if (food.householdServingFullText) {
            servingSize = food.householdServingFullText;
          }

          return {
            foodName: food.description,
            calories: Math.round(calories),
            protein: parseFloat(protein.toFixed(1)),
            carbs: parseFloat(carbs.toFixed(1)),
            fat: parseFloat(fat.toFixed(1)),
            servingSize,
            brandName: food.brandName || null,
            source: 'USDA FDC'
          };
        });
      }
    }
  } catch (error) {
    console.error("USDA API query failed or rate limited. Falling back to local data.", error);
  }

  // Combine results, prioritizing local results or USDA FDC
  // Remove duplicates by exact match of name
  const combined = [...localResults];
  const names = new Set(localResults.map(item => item.foodName.toLowerCase()));

  for (const item of usdaResults) {
    const key = item.foodName.toLowerCase();
    if (!names.has(key)) {
      names.add(key);
      combined.push(item);
    }
  }

  res.json(combined);
});

// Get User Food Logs (with optional date query YYYY-MM-DD)
app.get("/api/food/entries", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const dateStr = req.query.date as string; // YYYY-MM-DD
  const userEntries = await getFoodEntries(req.userId!, dateStr);
  res.json(userEntries);
});

// Log Food Entry
app.post("/api/food/log", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { foodName, calories, protein, carbs, fat, servingSize, quantity, mealType, loggedAt } = req.body;

  if (!foodName || calories === undefined || mealType === undefined) {
    res.status(400).json({ error: "Food name, calories, and meal category are required" });
    return;
  }

  const newEntry: FoodEntry = {
    id: `f_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: req.userId!,
    foodName,
    calories: Number(calories),
    protein: Number(protein || 0),
    carbs: Number(carbs || 0),
    fat: Number(fat || 0),
    servingSize: servingSize || "1 serving",
    quantity: Number(quantity || 1),
    mealType,
    loggedAt: loggedAt || new Date().toISOString()
  };

  await logFoodEntry(newEntry);
  res.status(201).json(newEntry);
});

// Delete Food Entry
app.delete("/api/food/log/:id", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const success = await deleteFoodEntry(req.userId!, id);
  if (!success) {
    res.status(404).json({ error: "Log entry not found" });
    return;
  }
  res.json({ message: "Food entry removed successfully" });
});

// ==================== EXERCISE LOGGING ENDPOINTS ====================

// Get Exercises
app.get("/api/exercises", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const dateStr = req.query.date as string;
  const entries = await getExercises(req.userId!, dateStr);
  res.json(entries);
});

// Log Exercise
app.post("/api/exercises", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { activityType, durationMinutes, caloriesBurned, loggedAt } = req.body;

  if (!activityType || durationMinutes === undefined || caloriesBurned === undefined) {
    res.status(400).json({ error: "Activity type, duration, and calories burned are required" });
    return;
  }

  const newExercise: ExerciseEntry = {
    id: `ex_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: req.userId!,
    activityType,
    durationMinutes: Number(durationMinutes),
    caloriesBurned: Number(caloriesBurned),
    loggedAt: loggedAt || new Date().toISOString()
  };

  await logExercise(newExercise);
  res.status(201).json(newExercise);
});

// Delete Exercise
app.delete("/api/exercises/:id", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const success = await deleteExercise(req.userId!, id);
  if (!success) {
    res.status(404).json({ error: "Exercise log not found" });
    return;
  }
  res.json({ message: "Exercise entry deleted successfully" });
});

// ==================== CUSTOM MEAL BUILDER ENDPOINTS ====================

// Get custom saved meals
app.get("/api/custom-meals", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const meals = await getCustomMeals(req.userId!);
  res.json(meals);
});

// Create custom meal
app.post("/api/custom-meals", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { mealName, ingredients, totalCalories, totalProtein, totalCarbs, totalFat } = req.body;

  if (!mealName || !ingredients || totalCalories === undefined) {
    res.status(400).json({ error: "Meal name, ingredients list, and total calories are required" });
    return;
  }

  const newMeal: CustomMeal = {
    id: `cm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: req.userId!,
    mealName,
    ingredients, // list of items
    totalCalories: Number(totalCalories),
    totalProtein: Number(totalProtein || 0),
    totalCarbs: Number(totalCarbs || 0),
    totalFat: Number(totalFat || 0),
    createdAt: new Date().toISOString()
  };

  await createCustomMeal(newMeal);
  res.status(201).json(newMeal);
});

// Delete custom meal
app.delete("/api/custom-meals/:id", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const success = await deleteCustomMeal(req.userId!, id);
  if (!success) {
    res.status(404).json({ error: "Custom meal recipe not found" });
    return;
  }
  res.json({ message: "Custom recipe deleted successfully" });
});

// ==================== WATER TRACKER ENDPOINTS ====================

// Get water log for date
app.get("/api/water", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const dateStr = req.query.date as string; // YYYY-MM-DD
  if (!dateStr) {
    res.status(400).json({ error: "Date parameter (YYYY-MM-DD) is required" });
    return;
  }

  let log = await getWaterLog(req.userId!, dateStr);

  if (!log) {
    log = await updateWaterLog(req.userId!, dateStr, 0);
  }

  res.json(log);
});

// Update water glasses
app.post("/api/water", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { dateStr, glasses } = req.body;

  if (!dateStr || glasses === undefined) {
    res.status(400).json({ error: "Date and glass count are required" });
    return;
  }

  const updatedLog = await updateWaterLog(req.userId!, dateStr, glasses);
  res.json(updatedLog);
});

// ==================== AI FOOD RECOGNITION (GEMINI) ====================

// Photo-based food recognition using server-side Gemini SDK
app.post("/api/ai/analyze", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { imageBase64, mimeType } = req.body;

  if (!imageBase64 || !mimeType) {
    res.status(400).json({ error: "Base64 image data and MIME type are required" });
    return;
  }

  if (!process.env.GEMINI_API_KEY) {
    // A helpful fallback if the API key isn't present
    res.json({
      foodName: "Estimated Meal (Fallback: Set GEMINI_API_KEY for real AI)",
      calories: 450,
      protein: 22,
      carbs: 45,
      fat: 14,
      servingSize: "1 typical plate",
      isFallback: true
    });
    return;
  }

  try {
    // Initialize the modern @google/genai SDK
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    const imagePart = {
      inlineData: {
        mimeType: mimeType,
        data: cleanBase64,
      },
    };

    const textPart = {
      text: `Identify the food or meal in this image. Estimate its macronutrient values (protein in grams, carbs in grams, fat in grams), total calories, and standard serving size. Return your response strictly as a single JSON object matching this schema. Do not include markdown wraps or code block symbols:
      {
        "foodName": "Descriptive meal name",
        "calories": 420,
        "protein": 18,
        "carbs": 52,
        "fat": 11,
        "servingSize": "1 bowl/plate/portion"
      }
      Be as realistic and nutritionally accurate as possible.`
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: "application/json"
      }
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("No response text from Gemini");
    }

    const result = JSON.parse(textOutput.trim());
    res.json(result);

  } catch (error: any) {
    console.error("Gemini AI Food recognition failed:", error);
    res.status(500).json({
      error: "AI recognition failed, please log food manually or retry.",
      details: error.message
    });
  }
});

// Voice / Text meal description parser using server-side Gemini SDK
app.post("/api/ai/parse-voice", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { textPrompt } = req.body;

  if (!textPrompt || typeof textPrompt !== 'string' || !textPrompt.trim()) {
    res.status(400).json({ error: "A text or voice description of your meal is required" });
    return;
  }

  if (!process.env.GEMINI_API_KEY) {
    // Helpful fallback if API key is not present
    res.json({
      foodName: textPrompt.trim().slice(0, 40),
      calories: 380,
      protein: 20,
      carbs: 45,
      fat: 12,
      servingSize: "1 portion",
      isFallback: true
    });
    return;
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: `You are an expert nutritionist and meal analyzer. Analyze this description of a meal or food item: "${textPrompt.trim()}".
Estimate the macronutrients (protein in grams, carbs in grams, fat in grams), total calories (kcal), a clean descriptive food name, and serving size.
Return your response strictly as a JSON object matching this schema without markdown wrappers or extra text:
{
  "foodName": "Short descriptive food name",
  "calories": 450,
  "protein": 25,
  "carbs": 50,
  "fat": 15,
  "servingSize": "1 portion"
}
Be as nutritionally accurate and realistic as possible based on standard food databases.`,
      config: {
        responseMimeType: "application/json"
      }
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("No response text from Gemini API");
    }

    const result = JSON.parse(textOutput.trim());
    res.json(result);

  } catch (error: any) {
    console.error("Gemini AI Voice Meal parsing failed:", error);
    res.status(500).json({
      error: "Failed to parse meal description with AI. Please try again or log manually.",
      details: error.message
    });
  }
});

// ==================== VITE DEVELOPMENT & PRODUCTION SERVING ====================

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
