package com.akitokosumoto.parkingassist;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

public class ParkingNotificationService extends Service {
    public static final String ACTION_SYNC = "com.akitokosumoto.parkingassist.action.SYNC";
    public static final String EXTRA_RECORDS = "records";

    private static final String CHANNEL_ID = "parking-active";
    private static final int NOTIFICATION_ID = 6501;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        startForegroundCompat(buildNotification(new JSONArray()));
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || !ACTION_SYNC.equals(intent.getAction())) {
            return START_NOT_STICKY;
        }

        String recordsJson = intent.getStringExtra(EXTRA_RECORDS);
        JSONArray records;
        try {
            records = recordsJson == null ? new JSONArray() : new JSONArray(recordsJson);
        } catch (Exception exception) {
            records = new JSONArray();
        }

        if (records.length() == 0) {
            stopSelf();
            return START_NOT_STICKY;
        }

        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.notify(NOTIFICATION_ID, buildNotification(records));
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.cancel(NOTIFICATION_ID);
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void startForegroundCompat(Notification notification) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private Notification buildNotification(JSONArray records) {
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_parking)
                .setContentIntent(openAppIntent())
                .setCategory(NotificationCompat.CATEGORY_PROGRESS)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setAutoCancel(false)
                .setShowWhen(false)
                .setContentTitle("精算機補助");

        if (records.length() == 1) {
            JSONObject record = records.optJSONObject(0);
            if (record != null) {
                String status = record.optString("status", "parking");
                String spot = record.optString("spot", "");
                String spotLabel = spot.isEmpty() ? "番号未入力" : spot + "番";

                if ("parking".equals(status)) {
                    builder.setContentTitle(spotLabel + "・駐車中")
                            .setContentText("証明書発行までの経過時間")
                            .setShowWhen(true)
                            .setUsesChronometer(true)
                            .setWhen(parseIsoMillis(record.optString("startedAt", "")));
                } else {
                    builder.setContentTitle(spotLabel + "・証明書発行済み")
                            .setContentText("精算待ち")
                            .setShowWhen(false);
                }
            }
        } else {
            builder.setContentTitle("精算機補助・対応中")
                    .setContentText(buildSummary(records));
        }

        // Android 16+ can promote eligible ongoing notifications to a status chip.
        // NotificationCompat keeps this call available on older Android versions.
        try {
            builder.getClass().getMethod("setRequestPromotedOngoing", boolean.class).invoke(builder, true);
        } catch (Exception ignored) {
            // The OEM or Android version may not support promoted notifications.
        }
        return builder.build();
    }

    private String buildSummary(JSONArray records) {
        int parkingCount = 0;
        int issuedCount = 0;
        StringBuilder spots = new StringBuilder();
        for (int index = 0; index < records.length(); index++) {
            JSONObject record = records.optJSONObject(index);
            if (record == null) continue;
            if ("parking".equals(record.optString("status"))) parkingCount++;
            if ("issued".equals(record.optString("status"))) issuedCount++;
            String spot = record.optString("spot", "");
            if (!spot.isEmpty()) {
                if (spots.length() > 0) spots.append('・');
                spots.append(spot).append('番');
            }
        }

        StringBuilder summary = new StringBuilder();
        if (parkingCount > 0) summary.append("駐車中 ").append(parkingCount).append("件");
        if (issuedCount > 0) {
            if (summary.length() > 0) summary.append(" / ");
            summary.append("精算待ち ").append(issuedCount).append("件");
        }
        if (spots.length() > 0) {
            if (summary.length() > 0) summary.append("：");
            summary.append(spots);
        }
        return summary.length() == 0 ? "対応中の記録があります" : summary.toString();
    }

    private PendingIntent openAppIntent() {
        Intent intent = new Intent(this, MainActivity.class)
                .setAction(Intent.ACTION_MAIN)
                .addCategory(Intent.CATEGORY_LAUNCHER)
                .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(this, 6501, intent, flags);
    }

    private long parseIsoMillis(String value) {
        if (value == null || value.isEmpty()) return System.currentTimeMillis();
        String[] patterns = { "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", "yyyy-MM-dd'T'HH:mm:ss'Z'" };
        for (String pattern : patterns) {
            try {
                SimpleDateFormat formatter = new SimpleDateFormat(pattern, Locale.US);
                formatter.setTimeZone(TimeZone.getTimeZone("UTC"));
                Date parsed = formatter.parse(value);
                if (parsed != null) return parsed.getTime();
            } catch (ParseException ignored) {
                // Try the next ISO-8601 precision.
            }
        }
        return System.currentTimeMillis();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "駐車中タイマー",
                NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("駐車中・精算待ちの車両をロック画面に表示します");
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }
}
