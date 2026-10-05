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
import android.util.Base64
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Rect
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetector
import com.google.mlkit.vision.face.FaceDetectorOptions
import org.tensorflow.lite.Interpreter
import java.io.FileInputStream
import java.nio.ByteOrder
import java.nio.channels.FileChannel
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

    private fun doRequest(id: String, method: String, url: String, body: String = "") {
        var status = 0
        var body = ""
        try {
            val u = URL(url)
            val conn = (wifiNetwork()?.openConnection(u) ?: u.openConnection()) as HttpURLConnection
            conn.requestMethod = method
            conn.connectTimeout = 1500
            conn.readTimeout = 3000
            if (body.isNotEmpty()) {
                val data = body.toByteArray(Charsets.UTF_8)
                conn.doOutput = true
                conn.setRequestProperty("Content-Type", "application/json")
                conn.setFixedLengthStreamingMode(data.size)
                conn.outputStream.use { it.write(data) }
            } else if (method == "POST") {
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

    /* ---------- Faces: ML Kit finds them, FaceNet turns each into 128 numbers to recognise later ---------- */
    private var faceDetector: FaceDetector? = null
    private var faceNet: Interpreter? = null
    private var faceNetFailed = false

    private fun detector(): FaceDetector {
        faceDetector?.let { return it }
        val d = FaceDetection.getClient(
            FaceDetectorOptions.Builder()
                .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
                .setMinFaceSize(0.12f)
                .build())
        faceDetector = d
        return d
    }

    @Synchronized
    private fun loadFaceNet(): Interpreter? {
        if (faceNet != null || faceNetFailed) return faceNet
        try {
            val fd = assets.openFd("facenet.tflite")
            val map = FileInputStream(fd.fileDescriptor).channel
                .map(FileChannel.MapMode.READ_ONLY, fd.startOffset, fd.declaredLength)
            faceNet = Interpreter(map, Interpreter.Options().setNumThreads(4))
        } catch (e: Exception) {
            faceNetFailed = true
        }
        return faceNet
    }

    private fun embedFace(bmp: Bitmap, box: Rect): FloatArray? {
        val net = loadFaceNet() ?: return null
        val m = (box.width() * 0.1f).toInt()
        val l = (box.left - m).coerceAtLeast(0)
        val t = (box.top - m).coerceAtLeast(0)
        val r = (box.right + m).coerceAtMost(bmp.width)
        val b = (box.bottom + m).coerceAtMost(bmp.height)
        if (r - l < 24 || b - t < 24) return null
        val face = Bitmap.createScaledBitmap(Bitmap.createBitmap(bmp, l, t, r - l, b - t), 160, 160, true)
        val px = IntArray(160 * 160)
        face.getPixels(px, 0, 160, 0, 0, 160, 160)
        val vals = FloatArray(px.size * 3)
        var k = 0
        for (p in px) {
            vals[k++] = ((p shr 16) and 0xFF).toFloat()
            vals[k++] = ((p shr 8) and 0xFF).toFloat()
            vals[k++] = (p and 0xFF).toFloat()
        }
        var mean = 0.0
        for (v in vals) mean += v
        mean /= vals.size
        var sq = 0.0
        for (v in vals) { val d = v - mean; sq += d * d }
        val std = maxOf(Math.sqrt(sq / vals.size), 1.0 / Math.sqrt(vals.size.toDouble()))
        val buf = ByteBuffer.allocateDirect(vals.size * 4).order(ByteOrder.nativeOrder())
        for (v in vals) buf.putFloat(((v - mean) / std).toFloat())
        buf.rewind()
        val out = Array(1) { FloatArray(128) }
        synchronized(net) { net.run(buf, out) }
        val e = out[0]
        var n = 0.0
        for (v in e) n += v * v
        val len = Math.sqrt(n).toFloat()
        if (len > 0f) for (i in e.indices) e[i] = e[i] / len
        return e
    }

    private fun doDetectFaces(id: String, dataUrl: String, withEmbedding: Boolean) {
        try {
            val bytes = Base64.decode(dataUrl.substringAfter(','), Base64.DEFAULT)
            val bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            if (bmp == null) { js("U7.onFaces(${q(id)},[])"); return }
            detector().process(InputImage.fromBitmap(bmp, 0))
                .addOnSuccessListener(io) { faces ->
                    val arr = JSONArray()
                    val sorted = faces.sortedByDescending { it.boundingBox.width() * it.boundingBox.height() }
                    for ((idx, f) in sorted.take(3).withIndex()) {
                        val bb = f.boundingBox
                        val o = JSONObject()
                        o.put("x", (bb.centerX().toDouble() / bmp.width) * 2 - 1)
                        o.put("w", bb.width().toDouble() / bmp.width)
                        o.put("h", bb.height().toDouble() / bmp.height)
                        if (idx == 0 && withEmbedding && bb.width() > bmp.width * 0.1) {
                            val e = embedFace(bmp, bb)
                            if (e != null) {
                                val ja = JSONArray()
                                for (v in e) ja.put(Math.round(v * 10000.0) / 10000.0)
                                o.put("emb", ja)
                            }
                        }
                        arr.put(o)
                    }
                    js("U7.onFaces(${q(id)},$arr)")
                }
                .addOnFailureListener(io) { js("U7.onFaces(${q(id)},[])") }
        } catch (e: Exception) {
            js("U7.onFaces(${q(id)},[])")
        }
    }

    /** Fetch a camera snapshot from Unit 7's head and hand it to the page as a data URL. */
    private fun doFetchImage(id: String, url: String) {
        var data = ""
        try {
            val u = URL(url)
            val conn = (wifiNetwork()?.openConnection(u) ?: u.openConnection()) as HttpURLConnection
            conn.connectTimeout = 1500
            conn.readTimeout = 3000
            if (conn.responseCode == 200) {
                val bytes = conn.inputStream.use { it.readBytes() }
                data = "data:image/jpeg;base64," + Base64.encodeToString(bytes, Base64.NO_WRAP)
            }
            conn.disconnect()
        } catch (e: Exception) {
            data = ""
        }
        js("U7.onImage(${q(id)},${q(data)})")
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

    private var tiltSensor: Sensor? = null

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
            tiltSensor = s
            sensors.registerListener(this, s, SensorManager.SENSOR_DELAY_GAME)
        } else {
            tiltSensor?.let { sensors.unregisterListener(this, it) }
        }
    }

    /* Body sensors for the Eyes phone: being picked up, shaken, tipped, covered, in the dark. */
    private var bodyOn = false
    private var lastAccelPost = 0L
    private var lastLightPost = 0L
    private var lastProxNear: Boolean? = null

    private fun setBody(on: Boolean) {
        if (on == bodyOn) return
        bodyOn = on
        val list = listOf(Sensor.TYPE_ACCELEROMETER, Sensor.TYPE_PROXIMITY, Sensor.TYPE_LIGHT)
            .mapNotNull { sensors.getDefaultSensor(it) }
        for (s in list) {
            if (on) sensors.registerListener(this, s,
                if (s.type == Sensor.TYPE_ACCELEROMETER) SensorManager.SENSOR_DELAY_GAME else SensorManager.SENSOR_DELAY_NORMAL)
            else sensors.unregisterListener(this, s)
        }
        if (!on) lastProxNear = null
    }

    private fun onBodySensor(event: SensorEvent) {
        val now = System.currentTimeMillis()
        when (event.sensor.type) {
            Sensor.TYPE_ACCELEROMETER -> {
                if (now - lastAccelPost < 40) return
                lastAccelPost = now
                js("U7.onAccel && U7.onAccel(%.2f,%.2f,%.2f)".format(Locale.US, event.values[0], event.values[1], event.values[2]))
            }
            Sensor.TYPE_PROXIMITY -> {
                val near = event.values[0] < minOf(event.sensor.maximumRange, 5f)
                if (near != lastProxNear) {
                    lastProxNear = near
                    js("U7.onProx && U7.onProx($near)")
                }
            }
            Sensor.TYPE_LIGHT -> {
                if (now - lastLightPost < 1000) return
                lastLightPost = now
                js("U7.onLight && U7.onLight(%.1f)".format(Locale.US, event.values[0]))
            }
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
        val type = event.sensor.type
        if (type == Sensor.TYPE_ACCELEROMETER || type == Sensor.TYPE_PROXIMITY || type == Sensor.TYPE_LIGHT) {
            onBodySensor(event)
            return
        }
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
        if (bodyOn) { setBody(false); pendingBody = true }
        recognizer?.cancel()
        js("U7.onPause()")
    }

    private var pendingTilt = false
    private var pendingBody = false

    override fun onResume() {
        super.onResume()
        if (pendingTilt) {
            pendingTilt = false
            setTilt(true)
        }
        if (pendingBody) {
            pendingBody = false
            setBody(true)
        }
        js("U7.onResume && U7.onResume()")
    }

    override fun onDestroy() {
        try { linkSock?.close() } catch (e: Exception) {}
        mlock?.release()
        faceDetector?.close()
        faceNet?.close()
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
        fun requestBody(id: String, method: String, url: String, body: String) {
            io.execute { doRequest(id, method, url, body) }
        }

        @JavascriptInterface
        fun detectFaces(id: String, dataUrl: String, withEmbedding: Boolean) {
            io.execute { doDetectFaces(id, dataUrl, withEmbedding) }
        }

        @JavascriptInterface
        fun fetchImage(id: String, url: String) {
            io.execute { doFetchImage(id, url) }
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
        fun speakVol(id: String, text: String, volume: Float) {
            if (!ttsReady) {
                js("U7.onSpoken(${q(id)})")
                return
            }
            val params = Bundle()
            params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, volume.coerceIn(0.05f, 1f))
            tts?.speak(text, TextToSpeech.QUEUE_ADD, params, id)
        }

        @JavascriptInterface
        fun body(on: Boolean) { main.post { setBody(on) } }

        @JavascriptInterface
        fun charging(): Boolean {
            val bm = getSystemService(BATTERY_SERVICE) as BatteryManager
            return bm.isCharging
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
