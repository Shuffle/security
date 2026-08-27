# ProGuard / R8 rules for Shuffle Security (Capacitor Android)

# Preserve Capacitor core and bridge classes
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }
-keepclassmembers class * implements com.getcapacitor.Plugin {
    public *;
}
-keepclassmembers class com.getcapacitor.Plugin {
    public *;
}
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Preserve Cordova compatibility plugins
-keep class org.apache.cordova.** { *; }
-keep interface org.apache.cordova.** { *; }

# Preserve AndroidX Core and Splash Screen
-keep class androidx.core.splashscreen.** { *; }

# Preserve line numbers and annotations for debugging stack traces
-keepattributes SourceFile,LineNumberTable,*Annotation*,JavascriptInterface
