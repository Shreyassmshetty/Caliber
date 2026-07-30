-- ====================================================================
-- Caliber Nutrition Tracker - Supabase SQL Migration Schema
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard)
-- ====================================================================

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  profile JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on user email for fast authentication lookup
CREATE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));

-- 2. Food Entries Table
CREATE TABLE IF NOT EXISTS food_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  food_name TEXT NOT NULL,
  calories NUMERIC DEFAULT 0,
  protein NUMERIC DEFAULT 0,
  carbs NUMERIC DEFAULT 0,
  fat NUMERIC DEFAULT 0,
  serving_size TEXT DEFAULT '1 serving',
  quantity NUMERIC DEFAULT 1,
  meal_type TEXT NOT NULL,
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for filtering user food logs by date
CREATE INDEX IF NOT EXISTS idx_food_entries_user_date ON food_entries(user_id, logged_at);

-- 3. Exercise Entries Table
CREATE TABLE IF NOT EXISTS exercises (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  duration_minutes NUMERIC DEFAULT 0,
  calories_burned NUMERIC DEFAULT 0,
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exercises_user_date ON exercises(user_id, logged_at);

-- 4. Custom Meals Table
CREATE TABLE IF NOT EXISTS custom_meals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meal_name TEXT NOT NULL,
  ingredients JSONB DEFAULT '[]'::jsonb,
  total_calories NUMERIC DEFAULT 0,
  total_protein NUMERIC DEFAULT 0,
  total_carbs NUMERIC DEFAULT 0,
  total_fat NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_meals_user ON custom_meals(user_id);

-- 5. Water Logs Table
CREATE TABLE IF NOT EXISTS water_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  glasses INT DEFAULT 0,
  date_str TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_date UNIQUE(user_id, date_str)
);

CREATE INDEX IF NOT EXISTS idx_water_logs_user_date ON water_logs(user_id, date_str);

-- Disable RLS or set permissive policies if using service role key or custom JWT
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE water_logs ENABLE ROW LEVEL SECURITY;

-- Allow public access for application service queries (handled securely via backend JWT)
CREATE POLICY "Allow service access users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service access food_entries" ON food_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service access exercises" ON exercises FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service access custom_meals" ON custom_meals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service access water_logs" ON water_logs FOR ALL USING (true) WITH CHECK (true);
