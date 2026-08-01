import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Apple, Eye, EyeOff, Dumbbell, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

export const Auth = () => {
  const { signup, login, googleLogin, loading, error } = useApp();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);

    if (!email || !password) {
      setLocalError("Please fill out all fields.");
      return;
    }

    if (password.length < 6) {
      setLocalError("Password must be at least 6 characters long.");
      return;
    }

    let success = false;
    if (isSignUp) {
      success = await signup(email, password);
    } else {
      success = await login(email, password);
    }

    if (!success) {
      // Error is set in context
    }
  };

  return (
    <div className="min-height-[90vh] flex flex-col justify-center px-4 py-12 sm:px-6 lg:px-8 max-w-md mx-auto">
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-brand-bg shadow-lg mb-4"
        >
          <Apple className="w-8 h-8" />
        </motion.div>
        <h2 className="text-3xl font-bold tracking-tight text-neutral-dark">
          {isSignUp ? "Create your account" : "Welcome back"}
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          Track your calories, macros, and hydration with ease.
        </p>
      </div>

      <motion.div
        initial={{ y, opacity: 0 }}
        animate={{ y, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="bg-white p-8 rounded-3xl shadow-md border border-gray-100"
      >
        <form className="space-y-6" onSubmit={handleSubmit}>
          {(error || localError) && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-xs font-medium border border-red-100 space-y-2">
              <p>{localError || error}</p>
              {(error?.includes('redirect_uri') || error?.includes('invalid') || error?.includes('OAuth') || error?.includes('Google') || error?.includes('closed')) && (
                <div className="text-[11px] text-red-700 bg-red-100/60 p-3 rounded-lg space-y-2">
                  <p className="font-semibold text-xs">How to fix "Error 400: redirect_uri_mismatch":</p>
                  <p>In Google Cloud Console under <strong>APIs & Services &gt; Credentials &gt; OAuth 2.0 Client IDs</strong>, add these to <strong>Authorized redirect URIs</strong>:</p>
                  <div className="space-y-1">
                    <code className="block bg-white/90 p-1.5 rounded font-mono text-[10px] break-all select-all border border-red-200">
                      {window.location.origin}/auth/google/callback
                    </code>
                    {window.location.origin.includes('ais-dev-') && (
                      <code className="block bg-white/90 p-1.5 rounded font-mono text-[10px] break-all select-all border border-red-200">
                        {window.location.origin.replace('ais-dev-', 'ais-pre-')}/auth/google/callback
                      </code>
                    )}
                  </div>
                  <p className="text-[10px] text-red-600">If using Supabase Google Provider, also add your Supabase URL callback:<br/><span className="font-mono bg-white/80 px-1 rounded">https://&lt;your-project&gt;.supabase.co/auth/v1/callback</span></p>
                  <p className="pt-1 font-medium text-[11px] text-gray-700">💡 Tip: You can also register or sign in directly with any email and password above!</p>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 pr-10 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary-light text-white font-medium py-3 rounded-xl shadow-md transition duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : isSignUp ? (
              "Get Started"
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-3 text-gray-500 font-semibold">Or continue with</span>
          </div>
        </div>

        <button
          type="button"
          onClick={googleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3 px-4 rounded-xl border border-gray-300 shadow-sm transition duration-150 text-sm disabled:opacity-50"
        >
          <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
          </svg>
          Sign in with Google
        </button>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setLocalError(null);
            }}
            className="text-xs font-semibold text-primary hover:text-primary-light transition"
          >
            {isSignUp ? "Already have an account? Sign in" : "New to the app? Create an account"}
          </button>
        </div>
      </motion.div>

      {/* Feature Highlight Pill Box */}
      <div className="mt-8 grid grid-cols-3 gap-3 text-center">
        <div className="bg-white/50 p-3 rounded-xl border border-gray-200/50 flex flex-col items-center">
          <Apple className="w-4 h-4 text-primary mb-1" />
          <span className="text-[10px] font-medium text-gray-500">USDA Search</span>
        </div>
        <div className="bg-white/50 p-3 rounded-xl border border-gray-200/50 flex flex-col items-center">
          <Sparkles className="w-4 h-4 text-purple-500 mb-1" />
          <span className="text-[10px] font-medium text-gray-500">AI Food Snap</span>
        </div>
        <div className="bg-white/50 p-3 rounded-xl border border-gray-200/50 flex flex-col items-center">
          <Dumbbell className="w-4 h-4 text-blue-500 mb-1" />
          <span className="text-[10px] font-medium text-gray-500">Burn Adjust</span>
        </div>
      </div>
    </div>
  );
};
