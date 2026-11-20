package com.czx.shuati;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.JsResult;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class MainActivity extends Activity {

    /**
     * 通过 WebViewAssetLoader 走 https 虚拟域名加载本地资源。
     * 好处：页面处于 secure context，IndexedDB / localStorage / fetch 行为与线上一致，
     * 而 file:// 在 WebView 里会有各种同源和存储限制。
     */
    private static final String APP_URL =
            "https://appassets.androidplatform.net/assets/index.html";
    private static final int REQ_PICK_FILE = 1001;

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private long lastBackTime = 0;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        web = new WebView(this);
        web.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        web.setBackgroundColor(Color.parseColor("#f4f6fa"));
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowContentAccess(true);
        s.setAllowFileAccess(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        // 固定 100%，否则系统字体放大设置会把答题界面撑乱
        s.setTextZoom(100);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setUserAgentString(s.getUserAgentString() + " ShuatiApp/1.0");

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web.setWebViewClient(new WebViewClientCompat() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (u != null && "appassets.androidplatform.net".equals(u.getHost())) {
                    return false;
                }
                // 外部链接（比如 API 文档）交给系统浏览器
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, u));
                } catch (Exception ignored) {
                }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                injectBridge(view);
            }
        });

        web.setWebChromeClient(new WebChromeClient() {

            /** 应用里 <input type=file> 依赖这个回调，不实现的话导入题库完全无效 */
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (fileCallback != null) {
                    fileCallback.onReceiveValue(null);
                }
                fileCallback = callback;

                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{
                        "application/pdf",
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        "application/vnd.ms-excel",
                        "text/plain",
                        "text/comma-separated-values",
                        "text/csv",
                        "text/markdown",
                        "application/json"
                });
                try {
                    startActivityForResult(Intent.createChooser(intent, "选择题库文件"), REQ_PICK_FILE);
                } catch (Exception e) {
                    fileCallback = null;
                    toast("找不到可用的文件选择器");
                    return false;
                }
                return true;
            }

            /**
             * WebChromeClient 的默认实现会把确认框直接取消掉。
             * 应用里“退出练习”用 confirm() 二次确认，不接管就永远退不出去。
             */
            @Override
            public boolean onJsConfirm(WebView view, String url, String message, final JsResult result) {
                new AlertDialog.Builder(MainActivity.this)
                        .setMessage(message)
                        .setPositiveButton("确定", (d, w) -> result.confirm())
                        .setNegativeButton("取消", (d, w) -> result.cancel())
                        .setOnCancelListener(d -> result.cancel())
                        .show();
                return true;
            }

            @Override
            public boolean onJsAlert(WebView view, String url, String message, final JsResult result) {
                new AlertDialog.Builder(MainActivity.this)
                        .setMessage(message)
                        .setPositiveButton("确定", (d, w) -> result.confirm())
                        .setOnCancelListener(d -> result.cancel())
                        .show();
                return true;
            }
        });

        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        web.loadUrl(APP_URL);
    }

    /**
     * 页面加载后注入两件事：
     * 1) 拦下 blob 下载（导出备份），交给原生写文件
     * 2) 暴露 __androidBack()，让系统返回键先走应用内导航
     */
    private void injectBridge(WebView view) {
        String js =
                "(function(){" +
                "  if (window.__shuatiBridge) return 'already';" +
                "  window.__shuatiBridge = true;" +

                "  var origClick = HTMLAnchorElement.prototype.click;" +
                "  HTMLAnchorElement.prototype.click = function(){" +
                "    try {" +
                "      var isBlob = this.href && this.href.lastIndexOf('blob:', 0) === 0;" +
                "      var hasDl = this.hasAttribute('download');" +
                "      if (isBlob && hasDl) {" +
                "        var name = this.getAttribute('download') || 'export.json';" +
                "        fetch(this.href).then(function(r){ return r.blob(); }).then(function(b){" +
                "          var fr = new FileReader();" +
                "          fr.onloadend = function(){" +
                "            var str = String(fr.result || '');" +
                "            var i = str.indexOf(',');" +
                "            AndroidBridge.saveFile(name, b.type || 'application/octet-stream', str.substring(i + 1));" +
                "          };" +
                "          fr.onerror = function(){ AndroidBridge.toast('导出失败：文件读取异常'); };" +
                "          fr.readAsDataURL(b);" +
                "        }).catch(function(e){ AndroidBridge.toast('导出失败：' + e.message); });" +
                "        return;" +
                "      }" +
                "    } catch (e) {}" +
                "    return origClick.apply(this, arguments);" +
                "  };" +

                "  window.__androidBack = function(){" +
                "    try {" +
                "      var mask = document.getElementById('mask');" +
                "      if (mask && mask.classList.contains('show')) {" +
                "        var c = document.querySelector('[data-act=\"closeSheet\"]');" +
                "        if (c) { c.click(); return true; }" +
                "        mask.click(); return true;" +
                "      }" +
                "      var act = document.querySelector('.view.active');" +
                "      if (act && act.id !== 'v-home') {" +
                "        var b = act.querySelector('[data-act=\"backhome\"]')" +
                "             || act.querySelector('[data-act=\"quitquiz\"]');" +
                "        if (b) { b.click(); return true; }" +
                "      }" +
                "    } catch (e) {}" +
                "    return false;" +
                "  };" +
                "  return 'ok';" +
                "})();";
        view.evaluateJavascript(js, null);
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript(
                "(function(){ try { return window.__androidBack ? window.__androidBack() : false; } "
                        + "catch(e) { return false; } })();",
                value -> {
                    // 应用内没有可回退的层级时才考虑退出
                    if (!"true".equals(value)) {
                        long now = System.currentTimeMillis();
                        if (now - lastBackTime < 2000) {
                            finish();
                        } else {
                            lastBackTime = now;
                            toast("再按一次退出");
                        }
                    }
                });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_PICK_FILE) {
            if (fileCallback == null) {
                super.onActivityResult(requestCode, resultCode, data);
                return;
            }
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    int count = data.getClipData().getItemCount();
                    results = new Uri[count];
                    for (int i = 0; i < count; i++) {
                        results[i] = data.getClipData().getItemAt(i).getUri();
                    }
                } else if (data.getData() != null) {
                    results = new Uri[]{data.getData()};
                }
            }
            fileCallback.onReceiveValue(results);
            fileCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    private void toast(final String msg) {
        runOnUiThread(() -> Toast.makeText(MainActivity.this, msg, Toast.LENGTH_SHORT).show());
    }

    /** 供页面调用的原生能力 */
    private class Bridge {

        @JavascriptInterface
        public void toast(String msg) {
            MainActivity.this.toast(msg);
        }

        @JavascriptInterface
        public void saveFile(String name, String mime, String base64) {
            byte[] data;
            try {
                data = Base64.decode(base64, Base64.DEFAULT);
            } catch (Exception e) {
                toast("文件内容解码失败");
                return;
            }
            String safeName = sanitize(name);
            try {
                String where = writeFile(safeName, mime, data);
                toast("已保存到 " + where);
            } catch (Exception e) {
                toast("保存失败：" + e.getMessage());
            }
        }
    }

    private static String sanitize(String name) {
        String n = name == null ? "" : name.trim();
        n = n.replace('/', '_').replace('\\', '_').replace("..", "_");
        if (n.isEmpty()) n = "shuati-export.json";
        return n;
    }

    private String writeFile(String name, String mime, byte[] data) throws Exception {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues cv = new ContentValues();
            cv.put(MediaStore.Downloads.DISPLAY_NAME, name);
            cv.put(MediaStore.Downloads.MIME_TYPE, mime);
            cv.put(MediaStore.Downloads.RELATIVE_PATH,
                    Environment.DIRECTORY_DOWNLOADS + "/刷题助手");
            ContentResolver cr = getContentResolver();
            Uri uri = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
            if (uri == null) throw new Exception("无法在下载目录创建文件");
            try (OutputStream os = cr.openOutputStream(uri)) {
                if (os == null) throw new Exception("无法写入文件");
                os.write(data);
                os.flush();
            }
            return "下载/刷题助手/" + name;
        }

        // Android 8/9：先试公共下载目录，没权限就退到应用私有目录
        File publicDir = new File(
                Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
                "刷题助手");
        if (publicDir.exists() || publicDir.mkdirs()) {
            File f = new File(publicDir, name);
            try (FileOutputStream fos = new FileOutputStream(f)) {
                fos.write(data);
                return f.getAbsolutePath();
            } catch (Exception ignored) {
                // 继续走私有目录
            }
        }
        File privateDir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (privateDir == null) privateDir = getFilesDir();
        if (!privateDir.exists() && !privateDir.mkdirs()) {
            throw new Exception("无法创建目录");
        }
        File f = new File(privateDir, name);
        try (FileOutputStream fos = new FileOutputStream(f)) {
            fos.write(data);
        }
        return f.getAbsolutePath();
    }
}
