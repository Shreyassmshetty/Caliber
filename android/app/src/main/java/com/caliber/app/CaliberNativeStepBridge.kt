package com.caliber.app

import android.content.Context
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONObject

/**
 * Caliber Unified Native Step Bridge
 * Exposes window.CaliberNativeSteps to the WebView frontend.
 * Routes calls across HealthConnect, Android Hardware Step Counter, and Samsung Health.
 */
class CaliberNativeStepBridge(private val context: Context, private val webView: WebView) {

    private val healthConnect = HealthConnectBridge(context, webView)
    private val stepCounter = AndroidStepCounterBridge(context)
    private val samsungHealth = SamsungHealthBridge(context)

    @JavascriptInterface
    fun getHealthConnectStatus(): String = healthConnect.getHealthConnectStatus()

    @JavascriptInterface
    fun checkHealthConnectPermission(): Boolean = healthConnect.checkPermission()

    @JavascriptInterface
    fun requestHealthConnectPermission() = healthConnect.requestPermission()

    @JavascriptInterface
    fun getHealthConnectTodaySteps(): Long = healthConnect.getTodaySteps()

    @JavascriptInterface
    fun isHardwareStepCounterAvailable(): Boolean = stepCounter.isHardwareStepCounterAvailable()

    @JavascriptInterface
    fun checkActivityRecognitionPermission(): Boolean = stepCounter.checkActivityRecognitionPermission()

    @JavascriptInterface
    fun requestActivityRecognitionPermission(): Boolean = true

    @JavascriptInterface
    fun getHardwareStepCount(dateStr: String): String = stepCounter.getHardwareStepCount(dateStr)

    @JavascriptInterface
    fun isSamsungHealthAvailable(): Boolean = samsungHealth.isSamsungHealthAvailable()

    @JavascriptInterface
    fun checkSamsungHealthPermission(): Boolean = samsungHealth.checkSamsungHealthPermission()

    @JavascriptInterface
    fun requestSamsungHealthPermission(): Boolean = samsungHealth.requestSamsungHealthPermission()

    @JavascriptInterface
    fun getSamsungHealthSteps(dateStr: String): Long = samsungHealth.getSamsungHealthSteps(dateStr)

    @JavascriptInterface
    fun getUnifiedStepSummary(dateStr: String): String {
        val result = JSONObject()
        val hcStatus = healthConnect.getHealthConnectStatus()
        
        if (hcStatus == "SDK_AVAILABLE" && healthConnect.checkPermission()) {
            result.put("source", "health_connect")
            result.put("steps", healthConnect.getTodaySteps())
            result.put("available", true)
        } else if (stepCounter.isHardwareStepCounterAvailable()) {
            val hwJson = JSONObject(stepCounter.getHardwareStepCount(dateStr))
            result.put("source", "android_step_counter")
            result.put("steps", hwJson.optLong("dailySteps", 0L))
            result.put("available", true)
        } else if (samsungHealth.isSamsungHealthAvailable()) {
            result.put("source", "samsung_health")
            result.put("steps", samsungHealth.getSamsungHealthSteps(dateStr))
            result.put("available", true)
        } else {
            result.put("source", "none")
            result.put("steps", 0)
            result.put("available", false)
        }
        return result.toString()
    }
}
