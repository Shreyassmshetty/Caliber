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
  loggedAt: string;
}

export interface ExerciseEntry {
  id: string;
  userId: string;
  activityType: string;
  durationMinutes: number;
  caloriesBurned: number;
  loggedAt: string;
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
  createdAt: string;
}

export interface WaterLog {
  id: string;
  userId: string;
  glasses: number;
  dateStr: string;
  updatedAt: string;
}

export type SyncActionType =
  | 'LOG_FOOD'
  | 'DELETE_FOOD'
  | 'LOG_EXERCISE'
  | 'DELETE_EXERCISE'
  | 'UPDATE_WATER'
  | 'SAVE_CUSTOM_MEAL';

export interface PendingSyncItem {
  id: string;
  type: SyncActionType;
  timestamp: string;
  title: string;
  subtitle?: string;
  payload: any;
}

