package com.handback.tv;

import android.app.Activity;
import android.app.AlertDialog;
import android.os.Bundle;
import android.graphics.Color;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceError;
import android.webkit.WebSettings;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Button;
import android.widget.EditText;
import android.text.InputType;
import org.json.JSONObject;
import android.webkit.JavascriptInterface;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import java.util.Locale;
import android.media.MediaPlayer;
import android.speech.tts.Voice;

/** TV launcher. Every primary operation can be performed with the D-pad and Select. */
public final class MainActivity extends Activity {
  private WebView web;
  private LinearLayout offline;
  private boolean failed=false;
  private TextToSpeech speech;
  private volatile boolean voiceReady=false;
  private MediaPlayer audio;
  private void voiceState(String state){runOnUiThread(()->web.evaluateJavascript("window.dispatchEvent(new CustomEvent('handback-voice-state',{detail:"+JSONObject.quote(state)+"}));",null));}
  public final class VoiceBridge {
    @JavascriptInterface public void ready(){remoteReady=true;}
    @JavascriptInterface public boolean available(){return voiceReady;}
    @JavascriptInterface public void speak(String text){runOnUiThread(()->{
      if(!voiceReady){voiceState("unavailable");return;}
      int result=speech.speak(text.substring(0,Math.min(text.length(),1800)),TextToSpeech.QUEUE_FLUSH,null,"handback-route");
      if(result==TextToSpeech.ERROR){voiceReady=false;voiceState("unavailable");}
    });}
    @JavascriptInterface public void play(String path){runOnUiThread(()->{
      if(!path.matches("^/api/voice/[a-f0-9]{32}$")){voiceState("unavailable");return;}
      if(audio!=null){audio.release();audio=null;}
      audio=new MediaPlayer();
      try {
        java.util.Map<String,String> headers=new java.util.HashMap<>();
        String cookie=android.webkit.CookieManager.getInstance().getCookie(base);
        if(cookie!=null)headers.put("Cookie",cookie);
        audio.setDataSource(MainActivity.this,android.net.Uri.parse(base+path),headers);
        audio.setOnPreparedListener(player->{player.start();voiceState("speaking");});
        audio.setOnCompletionListener(player->{player.release();if(audio==player)audio=null;voiceState("stopped");});
        audio.setOnErrorListener((player,what,extra)->{player.release();if(audio==player)audio=null;voiceState("unavailable");return true;});
        audio.prepareAsync();
      }catch(Exception e){audio.release();audio=null;voiceState("unavailable");}
    });}
    @JavascriptInterface public void stop(){runOnUiThread(()->{if(speech!=null)speech.stop();if(audio!=null){audio.release();audio=null;}voiceState("stopped");});}
  }
  private String base=BuildConfig.DEFAULT_ORIGIN;
  private volatile boolean remoteReady=false;
  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    base=getPreferences(MODE_PRIVATE).getString("base",base);
    LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(Color.rgb(17,47,53));
    web=new WebView(this);web.setBackgroundColor(Color.rgb(17,47,53));
    web.addJavascriptInterface(new VoiceBridge(),"HandbackVoice");
    speech=new TextToSpeech(this,status->{
      voiceReady=false;
      if(status==TextToSpeech.SUCCESS){
        speech.setLanguage(Locale.UK);
        if(speech.getVoices()!=null)for(Voice v:speech.getVoices())if(v.getLocale().getLanguage().equals("en")&&!v.isNetworkConnectionRequired()&&!v.getFeatures().contains("notInstalled")){voiceReady=speech.setVoice(v)==TextToSpeech.SUCCESS;break;}
        speech.setSpeechRate(0.85f);
      }
    });
    speech.setOnUtteranceProgressListener(new UtteranceProgressListener(){
      @Override public void onStart(String id){voiceState("speaking");}
      @Override public void onDone(String id){voiceState("stopped");}
      @Override public void onError(String id){voiceReady=false;voiceState("unavailable");}
    });
    WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setCacheMode(WebSettings.LOAD_NO_CACHE);settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setMediaPlaybackRequiresUserGesture(true);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
    web.setWebViewClient(new WebViewClient(){
      @Override public void onPageStarted(WebView view,String url,android.graphics.Bitmap icon){remoteReady=false;}
      @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request) {String url=request.getUrl().toString();return !url.startsWith(base+"/tv")&&!url.startsWith(base+"/auth/")&&!url.equals(base+"/");}
      @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error) {if(request.isForMainFrame())showOffline();}
      @Override public void onPageFinished(WebView view,String url){if(!failed){web.setVisibility(View.VISIBLE);offline.setVisibility(View.GONE);}}
    });
    root.addView(web,new LinearLayout.LayoutParams(-1,-1));
    offline=new LinearLayout(this);offline.setOrientation(LinearLayout.VERTICAL);offline.setPadding(70,45,70,30);offline.setGravity(android.view.Gravity.CENTER);
    TextView title=new TextView(this);title.setText("handback TV\nLet’s reconnect.");title.setTextColor(Color.rgb(243,239,218));title.setTextSize(30);title.setGravity(17);offline.addView(title);
    TextView info=new TextView(this);info.setText((base.startsWith("https:")?"Check your internet connection and try again.\nYour saved routes stay in the private preview.\n\n":"Keep your laptop awake and run Handback.\nYour saved trips will be waiting.\n\n")+base);info.setTextColor(Color.rgb(169,190,168));info.setTextSize(17);info.setGravity(17);info.setPadding(0,20,0,20);offline.addView(info);
    Button retry=new Button(this);retry.setText("Try again");retry.setOnClickListener(v->load());offline.addView(retry,new LinearLayout.LayoutParams(240,60));
    Button config=new Button(this);config.setText("Connection settings");config.setOnClickListener(v->settings());offline.addView(config,new LinearLayout.LayoutParams(240,60));
    root.addView(offline,new LinearLayout.LayoutParams(-1,-1));offline.setVisibility(View.GONE);setContentView(root);load();
  }
  private void load(){failed=false;offline.setVisibility(View.GONE);web.setVisibility(View.VISIBLE);web.loadUrl(base+"/tv/journeys");}
  private void showOffline(){failed=true;web.setVisibility(View.GONE);offline.setVisibility(View.VISIBLE);offline.getChildAt(2).requestFocus();}
  private void settings(){EditText field=new EditText(this);field.setText(base);field.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_URI);new AlertDialog.Builder(this).setTitle("Local service address").setMessage("Use the Azure preview HTTPS address, or http://10.0.2.2:4310 for the laptop emulator.").setView(field).setPositiveButton("Connect",(d,w)->{String value=field.getText().toString().replaceAll("/+$","");if(value.matches("^http://(10\\.0\\.2\\.2|127\\.0\\.0\\.1|localhost):[0-9]{2,5}$")||value.matches("^https://[a-z0-9.-]+\\.cloudapp\\.azure\\.com$")){base=value;getPreferences(MODE_PRIVATE).edit().putString("base",base).apply();load();}else new AlertDialog.Builder(this).setMessage("Enter a supported local address and port.").setPositiveButton("OK",null).show();}).setNegativeButton("Cancel",null).show();}
  private void pairing(){EditText field=new EditText(this);field.setInputType(InputType.TYPE_CLASS_NUMBER);new AlertDialog.Builder(this).setTitle("Pair this television").setMessage("Enter the six-digit code shown in your helper dashboard.").setView(field).setPositiveButton("Pair",(d,w)->{String code=field.getText().toString();if(code.matches("[0-9]{6}"))web.evaluateJavascript("window.dispatchEvent(new CustomEvent('handback-pair',{detail:"+JSONObject.quote(code)+"}));",null);}).setNegativeButton("Cancel",null).show();}
  @Override public boolean dispatchKeyEvent(KeyEvent event){
    int key=event.getKeyCode();
    boolean remote=key==KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE||key==KeyEvent.KEYCODE_MENU||key==KeyEvent.KEYCODE_DPAD_UP||key==KeyEvent.KEYCODE_DPAD_DOWN||key==KeyEvent.KEYCODE_DPAD_LEFT||key==KeyEvent.KEYCODE_DPAD_RIGHT||key==KeyEvent.KEYCODE_DPAD_CENTER||key==KeyEvent.KEYCODE_ENTER||key==KeyEvent.KEYCODE_BACK;
    if(!failed&&remoteReady&&remote&&event.getAction()!=KeyEvent.ACTION_DOWN)return true;
    if(key==KeyEvent.KEYCODE_MENU){new AlertDialog.Builder(this).setTitle("Handback TV").setItems(new String[]{"Pair television","Connection settings","Reload"},(d,w)->{if(w==0)pairing();else if(w==1)settings();else load();}).show();return true;}
    if(!failed&&remoteReady){String action=null;switch(key){case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:action="read";break;case KeyEvent.KEYCODE_DPAD_UP:action="up";break;case KeyEvent.KEYCODE_DPAD_DOWN:action="down";break;case KeyEvent.KEYCODE_DPAD_LEFT:action="left";break;case KeyEvent.KEYCODE_DPAD_RIGHT:action="right";break;case KeyEvent.KEYCODE_DPAD_CENTER:case KeyEvent.KEYCODE_ENTER:action="select";break;case KeyEvent.KEYCODE_BACK:action="back";break;}
      if(action!=null){web.evaluateJavascript("if(window.handbackRemote)window.handbackRemote('"+action+"');",null);return true;}}
    return super.dispatchKeyEvent(event);
  }
  @Override protected void onPause(){if(speech!=null)speech.stop();if(audio!=null){audio.release();audio=null;}super.onPause();}
  @Override protected void onDestroy(){if(audio!=null){audio.release();audio=null;}if(speech!=null){speech.stop();speech.shutdown();}web.removeJavascriptInterface("HandbackVoice");web.destroy();super.onDestroy();}
}
