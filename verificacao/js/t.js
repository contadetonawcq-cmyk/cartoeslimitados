/* TrackerNexus t.js v2 — https://cdn.trackernexus.app/t.js */
(function(w,d){"use strict";
var s=d.currentScript||(function(){var a=d.getElementsByTagName("script");return a[a.length-1]})();
var ID=s.getAttribute("data-id")||s.getAttribute("data-offer");if(!ID)return;
var API="https://api.trackernexus.app";
var LK="_tn_lid",UK="_tn_utms",PK="_tn_q";
function lid(){var v=localStorage.getItem(LK);if(v)return v;v="tn_"+Math.random().toString(36).substr(2,12)+"_"+Date.now().toString(36);localStorage.setItem(LK,v);return v}
function utms(){var p=new URLSearchParams(w.location.search);var k=["utm_source","utm_medium","utm_campaign","utm_content","utm_term"];var f={};k.forEach(function(u){var v=p.get(u);if(v)f[u.replace("utm_","")]=v});var st={};try{st=JSON.parse(localStorage.getItem(UK)||"{}")}catch(e){}for(var x in f)st[x]=f[x];localStorage.setItem(UK,JSON.stringify(st));return st}
function pg(){return(location.pathname.replace(/\/index\.html?$/i,"/").replace(/\.html?$/i,"").replace(/\/+$/,"")||"/")}
function send(type,page,detail){
var body=JSON.stringify({leadId:lid(),type:type,page:page||pg(),detail:detail||null,utms:utms(),offerId:ID});
try{if(navigator.sendBeacon){navigator.sendBeacon(API+"/api/t",body)}else{var x=new XMLHttpRequest();x.open("POST",API+"/api/t",true);x.setRequestHeader("Content-Type","text/plain");x.send(body)}}catch(e){try{var q=JSON.parse(localStorage.getItem(PK)||"[]");q.push(body);localStorage.setItem(PK,JSON.stringify(q.slice(-20)))}catch(e2){}}
}
try{var pq=JSON.parse(localStorage.getItem(PK)||"[]");if(pq.length){pq.forEach(function(b){try{navigator.sendBeacon(API+"/api/t",b)}catch(e){}});localStorage.removeItem(PK)}}catch(e){}
var CKD=["pay.segpaymentsafe.digital","pay.promonovaatiava.top"];
var custom=s.getAttribute("data-checkout-url");
if(custom){custom.split(",").forEach(function(d){d=d.trim().replace(/^https?:\/\//,"").replace(/\/.*$/,"");if(d)CKD.push(d)})}
function isCk(u){if(!u)return false;try{var p=new URL(u,location.origin);var h=p.hostname.toLowerCase();for(var i=0;i<CKD.length;i++){if(h===CKD[i]||h.endsWith("."+CKD[i]))return true}}catch(e){}return false}
var _ckf=false;function fireCk(u){if(_ckf)return;_ckf=true;send("checkout",pg(),u||"")}
d.addEventListener("click",function(e){var el=e.target;while(el&&el.tagName!=="A")el=el.parentElement;if(el&&el.href&&isCk(el.href))fireCk(el.href)},true);
var _open=w.open;w.open=function(){var u=arguments[0];if(isCk(u))fireCk(u);return _open.apply(w,arguments)};
w._tracker={trackCpf:function(st,dt){send("cpf",pg(),JSON.stringify({status:st,detail:dt}))},trackEvent:function(t,dt){send(t,pg(),dt)},trackCheckout:function(dt){send("checkout",pg(),dt)},goCheckout:function(url){send("checkout",pg(),url);setTimeout(function(){w.location.href=url},120)},getLeadId:lid};
send("pageview");
var _pi=setInterval(function(){send("ping")},60000);
w.addEventListener("beforeunload",function(){clearInterval(_pi);send("leave")});
d.addEventListener("visibilitychange",function(){if(d.hidden)send("leave");else send("pageview")});
})(window,document);
