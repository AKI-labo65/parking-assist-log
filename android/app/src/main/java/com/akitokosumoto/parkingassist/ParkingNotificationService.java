package com.akitokosumoto.parkingassist;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
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
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.TimeZone;

public class ParkingNotificationService extends Service {
    public static final String ACTION_SYNC = "com.akitokosumoto.parkingassist.action.SYNC";
    public static final String EXTRA_RECORDS = "records";

    private static final String CHANNEL_ID = "parking-active";
    private static final int NOTIFICATION_ID = 6501;
    static final String PREFERENCES = "parking-notification";
    private static final String DISMISSED_TIMERS = "dismissed-timers";

    public static class DismissReceiver extends BroadcastReceiver {
        @Override
        public void onReceive(Context context, Intent intent) {
            ArrayList<String> timerIds = intent.getStringArrayListExtra(DISMISSED_TIMERS);
            if (timerIds == null) return;
            SharedPreferences preferences = context.getSharedPreferences(PREFERENCES, MODE_PRIVATE);
            Set<String> dismissed = new HashSet<>(preferences.getStringSet(DISMISSED_TIMERS, new HashSet<>()));
            dismissed.addAll(timerIds);
            preferences.edit().putStringSet(DISMISSED_TIMERS, dismissed).apply();
        }
    }

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

    Notification buildNotification(JSONArray records) {
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

        // Now bar: one timer shows its elapsed time, several timers show the count (design notes 1 and 3).
        ArrayList<JSONObject> parking = new ArrayList<>();
        ArrayList<JSONObject> issued = new ArrayList<>();
        for (int index = 0; index < records.length(); index++) {
            JSONObject record = records.optJSONObject(index);
            if (record == null) continue;
            if ("parking".equals(record.optString("status", "parking"))) parking.add(record);
            else if ("issued".equals(record.optString("status"))) issued.add(record);
        }
        String waitingText = issued.isEmpty() ? "" : "精算待ち " + issued.size() + "台";

        if (parking.size() == 1) {
            JSONObject record = parking.get(0);
            long startedAt = parseIsoMillis(record.optString("startedAt", ""));
            builder.setContentTitle(spotLabel(record) + "・駐車中")
                    .setContentText("入庫 " + formatClock(startedAt) + "・証明書発行までの経過時間")
                    .setShowWhen(true)
                    .setUsesChronometer(true)
                    .setWhen(startedAt);
            if (!waitingText.isEmpty()) builder.setSubText(waitingText);
        } else if (parking.size() > 1) {
            StringBuilder lines = new StringBuilder();
            for (JSONObject record : parking) {
                if (lines.length() > 0) lines.append('\n');
                lines.append(spotLabel(record)).append("　入庫 ")
                        .append(formatClock(parseIsoMillis(record.optString("startedAt", ""))));
            }
            if (!waitingText.isEmpty()) lines.append('\n').append(waitingText);
            builder.setContentTitle("駐車中 " + parking.size() + "台")
                    .setContentText(joinSpots(parking) + (waitingText.isEmpty() ? "" : "／" + waitingText))
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(lines));
        } else if (issued.size() == 1) {
            builder.setContentTitle(spotLabel(issued.get(0)) + "・証明書発行済み")
                    .setContentText("精算待ち");
        } else if (!issued.isEmpty()) {
            builder.setContentTitle(waitingText)
                    .setContentText(joinSpots(issued));
        }

        Set<String> timerIds = new HashSet<>();
        for (int index = 0; index < records.length(); index++) {
            JSONObject record = records.optJSONObject(index);
            if (record == null || !"parking".equals(record.optString("status"))) continue;
            timerIds.add(record.optString("id", record.optString("spot") + ":" + record.optString("startedAt")));
        }
        SharedPreferences preferences = getSharedPreferences(PREFERENCES, MODE_PRIVATE);
        Set<String> dismissed = new HashSet<>(preferences.getStringSet(DISMISSED_TIMERS, new HashSet<>()));
        // Do not re-promote a timer the user dismissed. A newly started timer can appear again.
        if (records.length() > 0 && dismissed.retainAll(timerIds)) {
            preferences.edit().putStringSet(DISMISSED_TIMERS, dismissed).apply();
        }
        Set<String> eligibleTimers = new HashSet<>(timerIds);
        eligibleTimers.removeAll(dismissed);
        builder.setRequestPromotedOngoing(!eligibleTimers.isEmpty());
        if (!timerIds.isEmpty()) {
            Intent dismiss = new Intent(this, DismissReceiver.class)
                    .putStringArrayListExtra(DISMISSED_TIMERS, new ArrayList<>(timerIds));
            builder.setDeleteIntent(PendingIntent.getBroadcast(this, 6502, dismiss,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
            if (timerIds.size() > 1) builder.setShortCriticalText("駐車" + timerIds.size() + "台");
        }
        return builder.build();
    }

    private static String spotLabel(JSONObject record) {
        String spot = record.optString("spot", "");
        return spot.isEmpty() ? "番号未入力" : spot + "番";
    }

    private static String joinSpots(ArrayList<JSONObject> records) {
        StringBuilder spots = new StringBuilder();
        for (JSONObject record : records) {
            if (spots.length() > 0) spots.append('・');
            spots.append(spotLabel(record));
        }
        return spots.toString();
    }

    private static String formatClock(long millis) {
        return new SimpleDateFormat("H:mm", Locale.JAPAN).format(new Date(millis));
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
