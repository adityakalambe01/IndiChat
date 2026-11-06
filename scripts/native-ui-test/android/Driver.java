package com.indichat.acceptancedriver;
import android.app.Instrumentation;
import android.os.Bundle;
import android.graphics.Rect;
import android.view.accessibility.AccessibilityNodeInfo;

public class Driver extends Instrumentation {
  private Bundle args;
  public void onCreate(Bundle arguments) { super.onCreate(arguments); args=arguments; start(); }
  private String escape(CharSequence v) { return v==null?"":v.toString().replace("&","&amp;").replace("\"","&quot;").replace("<","&lt;").replace("\n","&#10;"); }
  private void tree(AccessibilityNodeInfo n,StringBuilder out) {
    Rect r=new Rect();n.getBoundsInScreen(r);
    out.append("<node text=\"").append(escape(n.getText())).append("\" content-desc=\"").append(escape(n.getContentDescription())).append("\" class=\"").append(escape(n.getClassName())).append("\" checked=\"").append(n.isChecked()).append("\" selected=\"").append(n.isSelected()).append("\" bounds=\"[").append(r.left).append(',').append(r.top).append("][").append(r.right).append(',').append(r.bottom).append("]\">");
    for(int i=0;i<n.getChildCount();i++){ AccessibilityNodeInfo child=n.getChild(i);if(child!=null)tree(child,out); }
    out.append("</node>");
  }
  public void onStart() {
    Bundle result=new Bundle();
    try {
      AccessibilityNodeInfo root=null;
      long deadline=android.os.SystemClock.uptimeMillis()+5000;
      while(root==null && android.os.SystemClock.uptimeMillis()<deadline) {
        root=getUiAutomation().getRootInActiveWindow();
        if(root==null) android.os.SystemClock.sleep(50);
      }
      if(root==null)throw new IllegalStateException("No active accessibility window");
      StringBuilder out=new StringBuilder("<hierarchy>");tree(root,out);out.append("</hierarchy>");
      result.putString("stream",out.toString());finish(-1,result);
    } catch(Exception error){ result.putString("stream",error.toString());finish(1,result); }
  }
}
