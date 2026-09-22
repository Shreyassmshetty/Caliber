package com.caliber.app

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.webkit.JavascriptInterface
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Android Hardware Step Counter Bridge
 * Low-power step tracking using Sensor.TYPE_STEP_COUNTER.
 * Handles baseline storage, reboot handling, midnight resets, and negative step prevention.
 */
class AndroidStepCounterBridge(private val context: Context) : SensorEventListener {

    private val sensorManager: SensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val stepCounterSensor: Sensor? = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
    private val prefs = context.getSharedPreferences("caliber_step_counter_prefs", Context.MODE_PRIVATE)

    private var lastRawSensorValue: Long = 0L

    init {
        registerSensorListener()
    }

    fun registerSensorListener() {
        stepCounterSensor?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL)
        }
    }

    fun unregisterSensorListener() {
        sensorManager.unregisterListener(this)
    }

    @JavascriptInterface
    fun isHardwareStepCounterAvailable(): Boolean {
        return stepCounterSensor != null
    }

    @JavascriptInterface
    fun checkActivityRecognitionPermission(): Boolean {
        // Android 10 (API 29+) ACTIVITY_RECOGNITION check
        return if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
            context.checkSelfPermission(android.manifest.permission.ACTIVITY_RECOGNITION) == android.content.pm.PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
    }

    @JavascriptInterface
    fun getHardwareStepCount(dateStr: String): String {
        val today = dateStr.ifEmpty { getCurrentDateString() }
        val lastSavedDate = prefs.getString("last_date", "") ?: ""

        val rawSensorValue = prefs.getLong("last_raw_value", 0L)
        var baseline = prefs.getLong("baseline_$today", -1L)

        // Midnight transition or new date
        if (lastSavedDate != today || baseline == -1L) {
            baseline = rawSensorValue
            prefs.edit()
                .putString("last_date", today)
                .putLong("baseline_$today", baseline)
                .apply()
        }

        val dailySteps = if (rawSensorValue >= baseline) {
            rawSensorValue - baseline
        } else {
            // Sensor reset or device reboot occurred!
            // Adjust baseline to match new raw value from 0
            prefs.edit().putLong("baseline_$today", rawSensorValue).apply()
            0L
        }

        val json = JSONObject()
        json.put("dateStr", today)
        json.put("cumulativeSteps", rawSensorValue)
        json.put("baseline", baseline)
        json.put("dailySteps", Math.max(0L, dailySteps))
        json.put("available", isHardwareStepCounterAvailable())
        return json.toString()
    }

    override fun onSensorChanged(event: SensorEvent?) {
        if (event?.sensor?.type == Sensor.TYPE_STEP_COUNTER) {
            val rawValue = event.values[0].toLong()
            val today = getCurrentDateString()
            val lastSavedValue = prefs.getLong("last_raw_value", 0L)

            // Reboot or sensor reset check: rawValue drops below last saved value
            if (rawValue < lastSavedValue && lastSavedValue > 0) {
                // Device rebooted -> reset baseline for today
                prefs.edit().putLong("baseline_$today", rawValue).apply()
            }

            prefs.edit()
                .putLong("last_raw_value", rawValue)
                .putString("last_date", today)
                .apply()

            lastRawSensorValue = rawValue
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    private fun getCurrentDateString(): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        return sdf.format(Date())
    }
}
