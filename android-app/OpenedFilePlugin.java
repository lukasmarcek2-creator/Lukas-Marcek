package sk.lukasmarcek.alldocumentreader;

import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;

/**
 * Odovzdá webovej časti aplikácie dokument, ktorým bola aplikácia otvorená
 * („Otvoriť pomocou“ / predvolená aplikácia) alebo ktorý jej iná aplikácia zdieľala.
 */
@CapacitorPlugin(name = "OpenedFile")
public class OpenedFilePlugin extends Plugin {
    private Intent pending;

    @Override
    public void load() {
        pending = getActivity().getIntent();
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        JSObject file = readIntent(intent);
        if (file != null) notifyListeners("fileOpened", file, true);
    }

    @PluginMethod
    public void getLaunchFile(PluginCall call) {
        JSObject file = readIntent(pending);
        pending = null;
        call.resolve(file == null ? new JSObject() : file);
    }

    @SuppressWarnings("deprecation")
    private Uri uriOf(Intent intent) {
        if (intent == null) return null;
        String action = intent.getAction();
        if (Intent.ACTION_VIEW.equals(action)) return intent.getData();
        if (Intent.ACTION_SEND.equals(action)) return intent.getParcelableExtra(Intent.EXTRA_STREAM);
        return null;
    }

    private JSObject readIntent(Intent intent) {
        Uri uri = uriOf(intent);
        if (uri == null) return null;
        JSObject out = new JSObject();
        try {
            ContentResolver cr = getContext().getContentResolver();
            String name = null;
            if ("content".equals(uri.getScheme())) {
                try (Cursor c = cr.query(uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
                    if (c != null && c.moveToFirst()) {
                        int i = c.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                        if (i >= 0) name = c.getString(i);
                    }
                } catch (Exception ignored) { }
            }
            if (name == null) name = uri.getLastPathSegment();
            String mime = cr.getType(uri);
            if (mime == null) mime = intent.getType();

            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            try (InputStream in = cr.openInputStream(uri)) {
                byte[] buf = new byte[65536];
                int n;
                while ((n = in.read(buf)) != -1) bytes.write(buf, 0, n);
            }
            out.put("name", name);
            out.put("mimeType", mime);
            out.put("data", Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP));
        } catch (Exception e) {
            out.put("error", String.valueOf(e.getMessage()));
        }
        return out;
    }
}
