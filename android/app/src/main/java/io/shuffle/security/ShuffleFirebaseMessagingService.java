package io.shuffle.security;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

public class ShuffleFirebaseMessagingService extends FirebaseMessagingService {

    public static final String CRITICAL_CHANNEL_ID = "shuffle_critical_pager_channel";
    public static final String CRITICAL_CHANNEL_NAME = "Critical Pager Alerts";

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        // Always forward to Capacitor PushNotifications plugin
        try {
            PushNotificationsPlugin.sendRemoteMessage(remoteMessage);
        } catch (Exception ignored) {
        }

        // Check if this payload is a critical incident / pager alert
        Map<String, String> data = remoteMessage.getData();
        String type = data.get("type");
        String priority = data.get("priority");
        boolean isCritical = "pager_alert".equalsIgnoreCase(type)
                || "critical_page".equalsIgnoreCase(type)
                || "critical".equalsIgnoreCase(type)
                || "pager".equalsIgnoreCase(type)
                || "emergency".equalsIgnoreCase(type)
                || "critical".equalsIgnoreCase(priority)
                || "high".equalsIgnoreCase(priority)
                || "true".equalsIgnoreCase(data.get("critical"))
                || "true".equalsIgnoreCase(data.get("pager"));

        if (isCritical) {
            handleCriticalPagerAlert(remoteMessage, data);
        }
    }

    private void handleCriticalPagerAlert(RemoteMessage remoteMessage, Map<String, String> data) {
        String title = data.containsKey("title") ? data.get("title")
                : (remoteMessage.getNotification() != null && remoteMessage.getNotification().getTitle() != null
                    ? remoteMessage.getNotification().getTitle()
                    : "CRITICAL ALERT");

        String body = data.containsKey("body") ? data.get("body")
                : (data.containsKey("message") ? data.get("message")
                : (remoteMessage.getNotification() != null && remoteMessage.getNotification().getBody() != null
                    ? remoteMessage.getNotification().getBody()
                    : "Emergency response required"));

        String incidentId = data.containsKey("incidentId") ? data.get("incidentId")
                : (data.containsKey("incident_id") ? data.get("incident_id")
                : data.get("id"));

        String url = data.containsKey("url") ? data.get("url")
                : (data.containsKey("link") ? data.get("link")
                : data.get("deep_link"));

        // 1. Wake up screen using PowerManager WakeLock
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            PowerManager.WakeLock wakeLock = pm.newWakeLock(
                    PowerManager.FULL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE,
                    "shuffle:critical_pager_wakelock"
            );
            wakeLock.acquire(15000); // 15 seconds max
        }

        // 2. Prepare Intent for full-screen PagerAlertActivity
        Intent fullScreenIntent = new Intent(this, PagerAlertActivity.class);
        fullScreenIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        fullScreenIntent.putExtra(PagerAlertActivity.EXTRA_TITLE, title);
        fullScreenIntent.putExtra(PagerAlertActivity.EXTRA_BODY, body);
        fullScreenIntent.putExtra(PagerAlertActivity.EXTRA_INCIDENT_ID, incidentId);
        fullScreenIntent.putExtra(PagerAlertActivity.EXTRA_URL, url);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(this, (int) System.currentTimeMillis(), fullScreenIntent, flags);

        // 3. Ensure High-Priority Notification Channel exists
        createCriticalNotificationChannel();

        // 4. Build and display full-screen notification
        Uri alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (alarmSound == null) {
            alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CRITICAL_CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(false)
                .setOngoing(true)
                .setSound(alarmSound)
                .setVibrate(new long[]{0, 1000, 500, 1000, 500, 1000})
                .setFullScreenIntent(fullScreenPendingIntent, true)
                .setContentIntent(fullScreenPendingIntent);

        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(this);
        int notificationId = (incidentId != null && !incidentId.isEmpty())
                ? Math.abs(incidentId.hashCode())
                : (int) (System.currentTimeMillis() & 0xfffffff);
        try {
            notificationManager.notify(notificationId, builder.build());
        } catch (SecurityException ignored) {
        }

        // 5. Directly launch PagerAlertActivity
        try {
            startActivity(fullScreenIntent);
        } catch (Exception ignored) {
        }
    }

    private void createCriticalNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                NotificationChannel channel = new NotificationChannel(
                        CRITICAL_CHANNEL_ID,
                        CRITICAL_CHANNEL_NAME,
                        NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("Emergency full-screen critical paging alerts that bypass Do Not Disturb");
                channel.enableLights(true);
                channel.enableVibration(true);
                channel.setVibrationPattern(new long[]{0, 800, 400, 800, 400, 1200});
                channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);

                Uri alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                if (alarmSound != null) {
                    AudioAttributes audioAttributes = new AudioAttributes.Builder()
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .build();
                    channel.setSound(alarmSound, audioAttributes);
                }

                channel.setBypassDnd(true);
                nm.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        try {
            PushNotificationsPlugin.onNewToken(token);
        } catch (Exception ignored) {
        }
    }
}
