package com.akitokosumoto.parkingassist;

import static org.junit.Assert.*;
import static org.junit.Assume.assumeTrue;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.service.notification.StatusBarNotification;
import android.util.Log;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

@RunWith(AndroidJUnit4.class)
public class ParkingNotificationTest {
    private Context context;
    private ParkingNotificationService service;

    private static class AttachedService extends ParkingNotificationService {
        AttachedService(Context context) { attachBaseContext(context); }
    }

    @Before
    public void prepare() {
        context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        context.getSharedPreferences(ParkingNotificationService.PREFERENCES, Context.MODE_PRIVATE).edit().clear().commit();
        service = new AttachedService(context);
    }

    private JSONArray parking(String ids) throws Exception {
        JSONArray records = new JSONArray();
        for (String id : ids.split(",")) {
            records.put(new org.json.JSONObject().put("id", id).put("spot", "15")
                    .put("status", "parking").put("startedAt", "2026-11-25T01:00:00.000Z"));
        }
        return records;
    }

    @Test
    public void timerMeetsPlatformLiveUpdateRequirements() throws Exception {
        assumeTrue(Build.VERSION.SDK_INT >= 36);
        assertEquals(PackageManager.PERMISSION_GRANTED,
                context.checkSelfPermission("android.permission.POST_PROMOTED_NOTIFICATIONS"));
        Notification notification = service.buildNotification(parking("a"));
        assertTrue(notification.hasPromotableCharacteristics());
        assertTrue(notification.extras.getBoolean(Notification.EXTRA_SHOW_CHRONOMETER));
        assertEquals(java.time.Instant.parse("2026-11-25T01:00:00.000Z").toEpochMilli(), notification.when);
        assertNotNull(notification.contentIntent);
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        Log.i("ParkingLiveUpdateTest", "canPostPromotedNotifications=" + manager.canPostPromotedNotifications());
    }

    @Test
    public void waitingAndStartupNotificationsStayStandard() throws Exception {
        assumeTrue(Build.VERSION.SDK_INT >= 36);
        JSONArray waiting = new JSONArray("[{\"id\":\"a\",\"status\":\"issued\",\"spot\":\"15\"}]");
        assertFalse(service.buildNotification(waiting).hasPromotableCharacteristics());
        assertFalse(service.buildNotification(new JSONArray()).hasPromotableCharacteristics());
    }

    @Test
    public void multipleTimersRemainEligibleWithCompactCount() throws Exception {
        assumeTrue(Build.VERSION.SDK_INT >= 36);
        Notification notification = service.buildNotification(parking("a,b"));
        assertTrue(notification.hasPromotableCharacteristics());
        assertEquals("駐車2台", NotificationCompat.getShortCriticalText(notification));
        assertFalse(notification.extras.getBoolean(Notification.EXTRA_SHOW_CHRONOMETER));
    }

    @Test
    public void dismissalStaysRespectedUntilAnotherTimerStarts() throws Exception {
        assumeTrue(Build.VERSION.SDK_INT >= 36);
        SharedPreferences preferences = context.getSharedPreferences(ParkingNotificationService.PREFERENCES, Context.MODE_PRIVATE);
        CountDownLatch received = new CountDownLatch(1);
        SharedPreferences.OnSharedPreferenceChangeListener listener = (prefs, key) -> received.countDown();
        preferences.registerOnSharedPreferenceChangeListener(listener);
        try {
            service.buildNotification(parking("a,b")).deleteIntent.send();
            assertTrue("Delete receiver did not record the dismissal", received.await(5, TimeUnit.SECONDS));
        } finally {
            preferences.unregisterOnSharedPreferenceChangeListener(listener);
        }
        assertFalse(service.buildNotification(parking("a,b")).hasPromotableCharacteristics());
        assertFalse(service.buildNotification(parking("a")).hasPromotableCharacteristics());
        assertTrue(service.buildNotification(parking("a,c")).hasPromotableCharacteristics());
    }

    @Test
    public void systemReceivesTheLiveUpdateRequest() throws Exception {
        assumeTrue(Build.VERSION.SDK_INT >= 36);
        assumeTrue(context.checkSelfPermission("android.permission.POST_NOTIFICATIONS") == PackageManager.PERMISSION_GRANTED);
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        manager.createNotificationChannel(new NotificationChannel("parking-active", "通知確認", NotificationManager.IMPORTANCE_LOW));
        Notification notification = service.buildNotification(parking("probe"));
        notification.extras.putCharSequence(Notification.EXTRA_TITLE, "精算機補助・通知確認用");
        try {
            manager.notify(9601, notification);
            Notification posted = null;
            for (int attempt = 0; attempt < 50 && posted == null; attempt++) {
                for (StatusBarNotification active : manager.getActiveNotifications()) {
                    if (active.getId() == 9601) posted = active.getNotification();
                }
                if (posted == null) Thread.sleep(20);
            }
            assertNotNull("Timer notification did not reach the system", posted);
            assertTrue(NotificationCompat.isRequestPromotedOngoing(posted));
            assertTrue(posted.hasPromotableCharacteristics());
            // OEM policy may decline promotion even when the app meets Android's requirements.
            Log.i("ParkingLiveUpdateTest", "postedTimerFlags=" + posted.flags
                    + ", promoted=" + ((posted.flags & Notification.FLAG_PROMOTED_ONGOING) != 0));
        } finally {
            manager.cancel(9601);
        }
    }
}
