# React Native (Hermes)
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.react.** { *; }

# Keep the app and its dependencies
-keep class sn.ged.proquelec.** { *; }
-keepclassmembers class sn.ged.proquelec.** { *; }

# Keep JS interface methods for React Native bridge
-keepclassmembers class * {
    @com.facebook.react.bridge.ReactMethod *;
    @com.facebook.react.bridge.ReactModule *;
}

# Keep native modules
-keep class com.mrousavy.camera.** { *; }
-keep class org.wonday.pdf.** { *; }
-keep class com.th3rdwave.safeareacontext.** { *; }
-keep class com.swmansion.rnscreens.** { *; }

# Dontwarn unresolved references
-dontwarn com.facebook.hermes.**
-dontwarn javax.annotation.**
-dontwarn com.google.errorprone.**
-dontwarn org.bouncycastle.**
-dontwarn com.twilio.**
