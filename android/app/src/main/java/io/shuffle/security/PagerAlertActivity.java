package io.shuffle.security;

import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.NotificationManagerCompat;

public class PagerAlertActivity extends AppCompatActivity {

    public static final String EXTRA_INCIDENT_ID = "incident_id";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_BODY = "body";
    public static final String EXTRA_URL = "url";
    public static final String EXTRA_TIMESTAMP = "timestamp";

    private MediaPlayer mediaPlayer;
    private Vibrator vibrator;
    private boolean isSilenced = false;
    private String currentIncidentId = null;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Configure activity to wake up screen and show above keyguard/lockscreen
        setupLockscreenWakeup();

        setContentView(R.layout.activity_pager_alert);

        // Read incident metadata from Intent
        Intent intent = getIntent();
        String title = intent != null && intent.getStringExtra(EXTRA_TITLE) != null
                ? intent.getStringExtra(EXTRA_TITLE)
                : "Critical Security Alert";
        String body = intent != null && intent.getStringExtra(EXTRA_BODY) != null
                ? intent.getStringExtra(EXTRA_BODY)
                : "An urgent incident requires your attention immediately.";
        String incidentId = intent != null ? intent.getStringExtra(EXTRA_INCIDENT_ID) : null;
        this.currentIncidentId = incidentId;
        String url = intent != null ? intent.getStringExtra(EXTRA_URL) : null;

        // Bind Views
        TextView tvTitle = findViewById(R.id.tv_incident_title);
        TextView tvBody = findViewById(R.id.tv_incident_body);
        TextView tvMeta = findViewById(R.id.tv_incident_meta);
        Button btnAcknowledge = findViewById(R.id.btn_acknowledge);
        Button btnSilence = findViewById(R.id.btn_silence);

        if (tvTitle != null) tvTitle.setText(title);
        if (tvBody != null) tvBody.setText(body);
        if (tvMeta != null && incidentId != null && !incidentId.isEmpty()) {
            tvMeta.setText("Incident ID: " + incidentId);
        }

        // Start emergency audible siren and vibration
        startAlertSiren();
        startVibration();

        // Handle Acknowledge & Open
        if (btnAcknowledge != null) {
            btnAcknowledge.setOnClickListener(v -> {
                stopAlert();
                openAppWithIncident(incidentId, url);
                finish();
            });
        }

        // Handle Silence Only
        if (btnSilence != null) {
            btnSilence.setOnClickListener(v -> {
                stopAlert();
                finish();
            });
        }
    }

    private void setupLockscreenWakeup() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null) {
                km.requestDismissKeyguard(this, null);
            }
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            );
        }

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    private void startAlertSiren() {
        if (isSilenced) return;
        try {
            Uri alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (alarmUri == null) {
                alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            }

            mediaPlayer = new MediaPlayer();
            mediaPlayer.setDataSource(this, alarmUri);

            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
            mediaPlayer.setAudioAttributes(audioAttributes);
            mediaPlayer.setLooping(true);
            mediaPlayer.prepare();
            mediaPlayer.start();
        } catch (Exception e) {
            // Fallback: silent fail gracefully if audio device is unavailable
        }
    }

    private void startVibration() {
        if (isSilenced) return;
        try {
            vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null && vibrator.hasVibrator()) {
                long[] pattern = new long[]{0, 800, 400, 800, 400, 1200, 500};
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
                } else {
                    vibrator.vibrate(pattern, 0);
                }
            }
        } catch (Exception e) {
            // Ignore vibration error
        }
    }

    private void stopAlert() {
        isSilenced = true;
        if (mediaPlayer != null) {
            try {
                if (mediaPlayer.isPlaying()) {
                    mediaPlayer.stop();
                }
                mediaPlayer.release();
            } catch (Exception ignored) {
            } finally {
                mediaPlayer = null;
            }
        }
        if (vibrator != null) {
            try {
                vibrator.cancel();
            } catch (Exception ignored) {
            } finally {
                vibrator = null;
            }
        }
        try {
            NotificationManagerCompat nm = NotificationManagerCompat.from(this);
            if (currentIncidentId != null && !currentIncidentId.isEmpty()) {
                nm.cancel(Math.abs(currentIncidentId.hashCode()));
            }
        } catch (Exception ignored) {
        }
    }

    private void openAppWithIncident(@Nullable String incidentId, @Nullable String targetUrl) {
        Intent mainIntent = new Intent(this, MainActivity.class);
        mainIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (targetUrl != null && !targetUrl.isEmpty()) {
            mainIntent.setData(Uri.parse(targetUrl));
        } else if (incidentId != null && !incidentId.isEmpty()) {
            mainIntent.setData(Uri.parse("shuffle://app/incidents/" + incidentId));
        }
        startActivity(mainIntent);
    }

    @Override
    protected void onPause() {
        super.onPause();
        stopAlert();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        stopAlert();
    }
}
