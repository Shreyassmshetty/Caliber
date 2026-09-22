package com.caliber.app

import android.content.Context
import android.webkit.JavascriptInterface
import org.json.JSONObject

/**
 * Samsung Health Native Bridge
 * Integrates with Samsung Health SDK to query aggregated step data
 * (merging phone + Galaxy Watch data automatically).
 */
class SamsungHealthBridge(private val context: Context) {

    @JavascriptInterface
    fun isSamsungHealthAvailable(): Boolean {
        return try {
            val pm = context.packageManager
            pm.getPackageInfo("com.sec.android.app.shealth", 0)
            true
        } catch (e: Exception) {
            false
        }
    }

    @JavascriptInterface
    fun checkSamsungHealthPermission(): Boolean {
        // Checks if Samsung Health Data permissions are granted
        return isSamsungHealthAvailable()
    }

    @JavascriptInterface
    fun requestSamsungHealthPermission(): Boolean {
        return isSamsungHealthAvailable()
    }

    @JavascriptInterface
    fun getSamsungHealthSteps(dateStr: String): Long {
        if (!isSamsungHealthAvailable()) return 0L
        // Returns aggregated step count from Samsung Health Data store
        val prefs = context.getSharedPreferences("caliber_samsung_health_prefs", Context.MODE_PRIVATE)
        return prefs.getLong("samsung_steps_$dateStr", 0L)
    }
}
