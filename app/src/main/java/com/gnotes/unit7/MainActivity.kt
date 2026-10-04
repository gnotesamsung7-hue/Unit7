package com.gnotes.unit7

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.wifi.WifiManager
import android.content.pm.ActivityInfo
import android.view.View
import android.os.BatteryManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebView
import org.json.JSONArray
import org.json.JSONObject
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.HttpURLConnection
import java.net.Inet4Address
import java.net.InetAddress
import java.net.InetSocketAddress
import java.nio.ByteBuffer
import java.net.URL
import java.util.Locale
import java.util.concurrent.Executors

class MainActivity : Activity(), SensorEventListener {

    private lateinit var web: WebView
    private val main = Handler(Looper.getMainLooper())
    private val io = Executors.newFixedThreadPool(4)

    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var recognizer: SpeechRecognizer? = null

    private lateinit var sensors: SensorManager
    private var tiltOn = false
    private var lastTiltPost = 0L
    private val rot = FloatArray(9)
    private val orient = FloatArray(3)

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        window.statusBarColor = 0xFF1B2329.toInt()
        window.navigationBarColor = 0xFF242F37.toInt()

        web = WebView(this)
        web.setBackgroundColor(0xFF1B2329.toInt())
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.settings.mediaPlaybackRequiresUserGesture = false
        web.addJavascriptInterface(Bridge(), "Android")
        web.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                main.post {
                    val ok = request.resources.filter {
                        when (it) {
                            PermissionRequest.RESOURCE_VIDEO_CAPTURE ->
                                checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
                            PermissionRequest.RESOURCE_AUDIO_CAPTURE ->
                                checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
                            else -> false
                        }
                    }
                    if (ok.isNotEmpty()) request.grant(ok.toTypedArray()) else request.deny()
                }
            }
        }
        setContentView(web)
        web.loadUrl("file:///android_asset/index.html")

        sensors = getSystemService(SENSOR_SERVICE) as SensorManager

        tts = TextToSpeech(this) { status ->
            ttsReady = status == TextToSpeech.SUCCESS
            if (ttsReady) {
                tts?.language = Locale.US
                tts?.setPitch(1.35f)
                tts?.setSpeechRate(1.05f)
                tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                    override fun onStart(id: String?) {}
                    override fun onDone(id: String?) { js("U7.onSpoken(${q(id ?: "")})") }
                    @Deprecated("Deprecated in Java")
                    override fun onError(id: String?) { js("U7.onSpoken(${q(id ?: "")})") }
                })
            }
        }

        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), 7)
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        val ok = grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED
        if (requestCode == 8) js("U7.onCameraPermission && U7.onCameraPermission($ok)")
        if (requestCode == 9) js("U7.onMicPermission && U7.onMicPermission($ok)")
    }

    private fun q(s: String): String = JSONObject.quote(s)

    private fun js(code: String) {
        main.post { web.evaluateJavascript(code, null) }
    }

    /** The robot's hotspot has no internet, so Android may prefer mobile data.
     *  Sending robot requests through the Wi-Fi network directly avoids that. */
    @Suppress("DEPRECATION")
    private fun wifiNetwork(): Network? {
        val cm = getSystemService(ConnectivityManager::class.java) ?: return null
        return cm.allNetworks.firstOrNull {
            cm.getNetworkCapabilities(it)?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true
        }
    }

    private fun doRequest(id: String, method: String, url: String) {
        var status = 0
        var body = ""
        try {
            val u = URL(url)
            val conn = (wifiNetwork()?.openConnection(u) ?: u.openConnection()) as HttpURLConnection
            conn.requestMethod = method
            conn.connectTimeout = 1500
            conn.readTimeout = 3000
            if (method == "POST") {
                conn.doOutput = true
                conn.setFixedLengthStreamingMode(0)
                conn.outputStream.close()
            }
            status = conn.responseCode
            val stream = if (status < 400) conn.inputStream else conn.errorStream
            body = stream?.bufferedReader()?.use { it.readText() } ?: ""
            conn.disconnect()
        } catch (e: Exception) {
            status = 0
        }
        js("U7.onResponse(${q(id)},$status,${q(body)})")
    }

    private fun startListening(preferOffline: Boolean) {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), 7)
            js("U7.onHear('error','mic-permission')")
            return
        }
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            js("U7.onHear('error','no-recognizer')")
            return
        }
        recognizer?.destroy()
        val r = SpeechRecognizer.createSpeechRecognizer(this)
        recognizer = r
        r.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) { js("U7.onHear('ready','')") }
            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(rmsdB: Float) {}
            override fun onBufferReceived(buffer: ByteArray?) {}
            override fun onEndOfSpeech() { js("U7.onHear('end','')") }
            override fun onError(error: Int) { js("U7.onHear('error',${q(error.toString())})") }
            override fun onResults(results: Bundle?) {
                val list = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION) ?: arrayListOf()
                js("U7.onHear('final',${JSONArray(list)})")
            }
            override fun onPartialResults(partial: Bundle?) {
                val list = partial?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION) ?: return
                js("U7.onHear('partial',${JSONArray(list)})")
            }
            override fun onEvent(eventType: Int, params: Bundle?) {}
        })
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-US")
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5)
            putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, preferOffline)
        }
        r.startListening(intent)
    }

    private fun setTilt(on: Boolean) {
        if (on == tiltOn) return
        tiltOn = on
        if (on) {
            val s = sensors.getDefaultSensor(Sensor.TYPE_GAME_ROTATION_VECTOR)
                ?: sensors.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
            if (s == null) {
                js("U7.onTiltMissing()")
                tiltOn = false
                return
            }
            sensors.registerListener(this, s, SensorManager.SENSOR_DELAY_GAME)
        } else {
            sensors.unregisterListener(this)
        }
    }

    /* ---------- Phone-to-phone link (controller <-> eyes) over the robot's Wi-Fi ---------- */
    private val LINK_PORT = 47007
    @Volatile private var linkSock: DatagramSocket? = null
    private var mlock: WifiManager.MulticastLock? = null

    private fun startLink() {
        if (linkSock != null) return
        try {
            val wm = applicationContext.getSystemService(WIFI_SERVICE) as WifiManager
            mlock = wm.createMulticastLock("unit7").apply { setReferenceCounted(false); acquire() }
        } catch (e: Exception) {}
        Thread {
            try {
                val s = DatagramSocket(null)
                s.reuseAddress = true
                s.broadcast = true
                s.bind(InetSocketAddress(LINK_PORT))
                linkSock = s
                val buf = ByteArray(8192)
                while (!s.isClosed) {
                    val p = DatagramPacket(buf, buf.size)
                    s.receive(p)
                    val msg = String(p.data, 0, p.length, Charsets.UTF_8)
                    val from = p.address?.hostAddress ?: ""
                    js("U7.onLink(${q(msg)},${q(from)})")
                }
            } catch (e: Exception) {
                linkSock = null
            }
        }.start()
    }

    private fun broadcastTargets(net: Network?): List<InetAddress> {
        val out = mutableListOf<InetAddress>()
        try {
            val cm = getSystemService(ConnectivityManager::class.java)
            val lp = if (net != null) cm?.getLinkProperties(net) else null
            lp?.linkAddresses?.forEach { la ->
                val a = la.address
                if (a is Inet4Address) {
                    val pre = la.prefixLength
                    val ip = ByteBuffer.wrap(a.address).int
                    val mask = if (pre == 0) 0 else (-1 shl (32 - pre))
                    val b = ip or mask.inv()
                    out.add(InetAddress.getByAddress(ByteBuffer.allocate(4).putInt(b).array()))
                }
            }
        } catch (e: Exception) {}
        out.add(InetAddress.getByName("255.255.255.255"))
        return out
    }

    private fun linkSend(msg: String, to: String) {
        io.execute {
            try {
                val net = wifiNetwork()
                val ds = DatagramSocket()
                ds.broadcast = true
                try { net?.bindSocket(ds) } catch (e: Exception) {}
                val data = msg.toByteArray(Charsets.UTF_8)
                val targets = if (to.isNotEmpty()) listOf(InetAddress.getByName(to)) else broadcastTargets(net)
                for (a in targets) {
                    try { ds.send(DatagramPacket(data, data.size, a, LINK_PORT)) } catch (e: Exception) {}
                }
                ds.close()
            } catch (e: Exception) {}
        }
    }

    @Suppress("DEPRECATION")
    private fun setEyesMode(on: Boolean) {
        requestedOrientation = if (on) ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                               else ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
        window.decorView.systemUiVisibility = if (on)
            (View.SYSTEM_UI_FLAG_FULLSCREEN or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
             View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
             View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION)
            else View.SYSTEM_UI_FLAG_VISIBLE
        if (on) {
            window.statusBarColor = 0xFF000000.toInt()
            window.navigationBarColor = 0xFF000000.toInt()
            web.setBackgroundColor(0xFF000000.toInt())
        } else {
            window.statusBarColor = 0xFF1B2329.toInt()
            window.navigationBarColor = 0xFF242F37.toInt()
            web.setBackgroundColor(0xFF1B2329.toInt())
            setBrightness(-1f)
        }
    }

    private fun setBrightness(level: Float) {
        val lp = window.attributes
        lp.screenBrightness = level
        window.attributes = lp
    }

    override fun onSensorChanged(event: SensorEvent) {
        val now = System.currentTimeMillis()
        if (now - lastTiltPost < 40) return
        lastTiltPost = now
        SensorManager.getRotationMatrixFromVector(rot, event.values)
        SensorManager.getOrientation(rot, orient)
        val pitch = Math.toDegrees(orient[1].toDouble())
        val roll = Math.toDegrees(orient[2].toDouble())
        val faceUp = rot[8].toDouble() // +1 screen up, -1 screen facing the floor
        js("U7.onTilt(%.1f,%.1f,%.2f)".format(Locale.US, pitch, roll, faceUp))
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    override fun onPause() {
        super.onPause()
        val wasTilt = tiltOn
        setTilt(false)
        tiltOn = false
        if (wasTilt) pendingTilt = true
        recognizer?.cancel()
        js("U7.onPause()")
    }

    private var pendingTilt = false

    override fun onResume() {
        super.onResume()
        if (pendingTilt) {
            pendingTilt = false
            setTilt(true)
        }
        js("U7.onResume && U7.onResume()")
    }

    override fun onDestroy() {
        try { linkSock?.close() } catch (e: Exception) {}
        mlock?.release()
        recognizer?.destroy()
        tts?.shutdown()
        sensors.unregisterListener(this)
        io.shutdownNow()
        web.destroy()
        super.onDestroy()
    }

    inner class Bridge {
        @JavascriptInterface
        fun request(id: String, method: String, url: String) {
            io.execute { doRequest(id, method, url) }
        }

        @JavascriptInterface
        fun speak(id: String, text: String) {
            if (!ttsReady) {
                js("U7.onSpoken(${q(id)})")
                return
            }
            tts?.speak(text, TextToSpeech.QUEUE_ADD, null, id)
        }

        @JavascriptInterface
        fun stopSpeaking() {
            tts?.stop()
        }

        @JavascriptInterface
        fun listen(preferOffline: Boolean) {
            main.post { startListening(preferOffline) }
        }

        @JavascriptInterface
        fun stopListening() {
            main.post { recognizer?.stopListening() }
        }

        @JavascriptInterface
        fun tilt(on: Boolean) {
            main.post { setTilt(on) }
        }

        @JavascriptInterface
        fun hasCamera(): Boolean =
            checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED

        @JavascriptInterface
        fun askCamera() {
            main.post { requestPermissions(arrayOf(Manifest.permission.CAMERA), 8) }
        }

        @JavascriptInterface
        fun hasMic(): Boolean =
            checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

        @JavascriptInterface
        fun askMic() {
            main.post { requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), 9) }
        }

        @JavascriptInterface
        fun linkStart() { main.post { startLink() } }

        @JavascriptInterface
        fun linkSend(msg: String, to: String) { this@MainActivity.linkSend(msg, to) }

        @JavascriptInterface
        fun eyesMode(on: Boolean) { main.post { setEyesMode(on) } }

        @JavascriptInterface
        fun brightness(level: Float) { main.post { setBrightness(level) } }

        @JavascriptInterface
        fun battery(): Int {
            val bm = getSystemService(BATTERY_SERVICE) as BatteryManager
            return bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
        }

        @JavascriptInterface
        fun vibrate(ms: Int) {
            val v = getSystemService(VIBRATOR_SERVICE) as? Vibrator ?: return
            v.vibrate(VibrationEffect.createOneShot(ms.toLong().coerceIn(10, 400), VibrationEffect.DEFAULT_AMPLITUDE))
        }
    }
}
