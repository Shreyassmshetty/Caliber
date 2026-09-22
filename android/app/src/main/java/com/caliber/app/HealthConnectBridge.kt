package com.caliber.app

import android.content.Context
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.time.TimeRangeFilter
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/**
 * Caliber Health Connect Android Native Bridge
 *
 * Implements Android Health Connect SDK step counting via StepsRecord aggregation.
 * Exposes a JavascriptInterface to Caliber Web Frontend (window.AndroidHealthBridge).
 */
class HealthConnectBridge(private val context: Context, private val webView: WebView) {

    private val READ_STEPS_PERMISSION = HealthPermission.getReadPermission(StepsRecord::class)

    /**
     * Get Health Connect availability status on device:
     * - SDK_AVAILABLE
     * - SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED
     * - SDK_UNAVAILABLE
     */
    @JavascriptInterface
    fun getHealthConnectStatus(): String {
        return try {
            val status = HealthConnectClient.getSdkStatus(context)
            when (status) {
                HealthConnectClient.SDK_AVAILABLE -> "SDK_AVAILABLE"
                HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED"
                else -> "SDK_UNAVAILABLE"
            }
        } catch (e: Exception) {
            "SDK_UNAVAILABLE"
        }
    }

    /**
     * Check if READ_STEPS permission is granted
     */
    @JavascriptInterface
    fun checkPermission(): Boolean {
        return try {
            if (HealthConnectClient.getSdkStatus(context) != HealthConnectClient.SDK_AVAILABLE) return false
            val client = HealthConnectClient.getOrCreate(context)
            var granted = false
            runBlocking(Dispatchers.IO) {
                val permissions = client.permissionController.getGrantedPermissions()
                granted = permissions.contains(READ_STEPS_PERMISSION)
            }
            granted
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Request READ_STEPS permission by launching Android Health Connect intent
     */
    @JavascriptInterface
    fun requestPermission() {
        GlobalScope.launch(Dispatchers.Main) {
            try {
                // Triggers Android Health Connect permission contract request
                val intent = HealthConnectClient.getOrCreate(context)
                    .permissionController
                    .createRequestPermissionResultContract()
                    .createIntent(context, setOf(READ_STEPS_PERMISSION))
                context.startActivity(intent)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    /**
     * Query Health Connect for today's aggregated step count using StepsRecord.COUNT_TOTAL
     * Local start of day (00:00:00) to current time.
     */
    @JavascriptInterface
    fun getTodaySteps(): Long {
        return try {
            if (!checkPermission()) return 0L
            val client = HealthConnectClient.getOrCreate(context)

            val zoneId = ZoneId.systemDefault()
            val startOfDay = LocalDate.now(zoneId).atStartOfDay(zoneId).toInstant()
            val now = Instant.now()

            var totalSteps = 0L
            runBlocking(Dispatchers.IO) {
                val response = client.aggregate(
                    AggregateRequest(
                        metrics = setOf(StepsRecord.COUNT_TOTAL),
                        timeRangeFilter = TimeRangeFilter.between(startOfDay, now)
                    )
                )
                totalSteps = response[StepsRecord.COUNT_TOTAL] ?: 0L
            }
            totalSteps
        } catch (e: Exception) {
            e.printStackTrace()
            0L
        }
    }

    /**
     * Query Health Connect for daily aggregated steps for historical days
     * Returns JSON string array: [{"date": "2026-09-22", "steps": 6428}, ...]
     */
    @JavascriptInterface
    fun getStepHistory(days: Int): String {
        return try {
            if (!checkPermission()) return "[]"
            val client = HealthConnectClient.getOrCreate(context)
            val zoneId = ZoneId.systemDefault()
            val results = JSONArray()

            val safeDays = if (days in 1..60) days else 30
            val today = LocalDate.now(zoneId)

            runBlocking(Dispatchers.IO) {
                for (i in 0 until safeDays) {
                    val date = today.minusDays(i.toLong())
                    val startTime = date.atStartOfDay(zoneId).toInstant()
                    val endTime = date.plusDays(1).atStartOfDay(zoneId).toInstant()

                    val response = client.aggregate(
                        AggregateRequest(
                            metrics = setOf(StepsRecord.COUNT_TOTAL),
                            timeRangeFilter = TimeRangeFilter.between(startTime, endTime)
                        )
                    )
                    val count = response[StepsRecord.COUNT_TOTAL] ?: 0L

                    val obj = JSONObject()
                    obj.put("date", date.toString())
                    obj.put("steps", count)
                    results.put(obj)
                }
            }
            results.toString()
        } catch (e: Exception) {
            "[]"
        }
    }
}
