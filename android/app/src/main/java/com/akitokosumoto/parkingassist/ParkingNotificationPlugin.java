package com.akitokosumoto.parkingassist;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
        name = "ParkingNotification",
        permissions = {
                @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
        }
)
public class ParkingNotificationPlugin extends Plugin {
    private static final String ACTION_SYNC = "com.akitokosumoto.parkingassist.action.SYNC";
    private static final String EXTRA_RECORDS = "records";

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
                || ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED) {
            call.resolve();
            return;
        }

        requestPermissionForAlias("notifications", call, "notificationPermissionCallback");
    }

    @PermissionCallback
    private void notificationPermissionCallback(PluginCall call) {
        call.resolve();
    }

    @PluginMethod
    public void sync(PluginCall call) {
        JSArray records = call.getArray(EXTRA_RECORDS, new JSArray());
        Intent intent = new Intent(getContext(), ParkingNotificationService.class)
                .setAction(ACTION_SYNC)
                .putExtra(EXTRA_RECORDS, records.toString());

        if (records.length() == 0) {
            getContext().stopService(intent);
        } else {
            ContextCompat.startForegroundService(getContext(), intent);
        }
        call.resolve();
    }
}
