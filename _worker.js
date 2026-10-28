import {storageEnv,initializeStore} from './trip-store.mjs';
import {serveProductionUi} from './.build/ui.mjs';
import {handleTripApp} from './trip-app.mjs';
import { authenticateTrip, knownAccountNames } from './trip-auth.mjs';
import { isAdmin } from './trip-settings.mjs';
import { handleTripTools, issueSession, toolSession } from './trip-tools.mjs';
import { handlePhotoTools } from './trip-photos.mjs';
import { handleTower } from './trip-tower.mjs';
// agnamo · trip — Cloudflare Worker
// Routes: /api/scan-trip, /api/suggest-packing, /api/health, /schema.sql
// All AI traffic → Cloudflare AI Gateway → DeepSeek. SPA fallback to index.html.

const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="theme-color" content="#faf7f0">
<title>agnamo · trip</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@400;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Unbounded:wght@600;700;800&display=swap');

/* ===== ROOT TOKENS ===== */
:root{
  --bg:#faf7f0;
  --surface:#ffffff;
  --surface-2:#f5f0e6;
  --ink:#17171c;
  --ink-2:#3a3a42;
  --muted:#86868f;
  --line:#e6ddc9;
  --line-soft:#f0ead9;
  --orange:#ff4d00;
  --orange-hi:#ff6b2c;
  --pink:#ff3d7f;
  --teal:#0d9488;
  --teal-soft:#ccfbf1;
  --red:#ef4444;
  --green:#22c55e;
  --grad:linear-gradient(135deg,#ff4d8f 0%,#ff4d00 100%);
  --grad-teal:linear-gradient(135deg,#0d9488,#0891b2);
  --r:20px;
  --r-sm:14px;
  --r-xs:10px;
  --r-lg:24px;
  --shadow-sm:0 1px 2px rgba(23,23,28,.04),0 1px 4px rgba(23,23,28,.03);
  --shadow:0 2px 8px rgba(23,23,28,.05),0 1px 3px rgba(23,23,28,.04);
  --shadow-lg:0 16px 48px rgba(23,23,28,.10),0 4px 16px rgba(23,23,28,.06);
  --shadow-glow:0 4px 24px rgba(255,77,0,.14);
  --shadow-card:0 1px 3px rgba(23,23,28,.04),0 4px 12px rgba(23,23,28,.04);
  --safe:env(safe-area-inset-bottom,0px);
  --tab-h:64px;
  --font-body:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;
  --font-display:'Unbounded',var(--font-body);
  --ease:cubic-bezier(.4,0,.2,1);
  --ease-out:cubic-bezier(0,.0,.2,1);
  --maxw:1600px;
}

/* ===== RESET ===== */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%;-webkit-tap-highlight-color:transparent;text-size-adjust:100%}
body{
  font-family:var(--font-body);
  background:var(--bg);
  background-image:
    radial-gradient(ellipse 80% 50% at 50% -10%,rgba(255,77,143,.04),transparent),
    radial-gradient(ellipse 60% 40% at 90% 5%,rgba(255,77,0,.03),transparent);
  background-attachment:fixed;
  color:var(--ink);
  min-height:100vh;
  -webkit-font-smoothing:antialiased;
  -moz-osx-font-smoothing:grayscale;
  font-feature-settings:'cv11','ss1','ss03';
  overscroll-behavior-y:none;
  padding-bottom:calc(var(--tab-h) + var(--safe) + 16px);
  letter-spacing:-.006em;
}
h1,h2,h3,h4{font-family:var(--font-display);letter-spacing:-.025em;line-height:1.12;font-weight:700}
button,input,select,textarea{font:inherit;color:inherit}
button{cursor:pointer;border:none;background:none}
input,textarea{-webkit-appearance:none;appearance:none}
:root{color-scheme:light}

/* ===== TABBAR ===== */
.tabbar{
  position:fixed;bottom:0;left:0;right:0;
  height:calc(var(--tab-h) + var(--safe));
  background:rgba(255,255,255,.72);
  backdrop-filter:blur(28px) saturate(1.8);
  -webkit-backdrop-filter:blur(28px) saturate(1.8);
  border-top:1px solid rgba(230,221,201,.45);
  display:flex;justify-content:center;align-items:flex-start;
  padding-top:9px;padding-bottom:var(--safe);
  z-index:100;
}
.tabbar::before{
  content:'';position:absolute;top:0;left:0;right:0;height:1px;
  background:linear-gradient(90deg,transparent,rgba(255,77,0,.12),transparent);
}
.tab{
  display:flex;flex-direction:column;align-items:center;gap:4px;
  font-size:.64rem;font-weight:600;
  color:var(--muted);letter-spacing:.01em;
  flex:1;max-width:120px;padding:4px 0;
  transition:color .2s var(--ease);-webkit-user-select:none;user-select:none;
}
.tab svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;transition:transform .2s var(--ease)}
.tab.active{color:var(--orange)}
.tab.active svg{transform:translateY(-1px) scale(1.05)}

/* ===== SCREENS ===== */
.screen{
  display:none;
  max-width:100%;margin:0 auto;
  padding:20px 16px 48px;
}
.screen.active{
  display:block;
  animation:fadeIn .28s var(--ease-out);
}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}

/* ===== BRAND HEADER ===== */
.brand-row{
  display:flex;align-items:center;justify-content:space-between;
  margin-bottom:28px;
}
.brand{
  font-family:var(--font-display);font-weight:800;font-size:1.05rem;
  display:flex;align-items:baseline;gap:1px;
  letter-spacing:-.03em;
}
.brand .a{
  background:var(--grad);
  -webkit-background-clip:text;background-clip:text;
  -webkit-text-fill-color:transparent;
}
.brand .dot{color:var(--teal)}
.section-label{
  font-size:.68rem;font-weight:700;
  text-transform:uppercase;letter-spacing:.1em;
  color:var(--muted);margin:0;
}

/* ===== TRIP HERO ===== */
.trip-hero{
  background:var(--surface);
  border-radius:var(--r-lg);
  padding:36px 28px;
  box-shadow:var(--shadow);
  border:1px solid var(--line);
  margin-bottom:24px;
  position:relative;overflow:hidden;
}
.trip-hero::before{
  content:'';position:absolute;top:-60px;right:-60px;
  width:200px;height:200px;
  background:var(--grad);
  opacity:.07;border-radius:50%;filter:blur(40px);
}
.trip-hero::after{
  content:'';position:absolute;bottom:-40px;left:-40px;
  width:140px;height:140px;
  background:var(--grad-teal);
  opacity:.04;border-radius:50%;filter:blur(40px);
}
.trip-hero .eyebrow{
  font-size:.66rem;font-weight:700;
  text-transform:uppercase;letter-spacing:.1em;
  color:var(--orange);margin-bottom:14px;position:relative;
}
.trip-hero h1{
  font-size:clamp(1.6rem,7vw,2.3rem);
  font-weight:800;margin-bottom:8px;position:relative;
  line-height:1.08;
}
.trip-hero .city{
  font-size:.92rem;color:var(--muted);
  font-weight:500;position:relative;line-height:1.5;
}

/* ===== FORMS ===== */
.field-group{display:flex;flex-direction:column;gap:16px;margin-top:28px}
.field-row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.lbl{
  font-size:.62rem;font-weight:700;
  text-transform:uppercase;letter-spacing:.08em;
  color:var(--muted);margin-bottom:7px;display:block;
}
.inp{
  width:100%;padding:14px 16px;
  font-size:.92rem;font-weight:500;
  border:1.5px solid var(--line);
  border-radius:var(--r-sm);
  background:var(--surface-2);
  outline:none;
  transition:border-color .2s var(--ease),background .2s var(--ease),box-shadow .2s var(--ease);
}
.inp:focus{border-color:var(--orange);background:var(--surface);box-shadow:0 0 0 4px rgba(255,77,0,.08)}
.inp::placeholder{color:var(--muted);font-weight:400}

/* ===== DESTINATION RESULTS ===== */
.dest-results{margin-top:10px}
.dest-result{
  padding:13px 16px;
  background:var(--surface);
  border:1px solid var(--line);
  border-radius:var(--r-sm);
  margin-bottom:8px;
  font-size:.88rem;cursor:pointer;
  display:flex;align-items:center;gap:12px;
  transition:all .15s var(--ease);
}
.dest-result:hover,.dest-result:active{
  border-color:var(--orange);
  background:rgba(255,77,0,.03);
}
.dest-result .flag{font-size:1.3rem;line-height:1}
.dest-result .info{flex:1;min-width:0}
.dest-result .name{font-weight:600;letter-spacing:-.01em}
.dest-result .region{font-size:.76rem;color:var(--muted);margin-top:1px}

/* ===== BUTTONS ===== */
.btn{
  font-weight:700;font-size:.86rem;
  padding:14px 26px;
  border-radius:100px;
  display:inline-flex;align-items:center;justify-content:center;gap:8px;
  transition:all .18s var(--ease);
  -webkit-user-select:none;user-select:none;text-align:center;
  letter-spacing:-.01em;
}
.btn-fill{
  background:var(--grad);color:#fff;
  box-shadow:0 2px 8px rgba(255,77,0,.2),0 1px 3px rgba(255,77,0,.12);
}
.btn-fill:hover{box-shadow:0 4px 16px rgba(255,77,0,.28),0 2px 6px rgba(255,77,0,.16);transform:translateY(-1px)}
.btn-fill:active{transform:scale(.97)}
.btn-dark{background:var(--ink);color:#fff;box-shadow:0 2px 8px rgba(23,23,28,.15)}
.btn-dark:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(23,23,28,.2)}
.btn-dark:active{transform:scale(.97)}
.btn-ghost{
  background:transparent;
  border:1.5px solid var(--line);
  color:var(--ink-2);
}
.btn-ghost:hover{border-color:var(--ink-2);background:var(--surface-2)}
.btn-ghost:active{background:var(--surface-2)}
.btn-block{display:flex;width:100%}
.btn-row{display:flex;gap:12px;margin-top:24px}

/* ===== SCAN BUTTON ===== */
.scan-btn{
  display:flex;align-items:center;gap:14px;
  padding:16px 20px;
  background:var(--surface);
  border:2px dashed rgba(255,77,0,.35);
  border-radius:var(--r-sm);
  cursor:pointer;
  transition:all .18s var(--ease);
  width:100%;margin-top:20px;
}
.scan-btn:hover{border-color:var(--orange);background:rgba(255,77,0,.03);border-width:2px}
.scan-btn:active{background:rgba(255,77,0,.06)}
.scan-btn .scan-text{font-size:.88rem;font-weight:700;color:var(--orange);letter-spacing:-.01em}
.scan-btn .scan-sub{font-size:.72rem;color:var(--muted);margin-top:3px;font-weight:400}

/* ===== TRIP INFO CARD ===== */
.trip-info{
  background:linear-gradient(135deg,#1c1c22 0%,#26262e 100%);
  border-radius:var(--r-lg);
  padding:24px 26px;margin-bottom:24px;
  display:flex;flex-direction:column;gap:18px;
  box-shadow:0 8px 32px rgba(23,23,28,.12);
  position:relative;overflow:hidden;
}
.trip-info::before{
  content:'';position:absolute;top:-30px;right:-30px;width:100px;height:100px;
  background:var(--grad);opacity:.08;border-radius:50%;filter:blur(30px);
}
.trip-info .row{display:flex;justify-content:space-between;align-items:center;position:relative}
.trip-info .dest-name{
  font-family:var(--font-display);font-weight:700;font-size:1.2rem;color:#fff;
  letter-spacing:-.02em;position:relative;
}
.trip-info .dates{font-size:.82rem;color:rgba(255,255,255,.55);margin-top:5px;font-weight:500;position:relative}
.trip-info .flight{
  display:flex;gap:20px;flex-wrap:wrap;
  padding-top:16px;border-top:1px solid rgba(255,255,255,.08);position:relative;
}
.trip-info .flight .item{
  font-size:.66rem;color:rgba(255,255,255,.4);
  text-transform:uppercase;letter-spacing:.06em;font-weight:600;
}
.trip-info .flight .item strong{
  color:var(--orange-hi);font-weight:600;font-size:.88rem;
  display:block;margin-top:4px;text-transform:none;letter-spacing:-.01em;
}
.trip-info .edit-link{
  font-size:.76rem;color:rgba(255,255,255,.45);
  text-decoration:none;font-weight:600;cursor:pointer;
  transition:color .15s;position:relative;
}
.trip-info .edit-link:hover{color:#fff}
.trip-info .source-badge{
  font-size:.58rem;font-weight:700;
  padding:4px 10px;border-radius:100px;
  background:var(--teal);color:#fff;
  text-transform:uppercase;letter-spacing:.05em;
  align-self:flex-start;position:relative;
}

/* ===== TRIPS LIST ===== */
.trips-list{margin-top:28px}
.trips-list .list-label{
  font-size:.68rem;font-weight:700;
  text-transform:uppercase;letter-spacing:.1em;
  color:var(--muted);margin-bottom:14px;
}
.trip-card{
  background:var(--surface);
  border:1.5px solid var(--line);
  border-radius:var(--r-sm);
  padding:18px;margin-bottom:10px;
  cursor:pointer;
  transition:all .18s var(--ease);
  display:flex;align-items:center;justify-content:space-between;gap:14px;
  box-shadow:var(--shadow-sm);
}
.trip-card:hover{border-color:var(--orange);box-shadow:var(--shadow)}
.trip-card:active{border-color:var(--orange)}
.trip-card.active{
  border-color:var(--orange);
  background:linear-gradient(135deg,rgba(255,77,0,.03),rgba(255,77,143,.02));
  box-shadow:0 0 0 1px var(--orange),var(--shadow-sm);
}
.trip-card .tc-main{flex:1;min-width:0}
.trip-card .tc-city{
  font-family:var(--font-display);font-weight:700;font-size:.92rem;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:-.02em;
}
.trip-card .tc-dates{font-size:.76rem;color:var(--muted);margin-top:4px;font-weight:500}
.trip-card .tc-source{
  font-size:.56rem;font-weight:700;
  padding:3px 8px;border-radius:100px;
  background:var(--teal-soft);color:var(--teal);
  text-transform:uppercase;margin-top:6px;display:inline-block;letter-spacing:.04em;
}
.trip-card .tc-del{
  width:30px;height:30px;border-radius:50%;
  color:var(--muted);font-size:.78rem;flex-shrink:0;
  display:grid;place-items:center;
  transition:all .15s var(--ease);
}
.trip-card .tc-del:hover{color:var(--red);background:rgba(239,68,68,.08)}
.trip-card .tc-del:active{color:var(--red);background:rgba(239,68,68,.12)}

/* ===== WEATHER ===== */
.weather-current{
  background:var(--grad);
  border-radius:var(--r-lg);
  padding:14px 20px;
  margin-bottom:16px;
  display:flex;align-items:center;gap:16px;
  position:relative;overflow:hidden;
  box-shadow:var(--shadow-glow);
}
.weather-current::after{
  content:'';position:absolute;top:-30px;right:-30px;
  width:110px;height:110px;border-radius:50%;
  background:rgba(255,255,255,.1);
}
.weather-current .w-icon{font-size:1.7rem;line-height:1;z-index:1;filter:drop-shadow(0 2px 8px rgba(0,0,0,.1))}
.weather-current .w-info{flex:1;z-index:1}
.weather-current .w-label{
  font-size:.64rem;text-transform:uppercase;letter-spacing:.1em;
  color:rgba(255,255,255,.65);font-weight:700;
}
.weather-current .w-cond{font-size:.96rem;font-weight:700;color:#fff;margin-top:2px;letter-spacing:-.01em}
.weather-current .w-extra{font-size:.72rem;color:rgba(255,255,255,.6);margin-top:3px;font-weight:500}
.weather-current .w-extra svg{width:.85rem;height:.85rem;vertical-align:-1px}
.weather-current .w-temp{
  font-family:var(--font-display);font-weight:800;font-size:1.8rem;
  color:#fff;z-index:1;letter-spacing:-.04em;line-height:1;
}
.weather-scroll{
  display:flex;gap:10px;overflow-x:auto;
  scroll-snap-type:x mandatory;
  -webkit-overflow-scrolling:touch;padding-bottom:6px;
}
.weather-scroll::-webkit-scrollbar{display:none}
.w-day{
  flex:0 0 80px;
  background:var(--surface);
  border:1px solid var(--line);
  border-radius:var(--r-sm);
  padding:16px 12px;text-align:center;
  scroll-snap-align:start;
  transition:all .18s var(--ease);
}
.w-day:hover{box-shadow:var(--shadow-sm)}
.w-day .d-label{font-size:.6rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
.w-day .d-icon{font-size:1.6rem;margin:8px 0;line-height:1}
.w-day .d-hi{font-family:var(--font-display);font-weight:700;font-size:1rem;letter-spacing:-.02em}
.w-day .d-lo{font-size:.74rem;color:var(--muted);font-weight:600;margin-top:1px}
.w-day .d-precip{font-size:.6rem;color:var(--teal);font-weight:700;margin-top:5px}

/* ===== PACK CATEGORIES ===== */
.cat-section{margin-bottom:14px}
.cat-head{
  display:flex;align-items:center;justify-content:space-between;
  padding:16px 20px;
  background:var(--surface);
  border:1px solid var(--line);
  border-radius:var(--r-sm);
  cursor:pointer;
  transition:all .15s var(--ease);
  -webkit-user-select:none;user-select:none;
  box-shadow:var(--shadow-sm);
}
.cat-head:hover{border-color:var(--ink-2)}
.cat-head:active{background:var(--surface-2)}
.cat-section.open .cat-head{border-color:var(--orange);box-shadow:0 0 0 1px var(--orange),var(--shadow-sm)}
.cat-head .left{display:flex;align-items:center;gap:12px}
.cat-head .cat-name{font-size:.92rem;font-weight:700;letter-spacing:-.01em}
.cat-head .chevron{width:18px;height:18px;transition:transform .25s var(--ease);color:var(--muted)}
.cat-section.open .cat-head .chevron{transform:rotate(180deg)}
.cat-head .right{display:flex;align-items:center;gap:10px}
.cat-head .pill{
  font-size:.64rem;font-weight:700;
  padding:4px 10px;border-radius:100px;
  background:var(--line-soft);color:var(--ink-2);
  letter-spacing:.02em;
}
.cat-head .pill.done{background:var(--teal);color:#fff}
.cat-body{max-height:0;overflow:hidden;transition:max-height .3s var(--ease)}
.cat-section.open .cat-body{max-height:5000px}

/* ===== PACK LIST ===== */
.pack-list{padding:8px 0 0}
.pack-row{
  display:flex;align-items:center;gap:12px;
  padding:12px 18px;
  border-bottom:1px solid var(--line-soft);
  transition:opacity .18s var(--ease),background .15s;
}
.pack-row:hover{background:rgba(245,240,230,.4)}
.pack-row:last-child{border-bottom:none}
.pack-row.checked{opacity:.42}
.pack-row .check{
  width:24px;height:24px;
  border:2px solid var(--line);
  border-radius:8px;flex-shrink:0;
  display:grid;place-items:center;
  transition:all .18s var(--ease);cursor:pointer;
}
.pack-row .check:active{transform:scale(.9)}
.pack-row .check svg{width:13px;height:13px;opacity:0;transition:opacity .15s}
.pack-row.checked .check{background:var(--orange);border-color:var(--orange);box-shadow:0 2px 8px rgba(255,77,0,.2)}
.pack-row.checked .check svg{opacity:1}
.pack-row .p-label{flex:1;font-size:.88rem;font-weight:500;min-width:0;letter-spacing:-.01em}
.pack-row.checked .p-label{text-decoration:line-through}
.pack-row .auto-badge{
  font-size:.56rem;font-weight:700;
  text-transform:uppercase;letter-spacing:.05em;
  padding:3px 7px;border-radius:100px;
  background:var(--teal-soft);color:var(--teal);white-space:nowrap;
}
.pack-row .qty-control{display:flex;align-items:center;gap:6px}
.pack-row .qty-btn{
  width:28px;height:28px;
  border:1px solid var(--line);border-radius:8px;
  display:grid;place-items:center;
  font-size:.85rem;font-weight:700;color:var(--ink-2);
  transition:all .15s var(--ease);
}
.pack-row .qty-btn:hover{border-color:var(--orange);color:var(--orange)}
.pack-row .qty-btn:active{transform:scale(.92)}
.pack-row .qty-val{font-size:.82rem;font-weight:700;min-width:18px;text-align:center;font-variant-numeric:tabular-nums}
.pack-row .del-btn{
  width:26px;height:26px;color:var(--muted);font-size:.78rem;
  opacity:0;transition:opacity .15s,color .15s;cursor:pointer;
}
.pack-row:hover .del-btn{opacity:.5}
.pack-row:active .del-btn{opacity:.6}
.pack-row .del-btn:active{opacity:1;color:var(--red)}
.pack-row .del-btn:hover{color:var(--red);opacity:1}

/* ===== PACK COUNTER ===== */
.pack-counter{
  display:flex;align-items:center;gap:4px;
  background:var(--surface-2);
  border-radius:100px;padding:3px 6px;
}
.pack-counter .pc-btn{
  width:24px;height:24px;border-radius:50%;
  border:1px solid var(--line);
  background:var(--surface);
  font-size:.8rem;font-weight:700;color:var(--ink-2);
  display:grid;place-items:center;cursor:pointer;
  transition:all .15s var(--ease);
}
.pack-counter .pc-btn:hover{border-color:var(--orange);color:var(--orange)}
.pack-counter .pc-btn:active{transform:scale(.9)}
.pack-counter .pc-val{
  font-size:.8rem;font-weight:700;min-width:30px;text-align:center;
  font-variant-numeric:tabular-nums;letter-spacing:-.01em;
}
.pack-counter .pc-sep{color:var(--muted);font-size:.68rem;font-weight:600}
.pc-others{display:flex;flex-wrap:wrap;gap:4px;margin-left:6px;align-items:center}
.pc-other{font-size:.64rem;font-weight:600;color:var(--muted);background:var(--surface);border:1px solid var(--line);border-radius:100px;padding:2px 8px;white-space:nowrap}
.pc-other b{font-weight:700;color:var(--ink-2)}
.share-chip{display:inline-block;background:var(--teal-soft);color:var(--teal);border-radius:100px;padding:3px 10px;font-weight:600;font-size:.74rem;margin:2px}

/* ===== ADD ITEM ===== */
.add-item{display:flex;gap:10px;padding:14px 18px 18px}
.add-item .ai-inp{
  flex:1;padding:10px 14px;font-size:.84rem;font-weight:500;
  border:1px solid var(--line);border-radius:var(--r-xs);
  background:var(--surface-2);outline:none;
  transition:border-color .15s;
}
.add-item .ai-inp:focus{border-color:var(--orange);background:var(--surface)}
.add-item .ai-inp::placeholder{color:var(--muted)}
.add-item .ai-btn{
  padding:10px 18px;font-size:.78rem;font-weight:700;
  background:var(--ink);color:#fff;border-radius:var(--r-xs);
  transition:transform .12s;letter-spacing:-.01em;
}
.add-item .ai-btn:active{transform:scale(.95)}

/* ===== PROGRESS CARD ===== */
.progress-card{
  background:var(--surface);
  border-radius:var(--r-lg);
  padding:22px 26px;
  box-shadow:var(--shadow);
  border:1px solid var(--line);
  margin-bottom:20px;
}
.progress-card .p-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
.progress-card .p-top .p-title{font-size:.82rem;font-weight:600;color:var(--ink-2);letter-spacing:-.01em}
.progress-card .p-top .p-pct{
  font-family:var(--font-display);font-weight:800;font-size:1.4rem;
  color:var(--orange);letter-spacing:-.03em;
}
.progress-card .p-track{
  height:8px;background:var(--line-soft);
  border-radius:100px;overflow:hidden;
}
.progress-card .p-fill{
  height:100%;background:var(--grad);
  border-radius:100px;
  transition:width .5s var(--ease);
  box-shadow:0 1px 4px rgba(255,77,0,.2);
}
.progress-card .p-fill.done{background:var(--grad-teal);box-shadow:0 1px 4px rgba(13,148,136,.2)}

/* ===== UPLOAD ZONE ===== */
.upload-zone{
  border:2px dashed var(--line);
  border-radius:var(--r-lg);
  padding:44px 24px;text-align:center;
  margin-bottom:18px;
  transition:all .2s var(--ease);
  cursor:pointer;background:var(--surface);
  box-shadow:var(--shadow-sm);
}
.upload-zone:hover,.upload-zone:active,.upload-zone.drag{
  border-color:var(--orange);
  background:rgba(255,77,0,.03);
}
.upload-zone .uz-icon{
  width:52px;height:52px;margin:0 auto 14px;
  border-radius:14px;background:var(--surface-2);
  display:grid;place-items:center;
}
.upload-zone .uz-icon svg{width:24px;height:24px;stroke:var(--muted);fill:none;stroke-width:2}
.upload-zone .uz-text{font-size:.9rem;font-weight:700;color:var(--ink-2);letter-spacing:-.01em}
.upload-zone .uz-sub{font-size:.76rem;color:var(--muted);margin-top:5px;font-weight:500}

/* ===== PHOTO GRID ===== */
.photo-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.photo-cell{
  position:relative;aspect-ratio:3/4;
  border-radius:var(--r-sm);overflow:hidden;
  border:3px solid transparent;
  transition:all .18s var(--ease);cursor:pointer;
  box-shadow:var(--shadow-sm);
}
.photo-cell:hover{box-shadow:var(--shadow)}
.photo-cell:active{transform:scale(.96)}
.photo-cell img{width:100%;height:100%;object-fit:cover;display:block}
.photo-cell.selected{border-color:var(--teal);box-shadow:0 0 0 1px var(--teal),var(--shadow)}
.photo-cell .pc-badge{
  position:absolute;top:6px;right:6px;
  width:24px;height:24px;border-radius:50%;
  background:rgba(0,0,0,.4);backdrop-filter:blur(8px);
  display:grid;place-items:center;
  transition:all .18s;
}
.photo-cell.selected .pc-badge{background:var(--teal)}
.photo-cell .pc-badge svg{width:12px;height:12px;stroke:#fff;fill:none;stroke-width:3;opacity:0;transition:opacity .15s}
.photo-cell.selected .pc-badge svg{opacity:1}
.photo-cell .pc-del{
  position:absolute;top:6px;left:6px;
  width:24px;height:24px;border-radius:50%;
  background:rgba(0,0,0,.45);backdrop-filter:blur(8px);
  color:#fff;font-size:.62rem;font-weight:700;
  display:grid;place-items:center;z-index:2;
}

/* ===== STYLE TAGS ===== */
.style-tags{display:flex;gap:8px;overflow-x:auto;margin-bottom:16px;padding-bottom:6px;-webkit-overflow-scrolling:touch}
.style-tags::-webkit-scrollbar{display:none}
.stag{
  flex:0 0 auto;font-size:.74rem;font-weight:700;
  padding:8px 16px;border-radius:100px;
  border:1.5px solid var(--line);
  background:transparent;color:var(--ink-2);
  white-space:nowrap;transition:all .15s var(--ease);
  letter-spacing:-.01em;
}
.stag.active{background:var(--ink);border-color:var(--ink);color:#fff}
.stag:hover{border-color:var(--ink-2)}
.stag:active{transform:scale(.95)}

/* ===== STYLE GRID ===== */
.style-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
.style-card{
  background:var(--surface);
  border-radius:var(--r-sm);overflow:hidden;
  border:1px solid var(--line);
  box-shadow:var(--shadow-sm);
  transition:box-shadow .18s;
}
.style-card:hover{box-shadow:var(--shadow)}
.style-card img{width:100%;aspect-ratio:3/4;object-fit:cover;display:block}
.style-card .sc-body{padding:12px 14px}
.style-card .sc-tag{
  font-size:.62rem;font-weight:700;
  text-transform:uppercase;letter-spacing:.06em;
  color:var(--orange);
}
.style-card .sc-inp{
  width:100%;margin-top:8px;padding:6px 0;
  font-size:.8rem;font-weight:500;
  border:none;border-bottom:1px solid var(--line-soft);
  outline:none;background:transparent;color:var(--ink-2);
}
.style-card .sc-inp:focus{border-bottom-color:var(--orange)}
.style-card .sc-inp::placeholder{color:var(--muted)}
.style-card .sc-foot{
  display:flex;justify-content:space-between;align-items:center;
  padding:10px 14px;border-top:1px solid var(--line-soft);
}
.style-card .sc-del{font-size:.7rem;color:var(--muted);font-weight:600;cursor:pointer;transition:color .15s}
.style-card .sc-del:hover,.style-card .sc-del:active{color:var(--red)}

/* ===== SYNC CARD ===== */
.sync-card{
  background:var(--surface);
  border-radius:var(--r-lg);
  padding:28px;
  box-shadow:var(--shadow);
  border:1px solid var(--line);
  margin-bottom:16px;
}
.sync-status{
  display:flex;align-items:center;gap:12px;
  padding:16px 18px;border-radius:var(--r-sm);
  margin-top:18px;font-size:.82rem;font-weight:600;
  letter-spacing:-.01em;
}
.sync-status.connected{background:rgba(34,197,94,.08);color:var(--green)}
.sync-status.disconnected{background:var(--surface-2);color:var(--muted)}
.sync-status .dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.sync-status.connected .dot{background:var(--green);box-shadow:0 0 0 3px rgba(34,197,94,.12)}
.sync-status.disconnected .dot{background:var(--muted)}
.sync-trips-count{font-size:.8rem;color:var(--muted);margin-top:14px;font-weight:500}

/* ===== EMPTY STATE ===== */
.empty-state{
  text-align:center;padding:36px 24px;
  color:var(--muted);font-size:.86rem;font-weight:500;
  font-style:normal;line-height:1.6;
}

/* ===== TOAST ===== */
.toast{
  position:fixed;bottom:calc(var(--tab-h) + var(--safe) + 24px);
  left:50%;transform:translateX(-50%) translateY(24px);
  background:var(--ink);color:#fff;
  padding:13px 26px;border-radius:100px;
  font-size:.82rem;font-weight:600;
  z-index:200;opacity:0;
  transition:all .3s var(--ease-out);
  pointer-events:none;white-space:nowrap;
  box-shadow:0 8px 32px rgba(23,23,28,.25);
  letter-spacing:-.01em;
}
.toast.show{opacity:1;transform:translateX(-50%) translateY(0)}

/* ===== MODAL ===== */
.modal-bg{
  position:fixed;inset:0;
  background:rgba(23,23,28,.45);
  backdrop-filter:blur(10px);
  display:none;place-items:center;
  z-index:300;padding:24px;
}
.modal-bg.show{display:grid}
.modal{
  background:var(--surface);
  border-radius:var(--r-lg);
  padding:40px 32px;text-align:center;
  max-width:360px;width:100%;
  box-shadow:var(--shadow-lg);
  animation:modalIn .3s var(--ease-out);
}
@keyframes modalIn{from{opacity:0;transform:scale(.94) translateY(10px)}to{opacity:1;transform:none}}
.modal .m-icon{font-size:2.8rem;margin-bottom:16px;line-height:1}
.modal h2{
  font-size:1.7rem;
  background:var(--grad);
  -webkit-background-clip:text;background-clip:text;
  -webkit-text-fill-color:transparent;
  margin-bottom:8px;letter-spacing:-.03em;
}
.modal p{font-size:.9rem;color:var(--muted);margin-bottom:28px;line-height:1.5;font-weight:500}

/* ===== LOADING OVERLAY ===== */
.loading-overlay{
  position:fixed;inset:0;
  background:rgba(23,23,28,.55);
  backdrop-filter:blur(12px);
  display:none;place-items:center;
  z-index:400;padding:24px;
}
.loading-overlay.show{display:grid}
.loading-overlay .lo-box{
  background:var(--surface);
  border-radius:var(--r-lg);
  padding:40px 32px;text-align:center;
  max-width:320px;width:100%;
  box-shadow:var(--shadow-lg);
  animation:modalIn .3s var(--ease-out);
}
.loading-overlay .spinner{
  width:42px;height:42px;
  border:3px solid var(--line-soft);
  border-top-color:var(--orange);
  border-radius:50%;
  animation:spin .7s linear infinite;
  margin:0 auto 18px;
}
@keyframes spin{to{transform:rotate(360deg)}}
.loading-overlay .lo-text{font-size:.92rem;font-weight:700;color:var(--ink);letter-spacing:-.01em}
.loading-overlay .lo-sub{font-size:.76rem;color:var(--muted);margin-top:8px;font-weight:500}

/* ===== HIDDEN ===== */
.hidden{display:none!important}

/* ===== AUTH GATE — PREMIUM FULL-SCREEN LOGIN ===== */
.auth-gate{
  position:fixed;inset:0;z-index:99999;
  background:var(--bg);
  background-image:
    radial-gradient(ellipse 70% 50% at 50% -5%,rgba(255,77,143,.07),transparent),
    radial-gradient(ellipse 55% 35% at 88% 8%,rgba(255,77,0,.06),transparent),
    radial-gradient(ellipse 50% 40% at 12% 92%,rgba(13,148,136,.05),transparent);
  background-attachment:fixed;
  display:flex;align-items:center;justify-content:center;
  padding:24px;
  animation:authGateIn .4s var(--ease-out);
}
@keyframes authGateIn{from{opacity:0}to{opacity:1}}
.auth-gate.leaving{animation:authGateOut .45s var(--ease) forwards}
@keyframes authGateOut{from{opacity:1;transform:none}to{opacity:0;transform:translateY(-20px)}}
.auth-card{
  background:var(--surface);
  border-radius:var(--r-lg);
  padding:48px 38px 36px;
  max-width:400px;width:100%;
  box-shadow:0 24px 64px rgba(23,23,28,.12),0 8px 24px rgba(23,23,28,.06);
  border:1px solid var(--line);
  animation:authCardIn .5s var(--ease-out);
  position:relative;overflow:hidden;
}
@keyframes authCardIn{from{opacity:0;transform:translateY(24px) scale(.96)}to{opacity:1;transform:none}}
.auth-gate.leaving .auth-card{animation:authCardOut .45s var(--ease) forwards}
@keyframes authCardOut{from{opacity:1;transform:none}to{opacity:0;transform:translateY(-20px) scale(.97)}}
.auth-card::before{
  content:'';position:absolute;top:-50px;right:-50px;
  width:140px;height:140px;
  background:var(--grad);opacity:.06;border-radius:50%;filter:blur(35px);
}
.auth-card .ac-brand{
  font-family:var(--font-display);font-weight:800;font-size:1.45rem;
  display:flex;align-items:baseline;gap:1px;
  margin-bottom:6px;justify-content:center;letter-spacing:-.03em;
  position:relative;
}
.auth-card .ac-brand .a{background:var(--grad);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.auth-card .ac-brand .dot{color:var(--teal)}
.auth-card .ac-tagline{
  font-size:.72rem;font-weight:600;color:var(--muted);
  text-align:center;margin-bottom:32px;letter-spacing:.06em;
  text-transform:uppercase;position:relative;
}
.auth-card h2{font-size:1.5rem;margin-bottom:8px;text-align:center;letter-spacing:-.03em;position:relative}
.auth-card .ac-sub{font-size:.84rem;color:var(--muted);text-align:center;margin-bottom:30px;font-weight:500;position:relative}
.auth-card .ac-field{margin-bottom:18px;position:relative}
.auth-card .ac-label{
  font-size:.62rem;font-weight:700;text-transform:uppercase;
  letter-spacing:.08em;color:var(--muted);
  display:block;margin-bottom:7px;position:relative;
}
.auth-card .ac-inp{
  width:100%;padding:14px 18px;
  font-size:.95rem;font-weight:500;
  border:1.5px solid var(--line);
  border-radius:var(--r-sm);
  background:var(--surface-2);outline:none;
  transition:border-color .2s,background .2s,box-shadow .2s;
  text-align:left;letter-spacing:0;
}
.auth-card .ac-inp:focus{border-color:var(--orange);background:var(--surface);box-shadow:0 0 0 4px rgba(255,77,0,.08)}
.auth-card .ac-inp::placeholder{color:var(--muted);font-weight:400}
.auth-card .ac-btn{
  width:100%;margin-top:6px;
  padding:16px 26px;font-size:.92rem;font-weight:700;
  background:var(--grad);color:#fff;
  border-radius:100px;border:none;cursor:pointer;
  letter-spacing:-.01em;
  box-shadow:0 4px 16px rgba(255,77,0,.25),0 2px 6px rgba(255,77,0,.15);
  transition:all .18s var(--ease);
}
.auth-card .ac-btn:hover{transform:translateY(-1px);box-shadow:0 8px 28px rgba(255,77,0,.32),0 4px 10px rgba(255,77,0,.18)}
.auth-card .ac-btn:active{transform:scale(.97)}
.auth-card .ac-err{font-size:.8rem;color:var(--red);text-align:center;margin-top:14px;display:none;font-weight:600;position:relative}
.auth-card .ac-err.show{display:block;animation:authErrShake .3s var(--ease)}
@keyframes authErrShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
.auth-card .ac-hint{
  font-size:.72rem;color:var(--muted);text-align:center;
  margin-top:24px;font-weight:500;letter-spacing:.02em;
  padding-top:18px;border-top:1px solid var(--line-soft);
  position:relative;
}

/* ===== PACK STATS ===== */
.pack-stats{display:flex;gap:12px;margin-bottom:18px}
.pack-stat{
  flex:1;text-align:center;
  padding:18px 10px;
  background:var(--surface);
  border:1px solid var(--line);
  border-radius:var(--r-sm);
  box-shadow:var(--shadow-sm);
  transition:all .18s var(--ease);
}
.pack-stat:hover{box-shadow:var(--shadow)}
.pack-stat .ps-num{
  font-family:var(--font-display);font-weight:800;
  font-size:1.6rem;line-height:1;letter-spacing:-.04em;
}
.pack-stat .ps-lbl{
  font-size:.56rem;font-weight:700;
  color:var(--muted);text-transform:uppercase;
  letter-spacing:.06em;margin-top:6px;
}

/* ===== PACK SEARCH ===== */
.pack-search{margin-bottom:18px}
.pack-search .ps-inp{
  width:100%;padding:14px 16px;
  font-size:.9rem;font-weight:500;
  border:1.5px solid var(--line);
  border-radius:var(--r-sm);
  background:var(--surface);outline:none;
  transition:border-color .2s,box-shadow .2s;
  box-shadow:var(--shadow-sm);
}
.pack-search .ps-inp:focus{border-color:var(--orange);box-shadow:0 0 0 4px rgba(255,77,0,.08)}
.pack-search .ps-inp::placeholder{color:var(--muted)}

/* ===== TEMPLATE CHIPS ===== */
.template-chips{
  display:flex;gap:8px;overflow-x:auto;
  margin-bottom:18px;padding-bottom:6px;
  -webkit-overflow-scrolling:touch;
}
.template-chips::-webkit-scrollbar{display:none}
.t-chip{
  flex:0 0 auto;display:flex;align-items:center;gap:6px;
  font-size:.76rem;font-weight:700;
  padding:9px 16px;border-radius:100px;
  border:1.5px solid var(--line);
  background:var(--surface);color:var(--ink-2);
  white-space:nowrap;transition:all .15s var(--ease);
  cursor:pointer;letter-spacing:-.01em;
}
.t-chip:hover{border-color:var(--orange);color:var(--orange)}
.t-chip:active{transform:scale(.95)}
.t-chip .t-icon{font-size:.9rem;line-height:1}

/* ===== AI SUGGEST BUTTON ===== */
.ai-suggest-btn{
  display:flex;align-items:center;justify-content:center;gap:8px;
  width:100%;padding:16px;margin-bottom:22px;
  background:var(--grad);color:#fff;
  border-radius:var(--r-sm);
  font-size:.88rem;font-weight:700;
  cursor:pointer;
  transition:all .15s var(--ease);
  border:none;letter-spacing:-.01em;
  box-shadow:var(--shadow-glow);
}
.ai-suggest-btn:hover{transform:translateY(-1px);box-shadow:0 6px 28px rgba(255,77,0,.2)}
.ai-suggest-btn:active{transform:scale(.98)}
.ai-suggest-btn.loading{opacity:.6;pointer-events:none}

/* ===== ESSENTIAL BADGE ===== */
.essential-badge{
  font-size:.54rem;font-weight:700;
  text-transform:uppercase;letter-spacing:.05em;
  padding:3px 7px;border-radius:100px;
  background:#fef3c7;color:#92400e;white-space:nowrap;
}

/* ===== CAT ICON ===== */
.cat-icon{font-size:1.1rem;line-height:1}

/* ===== CHAT ===== */
.chat-wrap{
  display:flex;flex-direction:column;
  height:calc(100vh - var(--tab-h) - var(--safe) - 140px);
  min-height:320px;
}
.chat-msgs{
  flex:1;overflow-y:auto;
  -webkit-overflow-scrolling:touch;
  padding:10px 4px 16px;
  display:flex;flex-direction:column;gap:12px;
}
.msg{display:flex;max-width:84%}
.msg .bubble{
  padding:12px 16px;border-radius:18px;
  font-size:.92rem;line-height:1.5;
  word-wrap:break-word;white-space:pre-wrap;letter-spacing:-.006em;
}
.msg.user{align-self:flex-end;flex-direction:row-reverse}
.msg.user .bubble{
  background:var(--grad);color:#fff;
  border-bottom-right-radius:6px;
  box-shadow:0 2px 12px rgba(255,77,0,.18);
}
.msg.assistant{align-self:flex-start}
.msg.assistant .bubble{
  background:var(--surface);border:1px solid var(--line);
  color:var(--ink);
  border-bottom-left-radius:6px;
  box-shadow:var(--shadow-sm);
}
.typing-bubble{color:var(--muted);font-style:italic}
.chat-input-bar{
  display:flex;gap:10px;align-items:flex-end;
  padding:12px 0 8px;
  border-top:1px solid var(--line);
  background:var(--bg);
  position:sticky;bottom:0;
}
.chat-input-bar textarea{
  flex:1;resize:none;
  min-height:46px;max-height:120px;
  padding:13px 16px;
  border-radius:var(--r);
  border:1.5px solid var(--line);
  background:var(--surface);color:var(--ink);
  font-size:.95rem;line-height:1.4;outline:none;
  transition:border-color .2s,box-shadow .2s;
  box-shadow:var(--shadow-sm);
}
.chat-input-bar textarea:focus{border-color:var(--orange);box-shadow:0 0 0 4px rgba(255,77,0,.08)}
.chat-input-bar .send-btn{
  width:46px;height:46px;flex:none;
  border-radius:50%;
  background:var(--grad);color:#fff;
  display:grid;place-items:center;
  font-size:1.1rem;cursor:pointer;
  transition:all .15s var(--ease);
  box-shadow:var(--shadow-glow);
}
.chat-input-bar .send-btn:hover{transform:translateY(-1px)}
.chat-input-bar .send-btn:active{transform:scale(.92)}

/* ===== EVENT CARDS ===== */
.event-card{
  display:flex;gap:16px;
  background:var(--surface);
  border:1px solid var(--line);
  border-radius:var(--r);
  padding:16px;margin-bottom:10px;
  box-shadow:var(--shadow-sm);
  transition:all .18s var(--ease);
}
.event-card:hover{box-shadow:var(--shadow);border-color:var(--line)}
.event-card .ev-date{
  display:flex;flex-direction:column;
  align-items:center;justify-content:center;
  background:var(--surface-2);
  border-radius:var(--r-sm);
  padding:10px 8px;min-width:62px;
}
.event-card .ev-date .ev-d{
  font-family:var(--font-display);font-weight:800;
  font-size:1.35rem;line-height:1;letter-spacing:-.03em;
}
.event-card .ev-date .ev-m{
  font-size:.6rem;text-transform:uppercase;
  letter-spacing:.06em;color:var(--muted);
  margin-top:3px;font-weight:700;
}
.event-card .ev-body{flex:1;min-width:0}
.event-card .ev-body .ev-title{font-size:.95rem;font-weight:700;margin-bottom:3px;letter-spacing:-.01em}
.event-card .ev-body .ev-desc{font-size:.82rem;color:var(--ink-2);margin:5px 0;line-height:1.5;font-weight:400}
.event-card .ev-body .ev-cite{font-size:.7rem;color:var(--muted);font-weight:500}

/* ===== CALENDAR ===== */
.cal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.cal-head .cal-title{
  font-family:var(--font-display);font-weight:700;font-size:1.05rem;letter-spacing:-.03em;
}
.cal-nav-btn{
  width:38px;height:38px;border-radius:10px;
  display:grid;place-items:center;
  font-size:1.1rem;font-weight:600;
  background:var(--surface);border:1px solid var(--line);
  color:var(--ink-2);cursor:pointer;
  transition:all .15s var(--ease);
  box-shadow:var(--shadow-sm);
}
.cal-nav-btn:hover{background:var(--surface-2);border-color:var(--ink-2)}
.cal-nav-btn:active{background:var(--surface-2);transform:scale(.95)}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:5px}
.cal-dow{
  text-align:center;font-size:.62rem;font-weight:700;
  color:var(--muted);text-transform:uppercase;
  letter-spacing:.05em;padding:6px 0;
}
.cal-day{
  position:relative;aspect-ratio:1;
  display:grid;place-items:center;
  border-radius:10px;
  font-size:.85rem;font-weight:600;
  color:var(--ink-2);
  background:var(--surface);
  border:1px solid var(--line);
  transition:all .15s;cursor:pointer;
}
.cal-day:hover{box-shadow:var(--shadow-sm)}
.cal-day.empty{background:transparent;border-color:transparent}
.cal-day.today{font-weight:800;color:var(--orange);border-color:var(--orange);box-shadow:0 0 0 1px var(--orange)}
.cal-day.trip-day{
  background:var(--grad);color:#fff;
  border-color:transparent;font-weight:700;
  box-shadow:0 2px 8px rgba(255,77,0,.2);
}
.cal-day.has-event::after{
  content:'';position:absolute;bottom:5px;left:50%;
  transform:translateX(-50%);
  width:5px;height:5px;border-radius:50%;background:var(--teal);
}
.cal-day.trip-day.has-event::after{background:#fff}

/* ===== RECOMMENDATION CARDS ===== */
.reco-card{
  display:flex;gap:16px;
  background:var(--surface);
  border:1px solid var(--line);
  border-radius:var(--r);
  padding:16px;margin-bottom:10px;
  box-shadow:var(--shadow-sm);
  transition:all .18s var(--ease);
}
.reco-card:hover{box-shadow:var(--shadow)}
.reco-card .reco-icon{
  width:44px;height:44px;border-radius:14px;
  display:grid;place-items:center;
  background:var(--grad);color:#fff;
  font-size:1.1rem;flex-shrink:0;
  box-shadow:0 2px 8px rgba(255,77,0,.15);
}
.reco-card .reco-body{flex:1;min-width:0}
.reco-card .reco-body .reco-title{font-size:.92rem;font-weight:700;letter-spacing:-.01em}
.reco-card .reco-body .reco-desc{font-size:.8rem;color:var(--muted);margin-top:3px;line-height:1.5}
.reco-card .reco-body .reco-dur{font-size:.7rem;font-weight:700;color:var(--teal);margin-top:6px}

/* ===== FLIGHT CARDS ===== */
.flight-card{
  background:var(--surface);
  border:1px solid var(--line);
  border-radius:var(--r);
  padding:18px;margin-bottom:10px;
  box-shadow:var(--shadow-sm);
  transition:all .18s var(--ease);
}
.flight-card:hover{box-shadow:var(--shadow);border-color:var(--line)}
.flight-card .fl-route{
  display:flex;align-items:center;gap:12px;
  font-family:var(--font-display);font-weight:700;font-size:1.05rem;letter-spacing:-.03em;
}
.flight-card .fl-route .fl-arrow{color:var(--orange)}
.flight-card .fl-meta{
  display:flex;justify-content:space-between;gap:10px;
  font-size:.8rem;color:var(--muted);margin-top:10px;
}
.flight-card .fl-meta .fl-num{font-weight:700;color:var(--ink-2)}
.flight-card .fl-times{
  display:flex;justify-content:space-between;align-items:baseline;
  gap:10px;margin-top:12px;
}
.flight-card .fl-times .fl-t{font-family:var(--font-display);font-weight:700;font-size:1.05rem;letter-spacing:-.02em}
.flight-card .fl-times .fl-dur{flex:1;text-align:center;font-size:.72rem;color:var(--muted);font-weight:500}
.flight-card .fl-footer{
  display:flex;align-items:center;justify-content:space-between;gap:10px;
  margin-top:12px;border-top:1px dashed var(--line);padding-top:12px;
}
.flight-card .fl-price{font-family:var(--font-display);font-weight:700;font-size:1.05rem;letter-spacing:-.02em}

/* ===== PLAN SECTION ===== */
.plan-section{margin-bottom:28px}
.plan-section .ps-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.plan-section .ps-head .ps-title{
  font-size:.78rem;font-weight:700;
  text-transform:uppercase;letter-spacing:.08em;
  color:var(--muted);
}

/* ===== USER SEARCH ===== */
.user-search-wrap{margin-bottom:18px}
.user-search-wrap .us-inp{
  width:100%;padding:14px 18px;
  font-size:.9rem;font-weight:500;
  border:1.5px solid var(--line);
  border-radius:var(--r);
  background:var(--surface);outline:none;
  transition:border-color .2s,box-shadow .2s;
  box-shadow:var(--shadow-sm);
}
.user-search-wrap .us-inp:focus{border-color:var(--orange);box-shadow:0 0 0 4px rgba(255,77,0,.08)}

/* ===== SHARED TRIP ===== */
.shared-trip{
  display:flex;gap:14px;align-items:center;
  background:var(--surface);
  border:1px solid var(--line);
  border-radius:var(--r);
  padding:14px 16px;margin-bottom:10px;
  box-shadow:var(--shadow-sm);cursor:pointer;
  transition:all .18s var(--ease);
}
.shared-trip:hover{box-shadow:var(--shadow);border-color:var(--ink-2)}
.shared-trip:active{border-color:var(--orange)}
.shared-trip .st-avatar{
  width:40px;height:40px;border-radius:50%;
  background:var(--grad);color:#fff;
  display:grid;place-items:center;
  font-family:var(--font-display);font-weight:800;font-size:.9rem;
  flex-shrink:0;box-shadow:0 2px 8px rgba(255,77,0,.15);
}
.shared-trip .st-info{flex:1;min-width:0}
.shared-trip .st-info .st-city{
  font-weight:700;font-size:.88rem;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:-.01em;
}
.shared-trip .st-info .st-meta{font-size:.72rem;color:var(--muted);margin-top:3px;font-weight:500}

/* ===== PLAN COLUMNS (desktop) ===== */
.plan-cols{display:grid;grid-template-columns:1fr;gap:24px}

/* ===== DESKTOP: FULL WIDTH + MULTI-COLUMN ===== */
@media(min-width:768px){
  .screen{padding:36px 36px 72px;max-width:var(--maxw)}
  .plan-cols{grid-template-columns:minmax(320px,1fr) minmax(360px,1.2fr);gap:32px;align-items:flex-start}
  .chat-wrap{height:calc(100vh - var(--tab-h) - var(--safe) - 160px)}
  .field-row{grid-template-columns:1fr 1fr}
  .style-grid{grid-template-columns:repeat(3,1fr)}
  .photo-grid{grid-template-columns:repeat(4,1fr)}
  .pack-stats{gap:16px}
  .brand-row{margin-bottom:32px}
  .trip-hero{padding:40px 36px}
  .trip-hero h1{font-size:clamp(1.8rem,5vw,2.6rem)}
}

@media(min-width:1024px){
  .screen{padding:48px 48px 96px;max-width:var(--maxw)}
  .tabbar{padding-top:11px}
  .tab{max-width:140px}
  .trip-hero{padding:48px 44px}
  .trip-hero h1{font-size:clamp(2rem,4vw,2.8rem)}
  .style-grid{grid-template-columns:repeat(4,1fr)}
  .photo-grid{grid-template-columns:repeat(5,1fr)}
  .plan-cols{grid-template-columns:minmax(360px,1fr) minmax(400px,1.3fr);gap:40px}
  .pack-stats{gap:20px}
  .pack-stat{padding:22px 14px}
  .pack-stat .ps-num{font-size:1.8rem}
  .sync-card{padding:32px}
  .modal{max-width:400px;padding:48px 36px}
  .loading-overlay .lo-box{max-width:360px}
  .ai-suggest-btn{font-size:.9rem;padding:18px}
  .chat-wrap{height:calc(100vh - var(--tab-h) - var(--safe) - 180px)}
  /* Pack tab: 2-column category grid on wide screens */
  #packList{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:flex-start}
  #packList .cat-body{max-height:none !important;overflow:visible}
  #packList .cat-section{margin-bottom:0}
  #packList .cat-section.open .cat-body{max-height:none}
  /* Trip tab: trips list in a grid */
  #tripsListContent{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}
  .trip-card{margin-bottom:0}
}

@media(min-width:1400px){
  .screen{padding:56px 64px 120px;max-width:var(--maxw)}
  .plan-cols{grid-template-columns:minmax(400px,1fr) minmax(440px,1.4fr);gap:48px}
  #packList{grid-template-columns:1fr 1fr 1fr}
  #tripsListContent{grid-template-columns:repeat(auto-fill,minmax(320px,1fr))}
  .style-grid{grid-template-columns:repeat(5,1fr)}
  .photo-grid{grid-template-columns:repeat(6,1fr)}
}

/* ===== MOBILE TWEAKS ===== */
@media(max-width:767px){
  .field-row{grid-template-columns:1fr 1fr;gap:12px}
  .style-grid{grid-template-columns:1fr 1fr}
  .photo-grid{grid-template-columns:repeat(3,1fr)}
  .w-day{flex:0 0 74px}
  .trip-hero{padding:28px 22px}
  .progress-card{padding:18px 20px}
  .cat-head{padding:14px 16px}
  .pack-row{padding:11px 14px;gap:10px;min-height:48px}
  .btn{padding:13px 22px;font-size:.84rem}
  .scan-btn{padding:14px 16px}
  .upload-zone{padding:32px 18px}
  .sync-card{padding:22px}
  .plan-cols{grid-template-columns:1fr}
}

@media(max-width:480px){
  .field-row{grid-template-columns:1fr}
  .style-grid{grid-template-columns:1fr 1fr}
  .photo-grid{grid-template-columns:repeat(3,1fr)}
  .w-day{flex:0 0 68px;padding:12px 10px}
  .tab{font-size:.58rem}
  .tab svg{width:20px;height:20px}
  .brand{font-size:1rem}
  .trip-hero{padding:24px 20px}
  .trip-hero h1{font-size:clamp(1.4rem,8vw,2rem)}
  .screen{padding:18px 14px 44px}
  .pack-stats{gap:10px}
  .pack-stat{padding:14px 8px}
}

@media(max-width:380px){
  .field-row{grid-template-columns:1fr}
  .style-grid{grid-template-columns:1fr}
  .photo-grid{grid-template-columns:repeat(2,1fr)}
  .w-day{flex:0 0 62px;padding:10px 8px}
}

/* ===== INPUT SIZING ===== */
.inp{font-size:max(.92rem,16px)}
.screen{padding-top:max(20px,env(safe-area-inset-top,20px))}

/* ===== REDUCED MOTION ===== */
@media(prefers-reduced-motion:reduce){
  *,*::before,*::after{
    animation-duration:.01ms!important;
    transition-duration:.01ms!important;
  }
}

/* ===== PREMIUM ANIMATIONS ===== */

/* (10) Page load — first-screen entrance */
@keyframes pageLoadIn{
  from{opacity:0;transform:translateY(18px) scale(.985)}
  to{opacity:1;transform:none}
}
.brand-row,.trip-hero,.field-group,.scan-btn,.btn-row,.trip-info,.section-label{
  animation:pageLoadIn .55s var(--ease-out) both;
}
.brand-row{animation-delay:.04s}
.trip-hero{animation-delay:.09s}
.trip-info{animation-delay:.07s}
.field-group{animation-delay:.14s}
.scan-btn{animation-delay:.19s}
.btn-row{animation-delay:.24s}

/* (1) Staggered fade-in-up for list items */
@keyframes staggerFadeUp{
  from{opacity:0;transform:translateY(16px)}
  to{opacity:1;transform:none}
}
.trip-card,.pack-row,.event-card,.reco-card,.flight-card,.w-day,.shared-trip{
  animation:staggerFadeUp .42s var(--ease-out) both;
}
.trip-card:nth-child(1){animation-delay:.04s}
.trip-card:nth-child(2){animation-delay:.08s}
.trip-card:nth-child(3){animation-delay:.12s}
.trip-card:nth-child(4){animation-delay:.16s}
.trip-card:nth-child(5){animation-delay:.20s}
.trip-card:nth-child(6){animation-delay:.24s}
.pack-row:nth-child(1){animation-delay:.03s}
.pack-row:nth-child(2){animation-delay:.06s}
.pack-row:nth-child(3){animation-delay:.09s}
.pack-row:nth-child(4){animation-delay:.12s}
.pack-row:nth-child(5){animation-delay:.15s}
.pack-row:nth-child(6){animation-delay:.18s}
.pack-row:nth-child(7){animation-delay:.21s}
.pack-row:nth-child(8){animation-delay:.24s}
.pack-row:nth-child(n+9){animation-delay:.27s}
.event-card:nth-child(1){animation-delay:.04s}
.event-card:nth-child(2){animation-delay:.08s}
.event-card:nth-child(3){animation-delay:.12s}
.event-card:nth-child(4){animation-delay:.16s}
.event-card:nth-child(5){animation-delay:.20s}
.event-card:nth-child(n+6){animation-delay:.24s}
.reco-card:nth-child(1){animation-delay:.05s}
.reco-card:nth-child(2){animation-delay:.10s}
.reco-card:nth-child(3){animation-delay:.15s}
.reco-card:nth-child(4){animation-delay:.20s}
.reco-card:nth-child(5){animation-delay:.25s}
.flight-card:nth-child(1){animation-delay:.04s}
.flight-card:nth-child(2){animation-delay:.08s}
.flight-card:nth-child(3){animation-delay:.12s}
.flight-card:nth-child(4){animation-delay:.16s}
.flight-card:nth-child(5){animation-delay:.20s}
.w-day:nth-child(1){animation-delay:.03s}
.w-day:nth-child(2){animation-delay:.06s}
.w-day:nth-child(3){animation-delay:.09s}
.w-day:nth-child(4){animation-delay:.12s}
.w-day:nth-child(5){animation-delay:.15s}
.w-day:nth-child(6){animation-delay:.18s}
.w-day:nth-child(7){animation-delay:.21s}
.shared-trip:nth-child(1){animation-delay:.05s}
.shared-trip:nth-child(2){animation-delay:.10s}
.shared-trip:nth-child(3){animation-delay:.15s}
.shared-trip:nth-child(n+4){animation-delay:.20s}

/* (2) Card hover lift with shadow growth */
.trip-card,.reco-card,.flight-card,.event-card{
  transition:transform .3s var(--ease),box-shadow .3s var(--ease),border-color .3s var(--ease);
}
.trip-card:hover{
  transform:translateY(-5px);
  box-shadow:0 14px 40px rgba(23,23,28,.10),0 4px 14px rgba(255,77,0,.10);
  border-color:var(--orange);
}
.reco-card:hover{
  transform:translateY(-4px);
  box-shadow:0 12px 36px rgba(23,23,28,.09),0 3px 12px rgba(255,77,0,.08);
  border-color:var(--line);
}
.flight-card:hover{
  transform:translateY(-4px);
  box-shadow:0 12px 36px rgba(23,23,28,.09),0 3px 12px rgba(255,77,0,.07);
}
.event-card:hover{
  transform:translateY(-3px);
  box-shadow:0 10px 32px rgba(23,23,28,.08),0 2px 8px rgba(255,77,0,.06);
  border-color:var(--line);
}

/* (3) Smooth scale-in for modals & loading overlays */
@keyframes overlayFadeIn{
  from{opacity:0}
  to{opacity:1}
}
@keyframes overlayScaleIn{
  from{opacity:0;transform:scale(.88) translateY(24px)}
  to{opacity:1;transform:scale(1) translateY(0)}
}
.modal-bg.show{
  animation:overlayFadeIn .28s var(--ease-out) both;
}
.modal-bg.show .modal{
  animation:overlayScaleIn .42s var(--ease-out) both;
}
.loading-overlay.show{
  animation:overlayFadeIn .28s var(--ease-out) both;
}
.loading-overlay.show .lo-box{
  animation:overlayScaleIn .42s var(--ease-out) both;
}

/* (4) Pulse animation for active tab indicator */
@keyframes tabPulse{
  0%,100%{filter:drop-shadow(0 0 0 rgba(255,77,0,0))}
  50%{filter:drop-shadow(0 0 7px rgba(255,77,0,.4))}
}
.tab.active{
  animation:tabPulse 2.6s var(--ease) infinite;
}

/* (5) Shimmer loading effect */
@keyframes shimmerSweep{
  0%{background-position:-200% 0}
  100%{background-position:200% 0}
}
.empty-state{
  position:relative;
  overflow:hidden;
}
.empty-state::after{
  content:'';
  position:absolute;
  inset:0;
  background:linear-gradient(90deg,transparent 0%,rgba(255,77,0,.05) 50%,transparent 100%);
  background-size:200% 100%;
  animation:shimmerSweep 2.2s linear infinite;
  pointer-events:none;
}
.shimmer-skel{
  background:linear-gradient(90deg,var(--surface-2) 25%,var(--line-soft) 50%,var(--surface-2) 75%);
  background-size:200% 100%;
  animation:shimmerSweep 1.5s linear infinite;
  border-radius:var(--r-sm);
}

/* (6) Chat message slide-in (user from right, assistant from left) */
@keyframes msgSlideRight{
  from{opacity:0;transform:translateX(28px)}
  to{opacity:1;transform:translateX(0)}
}
@keyframes msgSlideLeft{
  from{opacity:0;transform:translateX(-28px)}
  to{opacity:1;transform:translateX(0)}
}
.msg.user{
  animation:msgSlideRight .38s var(--ease-out) both;
}
.msg.assistant{
  animation:msgSlideLeft .38s var(--ease-out) both;
}
.msg.user .bubble,.msg.assistant .bubble{
  transition:box-shadow .2s var(--ease);
}

/* (7) Calendar cell hover effect */
.cal-day{
  transition:transform .2s var(--ease),box-shadow .2s var(--ease),background .2s var(--ease),border-color .2s var(--ease),color .2s var(--ease);
}
.cal-day:not(.empty):not(.trip-day):hover{
  transform:translateY(-2px) scale(1.06);
  box-shadow:0 5px 18px rgba(255,77,0,.14);
  border-color:var(--orange);
  color:var(--orange);
}
.cal-day:not(.empty):active{
  transform:scale(.93);
}

/* (8) Button press scale effect */
@keyframes btnPress{
  0%{transform:scale(1)}
  50%{transform:scale(.92)}
  100%{transform:scale(1)}
}
.btn{
  transition:transform .16s var(--ease),box-shadow .25s var(--ease),background .25s var(--ease),border-color .25s var(--ease),color .25s var(--ease);
}
.btn:active{
  animation:btnPress .28s var(--ease);
}
.btn-fill:active,.btn-dark:active{
  transform:scale(.94);
  box-shadow:0 1px 4px rgba(255,77,0,.2);
}
.btn-ghost:active{
  transform:scale(.94);
}
.scan-btn{
  transition:transform .22s var(--ease),box-shadow .22s var(--ease),border-color .22s var(--ease);
}
.scan-btn:active{
  transform:scale(.96);
}

/* (9) Smooth color transitions on all interactive elements */
.tab,.tab svg,.inp,.lbl,.edit-link,.qty-btn,.del-btn,.cat-head,.cat-head .chevron,.cat-head .pill,.cal-nav-btn,.cal-day,.pack-row .check,.pack-row .qty-btn,.pack-row .del-btn{
  transition-property:color,background-color,border-color,box-shadow,transform,opacity,filter;
  transition-duration:.2s;
  transition-timing-function:var(--ease);
}

/* Enhanced screen entrance on tab switch */
@keyframes screenEntrance{
  from{opacity:0;transform:translateY(14px) scale(.992)}
  to{opacity:1;transform:none}
}
.screen.active{
  animation:screenEntrance .38s var(--ease-out) both;
}

/* Weather tile hover lift */
.w-day{
  transition:transform .22s var(--ease),box-shadow .22s var(--ease);
}
.w-day:hover{
  transform:translateY(-3px);
  box-shadow:0 6px 20px rgba(23,23,28,.08),0 2px 8px rgba(255,77,0,.06);
}

/* Cat-head interactive polish */
.cat-head{
  transition:transform .22s var(--ease),border-color .22s var(--ease),background .22s var(--ease),box-shadow .22s var(--ease);
}
.cat-head:active{
  transform:scale(.99);
}

/* Shared-trip hover lift */
.shared-trip{
  transition:transform .26s var(--ease),box-shadow .26s var(--ease),border-color .26s var(--ease);
}
.shared-trip:hover{
  transform:translateY(-3px);
  box-shadow:0 8px 28px rgba(23,23,28,.08),0 2px 8px rgba(255,77,0,.06);
}

/* ===== SHARED USERS BAR ===== */
.shared-users{
  display:flex;align-items:center;flex-wrap:wrap;gap:8px;
  padding:14px 18px;
  background:var(--surface);
  border:1px solid var(--line);
  border-radius:var(--r-sm);
  box-shadow:var(--shadow-sm);
  margin-bottom:16px;
}
.shared-users .shared-label{
  font-size:.64rem;font-weight:700;
  text-transform:uppercase;letter-spacing:.06em;
  color:var(--muted);margin-right:4px;
}
.shared-user-chip{
  display:inline-flex;align-items:center;gap:8px;
  padding:5px 12px 5px 5px;
  background:var(--surface-2);
  border:1px solid var(--line);
  border-radius:100px;
  font-size:.78rem;font-weight:600;color:var(--ink-2);
  letter-spacing:-.01em;
  transition:all .18s var(--ease);
}
.shared-user-chip:hover{border-color:var(--orange);box-shadow:0 2px 8px rgba(255,77,0,.08)}
.shared-user-chip .chip-avatar{
  width:22px;height:22px;border-radius:50%;
  background:var(--grad);
  color:#fff;font-size:.6rem;font-weight:800;
  display:grid;place-items:center;
  flex-shrink:0;letter-spacing:0;
}
.shared-user-chip.is-owner .chip-avatar{background:var(--ink)}
.shared-user-chip .chip-name{
  max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
.shared-user-chip .chip-remove{
  width:16px;height:16px;color:var(--muted);
  margin-left:2px;cursor:pointer;flex-shrink:0;
  display:grid;place-items:center;
  transition:color .15s;
}
.shared-user-chip .chip-remove:hover{color:var(--red)}
.shared-user-chip .chip-remove svg{
  width:10px;height:10px;fill:none;stroke:currentColor;
  stroke-width:2.5;stroke-linecap:round;
}

/* ===== PACK USER COLUMNS ===== */
.pack-user-cols{
  display:flex;gap:1px;
  background:var(--line-soft);
  border-radius:var(--r-xs);
  overflow:hidden;
  margin-left:8px;flex-shrink:0;
}
.pack-user-col{
  display:flex;flex-direction:column;align-items:center;gap:2px;
  padding:6px 10px;
  background:var(--surface);
  min-width:50px;
  cursor:pointer;
  transition:background .18s var(--ease);
}
.pack-user-col:hover{background:var(--surface-2)}
.pack-user-col .uc-name{
  font-size:.56rem;font-weight:700;
  text-transform:uppercase;letter-spacing:.04em;
  color:var(--muted);
  max-width:56px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
.pack-user-col .uc-count{
  font-size:.8rem;font-weight:700;color:var(--ink);
  font-variant-numeric:tabular-nums;line-height:1.1;
}
.pack-user-col.packed .uc-count{color:var(--teal)}
.pack-user-col.all-packed{background:rgba(34,197,94,.07)}
.pack-user-col.all-packed .uc-count{color:var(--green)}
.pack-user-col .uc-bar{
  height:2px;width:100%;margin-top:3px;
  background:var(--line-soft);border-radius:100px;overflow:hidden;
}
.pack-user-col .uc-bar .uc-fill{
  height:100%;width:0;background:var(--grad);
  border-radius:100px;transition:width .3s var(--ease);
}
.pack-user-col.packed .uc-bar .uc-fill{width:100%}

/* ===== SHARE BUTTON ===== */
.share-btn{
  display:inline-flex;align-items:center;gap:8px;
  padding:9px 16px;
  background:var(--grad);
  color:#fff;
  border-radius:100px;
  font-size:.78rem;font-weight:700;letter-spacing:-.01em;
  box-shadow:var(--shadow-glow);
  transition:transform .18s var(--ease),box-shadow .18s var(--ease);
  -webkit-user-select:none;user-select:none;
}
.share-btn:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(255,77,0,.22)}
.share-btn:active{transform:scale(.96)}
.share-btn svg{
  width:16px;height:16px;fill:none;stroke:currentColor;
  stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0;
}
.share-btn.ghost{
  background:var(--surface);color:var(--orange);
  border:1px solid var(--line);box-shadow:var(--shadow-sm);
}
.share-btn.ghost:hover{
  border-color:var(--orange);background:rgba(255,77,0,.04);
  box-shadow:0 4px 14px rgba(255,77,0,.1);
}

/* ===== SHARE DIALOG ===== */
.share-dialog{
  position:fixed;inset:0;z-index:200;
  display:none;align-items:center;justify-content:center;
  padding:24px;
  background:rgba(23,23,28,.45);
  backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
}
.share-dialog.open{
  display:flex;
  animation:pageLoadIn .25s var(--ease-out) both;
}
.share-dialog .share-card{
  width:100%;max-width:440px;
  background:var(--surface);
  border-radius:var(--r-lg);
  box-shadow:var(--shadow-lg);
  padding:28px 26px 24px;
  display:flex;flex-direction:column;gap:16px;
}
.share-dialog .share-title{
  font-family:var(--font-display);font-weight:700;font-size:1.05rem;
  letter-spacing:-.02em;color:var(--ink);
}
.share-dialog .share-sub{
  font-size:.8rem;color:var(--muted);margin-top:-8px;line-height:1.45;
}
.share-dialog .share-field{
  display:flex;align-items:center;gap:10px;
  background:var(--surface-2);
  border:1.5px solid var(--line);
  border-radius:var(--r-sm);
  padding:4px 4px 4px 14px;
  transition:border-color .18s var(--ease),box-shadow .18s var(--ease);
}
.share-dialog .share-field:focus-within{
  border-color:var(--orange);box-shadow:0 0 0 3px rgba(255,77,0,.1);
}
.share-dialog .share-field svg{
  width:18px;height:18px;color:var(--muted);flex-shrink:0;
  fill:none;stroke:currentColor;stroke-width:2;
  stroke-linecap:round;stroke-linejoin:round;
}
.share-dialog .share-field .share-input{
  flex:1;border:none;background:transparent;outline:none;
  font-size:.92rem;font-weight:500;padding:12px 0;min-width:0;
  color:var(--ink);
}
.share-dialog .share-field .share-input::placeholder{color:var(--muted)}
.share-dialog .share-field .share-go{
  padding:8px 18px;background:var(--grad);color:#fff;
  border-radius:100px;font-size:.82rem;font-weight:700;
  flex-shrink:0;transition:transform .15s var(--ease);
}
.share-dialog .share-field .share-go:active{transform:scale(.94)}
.share-dialog .share-actions{display:flex;gap:10px;margin-top:4px}
.share-dialog .share-actions .btn-ghost{flex:1;justify-content:center}
.share-dialog .share-roster{
  display:flex;flex-wrap:wrap;gap:8px;
  padding-top:12px;border-top:1px solid var(--line-soft);margin-top:4px;
}
.share-dialog .share-roster .shared-user-chip{font-size:.74rem}

/* ===== FLIGHT ACTION ROW (search + refresh) ===== */
.flight-actions{display:flex;gap:10px;margin-bottom:12px}
.flight-actions .btn-ghost.btn-block{flex:1}
.fl-refresh-btn{
  flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;gap:7px;
  font-weight:700;font-size:.72rem;letter-spacing:-.01em;
  padding:9px 16px;border-radius:100px;
  background:transparent;border:1.5px solid var(--line);color:var(--muted);
  transition:all .18s var(--ease);
}
.fl-refresh-btn svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;transition:transform .5s var(--ease)}
.fl-refresh-btn:hover{border-color:var(--ink-2);color:var(--ink-2);background:var(--surface-2)}
.fl-refresh-btn:active{transform:scale(.96)}
.fl-refresh-btn.spinning svg{transform:rotate(360deg)}

/* ===== FLIGHT STATUS BADGE ===== */
.flight-card .fl-status-badge{
  display:inline-flex;align-items:center;gap:5px;
  font-size:.66rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;
  padding:4px 10px;border-radius:100px;line-height:1;margin-left:auto;flex-shrink:0;
}
.fl-status-badge .fl-status-dot{width:6px;height:6px;border-radius:50%;background:currentColor;flex-shrink:0}
.fl-status-badge.st-on-time{background:rgba(34,197,94,.12);color:var(--green)}
.fl-status-badge.st-delayed{background:rgba(255,77,0,.12);color:var(--orange)}
.fl-status-badge.st-cancelled{background:rgba(239,68,68,.12);color:var(--red)}
.fl-status-badge.st-scheduled{background:var(--surface-2);color:var(--muted)}
.fl-status-badge.st-board{background:rgba(13,148,136,.12);color:var(--teal)}

/* ===== LOAD MORE ===== */
.fl-load-more{
  display:flex;width:100%;align-items:center;justify-content:center;gap:8px;
  font-weight:700;font-size:.8rem;letter-spacing:-.01em;
  padding:14px 22px;margin-top:4px;margin-bottom:14px;
  border-radius:var(--r);border:1.5px dashed var(--line);
  background:transparent;color:var(--ink-2);
  transition:all .18s var(--ease);
}
.fl-load-more:hover{border-color:var(--orange);color:var(--orange);border-style:solid;background:rgba(255,77,0,.03)}
.fl-load-more:active{transform:scale(.98)}

/* ===== FLIGHT TRACKING MODAL ===== */
.track-modal{display:none;position:fixed;inset:0;z-index:200;background:rgba(23,23,28,.45);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);align-items:center;justify-content:center;padding:20px}
.track-modal.show{display:flex;animation:overlayFadeIn .22s var(--ease-out) both}
.track-modal-card{background:var(--surface);border-radius:var(--r-lg);box-shadow:var(--shadow-lg);border:1px solid var(--line);max-width:420px;width:100%;padding:24px;max-height:80vh;overflow-y:auto}
.track-modal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}
.track-close{padding:4px;color:var(--muted);border-radius:var(--r-xs);transition:color .2s var(--ease);display:inline-flex}
.track-close:hover{color:var(--ink)}
.track-panel .track-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:18px}
.track-panel .track-num{font-family:var(--font-display);font-weight:700;font-size:1.1rem;letter-spacing:-.02em}
.track-panel .track-status{font-size:.8rem;font-weight:600;margin-top:5px;display:flex;align-items:center;gap:5px}
.track-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.track-cell{background:var(--surface-2);border-radius:var(--r-sm);padding:14px}
.track-cell .tc-lbl{font-size:.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:6px}
.track-cell .tc-val{font-family:var(--font-display);font-weight:700;font-size:1rem}
.track-cell .tc-sub{font-size:.72rem;color:var(--muted);margin-top:4px}
.track-raw{margin-top:16px;font-size:.78rem;line-height:1.5;color:var(--ink-2);white-space:pre-wrap;background:var(--surface-2);border-radius:var(--r-sm);padding:12px}
.flight-card .track-btn{padding:5px 12px;font-size:.72rem;font-weight:600;display:inline-flex;align-items:center;gap:5px;border:1px solid var(--line)}
.flight-card .track-btn:hover{border-color:var(--orange);color:var(--orange)}
</style>
</head>
<body>
<nav class="tabbar">
  <button class="tab active" data-screen="trip"><svg viewBox="0 0 24 24"><path d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10"/></svg>Trip</button>
  <button class="tab" data-screen="pack"><svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>Pack</button>
  <button class="tab" data-screen="plan"><svg viewBox="0 0 24 24"><path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"/></svg>Plan</button>
  <button class="tab" data-screen="chat"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>Chat</button>
  <button class="tab" data-screen="sync"><svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 11-3-6.7M21 4v5h-5"/></svg>Sync</button>
</nav>

<div class="screen active" id="screen-trip">
  <div class="brand-row"><div class="brand"><span class="a">agnamo</span><span class="dot">.</span></div><span class="section-label" style="color:var(--orange)">trip</span></div>
  <div id="tripSetup">
    <div class="trip-hero"><div class="eyebrow">Where to?</div><h1>Plan the<br>pack, not<br>the trip.</h1><p class="city">Search a city or airport, or scan a flight screenshot.</p></div>
    <div class="field-group">
      <div><label class="lbl">Destination</label><input id="destInput" class="inp" type="text" placeholder="City or airport code — SEA, DFW, Tokyo…" autocomplete="off" autocapitalize="words"><div id="destResults" class="dest-results"></div></div>
      <div class="field-row"><div><label class="lbl">Departure</label><input id="departDate" class="inp" type="date"></div><div><label class="lbl">Return</label><input id="returnDate" class="inp" type="date"></div></div>
      <div class="field-row"><div><label class="lbl">Airline</label><input id="airline" class="inp" type="text" placeholder="JAL, Delta…" autocapitalize="characters"></div><div><label class="lbl">Flight #</label><input id="flightNum" class="inp" type="text" placeholder="JL 005" autocapitalize="characters"></div></div>
      <div class="field-row"><div><label class="lbl">Departure Time</label><input id="flightTime" class="inp" type="text" placeholder="14:30"></div><div><label class="lbl">Booking Ref</label><input id="bookingRef" class="inp" type="text" placeholder="ABC123" autocapitalize="characters"></div></div>
    </div>
    <button class="scan-btn" onclick="document.getElementById('scanFile').click()"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" stroke-width="2" stroke-linecap="round"><path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M7 9h10v6H7z"/></svg><div><div class="scan-text">Scan Flight Screenshot</div><div class="scan-sub">Upload a booking screenshot — we'll parse it</div></div></button>
    <input id="scanFile" type="file" accept="image/*" style="display:none" onchange="handleScanScreenshot(event)">
    <div class="btn-row"><button class="btn btn-fill btn-block" onclick="saveTrip()">Set Trip →</button></div>
  </div>
  <div id="tripSummary" class="hidden">
    <div class="trip-info"><div class="row"><div><div class="dest-name" id="tsDest">—</div><div class="dates" id="tsDates"></div></div><a class="edit-link" onclick="editTrip()">Edit ↑</a></div><div class="flight" id="tsFlight"></div><div id="tsSource"></div></div>
    <div class="section-label" style="margin-bottom:14px">Weather at destination</div>
    <div id="weatherBlock"></div>
    <div class="section-label" style="margin:20px 0 10px">Flight search</div>
    <div class="field-row" style="margin-bottom:10px"><input id="fromInput" class="inp" type="text" placeholder="From (SEA)" autocapitalize="characters"><input id="toInput" class="inp" type="text" placeholder="To (DFW)" autocapitalize="characters"></div>
    <div class="btn-row" style="margin-bottom:12px"><button class="btn btn-ghost" style="flex:1" onclick="searchFlights()">Search flights →</button><button class="btn btn-ghost" id="refreshFlightsBtn" onclick="refreshFlights()" style="display:none;padding:14px 16px" title="Refresh flights"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 11-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg></button></div>
    <div id="flightResults"></div>
    <button class="btn btn-ghost btn-block fl-load-more" id="loadMoreFlightsBtn" onclick="loadMoreFlights()" style="display:none;margin-bottom:12px">Load more flights</button>
    <div id="trackModal" class="track-modal" onclick="if(event.target===this)closeTrackModal()"><div class="track-modal-card"><div class="track-modal-head"><span class="section-label" style="color:var(--orange)">Flight tracking</span><button class="track-close" onclick="closeTrackModal()"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button></div><div id="trackModalBody"></div></div></div>
    <div class="btn-row"><button class="btn btn-dark btn-block" onclick="goScreen('plan')">Plan itinerary →</button></div>
  </div>
  <div id="tripsList" class="trips-list hidden"><div class="list-label">My Trips</div><div id="tripsListContent"></div></div>
</div>

<div class="screen" id="screen-pack">
  <div class="brand-row"><div class="brand"><span class="a">agnamo</span><span class="dot">.</span></div><span class="section-label" style="color:var(--orange)">pack list</span></div>
  <div class="progress-card"><div class="p-top"><span class="p-title" id="pTitle">0 of 0 packed</span><span class="p-pct" id="pPct">0%</span></div><div class="p-track"><div class="p-fill" id="pFill" style="width:0%"></div></div></div>
  <div class="pack-stats"><div class="pack-stat"><div class="ps-num" id="psTotal">0</div><div class="ps-lbl">Total</div></div><div class="pack-stat"><div class="ps-num" id="psPacked" style="color:var(--teal)">0</div><div class="ps-lbl">Packed</div></div><div class="pack-stat"><div class="ps-num" id="psLeft" style="color:var(--orange)">0</div><div class="ps-lbl">Left</div></div></div>
  <div class="pack-search"><input class="ps-inp" id="packSearch" type="text" placeholder="Search items…" oninput="filterPack()"></div>
  <div class="template-chips" id="templateChips"></div>
  <button class="ai-suggest-btn" id="aiSuggestBtn" onclick="aiSuggest()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.7l-1.9-5.8L4.5 10l5.6-1.4L12 3z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z"/></svg> AI Suggest — smart packing for your trip</button>
  <div id="packList"></div>
</div>

<div class="screen" id="screen-plan">
  <div class="brand-row"><div class="brand"><span class="a">agnamo</span><span class="dot">.</span></div><span class="section-label" style="color:var(--teal)">plan</span></div>
  <div class="plan-cols">
    <div class="plan-section">
      <div class="ps-head"><span class="ps-title">Calendar</span></div>
      <div id="calendarGrid"></div>
    </div>
    <div>
      <div class="plan-section">
        <div class="ps-head"><span class="ps-title">Local events</span><button class="btn btn-ghost" style="padding:6px 14px;font-size:.72rem" onclick="fetchEventsForTrip()">Find events</button></div>
        <div id="eventsList"><div class="empty-state">No events yet. Tap "Find events" to discover what's happening.</div></div>
      </div>
      <div class="plan-section">
        <div class="ps-head"><span class="ps-title">Recommendations</span><button class="btn btn-ghost" style="padding:6px 14px;font-size:.72rem" onclick="fetchRecsForTrip()">Get recs</button></div>
        <div style="margin-bottom:14px"><button class="btn btn-dark btn-block" onclick="runAgentsManual()" style="font-size:.82rem;padding:12px">Run 3 Agents — Guide + Research + Planning</button></div>
        <div id="recsList"><div class="empty-state">No recommendations yet. Tap "Get recs" for activity ideas.</div></div>
      </div>
    </div>
  </div>
</div>

<div class="screen" id="screen-chat">
  <div class="brand-row"><div class="brand"><span class="a">agnamo</span><span class="dot">.</span></div><span class="section-label" style="color:var(--pink)">chat</span></div>
  <div class="chat-wrap">
    <div class="chat-msgs" id="chatMessages"><div class="empty-state" id="chatEmpty">Ask me anything about your trip — packing, weather, events, restaurants, itinerary…</div></div>
    <div class="chat-input-bar">
      <textarea id="chatInput" placeholder="Ask about your trip…" rows="1" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendChat()}"></textarea>
      <button class="send-btn" aria-label="Send message" onclick="sendChat()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l16-7-7 16-2-7-7-2z"/></svg></button>
    </div>
  </div>
</div>

<div class="screen" id="screen-closet">
  <div class="brand-row"><div class="brand"><span class="a">agnamo</span><span class="dot">.</span></div><span class="section-label" style="color:var(--teal)">closet</span></div>
  <div class="upload-zone" id="closetUpload" onclick="document.getElementById('closetFile').click()"><div class="uz-icon"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg></div><div class="uz-text">Upload closet photos</div><div class="uz-sub">Tap or drop — stays on your device</div></div>
  <input id="closetFile" type="file" accept="image/*" multiple style="display:none" onchange="handleClosetUpload(event)">
  <div id="closetGrid" class="photo-grid"></div>
</div>

<div class="screen" id="screen-style">
  <div class="brand-row"><div class="brand"><span class="a">agnamo</span><span class="dot">.</span></div><span class="section-label" style="color:var(--pink)">style</span></div>
  <div class="upload-zone" id="styleUpload" onclick="document.getElementById('styleFile').click()"><div class="uz-icon"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg></div><div class="uz-text">Upload outfit inspiration</div><div class="uz-sub">Tag by vibe, add notes</div></div>
  <input id="styleFile" type="file" accept="image/*" multiple style="display:none" onchange="handleStyleUpload(event)">
  <div class="style-tags" id="styleTags"></div>
  <div id="styleGrid" class="style-grid"></div>
</div>

<div class="screen" id="screen-sync">
  <div class="brand-row"><div class="brand"><span class="a">agnamo</span><span class="dot">.</span></div><span class="section-label" style="color:var(--teal)">sync</span></div>
  <div class="sync-card">
    <div id="userBadge" style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--surface-2);border-radius:var(--r-sm);margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:8px"><span style="width:8px;height:8px;border-radius:50%;background:var(--teal)"></span><span style="font-size:.82rem;font-weight:600" id="syncUserName">—</span></div>
      <button class="btn btn-fill" style="padding:8px 18px;font-size:.76rem;font-weight:700" onclick="logoutUser()">Log out</button>
    </div>
    <div class="field-group" style="margin-top:0">
      <div><label class="lbl">Supabase URL</label><input id="sbUrl" class="inp" type="text" placeholder="https://xxxxx.supabase.co" autocapitalize="none" spellcheck="false"></div>
      <div><label class="lbl">Anon Key</label><input id="sbKey" class="inp" type="password" placeholder="eyJhbGci…" autocapitalize="none" spellcheck="false"></div>
    </div>
    <div class="btn-row"><button class="btn btn-fill btn-block" onclick="syncConnect()">Connect & Sync</button></div>
    <div id="syncStatus" class="sync-status disconnected"><div class="dot"></div><span id="syncStatusText">Not connected</span></div>
    <div class="sync-trips-count" id="syncTripsCount"></div>
  </div>
  <div style="font-size:.78rem;color:var(--muted);padding:0 4px;line-height:1.6;margin-bottom:20px">
    <p>Trips sync to Supabase — shared across all users (Vrinda, Gabe, Lux). Photos stay on your device.</p>
  </div>
  <div class="sync-card">
    <div class="ps-head" style="margin-bottom:12px"><span class="ps-title">Share this trip</span></div>
    <div class="field-group" style="margin-top:0;margin-bottom:12px"><div><label class="lbl">Share with username</label><input id="shareUserInput" class="inp" type="text" placeholder="Vrinda, Gabe, Lux..." autocapitalize="words"></div></div>
    <button class="btn btn-fill btn-block" style="margin-bottom:8px" onclick="shareTrip()">Share trip</button>
    <div id="shareTripStatus" style="font-size:.76rem;color:var(--muted);margin-bottom:8px"></div>
    <div id="sharedWithList" style="font-size:.8rem;color:var(--ink-2)"></div>
  </div>
  <div class="sync-card">
    <div class="ps-head" style="margin-bottom:12px"><span class="ps-title">Shared trips</span></div>
    <div class="user-search-wrap"><input id="userSearchInput" class="inp us-inp" type="text" placeholder="Search by username (Vrinda, Gabe…)" onkeydown="if(event.key==='Enter')searchUserTrips()"></div>
    <button class="btn btn-ghost btn-block" style="margin-bottom:12px" onclick="searchUserTrips()">Search trips →</button>
    <div id="userTripsList"></div>
  </div>
</div>

<div class="toast" id="toast"></div>
<div class="modal-bg" id="modalBg"><div class="modal"><div class="m-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5L21 14z"/></svg></div><h2>Packed.</h2><p>You're ready to move. Safe travels.</p><button class="btn btn-fill btn-block" onclick="document.getElementById('modalBg').classList.remove('show')">Done</button></div></div>
<div class="loading-overlay" id="loadingOverlay"><div class="lo-box"><div class="spinner"></div><div class="lo-text" id="loText">Loading…</div><div class="lo-sub" id="loSub"></div></div></div>

<script>
const AUTH_USERS={};
const nativeTripFetch=window.fetch.bind(window);
window.fetch=(input,init={})=>{const target=new URL(typeof input==='string'?input:input.url,location.href);if(target.origin===location.origin&&target.pathname.startsWith('/api/')){const headers=new Headers(init.headers||(input instanceof Request?input.headers:undefined));const token=sessionStorage.getItem('tripToolSession');if(token)headers.set('Authorization','Bearer '+token);return nativeTripFetch(input,{...init,headers})}return nativeTripFetch(input,init)};const AUTH_KEY='agnamoTripAuth';const AUTH_USER_KEY='agnamoTripUser';
function checkAuth(){return !!sessionStorage.getItem('tripToolSession')&&Number(sessionStorage.getItem('tripToolExpires'))>Date.now()}
function currentUser(){return localStorage.getItem(AUTH_USER_KEY)||null}
function showAuthGate(){
  const g=document.createElement('div');g.className='auth-gate';g.id='authGate';
  g.innerHTML='<div class="auth-card">'
    +'<div class="ac-brand"><span class="a">agnamo</span><span class="dot">.</span></div>'
    +'<div class="ac-tagline">trip planner</div>'
    +'<h2>Welcome back</h2>'
    +'<p class="ac-sub">Sign in to plan your next adventure</p>'
    +'<div class="ac-field"><label class="ac-label" for="authUser">Username</label><input class="ac-inp" type="text" id="authUser" placeholder="Your name" maxlength="20" autocomplete="off"></div>'
    +'<div class="ac-field"><label class="ac-label" for="authInp">Access code</label><input class="ac-inp" type="password" id="authInp" placeholder="Enter access code" maxlength="12" autocomplete="off"></div>'
    +'<div class="ac-err" id="authErr">Wrong name or code — try again</div>'
    +'<button class="ac-btn" onclick="tryAuth()">Log in →</button>'
    +'<div class="ac-hint">Valid users · Vrinda · Gabe · Lux · Kian</div>'
    +'</div>';
  document.body.appendChild(g);
  const u=document.getElementById('authUser');u.focus();
  u.addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('authInp').focus()});
  document.getElementById('authInp').addEventListener('keydown',e=>{if(e.key==='Enter')tryAuth()});
}
async function tryAuth(){
  const raw=document.getElementById('authUser').value.trim();
  const code=document.getElementById('authInp').value.trim();
  const name=raw.charAt(0).toUpperCase()+raw.slice(1).toLowerCase();
  try{const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user:name,password:code})});const d=await r.json();if(d.valid){if(d.token){sessionStorage.setItem('tripToolSession',d.token);sessionStorage.setItem('tripToolExpires',String(Date.now()+3600000))}localStorage.setItem(AUTH_USER_KEY,name);document.getElementById('authGate').remove();initApp()}else{document.getElementById('authErr').classList.add('show');document.getElementById('authInp').value='';document.getElementById('authInp').focus()}}catch{document.getElementById('authErr').classList.add('show');document.getElementById('authInp').value='';document.getElementById('authInp').focus()}
}
function logoutUser(){sessionStorage.removeItem('tripToolSession');sessionStorage.removeItem('tripToolExpires');localStorage.removeItem(AUTH_KEY);localStorage.removeItem(AUTH_USER_KEY);location.reload()}

const STORE='agnamoTripPack_v4';
const SB_URL='https://ioogwysicqqiknjzczhe.supabase.co';const SB_KEY='';
let S=load();let currentDest=null,destResults=[],destTimer=null;
function load(){try{const s=JSON.parse(localStorage.getItem(STORE));if(s&&s.trips)return s}catch{}return{config:{url:SB_URL,key:SB_KEY},trips:[],activeId:null,localChecklist:{},localCloset:[],localStyle:[]}}
function save(){localStorage.setItem(STORE,JSON.stringify(S))}
function activeTrip(){return S.trips.find(t=>t.id===S.activeId)||null}
function activeItems(){const t=activeTrip();if(t){if(!t.items)t.items={};return t.items}if(!S.localChecklist)S.localChecklist={};return S.localChecklist}
function activeCloset(){const t=activeTrip();if(t)return t.closet||(t.closet=[]);if(!S.localCloset)S.localCloset=[];return S.localCloset}
function activeStyle(){const t=activeTrip();if(t)return t.style||(t.style=[]);if(!S.localStyle)S.localStyle=[];return S.localStyle}
function uuid(){return crypto.randomUUID?crypto.randomUUID():'id-'+Date.now()+'-'+Math.random().toString(36).slice(2)}
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove('show'),2400)}
function showLoading(text,sub){const o=document.getElementById('loadingOverlay');document.getElementById('loText').textContent=text||'Loading…';document.getElementById('loSub').textContent=sub||'';o.classList.add('show')}
function hideLoading(){document.getElementById('loadingOverlay').classList.remove('show')}

/* Perplexity API */
let searchFailCount=0;
async function pplxChat(messages,systemPrompt){
  try{
    const payload={model:'sonar',messages:[]};
    if(systemPrompt)payload.messages.push({role:'system',content:systemPrompt});
    messages.forEach(m=>payload.messages.push({role:m.role,content:m.content}));
    const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if(!r.ok){searchFailCount++;if(searchFailCount>2){return await runAgentFallback(messages,systemPrompt)}return null}
    searchFailCount=0;
    const d=await r.json();return d.choices?.[0]?.message?.content?.trim()||null
  }catch{searchFailCount++;if(searchFailCount>2){return await runAgentFallback(messages,systemPrompt)}return null}
}
async function runAgentsManual(){
  const t=activeTrip();if(!t){toast('Set a trip first');return}
  toast('Running 3 agents in parallel...');
  try{
    const tripCtx={city:t.city,depart:t.depart,return:t.return,weather:t.weather};
    const query='Give me a complete travel brief for '+t.city+' departing '+t.depart+' returning '+t.return+'. Include local events, dining, activities, and a day-by-day plan.';
    const r=await fetch('/api/agents/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,tripContext:tripCtx})});
    if(!r.ok){toast('Agent run failed');return}
    const d=await r.json();
    if(d.results){
      const list=document.getElementById('recsList');if(!list)return;
      list.innerHTML=d.results.map(res=>'<div class="reco-card"><div class="reco-head"><span class="reco-icon">'+(res.agent==='travel-guide'?'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><circle cx=\\'12\\' cy=\\'12\\' r=\\'9\\'/><circle cx=\\'12\\' cy=\\'12\\' r=\\'5\\'/></svg>':res.agent==='research'?'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><circle cx=\\'11\\' cy=\\'11\\' r=\\'8\\'/><path d=\\'M21 21l-4-4\\'/></svg>':'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><rect x=\\'3\\' y=\\'4\\' width=\\'18\\' height=\\'18\\' rx=\\'2\\'/><path d=\\'M3 10h18M8 2v4M16 2v4\\'/></svg>')+'</span><span class="reco-name">'+res.agent.replace(/-/g,' ').replace(/\\b\\w/g,c=>c.toUpperCase())+'</span></div><div class="reco-body" style="white-space:pre-wrap;font-size:.82rem;line-height:1.5">'+(res.content||res.error||'No response')+'</div></div>').join('');
      toast('3 agents responded');
    }
  }catch(e){toast('Agent run failed: '+e.message)}
}
async function runAgentFallback(messages,systemPrompt){
  try{
    toast('Running 3 agents in parallel...');
    const query=messages.map(m=>m.content).join(' ');
    const tripCtx=activeTrip()?{city:activeTrip().city,depart:activeTrip().depart,return:activeTrip().return,weather:activeTrip().weather}:null;
    const r=await fetch('/api/agents/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,tripContext:tripCtx})});
    if(!r.ok)return null;
    const d=await r.json();
    if(d.results){
      let out='';d.results.forEach(res=>{if(res.content){out+='### '+res.agent.toUpperCase()+'\\n'+res.content+'\\n\\n'}});
      return out.trim()||null
    }
    return null
  }catch{return null}
}

/* Worker API */
function sbConfigured(){return true}
function tripToRow(t){return{id:t.id,city:t.city,country:t.country,cc:t.cc,lat:t.lat,lon:t.lon,tz:t.tz,depart:t.depart,return_date:t.return,airline:t.airline,flight_num:t.flightNum,flight_time:t.flightTime,booking_ref:t.bookingRef,items:t.items,closet:t.closet,style:t.style,weather:t.weather,events:t.events,recommendations:t.recommendations,chat_history:t.chatHistory,source:t.source,raw_ocr:t.rawOcr,shared_with:t.sharedWith||[],created_by:currentUser()}}
function rowToTrip(r){return{id:r.id,city:r.city,country:r.country,cc:r.cc,lat:r.lat,lon:r.lon,tz:r.tz,depart:r.depart,return:r.return_date,airline:r.airline,flightNum:r.flight_num,flightTime:r.flight_time,bookingRef:r.booking_ref,items:r.items||{},closet:r.closet||[],style:r.style||[],weather:r.weather,events:r.events,recommendations:r.recommendations,chatHistory:r.chat_history,source:r.source,rawOcr:r.raw_ocr,sharedWith:r.shared_with||r.sharedWith||[],createdBy:r.created_by}}
async function sbLoadTrips(){try{const r=await fetch('/api/trips');if(!r.ok)return[];return(await r.json()).map(rowToTrip)}catch{return[]}}
async function sbLoadSharedTrips(){try{const u=currentUser()||'';const r=await fetch('/api/trips/shared?user='+encodeURIComponent(u));if(!r.ok)return[];return(await r.json()).map(rowToTrip)}catch{return[]}}
async function sbSaveTrip(t){try{await fetch('/api/trips',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(tripToRow(t))})}catch{}}
async function sbDeleteTrip(id){try{await fetch('/api/trips?id='+id,{method:'DELETE'})}catch{}}

/* Screen nav — 5 tabs */
function goScreen(name){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('screen-'+name).classList.add('active');
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  const tab=document.querySelector(\`.tab[data-screen="\${name}"]\`);if(tab)tab.classList.add('active');
  window.scrollTo(0,0);
  if(name==='trip')renderTripsList();if(name==='pack')renderPack();if(name==='plan'){renderCalendar();renderEvents();renderRecs()}if(name==='chat')renderChat();if(name==='closet')renderCloset();if(name==='style')renderStyle();if(name==='sync')renderSync();
}
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>goScreen(t.dataset.screen)));

/* Airport DB */
const AIRPORTS=[{c:'SEA',city:'Seattle',country:'United States',cc:'US',lat:47.45,lon:-122.31,tz:'America/Los_Angeles',n:'Seattle–Tacoma'},{c:'PDX',city:'Portland',country:'United States',cc:'US',lat:45.59,lon:-122.60,tz:'America/Los_Angeles',n:'Portland Intl'},{c:'SFO',city:'San Francisco',country:'United States',cc:'US',lat:37.62,lon:-122.38,tz:'America/Los_Angeles',n:'San Francisco Intl'},{c:'LAX',city:'Los Angeles',country:'United States',cc:'US',lat:33.94,lon:-118.41,tz:'America/Los_Angeles',n:'Los Angeles Intl'},{c:'SAN',city:'San Diego',country:'United States',cc:'US',lat:32.73,lon:-117.19,tz:'America/Los_Angeles',n:'San Diego Intl'},{c:'LAS',city:'Las Vegas',country:'United States',cc:'US',lat:36.08,lon:-115.15,tz:'America/Los_Angeles',n:'Harry Reid Intl'},{c:'DFW',city:'Dallas–Fort Worth',country:'United States',cc:'US',lat:32.90,lon:-97.04,tz:'America/Chicago',n:'Dallas/Fort Worth Intl'},{c:'AUS',city:'Austin',country:'United States',cc:'US',lat:30.20,lon:-97.67,tz:'America/Chicago',n:'Austin–Bergstrom'},{c:'IAH',city:'Houston',country:'United States',cc:'US',lat:29.98,lon:-95.34,tz:'America/Chicago',n:'George Bush Intercontinental'},{c:'ORD',city:'Chicago',country:'United States',cc:'US',lat:41.98,lon:-87.90,tz:'America/Chicago',n:"O'Hare Intl"},{c:'ATL',city:'Atlanta',country:'United States',cc:'US',lat:33.64,lon:-84.43,tz:'America/New_York',n:'Hartsfield–Jackson'},{c:'MIA',city:'Miami',country:'United States',cc:'US',lat:25.79,lon:-80.29,tz:'America/New_York',n:'Miami Intl'},{c:'JFK',city:'New York',country:'United States',cc:'US',lat:40.64,lon:-73.78,tz:'America/New_York',n:'John F. Kennedy Intl'},{c:'EWR',city:'Newark',country:'United States',cc:'US',lat:40.69,lon:-74.17,tz:'America/New_York',n:'Newark Liberty'},{c:'BOS',city:'Boston',country:'United States',cc:'US',lat:42.37,lon:-71.01,tz:'America/New_York',n:'Logan Intl'},{c:'IAD',city:'Washington',country:'United States',cc:'US',lat:38.95,lon:-77.45,tz:'America/New_York',n:'Dulles Intl'},{c:'DEN',city:'Denver',country:'United States',cc:'US',lat:39.86,lon:-104.67,tz:'America/Denver',n:'Denver Intl'},{c:'PHX',city:'Phoenix',country:'United States',cc:'US',lat:33.44,lon:-112.01,tz:'America/Phoenix',n:'Sky Harbor'},{c:'SLC',city:'Salt Lake City',country:'United States',cc:'US',lat:40.79,lon:-111.97,tz:'America/Denver',n:'Salt Lake City Intl'},{c:'MSP',city:'Minneapolis',country:'United States',cc:'US',lat:44.88,lon:-93.23,tz:'America/Chicago',n:'Minneapolis–St. Paul'},{c:'HNL',city:'Honolulu',country:'United States',cc:'US',lat:21.32,lon:-157.92,tz:'Pacific/Honolulu',n:'Daniel K. Inouye'},{c:'YYZ',city:'Toronto',country:'Canada',cc:'CA',lat:43.68,lon:-79.61,tz:'America/Toronto',n:'Toronto Pearson'},{c:'YVR',city:'Vancouver',country:'Canada',cc:'CA',lat:49.20,lon:-123.18,tz:'America/Vancouver',n:'Vancouver Intl'},{c:'MEX',city:'Mexico City',country:'Mexico',cc:'MX',lat:19.44,lon:-99.07,tz:'America/Mexico_City',n:'Benito Juárez'},{c:'CUN',city:'Cancún',country:'Mexico',cc:'MX',lat:21.04,lon:-86.87,tz:'America/Cancun',n:'Cancún Intl'},{c:'LHR',city:'London',country:'United Kingdom',cc:'GB',lat:51.47,lon:-0.45,tz:'Europe/London',n:'Heathrow'},{c:'CDG',city:'Paris',country:'France',cc:'FR',lat:49.00,lon:2.55,tz:'Europe/Paris',n:'Charles de Gaulle'},{c:'AMS',city:'Amsterdam',country:'Netherlands',cc:'NL',lat:52.31,lon:4.76,tz:'Europe/Amsterdam',n:'Schiphol'},{c:'FRA',city:'Frankfurt',country:'Germany',cc:'DE',lat:50.04,lon:8.56,tz:'Europe/Berlin',n:'Frankfurt am Main'},{c:'FCO',city:'Rome',country:'Italy',cc:'IT',lat:41.80,lon:12.25,tz:'Europe/Rome',n:'Leonardo da Vinci'},{c:'MAD',city:'Madrid',country:'Spain',cc:'ES',lat:40.47,lon:-3.56,tz:'Europe/Madrid',n:'Madrid Barajas'},{c:'BCN',city:'Barcelona',country:'Spain',cc:'ES',lat:41.30,lon:2.08,tz:'Europe/Madrid',n:'Barcelona–El Prat'},{c:'LIS',city:'Lisbon',country:'Portugal',cc:'PT',lat:38.78,lon:-9.13,tz:'Europe/Lisbon',n:'Humberto Delgado'},{c:'DUB',city:'Dublin',country:'Ireland',cc:'IE',lat:53.42,lon:-6.25,tz:'Europe/Dublin',n:'Dublin Intl'},{c:'NRT',city:'Tokyo',country:'Japan',cc:'JP',lat:35.77,lon:140.39,tz:'Asia/Tokyo',n:'Narita Intl'},{c:'HND',city:'Tokyo',country:'Japan',cc:'JP',lat:35.55,lon:139.78,tz:'Asia/Tokyo',n:'Haneda'},{c:'KIX',city:'Osaka',country:'Japan',cc:'JP',lat:34.43,lon:135.24,tz:'Asia/Tokyo',n:'Kansai Intl'},{c:'ICN',city:'Seoul',country:'South Korea',cc:'KR',lat:37.46,lon:126.44,tz:'Asia/Seoul',n:'Incheon Intl'},{c:'SIN',city:'Singapore',country:'Singapore',cc:'SG',lat:1.35,lon:103.99,tz:'Asia/Singapore',n:'Singapore Changi'},{c:'BKK',city:'Bangkok',country:'Thailand',cc:'TH',lat:13.69,lon:100.75,tz:'Asia/Bangkok',n:'Suvarnabhumi'},{c:'DXB',city:'Dubai',country:'UAE',cc:'AE',lat:25.25,lon:55.36,tz:'Asia/Dubai',n:'Dubai Intl'},{c:'SYD',city:'Sydney',country:'Australia',cc:'AU',lat:-33.95,lon:151.18,tz:'Australia/Sydney',n:'Sydney Kingsford Smith'},{c:'MEL',city:'Melbourne',country:'Australia',cc:'AU',lat:-37.67,lon:144.84,tz:'Australia/Melbourne',n:'Melbourne Intl'},{c:'AKL',city:'Auckland',country:'New Zealand',cc:'NZ',lat:-37.01,lon:174.79,tz:'Pacific/Auckland',n:'Auckland Intl'},{c:'GRU',city:'São Paulo',country:'Brazil',cc:'BR',lat:-23.43,lon:-46.47,tz:'America/Sao_Paulo',n:'Guarulhos Intl'},{c:'EZE',city:'Buenos Aires',country:'Argentina',cc:'AR',lat:-34.82,lon:-58.54,tz:'America/Argentina/Buenos_Aires',n:'Ezeiza Intl'},{c:'DEL',city:'Delhi',country:'India',cc:'IN',lat:28.56,lon:77.10,tz:'Asia/Kolkata',n:'Indira Gandhi Intl'},{c:'BOM',city:'Mumbai',country:'India',cc:'IN',lat:19.09,lon:72.87,tz:'Asia/Kolkata',n:'Chhatrapati Shivaji'},{c:'JNB',city:'Johannesburg',country:'South Africa',cc:'ZA',lat:-26.14,lon:28.24,tz:'Africa/Johannesburg',n:'O. R. Tambo'},{c:'TLV',city:'Tel Aviv',country:'Israel',cc:'IL',lat:32.01,lon:34.89,tz:'Asia/Jerusalem',n:'Ben Gurion'}];

/* Destination search — typeahead by airport code or city */
const destInput=document.getElementById('destInput'),destResultsEl=document.getElementById('destResults');
let searchSeq=0;
destInput.addEventListener('input',()=>{clearTimeout(destTimer);const q=destInput.value.trim();if(q.length<1){destResultsEl.innerHTML='';destResults=[];return}const mySeq=++searchSeq;destTimer=setTimeout(async()=>{
  if(mySeq!==searchSeq)return;
  const upperQ=q.toUpperCase();
  let apMatches=[];
  if(upperQ.length>=2){apMatches=AIRPORTS.filter(a=>a.c===upperQ||a.c.startsWith(upperQ)||(a.city.toUpperCase().includes(upperQ)&&upperQ.length>=3)).slice(0,5)}
  let geoResults=[];
  if(q.length>=2){try{const r=await fetch(\`https://geocoding-api.open-meteo.com/v1/search?name=\${encodeURIComponent(q)}&count=5&language=en&format=json\`);const d=await r.json();geoResults=d.results||[]}catch{}
  if(mySeq!==searchSeq)return;}
  destResults=[];
  const seenCities=new Set();
  apMatches.forEach(a=>{const key=a.c+a.cc;if(!seenCities.has(key)){seenCities.add(key);destResults.push({name:a.city,country:a.country,country_code:a.cc,latitude:a.lat,longitude:a.lon,timezone:a.tz,_airport:a.c,_airportName:a.n})}});
  geoResults.forEach(c=>{const key=c.name+(c.country_code||'');if(!seenCities.has(key)){seenCities.add(key);destResults.push(c)}});
  destResultsEl.innerHTML=destResults.map((c,i)=>{const flag=c.country_code?String.fromCodePoint(...[...c.country_code.toUpperCase()].map(ch=>ch.charCodeAt(0)+0x1F1E5-65)):'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5L21 14z"/></svg>';return \`<div class="dest-result" onclick="pickDest(\${i})"><span class="flag">\${flag}</span><div class="info"><div class="name">\${c.name}\${c._airport?\` <span class="auto-badge" style="background:#fef3c7;color:#92400e">\${c._airport}</span>\`:''}</div><div class="region">\${c._airport?c._airportName+', ':''}\${c.admin1||''}\${c.admin1?', ':''}\${c.country}</div></div></div>\`}).join('');
},200)});
function pickDest(i){currentDest=destResults[i];destInput.value=\`\${currentDest.name}, \${currentDest.country}\`;destResultsEl.innerHTML=''}

/* Trip CRUD */
function saveTrip(){
  if(!currentDest){toast('Search and pick a destination');destInput.focus();return}
  const data={id:activeTrip()?.id||uuid(),city:currentDest.name,country:currentDest.country,cc:currentDest.country_code,lat:currentDest.latitude,lon:currentDest.longitude,tz:currentDest.timezone,depart:document.getElementById('departDate').value||null,return:document.getElementById('returnDate').value||null,airline:document.getElementById('airline').value||'',flightNum:document.getElementById('flightNum').value||'',flightTime:document.getElementById('flightTime').value||'',bookingRef:document.getElementById('bookingRef').value||'',items:activeTrip()?.items||{},closet:activeTrip()?.closet||[],style:activeTrip()?.style||[],weather:activeTrip()?.weather||null,events:activeTrip()?.events||null,recommendations:activeTrip()?.recommendations||null,chatHistory:activeTrip()?.chatHistory||[],source:activeTrip()?.source||'manual',rawOcr:activeTrip()?.rawOcr||null,createdBy:currentUser()};
  const prevTrip=activeTrip();const destChanged=!!prevTrip&&(prevTrip.lat!==currentDest.latitude||prevTrip.lon!==currentDest.longitude);
  if(!S.activeId||!activeTrip()){S.trips.push(data);S.activeId=data.id}else Object.assign(activeTrip(),data);
  if(destChanged&&activeTrip()){activeTrip().weather=null;activeTrip().events=null;activeTrip().recommendations=null;const wb=document.getElementById('weatherBlock');if(wb)wb.innerHTML=''}
  save();sbSaveTrip(data);renderTripSummary();renderTripsList();autoSuggest();toast('Trip saved');
  if(!activeTrip().weather)fetchWeather();
}
function editTrip(){document.getElementById('tripSetup').classList.remove('hidden');document.getElementById('tripSummary').classList.add('hidden');const t=activeTrip();if(!t)return;currentDest={name:t.city,country:t.country,country_code:t.cc,latitude:t.lat,longitude:t.lon,timezone:t.tz};destInput.value=\`\${t.city}, \${t.country}\`;document.getElementById('departDate').value=t.depart||'';document.getElementById('returnDate').value=t.return||'';document.getElementById('airline').value=t.airline||'';document.getElementById('flightNum').value=t.flightNum||'';document.getElementById('flightTime').value=t.flightTime||'';document.getElementById('bookingRef').value=t.bookingRef||''}
function renderTripSummary(){const t=activeTrip();if(!t)return;document.getElementById('tripSetup').classList.add('hidden');document.getElementById('tripSummary').classList.remove('hidden');document.getElementById('tsDest').textContent=\`\${t.city}, \${t.country}\`;const dates=[];if(t.depart)dates.push(fmtDate(t.depart));if(t.return)dates.push(fmtDate(t.return));document.getElementById('tsDates').textContent=dates.join(' — ');const flight=[];if(t.airline)flight.push(\`<div class="item">Airline<strong>\${t.airline}\${t.flightNum?' '+t.flightNum:''}</strong></div>\`);if(t.flightTime)flight.push(\`<div class="item">Departure<strong>\${t.flightTime}</strong></div>\`);if(t.bookingRef)flight.push(\`<div class="item">Booking Ref<strong>\${t.bookingRef}</strong></div>\`);document.getElementById('tsFlight').innerHTML=flight.join('')||'';document.getElementById('tsSource').innerHTML=t.source&&t.source!=='manual'?\`<div class="source-badge">\${t.source}</div>\`:''}
function renderTripsList(){const el=document.getElementById('tripsList');if(!S.trips.length){el.classList.add('hidden');return}el.classList.remove('hidden');document.getElementById('tripsListContent').innerHTML=S.trips.map(t=>{const dates=[];if(t.depart)dates.push(fmtDate(t.depart));if(t.return)dates.push(fmtDate(t.return));const src=t.source&&t.source!=='manual'?\`<span class="tc-source">\${t.source}</span>\`:'';const by=t.createdBy?\` · \${t.createdBy}\`:'';return \`<div class="trip-card \${t.id===S.activeId?'active':''}" onclick="selectTrip('\${t.id}')"><div class="tc-main"><div class="tc-city">\${t.city}, \${t.country}</div><div class="tc-dates">\${dates.join(' — ')||'No dates'}\${by}</div>\${src}</div><button class="tc-del" onclick="event.stopPropagation();deleteTrip('\${t.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button></div>\`}).join('')}
function selectTrip(id){S.activeId=id;save();const t=activeTrip();if(t){currentDest={name:t.city,country:t.country,country_code:t.cc,latitude:t.lat,longitude:t.lon,timezone:t.tz};destInput.value=\`\${t.city}, \${t.country}\`;document.getElementById('departDate').value=t.depart||'';document.getElementById('returnDate').value=t.return||'';document.getElementById('airline').value=t.airline||'';document.getElementById('flightNum').value=t.flightNum||'';document.getElementById('flightTime').value=t.flightTime||'';document.getElementById('bookingRef').value=t.bookingRef||'';renderTripSummary();if(t.weather)renderWeather();else{const wb=document.getElementById('weatherBlock');if(wb)wb.innerHTML='';}renderTripsList();renderPack()}}
function deleteTrip(id){S.trips=S.trips.filter(t=>t.id!==id);if(S.activeId===id)S.activeId=S.trips[0]?.id||null;save();sbDeleteTrip(id);if(S.activeId)selectTrip(S.activeId);else{document.getElementById('tripSetup').classList.remove('hidden');document.getElementById('tripSummary').classList.add('hidden')}renderTripsList();renderPack();toast('Trip deleted')}
function fmtDate(s){const d=new Date(s+'T00:00');return d.toLocaleDateString('en',{month:'short',day:'numeric'})}

/* Weather — 16 days */
async function fetchWeather(){const t=activeTrip();if(!t)return;try{const lat=t.lat.toFixed(2),lon=t.lon.toFixed(2);const r=await fetch(\`https://api.open-meteo.com/v1/forecast?latitude=\${lat}&longitude=\${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max&timezone=\${encodeURIComponent(t.tz||'auto')}&forecast_days=16\`);if(!r.ok)throw new Error('Weather API error');t.weather=await r.json();save();sbSaveTrip(t);renderWeather();autoSuggest()}catch{toast('Weather fetch failed')}}
const W_ICON={0:'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><circle cx=\\'12\\' cy=\\'12\\' r=\\'4.5\\'/><path d=\\'M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8l1.8-1.8M18 6l1.8-1.8\\'/></svg>',1:'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><circle cx=\\'8\\' cy=\\'7\\' r=\\'3\\'/><path d=\\'M8 1.5v2M14.5 7h-2M8 12.5v2M3 7H1M11.2 3.8l1.4 1.4M3.4 11.2l1.4-1.4M3.8 3.4l1.4 1.4\\'/><path d=\\'M17 12a4 4 0 014 4 3 3 0 01-3 3H9a3 3 0 010-6 4 4 0 014-3 4 4 0 014 2z\\'/></svg>',2:'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><circle cx=\\'7\\' cy=\\'7\\' r=\\'3\\'/><path d=\\'M7 1.5v2M13.5 7h-2M7 12.5v2M2 7H0M10.2 3.8l1.4 1.4M2.4 11.6l1.4-1.4M2.8 3.4l1.4 1.4\\'/><path d=\\'M18 12a4 4 0 014 4 3 3 0 01-3 3H10a3 3 0 010-6 4 4 0 014-3 4 4 0 014 2z\\'/></svg>',3:'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M18 12a4 4 0 014 4 3 3 0 01-3 3H6a3 3 0 010-6 4 4 0 014-3 4 4 0 014 2 4 4 0 014-1z\\'/></svg>',45:'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\'><path d=\\'M3 8h18M3 12h18M3 16h18M3 20h12\\'/></svg>',48:'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\'><path d=\\'M3 8h18M3 12h18M3 16h18M3 20h12\\'/></svg>',51:'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><circle cx=\\'7\\' cy=\\'7\\' r=\\'3\\'/><path d=\\'M7 1.5v2M13.5 7h-2M7 12.5v2M2 7H0M10.2 3.8l1.4 1.4M2.4 11.6l1.4-1.4M2.8 3.4l1.4 1.4\\'/><path d=\\'M18 12a4 4 0 014 4 3 3 0 01-3 3H10a3 3 0 010-6 4 4 0 014-3 4 4 0 014 2z\\'/><path d=\\'M9 19v2M13 19v2M17 19v2\\'/></svg>',53:'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><circle cx=\\'7\\' cy=\\'7\\' r=\\'3\\'/><path d=\\'M7 1.5v2M13.5 7h-2M7 12.5v2M2 7H0M10.2 3.8l1.4 1.4M2.4 11.6l1.4-1.4M2.8 3.4l1.4 1.4\\'/><path d=\\'M18 12a4 4 0 014 4 3 3 0 01-3 3H10a3 3 0 010-6 4 4 0 014-3 4 4 0 014 2z\\'/><path d=\\'M9 19v2M13 19v2M17 19v2\\'/></svg>',55:'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M18 12a4 4 0 014 4 3 3 0 01-3 3H6a3 3 0 010-6 4 4 0 014-3 4 4 0 014 2 4 4 0 014-1z\\'/><path d=\\'M8 19v2M12 19v2.5M16 19v2\\'/></svg>',56:'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M18 12a4 4 0 014 4 3 3 0 01-3 3H6a3 3 0 010-6 4 4 0 014-3 4 4 0 014 2 4 4 0 014-1z\\'/><path d=\\'M8 19v2M12 19v2.5M16 19v2\\'/></svg>',57:'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M18 12a4 4 0 014 4 3 3 0 01-3 3H6a3 3 0 010-6 4 4 0 014-3 4 4 0 014 2 4 4 0 014-1z\\'/><path d=\\'M8 19v2M12 19v2.5M16 19v2\\'/></svg>',61:'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M18 12a4 4 0 014 4 3 3 0 01-3 3H6a3 3 0 010-6 4 4 0 014-3 4 4 0 014 2 4 4 0 014-1z\\'/><path d=\\'M8 19v2M12 19v2.5M16 19v2\\'/></svg>',63:'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M18 12a4 4 0 014 4 3 3 0 01-3 3H6a3 3 0 010-6 4 4 0 014-3 4 4 0 014 2 4 4 0 014-1z\\'/><path d=\\'M8 19v2M12 19v2.5M16 19v2\\'/></svg>',65:'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M18 12a4 4 0 014 4 3 3 0 01-3 3H6a3 3 0 010-6 4 4 0 014-3 4 4 0 014 2 4 4 0 014-1z\\'/><path d=\\'M8 19v2M12 19v2.5M16 19v2\\'/></svg>',66:'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M18 11a4 4 0 014 4 3 3 0 01-3 3H6a3 3 0 010-6 4 4 0 014-3 4 4 0 014-2 4 4 0 014 1z\\'/><path d=\\'M8 19l1 1-1 1M12 19l1 1-1 1M16 19l1 1-1 1\\'/></svg>',67:'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M18 11a4 4 0 014 4 3 3 0 01-3 3H6a3 3 0 010-6 4 4 0 014-3 4 4 0 014-2 4 4 0 014 1z\\'/><path d=\\'M8 19l1 1-1 1M12 19l1 1-1 1M16 19l1 1-1 1\\'/></svg>',71:'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M12 2v20M4 6l16 12M20 6L4 18\\'/><path d=\\'M12 6l-2-2M12 6l2-2M12 18l-2 2M12 18l2 2M6 8l-2.5.5M18 8l2.5.5M6 16l-2.5-.5M18 16l2.5-.5\\'/></svg>',73:'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M12 2v20M4 6l16 12M20 6L4 18\\'/><path d=\\'M12 6l-2-2M12 6l2-2M12 18l-2 2M12 18l2 2M6 8l-2.5.5M18 8l2.5.5M6 16l-2.5-.5M18 16l2.5-.5\\'/></svg>',75:'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M12 2v20M4 6l16 12M20 6L4 18\\'/><path d=\\'M12 6l-2-2M12 6l2-2M12 18l-2 2M12 18l2 2M6 8l-2.5.5M18 8l2.5.5M6 16l-2.5-.5M18 16l2.5-.5\\'/></svg>',77:'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M12 2v20M4 6l16 12M20 6L4 18\\'/><path d=\\'M12 6l-2-2M12 6l2-2M12 18l-2 2M12 18l2 2M6 8l-2.5.5M18 8l2.5.5M6 16l-2.5-.5M18 16l2.5-.5\\'/></svg>',80:'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><circle cx=\\'7\\' cy=\\'7\\' r=\\'3\\'/><path d=\\'M7 1.5v2M13.5 7h-2M7 12.5v2M2 7H0M10.2 3.8l1.4 1.4M2.4 11.6l1.4-1.4M2.8 3.4l1.4 1.4\\'/><path d=\\'M18 12a4 4 0 014 4 3 3 0 01-3 3H10a3 3 0 010-6 4 4 0 014-3 4 4 0 014 2z\\'/><path d=\\'M9 19v2M13 19v2M17 19v2\\'/></svg>',81:'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M18 12a4 4 0 014 4 3 3 0 01-3 3H6a3 3 0 010-6 4 4 0 014-3 4 4 0 014 2 4 4 0 014-1z\\'/><path d=\\'M8 19v2M12 19v2.5M16 19v2\\'/></svg>',82:'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M18 11a4 4 0 014 4 3 3 0 01-3 3H6a3 3 0 010-6 4 4 0 014-3 4 4 0 014-2 4 4 0 014 1z\\'/><path d=\\'M13 14l-3 5h3l-2 4\\'/></svg>',85:'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M18 11a4 4 0 014 4 3 3 0 01-3 3H6a3 3 0 010-6 4 4 0 014-3 4 4 0 014-2 4 4 0 014 1z\\'/><path d=\\'M8 19l1 1-1 1M12 19l1 1-1 1M16 19l1 1-1 1\\'/></svg>',86:'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M18 11a4 4 0 014 4 3 3 0 01-3 3H6a3 3 0 010-6 4 4 0 014-3 4 4 0 014-2 4 4 0 014 1z\\'/><path d=\\'M8 19l1 1-1 1M12 19l1 1-1 1M16 19l1 1-1 1\\'/></svg>',95:'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M18 11a4 4 0 014 4 3 3 0 01-3 3H6a3 3 0 010-6 4 4 0 014-3 4 4 0 014-2 4 4 0 014 1z\\'/><path d=\\'M13 14l-3 5h3l-2 4\\'/></svg>',96:'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M18 11a4 4 0 014 4 3 3 0 01-3 3H6a3 3 0 010-6 4 4 0 014-3 4 4 0 014-2 4 4 0 014 1z\\'/><path d=\\'M13 14l-3 5h3l-2 4\\'/></svg>',99:'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M18 11a4 4 0 014 4 3 3 0 01-3 3H6a3 3 0 010-6 4 4 0 014-3 4 4 0 014-2 4 4 0 014 1z\\'/><path d=\\'M13 14l-3 5h3l-2 4\\'/></svg>'};
const W_LABEL={0:'Clear',1:'Mostly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Rime fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',56:'Freezing drizzle',57:'Heavy freezing drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',66:'Freezing rain',67:'Heavy freezing rain',71:'Light snow',73:'Snow',75:'Heavy snow',77:'Snow grains',80:'Light showers',81:'Showers',82:'Violent showers',85:'Snow showers',86:'Heavy snow showers',95:'Thunderstorm',96:'Thunderstorm + hail',99:'Severe thunderstorm'};
function renderWeather(){const t=activeTrip();if(!t||!t.weather||!t.weather.current||!t.weather.daily)return;const w=t.weather,cur=w.current,daily=w.daily;let days=daily.time,start=0,end=days.length;if(t.depart){const di=days.indexOf(t.depart);if(di>=0)start=di}let html=\`<div class="weather-current"><div class="w-icon">\${W_ICON[cur.weather_code]||'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M14 14.76V5a2 2 0 10-4 0v9.76a4 4 0 104 0z\\'/><circle cx=\\'12\\' cy=\\'17\\' r=\\'1.5\\'/></svg>'}</div><div class="w-info"><div class="w-label">Current in \${t.city}</div><div class="w-cond">\${W_LABEL[cur.weather_code]||'—'}</div><div class="w-extra"><svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M12 2.5S5 11 5 16a7 7 0 0014 0c0-5-7-13.5-7-13.5z\\'/></svg> \${cur.relative_humidity_2m}% · <svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M3 8h11a3 3 0 100-6M3 12h15a3 3 0 110 6M3 16h9\\'/></svg> \${Math.round(cur.wind_speed_10m)} km/h</div></div><div class="w-temp">\${Math.round(cur.temperature_2m)}°</div></div><div class="weather-scroll">\`;for(let i=start;i<end&&i<days.length;i++){const d=new Date(days[i]+'T00:00');const lbl=d.toLocaleDateString('en',{weekday:'short',day:'numeric'});const hi=Math.round(daily.temperature_2m_max[i]);const lo=Math.round(daily.temperature_2m_min[i]);const prec=daily.precipitation_probability_max?.[i]??0;html+=\`<div class="w-day"><div class="d-label">\${lbl}</div><div class="d-icon">\${W_ICON[daily.weather_code[i]]||'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M14 14.76V5a2 2 0 10-4 0v9.76a4 4 0 104 0z\\'/><circle cx=\\'12\\' cy=\\'17\\' r=\\'1.5\\'/></svg>'}</div><div class="d-hi">\${hi}°</div><div class="d-lo">\${lo}°</div>\${prec>20?\`<div class="d-precip"><svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M12 2.5S5 11 5 16a7 7 0 0014 0c0-5-7-13.5-7-13.5z\\'/></svg>\${prec}%</div>\`:''}</div>\`}html+='</div>';document.getElementById('weatherBlock').innerHTML=html}

/* Auto-suggest */
function autoSuggest(){const t=activeTrip();if(!t)return;const w=t.weather;let maxT=22,minT=15,rain=false,snow=false,uvHi=false;if(w?.daily){const d=w.daily;const depIdx=t.depart?Math.max(0,d.time.indexOf(t.depart)):0;const n=Math.min(16,d.time.length-depIdx);for(let i=depIdx;i<depIdx+n&&i<d.time.length;i++){maxT=Math.max(maxT,d.temperature_2m_max[i]);minT=Math.min(minT,d.temperature_2m_min[i]);if((d.precipitation_probability_max?.[i]??0)>30)rain=true;if(d.weather_code[i]>=71&&d.weather_code[i]<=77)snow=true;if((d.uv_index_max?.[i]??0)>6)uvHi=true}}const add=(label,cat,key)=>{const k=\`auto-\${key}\`;if(!t.items[k])t.items[k]={cat,label,checked:false,qty:1,packed:0,auto:true}};if(maxT>=28){add('Sunscreen','grooming','sunscreen');add('Hat / Cap','apparel','hat')}if(minT<=5){add('Heavy jacket','apparel','heavy-jacket');add('Thermal base layer','apparel','thermal');add('Gloves','apparel','gloves')}if(minT<=-5){add('Scarf','apparel','scarf');add('Warm beanie','apparel','beanie')}if(rain){add('Rain jacket','gear','rain-jacket');add('Umbrella','gear','umbrella')}if(snow){add('Snow boots','gear','snow-boots')}if(uvHi){add('Sunglasses','gear','sunglasses')}if(maxT<=18&&minT>=6){add('Light layer','apparel','light-layer')}save();renderPack()}

/* Packing — with packed counter */
const CATS=[{id:'apparel',name:'Apparel',icon:'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M20 4l-4-2-4 2-4-2-4 2 3 3v13h10V7l3-3z\\'/></svg>'},{id:'grooming',name:'Grooming',icon:'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M9 2h6v3H9zM10 5h4l1 3H9zM9 9h6v11a2 2 0 01-2 2h-2a2 2 0 01-2-2V9z\\'/></svg>'},{id:'beauty',name:'Face & Beauty',icon:'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M9 3l6 9-3 3-6-6 3-6zM3 9l3 3-2 2-3-3 2-2z\\'/></svg>'},{id:'tech',name:'Tech',icon:'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M9 2v6M15 2v6M7 8h10v3a5 5 0 01-10 0V8zM12 16v4M9 22h6\\'/></svg>'},{id:'health',name:'Health & Meds',icon:'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><rect x=\\'3\\' y=\\'9\\' width=\\'18\\' height=\\'6\\' rx=\\'3\\' transform=\\'rotate(45 12 12)\\'/><path d=\\'M8.5 8.5l7 7\\'/></svg>'},{id:'docs',name:'Travel Docs',icon:'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z\\'/><path d=\\'M14 2v6h6M8 13h8M8 17h8\\'/></svg>'},{id:'gear',name:'Gear',icon:'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M5 8a7 7 0 0114 0v10a2 2 0 01-2 2H7a2 2 0 01-2-2V8z\\'/><path d=\\'M8 8V5a2 2 0 012-2h4a2 2 0 012 2v3M9 14h6\\'/></svg>'}];
const TEMPLATES=[{id:'beach',name:'Beach',icon:'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M12 3v12M12 9c4 0 7 1 8 2M12 5C8 5 5 6 4 7M3 17h18M2 21h20\\'/><circle cx=\\'12\\' cy=\\'15\\' r=\\'1\\'/></svg>',items:[['apparel','Swimwear',1],['apparel','Sun Hat',1],['apparel','Flip Flops',1],['grooming','Sunscreen',2],['grooming','After Sun Lotion',1],['gear','Beach Bag',1],['gear','Sunglasses',1]]},{id:'business',name:'Business',icon:'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><rect x=\\'3\\' y=\\'7\\' width=\\'18\\' height=\\'13\\' rx=\\'2\\'/><path d=\\'M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M3 12h18\\'/></svg>',items:[['apparel','Suit / Blazer',1],['apparel','Dress Shirts',3],['gear','Dress Shoes',1],['tech','Laptop + Charger',1],['docs','Business Cards',1],['docs','Meeting Agenda',1]]},{id:'weekend',name:'Weekend',icon:'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M13 2L4 14h7l-2 8 9-12h-7l2-8z\\'/></svg>',items:[['apparel','Tops / Tees',2],['apparel','Pants / Shorts',1],['grooming','Toothbrush & Paste',1],['tech','Phone + Cable',1],['tech','Power Bank',1]]},{id:'adventure',name:'Adventure',icon:'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M7 4h5v9H7zM12 4h5v9h-5zM6 13h12v6a2 2 0 01-2 2H8a2 2 0 01-2-2v-6zM7 16h4M14 16h3\\'/></svg>',items:[['apparel','Hiking Boots',1],['apparel','Moisture-Wick Tops',2],['apparel','Trail Pants',1],['gear','Day Bag',1],['gear','Water Bottle',1],['health','First Aid Kit',1],['health','Bug Repellent',1]]},{id:'festival',name:'Festival',icon:'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M4 9c4-4 12-4 16 0M3 9l3-3M21 9l-3-3M5 9l7 11 7-11\\'/><path d=\\'M12 9v11M9 9l3 11 3-11\\'/></svg>',items:[['tech','Portable Charger',1],['gear','Fanny Pack',1],['gear','Earplugs',1],['gear','Reusable Cup',1],['apparel','Bandana',1],['health','Sunscreen',1],['health','Electrolytes',1]]}];
function renderPack(){
  const el=document.getElementById('packList');const t=activeTrip();const items=activeItems();
  const noTrip=!t;
  if(Object.keys(items).length===0){
    const seeds=[['apparel','Tops / Tees',3,false],['apparel','Pants / Shorts',2,false],['apparel','Evening Fit',1,false],['apparel','Outerwear / Jacket',1,false],['apparel','Sleepwear',1,false],['apparel','Underwear & Socks',5,true],['apparel','Swimwear',1,false],['apparel','Accessories',1,false],['grooming','Skincare',1,true],['grooming','Deodorant',1,true],['grooming','Hair Products',1,false],['grooming','Toothbrush & Paste',1,true],['grooming','Shower Kit',1,false],['grooming','Shaving Kit',1,false],['beauty','Foundation',1,false],['beauty','Concealer',1,false],['beauty','Blush / Bronzer',1,false],['beauty','Eyeliner / Mascara',1,false],['beauty','Lip Color',1,false],['beauty','Brushes & Tools',1,false],['beauty','Makeup Remover',1,false],['beauty','Setting Spray',1,false],['tech','Phone + Cable',1,true],['tech','Power Bank',1,false],['tech','Laptop + Charger',1,false],['tech','Earbuds / Headphones',1,false],['tech','Travel Adapter',1,false],['health','First Aid Kit',1,false],['health','Prescription Meds',1,true],['health','Pain Reliever',1,false],['health','Vitamins',1,false],['health','Sunscreen',1,false],['health','Bug Repellent',1,false],['docs','Passport / ID',1,true],['docs','Boarding Pass / Tickets',1,true],['docs','Hotel Reservations',1,false],['docs','Travel Insurance',1,false],['docs','Emergency Contacts',1,false],['gear','Day Bag',1,true],['gear','Sunglasses',1,false],['gear','Water Bottle',1,false],['gear','Umbrella',1,false],['gear','Travel Pillow',1,false],['gear','Luggage Lock',1,false]];
    seeds.forEach(([cat,label,qty,essential])=>{items[\`seed-\${cat}-\${label}\`]={cat,label,checked:false,qty,packed:0,essential:essential||false,auto:false}});
    save();
  }
  renderTemplates();
  const search=(document.getElementById('packSearch')?.value||'').trim().toLowerCase();
  let html='';
  if(noTrip){html+=\`<div style="background:var(--surface-2);border:1px solid var(--line);border-radius:var(--r-sm);padding:10px 14px;margin-bottom:14px;font-size:.78rem;color:var(--muted);text-align:center">No trip set — this checklist saves locally. <a onclick="goScreen('trip')" style="color:var(--orange);font-weight:600;cursor:pointer">Set up a trip →</a></div>\`}
  CATS.forEach(cat=>{
    let catItems=Object.entries(items).filter(([k,v])=>v.cat===cat.id);
    if(search)catItems=catItems.filter(([k,v])=>v.label.toLowerCase().includes(search));
    if(!catItems.length)return;
    const done=catItems.filter(([k,v])=>v.checked).length;
    const allDone=catItems.length>0&&done===catItems.length;
    html+=\`<div class="cat-section\${allDone?' open':''}" data-cat="\${cat.id}"><div class="cat-head" onclick="this.parentElement.classList.toggle('open')"><div class="left"><span class="cat-icon">\${cat.icon}</span><span class="cat-name">\${cat.name}</span></div><div class="right"><span class="pill \${allDone?'done':''}">\${done}/\${catItems.length}</span><svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg></div></div><div class="cat-body"><div class="pack-list">\${catItems.map(([k,v])=>{const me=currentUser();const tr=activeTrip();const shared=(tr&&Array.isArray(tr.sharedWith))?tr.sharedWith.filter(u=>u):[];if(!v.packedBy)v.packedBy={};const packed=(typeof v.packedBy[me]==='number')?v.packedBy[me]:(v.packed||0);const total=v.qty||1;const isDone=packed>=total;const others=shared.filter(u=>u!==me).map(u=>{const p=(typeof v.packedBy[u]==='number')?v.packedBy[u]:(v.packed||0);return '<span class="pc-other"><b>'+u+'</b> '+p+'/'+total+'</span>'}).join('');const othersHtml=others?'<span class="pc-others">'+others+'</span>':'';return \`<div class="pack-row \${isDone?'checked':''}" data-key="\${k}"><div class="check" onclick="toggleItem('\${k}')"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div><span class="p-label">\${v.label}\${v.essential?' <span class="essential-badge">essential</span>':''}\${v.auto?' <span class="auto-badge">weather</span>':''}\${v.fromTemplate?' <span class="auto-badge" style="background:#fef3c7;color:#92400e">'+v.fromTemplate+'</span>':''}</span><div class="pack-counter"><button class="pc-btn" onclick="packedQty('\${k}',-1)">−</button><span class="pc-val">\${packed}<span class="pc-sep">/</span>\${total}</span><button class="pc-btn" onclick="packedQty('\${k}',1)">+</button></div>\${othersHtml}<div class="qty-control"><button class="qty-btn" onclick="qtyItem('\${k}',-1)">−</button><span class="qty-val">\${total}</span><button class="qty-btn" onclick="qtyItem('\${k}',1)">+</button></div><button class="del-btn" onclick="delItem('\${k}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button></div>\`}).join('')}<div class="add-item"><input class="ai-inp" id="add-\${cat.id}" placeholder="Add \${cat.name.toLowerCase()} item…" onkeydown="if(event.key==='Enter')addItem('\${cat.id}')"><button class="ai-btn" onclick="addItem('\${cat.id}')">Add</button></div></div></div></div>\`;
  });
  el.innerHTML=html;
  updateProgress();
  if(!search){const first=el.querySelector('.cat-section');if(first)first.classList.add('open')}
}
function toggleItem(k){const items=activeItems();if(!items[k])return;const total=items[k].qty||1;const me=currentUser();if(!items[k].packedBy)items[k].packedBy={};const cur=(typeof items[k].packedBy[me]==='number')?items[k].packedBy[me]:(items[k].packed||0);if(cur<total){items[k].packedBy[me]=total}else{items[k].packedBy[me]=0}items[k].packed=items[k].packedBy[me];items[k].checked=items[k].packedBy[me]>=total;save();const t=activeTrip();if(t)sbSaveTrip(t);renderPack();if(allPacked())document.getElementById('modalBg').classList.add('show')}
function packedQty(k,dir){const items=activeItems();if(!items[k])return;const total=items[k].qty||1;const me=currentUser();if(!items[k].packedBy)items[k].packedBy={};if(typeof items[k].packedBy[me]!=='number')items[k].packedBy[me]=items[k].packed||0;items[k].packedBy[me]=Math.max(0,Math.min(total,items[k].packedBy[me]+dir));items[k].packed=items[k].packedBy[me];items[k].checked=items[k].packedBy[me]>=total;save();const t=activeTrip();if(t)sbSaveTrip(t);renderPack();if(allPacked())document.getElementById('modalBg').classList.add('show')}
function qtyItem(k,dir){const items=activeItems();if(!items[k])return;items[k].qty=Math.max(1,(items[k].qty||1)+dir);const me=currentUser();if(items[k].packedBy&&typeof items[k].packedBy[me]==='number'&&items[k].packedBy[me]>items[k].qty)items[k].packedBy[me]=items[k].qty;if((items[k].packed||0)>items[k].qty)items[k].packed=items[k].qty;items[k].checked=(items[k].packedBy?items[k].packedBy[me]:items[k].packed)>=items[k].qty;save();const t=activeTrip();if(t)sbSaveTrip(t);renderPack()}
function delItem(k){const items=activeItems();if(!items[k])return;delete items[k];save();const t=activeTrip();if(t)sbSaveTrip(t);renderPack()}
function addItem(catId){const items=activeItems();const inp=document.getElementById(\`add-\${catId}\`);const label=inp.value.trim();if(!label)return;items[\`c-\${Date.now()}\`]={cat:catId,label,checked:false,qty:1,packed:0,auto:false};inp.value='';save();const t=activeTrip();if(t)sbSaveTrip(t);renderPack()}
function allPacked(){const items=activeItems();const ks=Object.keys(items);return ks.length>0&&ks.every(k=>items[k].checked)}
function updateProgress(){
  const items=activeItems();const ks=Object.keys(items);
  const total=ks.length,done=ks.filter(k=>items[k].checked).length;
  const pct=total?Math.round(done/total*100):0;
  document.getElementById('pPct').textContent=pct+'%';
  document.getElementById('pPct').style.color=pct===100?'var(--teal)':'var(--orange)';
  document.getElementById('pFill').style.width=pct+'%';
  document.getElementById('pFill').classList.toggle('done',pct===100);
  document.getElementById('pTitle').textContent=\`\${done} of \${total} packed\`;
  const psT=document.getElementById('psTotal'),psP=document.getElementById('psPacked'),psL=document.getElementById('psLeft');
  if(psT){psT.textContent=total;psP.textContent=done;psL.textContent=total-done}
}
function renderTemplates(){const el=document.getElementById('templateChips');if(!el)return;el.innerHTML=TEMPLATES.map(t=>\`<button class="t-chip" onclick="applyTemplate('\${t.id}')"><span class="t-icon">\${t.icon}</span>\${t.name}</button>\`).join('')}
function filterPack(){renderPack()}
function applyTemplate(id){const t=activeTrip();const items=activeItems();const tpl=TEMPLATES.find(x=>x.id===id);if(!tpl)return;let added=0;tpl.items.forEach(([cat,label,qty])=>{const k=\`tpl-\${id}-\${cat}-\${label}\`;if(!items[k]){items[k]={cat,label,checked:false,qty,packed:0,essential:false,auto:false,fromTemplate:tpl.name};added++}});save();if(t)sbSaveTrip(t);renderPack();if(added)toast(\`Added \${added} items from \${tpl.name} template\`);else toast(\`\${tpl.name} items already in your list\`)}
async function aiSuggest(){const t=activeTrip();const items=activeItems();if(!t&&!Object.keys(items).length){toast('Add some items first');return}const btn=document.getElementById('aiSuggestBtn');if(btn){btn.classList.add('loading');btn.textContent='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.7l-1.9-5.8L4.5 10l5.6-1.4L12 3z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z"/></svg> AI is thinking…'}showLoading('AI Suggest','Generating smart packing list');try{const body={destination:t?\`\${t.city}, \${t.country}\`:'General trip',departDate:t?.depart,returnDate:t?.return,weather:t?.weather};const r=await fetch('/api/suggest-packing',{method:'POST',headers:{'apikey':SB_KEY,'Authorization':\`Bearer \${SB_KEY}\`,'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok){const err=await r.text();throw new Error('AI suggest failed: '+err)}const result=await r.json();hideLoading();if(result.categories&&Array.isArray(result.categories)){let added=0;result.categories.forEach(cat=>{if(cat.items&&Array.isArray(cat.items)){cat.items.forEach(item=>{const k=\`ai-\${Date.now()}-\${Math.random().toString(36).slice(2,6)}\`;const catId=CATS.find(c=>c.name.toLowerCase().replace(' & beauty','').replace(' & meds','')===cat.name?.toLowerCase()?.replace(' & beauty','')?.replace(' & meds',''))?.id||cat.id||'gear';if(!items[k]){items[k]={cat:catId,label:item.label,checked:false,qty:item.qty||1,packed:0,essential:item.essential||false,auto:false,fromTemplate:'AI'};added++}})}});save();if(t)sbSaveTrip(t);renderPack();toast(\`AI added \${added} smart suggestions\`)}else{toast('AI suggestion format unexpected')}}catch(err){hideLoading();autoSuggest();toast('AI suggest unavailable — used weather-based suggestions instead')}if(btn){btn.classList.remove('loading');btn.textContent='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.7l-1.9-5.8L4.5 10l5.6-1.4L12 3z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z"/></svg> AI Suggest — smart packing for your trip'}}

/* Events */
async function fetchEventsForTrip(){const t=activeTrip();if(!t){toast('Set up a trip first');return}showLoading('Finding events','Searching for local events');try{const text=await pplxChat([{role:'user',content:\`What are 5-8 events happening in \${t.city}, \${t.country} in the next 2 weeks? List each as: EVENT NAME | DATE (YYYY-MM-DD) | BRIEF DESCRIPTION. Only real upcoming events.\`}],'You are a travel events assistant. Return only the event list, one per line, in NAME | DATE | DESCRIPTION format. No preamble.');if(!text){toast('Could not fetch events — try again');return}t.events=text;save();sbSaveTrip(t);renderEvents();toast('Events loaded')}catch(e){toast('Events fetch failed')}finally{hideLoading()}}
function renderEvents(){const el=document.getElementById('eventsList');if(!el)return;const t=activeTrip();const raw=t&&t.events?String(t.events):'';if(!raw.trim()){el.innerHTML='<div class="empty-state">No events yet. Tap "Find events" to discover what\\'s happening.</div>';return}const lines=raw.split(/\\r?\\n/).map(s=>s.trim()).filter(s=>s.length>0&&!/^(#|\\*|-{2,})/.test(s));let html='';let count=0;lines.forEach(line=>{const parts=line.split('|').map(s=>s.trim());if(parts.length<2)return;const name=parts[0];const date=parts[1];const desc=parts.slice(2).join(' — ').trim();const dm=date.match(/(\\d{4})-(\\d{2})-(\\d{2})/);let badge='<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><rect x=\\'3\\' y=\\'5\\' width=\\'18\\' height=\\'16\\' rx=\\'2\\'/><path d=\\'M3 9h18M8 3v4M16 3v4M8 14h2M11 14h2M14 14h2M8 17h2M11 17h2\\'/></svg>';if(dm){const mn=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];const mi=parseInt(dm[2])-1;if(mi>=0&&mi<12)badge=\`<div class="ev-d">\${parseInt(dm[3])}</div><div class="ev-m">\${mn[mi]}</div>\`}else{badge=\`<div class="ev-d"><svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><rect x=\\'3\\' y=\\'5\\' width=\\'18\\' height=\\'16\\' rx=\\'2\\'/><path d=\\'M3 9h18M8 3v4M16 3v4M8 14h2M11 14h2M14 14h2M8 17h2M11 17h2\\'/></svg></div><div class="ev-m">\${date.slice(0,6)}</div>\`}html+=\`<div class="event-card"><div class="ev-date">\${badge}</div><div class="ev-body"><div class="ev-title">\${name}</div><div class="ev-desc">\${desc||''}</div><div class="ev-cite">\${date}</div></div></div>\`;count++});el.innerHTML=count?html:'<div class="empty-state">No events parsed.</div>'}

/* Recommendations */
async function fetchRecsForTrip(){const t=activeTrip();if(!t){toast('Set up a trip first');return}showLoading('Getting recs','Finding activities for your trip');try{const wx=t.weather?\` Weather: \${t.weather.current?.temperature_2m}°C, \${W_LABEL[t.weather.current?.weather_code]||'mixed'}.\`:'';const text=await pplxChat([{role:'user',content:\`Give me 5 activity recommendations for a trip to \${t.city}, \${t.country}.\${wx} List each as: ACTIVITY | WHY RECOMMENDED | DURATION. Be specific and practical.\`}],'You are a travel recommendation assistant. Return exactly 5 recommendations, one per line, in NAME | REASON | DURATION format. No preamble.');if(!text){toast('Could not fetch recommendations — try again');return}t.recommendations=text;save();sbSaveTrip(t);renderRecs();toast('Recommendations loaded')}catch(e){toast('Recs fetch failed')}finally{hideLoading()}}
function renderRecs(){const el=document.getElementById('recsList');if(!el)return;const t=activeTrip();const raw=t&&t.recommendations?String(t.recommendations):'';if(!raw.trim()){el.innerHTML='<div class="empty-state">No recommendations yet. Tap "Get recs" for activity ideas.</div>';return}const lines=raw.split(/\\r?\\n/).map(s=>s.trim()).filter(s=>s.length>0&&!/^(#|\\*|-{2,})/.test(s));const icons=['<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><circle cx=\\'12\\' cy=\\'12\\' r=\\'9\\'/><circle cx=\\'12\\' cy=\\'12\\' r=\\'5\\'/><circle cx=\\'12\\' cy=\\'12\\' r=\\'1.5\\'/></svg>','<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><circle cx=\\'12\\' cy=\\'12\\' r=\\'9\\'/><circle cx=\\'12\\' cy=\\'12\\' r=\\'6\\'/><circle cx=\\'12\\' cy=\\'12\\' r=\\'2\\'/></svg>','<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M7 4h5v9H7zM12 4h5v9h-5zM6 13h12v6a2 2 0 01-2 2H8a2 2 0 01-2-2v-6zM7 16h4M14 16h3\\'/></svg>','<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M3 21h18M4 10l8-5 8 5M5 10v9M9 10v9M15 10v9M19 10v9M3 8l9-4 9 4\\'/></svg>','<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M2 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 7c2-2 4-2 6 0s4 2 6 0 4-2 6 0\\'/></svg>','<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M12 3a9 9 0 100 18c1.5 0 2-1 2-2 0-1.5-1-1.5-1-3 0-1 .8-2 2-2h2a4 4 0 004-4 9 9 0 00-9-7z\\'/><circle cx=\\'7.5\\' cy=\\'11.5\\' r=\\'1\\'/><circle cx=\\'9.5\\' cy=\\'7.5\\' r=\\'1\\'/><circle cx=\\'14.5\\' cy=\\'7.5\\' r=\\'1\\'/></svg>','<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><circle cx=\\'6\\' cy=\\'17\\' r=\\'4\\'/><circle cx=\\'18\\' cy=\\'17\\' r=\\'4\\'/><path d=\\'M6 17l5-8h5l3 8M11 9l2-3h3M9 9h3\\'/></svg>','<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M10 3v18M14 3v18M8 7l4 2 4-2M8 11l4 2 4-2M8 15l4 2 4-2\\'/></svg>','<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M6 6h15l-1.5 9h-12zM6 6l-.5-3H3\\'/><circle cx=\\'9\\' cy=\\'20\\' r=\\'1\\'/><circle cx=\\'18\\' cy=\\'20\\' r=\\'1\\'/></svg>','<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><path d=\\'M5 3h14l-2 8a5 5 0 01-10 0L5 3zM12 14v6M9 20h6\\'/></svg>'];let html='';let count=0;lines.forEach((line,i)=>{const parts=line.split('|').map(s=>s.trim());if(parts.length<2)return;const name=parts[0];const reason=parts[1];const dur=parts[2]||'';html+=\`<div class="reco-card"><div class="reco-icon">\${icons[i%icons.length]}</div><div class="reco-body"><div class="reco-title">\${name}</div><div class="reco-desc">\${reason}</div>\${dur?\`<div class="reco-dur"><svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><circle cx=\\'12\\' cy=\\'13\\' r=\\'8\\'/><path d=\\'M12 13V9M9 2h6M12 5v1\\'/></svg> \${dur}</div>\`:''}</div></div>\`;count++});el.innerHTML=count?html:'<div class="empty-state">No recs parsed.</div>'}

/* Calendar */
let calMonth=new Date().getMonth(),calYear=new Date().getFullYear();
function renderCalendar(){const el=document.getElementById('calendarGrid');if(!el)return;const mn=['January','February','March','April','May','June','July','August','September','October','November','December'];const dn=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];let html=\`<div class="cal-head"><button class="cal-nav-btn" onclick="calNav(-1)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button><div class="cal-title">\${mn[calMonth]} \${calYear}</div><button class="cal-nav-btn" onclick="calNav(1)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></button></div><div class="cal-grid">\`;dn.forEach(d=>html+=\`<div class="cal-dow">\${d}</div>\`);const firstDay=new Date(calYear,calMonth,1).getDay();const daysInMonth=new Date(calYear,calMonth+1,0).getDate();for(let i=0;i<firstDay;i++)html+='<div class="cal-day empty"></div>';const t=activeTrip();const tripStart=t&&t.depart?new Date(t.depart+'T00:00'):null;const tripEnd=t&&t.return?new Date(t.return+'T00:00'):null;const todayStr=new Date().getFullYear()+'-'+String(new Date().getMonth()+1).padStart(2,'0')+'-'+String(new Date().getDate()).padStart(2,'0');const eventDates={};if(t&&t.events){String(t.events).split(/\\r?\\n/).forEach(ln=>{const m=ln.match(/(\\d{4})-(\\d{2})-(\\d{2})/);if(m)eventDates[m[1]+'-'+m[2]+'-'+m[3]]=true})}for(let d=1;d<=daysInMonth;d++){const ds=calYear+'-'+String(calMonth+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');const dt=new Date(calYear,calMonth,d);let cls='cal-day';if(ds===todayStr)cls+=' today';if(tripStart&&tripEnd&&dt>=tripStart&&dt<=tripEnd)cls+=' trip-day';else if(tripStart&&ds===t.depart)cls+=' trip-day';else if(tripEnd&&ds===t.return)cls+=' trip-day';if(eventDates[ds])cls+=' has-event';html+=\`<div class="\${cls.trim()}">\${d}</div>\`}html+='</div>';el.innerHTML=html}
function calNav(dir){calMonth+=dir;if(calMonth<0){calMonth=11;calYear--}if(calMonth>11){calMonth=0;calYear++}renderCalendar()}

/* Chat */
function renderChat(){const box=document.getElementById('chatMessages');if(!box)return;const t=activeTrip();if(!t){box.innerHTML='<div class="empty-state">Set up a trip first, then ask me anything about it.</div>';return}if(!Array.isArray(t.chatHistory))t.chatHistory=[];if(!t.chatHistory.length){box.innerHTML='<div class="empty-state" id="chatEmpty">Ask me anything about your trip — packing, weather, events, restaurants, itinerary…</div>';return}box.innerHTML=t.chatHistory.map(m=>\`<div class="msg \${m.role==='user'?'user':'assistant'}"><div class="bubble">\${m.content.replace(/</g,'&lt;')}</div></div>\`).join('');box.scrollTop=box.scrollHeight}
async function sendChat(){const inp=document.getElementById('chatInput');const box=document.getElementById('chatMessages');if(!inp||!box)return;const text=inp.value.trim();if(!text)return;const t=activeTrip();if(!t){toast('Set up a trip first');return}if(!Array.isArray(t.chatHistory))t.chatHistory=[];const empty=box.querySelector('#chatEmpty');if(empty)empty.remove();t.chatHistory.push({role:'user',content:text});box.insertAdjacentHTML('beforeend',\`<div class="msg user"><div class="bubble">\${text.replace(/</g,'&lt;')}</div></div>\`);inp.value='';box.scrollTop=box.scrollHeight;save();const typing=box.querySelector('.typing-bubble');if(typing)typing.remove();box.insertAdjacentHTML('beforeend','<div class="msg assistant"><div class="bubble typing-bubble">Thinking…</div></div>');box.scrollTop=box.scrollHeight;let sys='You are a helpful trip planning assistant. Keep responses concise and practical. The user is planning a trip';if(t.city)sys+=\` to \${t.city}, \${t.country}\`;if(t.depart)sys+=\` departing \${t.depart}\`;if(t.return)sys+=\` returning \${t.return}\`;if(t.weather){const wx=t.weather;sys+=\`. Current weather: \${Math.round(wx.current?.temperature_2m)}°C, \${W_LABEL[wx.current?.weather_code]||'mixed'}\`}sys+='.';try{const reply=await pplxChat(t.chatHistory.slice(-12),sys);const tb=box.querySelector('.typing-bubble');if(tb)tb.parentElement.remove();if(!reply){toast('AI could not respond');return}t.chatHistory.push({role:'assistant',content:reply});box.insertAdjacentHTML('beforeend',\`<div class="msg assistant"><div class="bubble">\${reply.replace(/</g,'&lt;')}</div></div>\`);box.scrollTop=box.scrollHeight;save();sbSaveTrip(t)}catch(e){const tb=box.querySelector('.typing-bubble');if(tb)tb.parentElement.remove();toast('Chat error')}}

/* Flight search */
async function searchFlights(){const fromEl=document.getElementById('fromInput'),toEl=document.getElementById('toInput');if(!fromEl||!toEl){toast('Flight search inputs not found');return}const from=fromEl.value.trim().toUpperCase(),to=toEl.value.trim().toUpperCase();if(!from||!to){toast('Enter origin and destination airport codes');return}const t=activeTrip();const depDate=t&&t.depart?t.depart:'soon';flightSearchState={from,to,date:depDate,offset:0,results:[],hasMore:false};await runFlightSearch(true)}
async function refreshFlights(){if(!flightSearchState.from||!flightSearchState.to){toast('Search flights first');return}flightSearchState.offset=0;flightSearchState.results=[];flightSearchState.hasMore=false;await runFlightSearch(true)}
async function loadMoreFlights(){if(!flightSearchState.from||!flightSearchState.to){toast('Search flights first');return}await runFlightSearch(false)}
async function runFlightSearch(clear){const{from,to,date}=flightSearchState;const resEl=document.getElementById('flightResults'),moreBtn=document.getElementById('loadMoreFlightsBtn'),rfb=document.getElementById('refreshFlightsBtn');if(clear&&resEl)resEl.innerHTML='<div class="empty-state">Searching flights...</div>';if(moreBtn)moreBtn.style.display='none';let flights=[];try{const r=await fetch('/api/flights/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from,to,date,offset:flightSearchState.offset})});if(r.ok){const d=await r.json();flights=Array.isArray(d.flights)?d.flights:(Array.isArray(d)?d:[]);flightSearchState.hasMore=!!d.has_more}else{flights=await flightsFallback(from,to,date)}}catch{flights=await flightsFallback(from,to,date)}if(!flights.length&&flightSearchState.offset===0){if(resEl)resEl.innerHTML='<div class="empty-state">No flights found. Try again.</div>';if(moreBtn)moreBtn.style.display='none';if(rfb)rfb.style.display='inline-flex';return}renderFlightCards(flights,clear);flightSearchState.results=flightSearchState.results.concat(flights);flightSearchState.offset+=flights.length;if(moreBtn)moreBtn.style.display=flightSearchState.hasMore?'block':'none';if(rfb)rfb.style.display='inline-flex'}
async function flightsFallback(from,to,date){const text=await pplxChat([{role:'user',content:'Find 5 real commercial flights from '+from+' to '+to+' on '+date+'. List each as: FLIGHT NUMBER | AIRLINE | DEPARTURE TIME | ARRIVAL TIME | DURATION | APPROX PRICE USD. Only real airlines and realistic times.'}],'You are a flight search assistant. Return flight options in the exact format requested. No preamble.');if(!text)return[];return text.split(/\\r?\\n/).map(s=>s.trim()).filter(s=>s.length>0&&!/^(#|\\*|-{2,})/.test(s)).map(line=>{const p=line.split('|').map(s=>s.trim());if(p.length<3)return null;return{flightNumber:p[0],airline:p[1],departureTime:p[2],arrivalTime:p[3]||'',duration:p[4]||'',price:p[5]||''}}).filter(Boolean)}
function renderFlightCards(flights,clear){const resEl=document.getElementById('flightResults');if(!resEl)return;const{from,to}=flightSearchState;let html='';flights.forEach(f=>{const num=(f.flightNumber||f.flight_number||'').toString();const airline=(f.airline||'').toString();const depT=(f.departureTime||f.depTime||'').toString();const arrT=(f.arrivalTime||f.arrival_time||'').toString();const dur=(f.duration||'').toString();const price=(f.price||'').toString();const status=(f.status||'scheduled').toString();const stClass='st-'+status.toLowerCase().replace(/[^a-z-]/g,'');const esc=s=>s.replace(/'/g,"\\'");html+='<div class="flight-card"><div class="fl-route"><span>'+from+'</span><span class="fl-arrow">\\u2192</span><span>'+to+'</span></div><div class="fl-meta"><span class="fl-num">'+num+'</span><span>'+airline+'</span><span class="fl-status-badge '+stClass+'"><span class="fl-status-dot"></span>'+status+'</span></div><div class="fl-times">'+(depT?'<span class="fl-t">'+depT+'</span>':'')+'<span class="fl-dur">'+dur+'</span>'+(arrT?'<span class="fl-t">'+arrT+'</span>':'')+'</div><div class="fl-footer">'+(price?'<span class="fl-price">'+price+'</span>':'<span></span>')+'<button class="btn btn-ghost track-btn" onclick="trackFlight(\\''+esc(airline)+'\\',\\''+esc(num)+'\\',\\''+esc(flightSearchState.date||'')+'\\')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>Track</button></div></div>'});if(clear)resEl.innerHTML=html;else resEl.insertAdjacentHTML('beforeend',html)}
async function trackFlight(airline,flightNumber,date){const modal=document.getElementById('trackModal'),body=document.getElementById('trackModalBody');if(!modal||!body)return;body.innerHTML='<div class="empty-state">Tracking live status...</div>';modal.classList.add('show');try{let data=null;const r=await fetch('/api/flights/track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({airline,flightNumber,date})});if(r.ok)data=await r.json();if(!data||!data.flight){const text=await pplxChat([{role:'user',content:'What is the current live status of flight '+airline+' '+flightNumber+' on '+date+'? Include: STATUS, DEPARTURE TIME, GATE, TERMINAL, ARRIVAL TIME, DELAY MINUTES.'}],'You are a flight tracking assistant. Return the status concisely.');data={flight:{text:text||'Status unavailable'}}}renderTrackPanel(data.flight||data,airline,flightNumber)}catch{body.innerHTML='<div class="empty-state">Tracking unavailable. Try again.</div>'}}
function renderTrackPanel(s,airline,flightNumber){const body=document.getElementById('trackModalBody');if(!body)return;const status=(s.status||'Unknown').toString();const dep=(s.departureTime||s.departure_time||'').toString();const arr=(s.arrivalTime||s.arrival_time||'').toString();const gate=(s.gate||'').toString();const terminal=(s.terminal||'').toString();const delay=(s.delayMinutes||s.delay_minutes||0);const col=/delay|late/i.test(status)?'var(--orange)':/cancel/i.test(status)?'var(--red)':/board|on.?time|departed|arrived|landed|sched/i.test(status)?'var(--green)':'var(--muted)';body.innerHTML='<div class="track-panel"><div class="track-head"><div><div class="track-num">'+airline+' '+flightNumber+'</div><div class="track-status" style="color:'+col+'">'+status+(delay>0?' · '+delay+'m delay':'')+'</div></div></div><div class="track-grid"><div class="track-cell"><div class="tc-lbl">Departure</div><div class="tc-val">'+(dep||'\\u2014')+'</div>'+(terminal?'<div class="tc-sub">Terminal '+terminal+'</div>':'')+(gate?'<div class="tc-sub">Gate '+gate+'</div>':'')+'</div><div class="track-cell"><div class="tc-lbl">Arrival</div><div class="tc-val">'+(arr||'\\u2014')+'</div></div></div>'+(s.text?'<div class="track-raw">'+(s.text).replace(/</g,'&lt;')+'</div>':'')+'</div>'}
function closeTrackModal(){const m=document.getElementById('trackModal');if(m)m.classList.remove('show')}
let flightSearchState={from:'',to:'',date:'',offset:0,results:[],hasMore:false}

/* Shared trips */
async function searchUserTrips(){const inp=document.getElementById('userSearchInput');const list=document.getElementById('userTripsList');if(!list)return;const username=inp?inp.value.trim():'';list.innerHTML='<div class="empty-state">Searching…</div>';try{const trips=await sbLoadTrips();let filtered=trips;if(username){filtered=trips.filter(t=>{const cb=(t.createdBy||t.created_by||'').toLowerCase();return cb.includes(username.toLowerCase())})}if(!filtered.length){list.innerHTML='<div class="empty-state">No trips found for this user.</div>';return}list.innerHTML=filtered.map(t=>{const initials=(t.city||'?')[0];const dates=[];if(t.depart)dates.push(fmtDate(t.depart));if(t.return)dates.push(fmtDate(t.return));return \`<div class="shared-trip" onclick="selectTrip('\${t.id}')"><div class="st-avatar">\${initials}</div><div class="st-info"><div class="st-city">\${t.city||'Unknown'}, \${t.country||''}</div><div class="st-meta">\${dates.join(' — ')||'No dates'}\${t.createdBy?' · '+t.createdBy:''}</div></div></div>\`}).join('')}catch(e){list.innerHTML='<div class="empty-state">Search failed — try again.</div>'}}
async function shareTrip(){const t=activeTrip();if(!t){toast('Set a trip first');return}const inp=document.getElementById('shareUserInput');const u=inp?inp.value.trim():'';if(!u){toast('Enter a username to share with');return}try{const r=await fetch('/api/trips/share',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tripId:t.id,username:u})});if(!r.ok){toast('Share failed');return}if(!Array.isArray(t.sharedWith))t.sharedWith=[];if(!t.sharedWith.includes(u))t.sharedWith.push(u);save();sbSaveTrip(t);renderSharedWith();if(inp)inp.value='';toast('Shared with '+u)}catch{toast('Share failed')}}
function renderSharedWith(){const el=document.getElementById('sharedWithList');if(!el)return;const t=activeTrip();if(!t||!Array.isArray(t.sharedWith)||!t.sharedWith.length){el.innerHTML='';return}el.innerHTML='<div style="margin-bottom:6px;font-weight:600">Shared with:</div>'+t.sharedWith.map(u=>'<span class="share-chip">'+u+'</span>').join(' ')}

/* Closet */
function handleClosetUpload(e){const closet=activeCloset();const files=[...e.target.files];files.forEach(file=>{const reader=new FileReader();reader.onload=ev=>{closet.push({id:'c'+Date.now()+Math.random().toString(36).slice(2,6),src:ev.target.result,selected:false});save();renderCloset()};reader.readAsDataURL(file)});if(files.length)toast(\`Added \${files.length} photo\${files.length>1?'s':''}\`)}
function renderCloset(){const grid=document.getElementById('closetGrid');const closet=activeCloset();if(!closet.length){grid.innerHTML='<div class="empty-state" style="grid-column:1/-1;">No closet photos yet — upload above ↑</div>';return}grid.innerHTML=closet.map(c=>\`<div class="photo-cell \${c.selected?'selected':''}" onclick="toggleCloset('\${c.id}')"><img src="\${c.src}" alt="closet"><div class="pc-badge"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div><button class="pc-del" onclick="event.stopPropagation();delCloset('\${c.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button></div>\`).join('')}
function toggleCloset(id){const closet=activeCloset();const c=closet.find(x=>x.id===id);if(!c)return;c.selected=!c.selected;save();renderCloset();toast(c.selected?'Added to trip':'Removed')}
function delCloset(id){const closet=activeCloset();const t=activeTrip();if(t){t.closet=t.closet.filter(x=>x.id!==id)}else{S.localCloset=S.localCloset.filter(x=>x.id!==id)}save();renderCloset()}

/* Style */
const STYLE_TAGS=['Casual','Formal','Beach','Street','Athletic','Evening','Business'];let activeTag='Casual';
function handleStyleUpload(e){const style=activeStyle();const files=[...e.target.files];files.forEach(file=>{const reader=new FileReader();reader.onload=ev=>{style.push({id:'s'+Date.now()+Math.random().toString(36).slice(2,6),src:ev.target.result,tag:activeTag,note:''});save();renderStyle()};reader.readAsDataURL(file)});if(files.length)toast(\`Added \${files.length} photo\${files.length>1?'s':''}\`)}
function renderStyle(){const tagsEl=document.getElementById('styleTags');if(tagsEl)tagsEl.innerHTML=STYLE_TAGS.map(t=>\`<button class="stag \${t===activeTag?'active':''}" onclick="setTag('\${t}')">\${t}</button>\`).join('');const grid=document.getElementById('styleGrid');const style=activeStyle();if(!style.length){grid.innerHTML='<div class="empty-state" style="grid-column:1/-1;">No style photos yet — upload above ↑</div>';return}grid.innerHTML=style.map(s=>\`<div class="style-card"><img src="\${s.src}" alt="outfit"><div class="sc-body"><div class="sc-tag">\${s.tag}</div><input class="sc-inp" placeholder="Note…" value="\${(s.note||'').replace(/"/g,'&quot;')}" onchange="editStyleNote('\${s.id}',this.value)"></div><div class="sc-foot"><button class="sc-del" onclick="delStyle('\${s.id}')">Remove</button><span style="font-size:.65rem;color:var(--muted);">\${s.tag}</span></div></div>\`).join('')}
function setTag(t){activeTag=t;renderStyle()}
function editStyleNote(id,note){const style=activeStyle();const s=style.find(x=>x.id===id);if(s){s.note=note;save()}}
function delStyle(id){const style=activeStyle();const t=activeTrip();if(t){t.style=t.style.filter(x=>x.id!==id)}else{S.localStyle=S.localStyle.filter(x=>x.id!==id)}save();renderStyle()}

/* Drag & drop */
function setupDnD(uid,fid){const el=document.getElementById(uid);if(!el)return;el.addEventListener('dragover',e=>{e.preventDefault();el.classList.add('drag')});el.addEventListener('dragleave',()=>el.classList.remove('drag'));el.addEventListener('drop',e=>{e.preventDefault();el.classList.remove('drag');const inp=document.getElementById(fid);inp.files=e.dataTransfer.files;inp.dispatchEvent(new Event('change'))})}
setupDnD('closetUpload','closetFile');setupDnD('styleUpload','styleFile');

/* Sync */
function renderSync(){document.getElementById('sbUrl').value=S.config.url||'';document.getElementById('sbKey').value=S.config.key||'';const un=document.getElementById('syncUserName');if(un){un.textContent=currentUser()||'—'}const st=document.getElementById('syncStatus');if(sbConfigured()){st.className='sync-status connected';document.getElementById('syncStatusText').textContent='Connected — '+S.trips.length+' trips';document.getElementById('syncTripsCount').textContent=S.trips.length+' trips synced'}else{st.className='sync-status disconnected';document.getElementById('syncStatusText').textContent='Not connected';document.getElementById('syncTripsCount').textContent=''}renderSharedWith()}
async function syncConnect(){const url=document.getElementById('sbUrl').value.trim().replace(/\\/$/,'');const key=document.getElementById('sbKey').value.trim();if(!url||!key){toast('Enter URL and key');return}S.config={url,key};save();showLoading('Syncing…','Loading trips from Supabase');try{const trips=await sbLoadTrips();const shared=await sbLoadSharedTrips().catch(()=>[]);const all=[...trips,...shared];hideLoading();const sbIds=new Set(all.map(t=>t.id));S.trips=[...S.trips.filter(t=>!sbIds.has(t.id)),...all];if(!S.activeId&&S.trips.length)S.activeId=S.trips[0].id;save();renderSync();renderTripsList();if(activeTrip())renderTripSummary();toast(\`Synced \${trips.length} trips\`)}catch{hideLoading();toast('Sync failed — check URL and key')}}

/* Screenshot OCR */
const AIRLINES={'JL':'JAL','NH':'ANA','AA':'American Airlines','UA':'United Airlines','DL':'Delta','WN':'Southwest','BA':'British Airways','AF':'Air France','LH':'Lufthansa','KL':'KLM','EK':'Emirates','QR':'Qatar Airways','SQ':'Singapore Airlines','CX':'Cathay Pacific','AC':'Air Canada','QF':'Qantas','NZ':'Air New Zealand','VS':'Virgin Atlantic','FI':'Icelandair','SK':'SAS','IB':'Iberia','AZ':'ITA Airways','KE':'Korean Air','OZ':'Asiana Airlines','CA':'Air China','MU':'China Eastern','CZ':'China Southern','TG':'Thai Airways','MH':'Malaysia Airlines','PR':'Philippine Airlines','5J':'Cebu Pacific','FJ':'Fiji Airways','HA':'Hawaiian Airlines','B6':'JetBlue','NK':'Spirit','AS':'Alaska Airlines','WS':'WestJet'};
async function handleScanScreenshot(e){const file=e.target.files?.[0];if(!file)return;showLoading('Scanning…','AI reading your screenshot');try{const reader=new FileReader();const base64=await new Promise((res,rej)=>{reader.onload=()=>res(reader.result);reader.onerror=rej;reader.readAsDataURL(file)});const fnUrl='/api/scan-trip';showLoading('Analyzing…','AI vision parsing flight details');const r=await fetch(fnUrl,{method:'POST',headers:{'apikey':SB_KEY,'Authorization':\`Bearer \${SB_KEY}\`,'Content-Type':'application/json'},body:JSON.stringify({image:base64})});if(!r.ok){const err=await r.text();throw new Error('Scan failed: '+err)}const result=await r.json();if(result.error)throw new Error(result.error);hideLoading();if(result.trip){const t=result.trip;currentDest={name:t.city,country:t.country,country_code:t.cc,latitude:t.lat,longitude:t.lon,timezone:t.tz};destInput.value=\`\${t.city}, \${t.country}\`;document.getElementById('departDate').value=t.depart||'';document.getElementById('returnDate').value=t.return||'';document.getElementById('airline').value=t.airline||'';document.getElementById('flightNum').value=t.flightNum||'';document.getElementById('flightTime').value=t.flightTime||'';document.getElementById('bookingRef').value=t.bookingRef||'';const newTrip={id:t.id,city:t.city,country:t.country,cc:t.cc,lat:t.lat,lon:t.lon,tz:t.tz,depart:t.depart,return:t.return,airline:t.airline,flightNum:t.flightNum,flightTime:t.flightTime,bookingRef:t.bookingRef,items:t.items,closet:[],style:t.style||[],weather:t.weather,events:null,recommendations:null,chatHistory:[],source:'screenshot',rawOcr:null,createdBy:currentUser()};S.trips.push(newTrip);S.activeId=t.id;save();renderTripSummary();renderTripsList();renderPack();fetchWeather();toast('Trip scanned & saved — packing list ready')}}catch(err){hideLoading();toast('Scan failed — try again or fill in manually');console.error('Scan error:',err)}e.target.value=''}

/* Init */
async function initApp(){
  if(sbConfigured()){const trips=await sbLoadTrips().catch(()=>[]);const shared=await sbLoadSharedTrips().catch(()=>[]);const all=[...(trips||[]),...shared];if(all.length){const sbIds=new Set(all.map(t=>t.id));S.trips=[...S.trips.filter(t=>!sbIds.has(t.id)),...all];if(!S.activeId&&S.trips.length)S.activeId=S.trips[0].id;save()}}
  if(S.activeId&&activeTrip()){const t=activeTrip();currentDest={name:t.city,country:t.country,country_code:t.cc,latitude:t.lat,longitude:t.lon,timezone:t.tz};destInput.value=\`\${t.city}, \${t.country}\`;document.getElementById('departDate').value=t.depart||'';document.getElementById('returnDate').value=t.return||'';document.getElementById('airline').value=t.airline||'';document.getElementById('flightNum').value=t.flightNum||'';document.getElementById('flightTime').value=t.flightTime||'';document.getElementById('bookingRef').value=t.bookingRef||'';renderTripSummary();if(t.weather)renderWeather()}
  renderTripsList();renderPack();renderCloset();renderStyle();renderSync();renderCalendar();
}
if(checkAuth()){initApp()}else{showAuthGate()}
</script>
</body>
</html>`;
const SCHEMA_SQL = `-- agnamo · trip — Supabase schema
-- Run this in: Dashboard → SQL Editor → New query
-- Then: Settings → API → Exposed schemas → add 'public' (should be default)

CREATE TABLE IF NOT EXISTS public.trips (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city        TEXT,
  country     TEXT,
  cc          TEXT,
  lat         DOUBLE PRECISION,
  lon         DOUBLE PRECISION,
  tz          TEXT,
  depart      DATE,
  return_date DATE,
  airline     TEXT,
  flight_num  TEXT,
  flight_time TEXT,
  booking_ref TEXT,
  items       JSONB DEFAULT '{}'::jsonb,
  closet      JSONB DEFAULT '[]'::jsonb,
  style        JSONB DEFAULT '[]'::jsonb,
  weather     JSONB,
  source      TEXT DEFAULT 'manual',
  raw_ocr     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON public.trips FOR ALL TO anon USING (true) WITH CHECK (true);
`;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    try{env=storageEnv(env);await initializeStore(env)}catch(error){return json({error:'D1 registry storage is unavailable. Existing records have been preserved.'},503)}
    const appResponse=await handleTripApp(request,env);
    if(appResponse)return appResponse;
    const providerRoutes=['/api/chat','/api/agents/run','/api/flights/search','/api/flights/track','/api/scan-trip','/api/suggest-packing'];
    if (providerRoutes.includes(path) && request.method !== 'OPTIONS') {
      const session=await toolSession(request,env);
      if(!session)return json({error:'Sign in to use provider tools'},401);
      if(!isAdmin(env,session.user))return json({error:'Use your approved integration group in Trip AI'},403);
    }
    const photoResponse = await handlePhotoTools(request, env);
    if (photoResponse) return photoResponse;
    const toolResponse = await handleTripTools(request, env);
    if (toolResponse) return toolResponse;

    // Resolve env at request time
    const DEEPSEEK_KEY = env?.DEEPSEEK_KEY || '';
    const CF_ACCOUNT_ID = env?.CF_ACCOUNT_ID || '';
    const CF_AIG_GATEWAY = env?.CF_AIG_GATEWAY || 'default';
    const CF_AIG_TOKEN = env?.CF_AIG_TOKEN || '';
    const SB_URL = env?.SB_URL || '';
    const SB_KEY = env?.SB_SERVICE_KEY || '';
    const AIG_DEEPSEEK = `https://gateway.ai.cloudflare.com/v1/${CF_ACCOUNT_ID}/${CF_AIG_GATEWAY}/deepseek/chat/completions`;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    // ─── AI Gateway → DeepSeek ───────────────────────────────────────────────
    async function callDeepSeek(messages, opts = {}) {
      const { max_tokens = 2000, temperature = 0.3, json_mode = false } = opts;
      if (!CF_ACCOUNT_ID) throw new Error('CF_ACCOUNT_ID not set — AI Gateway unavailable');
      const headers = { 'Content-Type': 'application/json' };
      if (DEEPSEEK_KEY) headers['Authorization'] = `Bearer ${DEEPSEEK_KEY}`;
      if (CF_AIG_TOKEN) headers['cf-aig-authorization'] = `Bearer ${CF_AIG_TOKEN}`;
      const body = { model: 'deepseek-v4-pro', messages, max_tokens, temperature };
      if (json_mode) body.response_format = { type: 'json_object' };
      const res = await fetch(AIG_DEEPSEEK, { method: 'POST', headers, body: JSON.stringify(body) });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`DeepSeek ${res.status}: ${detail || res.statusText}`);
      }
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    }

    // ─── /api/chat (Perplexity proxy) ────────────────────────────────────────
    if (path === '/api/chat' && request.method === 'POST') {
      try {
        const body = await request.json();
        const payload = { model: 'sonar', messages: [] };
        if (body.messages) {
          payload.messages = body.messages;
        }
        const pplxKey = env.PPLX_KEY || '';
        if (!pplxKey) return json({ error: 'PPLX_KEY not configured' }, 500);
        const res = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + pplxKey },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const detail = await res.text().catch(() => '');
          return json({ error: 'Perplexity ' + res.status + ': ' + detail }, res.status);
        }
        const data = await res.json();
        return json(data);
      } catch (err) {
        return json({ error: err.message || 'Chat failed' }, 500);
      }
    }
    // ─── GET /api/agents/:name — fetch agent SOUL.md or user context from R2 ───
    if (path.startsWith('/api/agents/') && request.method === 'GET') {
      try {
        const name = path.split('/api/agents/')[1];
        const validNames = ['lux', 'travel-guide-SOUL', 'research-SOUL', 'planning-SOUL'];
        if (!validNames.includes(name)) return json({ error: 'Invalid agent file' }, 400);
        const obj = await env.trip_agents.get(name + '.md');
        if (!obj) return json({ error: 'File not found' }, 404);
        const text = await obj.text();
        return json({ name, content: text });
      } catch (err) {
        return json({ error: err.message }, 500);
      }
    }
    // ─── POST /api/agents/run — run all 3 agents in parallel via Perplexity ───
    if (path === '/api/agents/run' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { query, tripContext } = body;
        if (!query) return json({ error: 'Query required' }, 400);

        // Load all context files from R2 in parallel
        const [luxRes, guideRes, researchRes, planningRes] = await Promise.all([
          env.trip_agents.get('lux.md'),
          env.trip_agents.get('travel-guide-SOUL.md'),
          env.trip_agents.get('research-SOUL.md'),
          env.trip_agents.get('planning-SOUL.md'),
        ]);

        const userCtx = luxRes ? await luxRes.text() : '';
        const guideSoul = guideRes ? await guideRes.text() : '';
        const researchSoul = researchRes ? await researchRes.text() : '';
        const planningSoul = planningRes ? await planningRes.text() : '';

        const tripStr = tripContext ? JSON.stringify(tripContext).substring(0, 2000) : '';
        const pplxKey = env.PPLX_KEY || '';
        if (!pplxKey) return json({ error: 'PPLX_KEY not configured' }, 500);

        // Build 3 agent payloads
        const agents = [
          { name: 'travel-guide', soul: guideSoul, system: guideSoul + '\n\n## User Context\n' + userCtx + '\n\n## Trip Context\n' + tripStr },
          { name: 'research', soul: researchSoul, system: researchSoul + '\n\n## User Context\n' + userCtx + '\n\n## Trip Context\n' + tripStr },
          { name: 'planning', soul: planningSoul, system: planningSoul + '\n\n## User Context\n' + userCtx + '\n\n## Trip Context\n' + tripStr },
        ];

        // Run all 3 in parallel
        const results = await Promise.all(agents.map(async (agent) => {
          try {
            const res = await fetch('https://api.perplexity.ai/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + pplxKey },
              body: JSON.stringify({
                model: 'sonar',
                messages: [
                  { role: 'system', content: agent.system },
                  { role: 'user', content: query },
                ],
              }),
            });
            if (!res.ok) return { agent: agent.name, error: 'Perplexity ' + res.status };
            const data = await res.json();
            return { agent: agent.name, content: data.choices?.[0]?.message?.content?.trim() || '' };
          } catch (e) {
            return { agent: agent.name, error: e.message };
          }
        }));

        return json({ results, query, tripContext: !!tripContext });
      } catch (err) {
        return json({ error: err.message }, 500);
      }
    }
    // ─── POST /api/flights/search — search flights via Perplexity with pagination ───
    if (path === '/api/flights/search' && request.method === 'POST') {
      try {
        const { from, to, date, offset } = await request.json();
        if (!from || !to || !date) return json({ error: 'from, to, date required' }, 400);
        const pageOffset = Math.max(0, parseInt(offset) || 0);
        const pplxKey = env.PPLX_KEY || '';
        if (!pplxKey) return json({ error: 'PPLX_KEY not configured' }, 500);
        const sysPrompt = 'You are a real-time flight search assistant. Return ONLY a JSON array (no markdown, no prose, no code fences) of 10-15 real flights from ' + String(from) + ' to ' + String(to) + ' on ' + String(date) + '. Start at result #' + (pageOffset + 1) + ' (offset ' + pageOffset + ') — if offset > 0, skip the first ' + pageOffset + ' flights and return the next batch. Each flight object must have fields: airline (string), flightNumber (string), departureTime (string), arrivalTime (string), aircraft (string), gate (string), status (string: on-time, delayed, cancelled, boarding, scheduled), duration (string), price (string), stops (integer, 0 = nonstop). Use real airline names, real flight numbers, and realistic times for that date and route. Output ONLY the JSON array.';
        const res = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + pplxKey },
          body: JSON.stringify({ model: 'sonar', messages: [{ role: 'system', content: sysPrompt }, { role: 'user', content: 'Search flights from ' + from + ' to ' + to + ' on ' + date + ', offset ' + pageOffset }] }),
        });
        if (!res.ok) return json({ error: 'Perplexity ' + res.status }, 502);
        const data = await res.json();
        const raw = (data.choices?.[0]?.message?.content || '').trim();
        let flights;
        try { flights = JSON.parse(raw); } catch { const m = raw.match(/\[[\s\S]*\]/); try { flights = m ? JSON.parse(m[0]) : []; } catch { flights = []; } }
        if (!Array.isArray(flights)) { const vals = Object.values(flights).filter(v => Array.isArray(v)); flights = vals.length ? vals[0] : []; }
        return json({ flights, offset: pageOffset, has_more: flights.length >= 10 });
      } catch (err) { return json({ error: err.message }, 500); }
    }
    // ─── POST /api/flights/track — live flight status via Perplexity ───
    if (path === '/api/flights/track' && request.method === 'POST') {
      try {
        const { airline, flightNumber, date } = await request.json();
        if (!airline || !flightNumber || !date) return json({ error: 'airline, flightNumber, date required' }, 400);
        const pplxKey = env.PPLX_KEY || '';
        if (!pplxKey) return json({ error: 'PPLX_KEY not configured' }, 500);
        const sysPrompt = 'You are a live flight tracking assistant. Return ONLY a JSON object (no markdown, no prose) with the current real-time status of ' + String(airline) + ' flight ' + String(flightNumber) + ' on ' + String(date) + '. Include fields: airline, flightNumber, status (departed, arrived, delayed, cancelled, scheduled, boarding), departureTime, arrivalTime, gate, terminal, delayMinutes (integer), aircraft, origin, destination. Output ONLY the JSON object.';
        const res = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + pplxKey },
          body: JSON.stringify({ model: 'sonar', messages: [{ role: 'system', content: sysPrompt }, { role: 'user', content: 'Track ' + airline + ' flight ' + flightNumber + ' on ' + date }] }),
        });
        if (!res.ok) return json({ error: 'Perplexity ' + res.status }, 502);
        const data = await res.json();
        const raw = (data.choices?.[0]?.message?.content || '').trim();
        let status;
        try { status = JSON.parse(raw); } catch { const m = raw.match(/\{[\s\S]*\}/); try { status = m ? JSON.parse(m[0]) : {}; } catch { status = {}; } }
        if (!status || typeof status !== 'object') status = {};
        return json({ flight: status });
      } catch (err) { return json({ error: err.message }, 500); }
    }
    // ─── /api/auth ──────────────────────────────────────────────────────────
    if (path === '/api/auth' && request.method === 'POST') {
      try {
        const { user, password } = await request.json();
        const account=typeof user==='string'?knownAccountNames(env).find(name=>name.toLowerCase()===user.trim().toLowerCase())||user:user;
        if (await authenticateTrip(env,account,password)) {
          return json({ valid: true, user:account, token: await issueSession(env, account) });
        }
        return json({ valid: false }, 401);
      } catch (err) {
        return json({ valid: false, error: err.status === 503 ? err.message : 'Authentication failed' }, err.status || 400);
      }
    }
    // ─── GET /api/trips ──────────────────────────────────────────────────────
    if (path === '/api/trips' && request.method === 'GET') {
      try {
        const raw = await env.TRIPS_KV.get('all_trips');
        const trips = raw ? JSON.parse(raw) : [];
        return json(trips);
      } catch (err) {
        return json({ error: err.message }, 500);
      }
    }
    // ─── POST /api/trips ─────────────────────────────────────────────────────
    if (path === '/api/trips' && request.method === 'POST') {
      try {
        const trip = await request.json();
        if (!trip.id) return json({ error: 'Trip id required' }, 400);
        const raw = await env.TRIPS_KV.get('all_trips');
        const trips = raw ? JSON.parse(raw) : [];
        const idx = trips.findIndex(t => t.id === trip.id);
        if (idx >= 0) trips[idx] = trip; else trips.push(trip);
        await env.TRIPS_KV.put('all_trips', JSON.stringify(trips));
        return json({ ok: true });
      } catch (err) {
        return json({ error: err.message }, 500);
      }
    }
    // ─── DELETE /api/trips ───────────────────────────────────────────────────
    if (path === '/api/trips' && request.method === 'DELETE') {
      try {
        const id = url.searchParams.get('id');
        if (!id) return json({ error: 'Trip id required' }, 400);
        const raw = await env.TRIPS_KV.get('all_trips');
        const trips = raw ? JSON.parse(raw) : [];
        const filtered = trips.filter(t => t.id !== id);
        await env.TRIPS_KV.put('all_trips', JSON.stringify(filtered));
        return json({ ok: true });
      } catch (err) {
        return json({ error: err.message }, 500);
      }
    }
    // ─── /api/auth ──────────────────────────────────────────────────────────
    if (path === '/api/auth' && request.method === 'POST') {
      try {
        const { user, password } = await request.json();
        const account=typeof user==='string'?knownAccountNames(env).find(name=>name.toLowerCase()===user.trim().toLowerCase())||user:user;
        if (await authenticateTrip(env,account,password)) {
          return json({ valid: true, user:account, token: await issueSession(env, account) });
        }
        return json({ valid: false }, 401);
      } catch (err) {
        return json({ valid: false, error: err.status === 503 ? err.message : 'Authentication failed' }, err.status || 400);
      }
    }
    // ─── GET /api/trips ──────────────────────────────────────────────────────
    if (path === '/api/trips' && request.method === 'GET') {
      try {
        const raw = await env.TRIPS_KV.get('all_trips');
        const trips = raw ? JSON.parse(raw) : [];
        return json(trips);
      } catch (err) {
        return json({ error: err.message }, 500);
      }
    }
    // ─── POST /api/trips ─────────────────────────────────────────────────────
    if (path === '/api/trips' && request.method === 'POST') {
      try {
        const trip = await request.json();
        if (!trip.id) return json({ error: 'Trip id required' }, 400);
        const raw = await env.TRIPS_KV.get('all_trips');
        const trips = raw ? JSON.parse(raw) : [];
        const idx = trips.findIndex(t => t.id === trip.id);
        if (idx >= 0) trips[idx] = trip; else trips.push(trip);
        await env.TRIPS_KV.put('all_trips', JSON.stringify(trips));
        return json({ ok: true });
      } catch (err) {
        return json({ error: err.message }, 500);
      }
    }
    // ─── DELETE /api/trips ───────────────────────────────────────────────────
    if (path === '/api/trips' && request.method === 'DELETE') {
      try {
        const id = url.searchParams.get('id');
        if (!id) return json({ error: 'Trip id required' }, 400);
        const raw = await env.TRIPS_KV.get('all_trips');
        const trips = raw ? JSON.parse(raw) : [];
        const filtered = trips.filter(t => t.id !== id);
        await env.TRIPS_KV.put('all_trips', JSON.stringify(filtered));
        return json({ ok: true });
      } catch (err) {
        return json({ error: err.message }, 500);
      }
    }
    // ─── POST /api/trips/share ───────────────────────────────────────────────
    if (path === '/api/trips/share' && request.method === 'POST') {
      try {
        const { tripId, username } = await request.json();
        if (!tripId || !username) return json({ error: 'tripId and username required' }, 400);
        const raw = await env.TRIPS_KV.get('all_trips');
        const trips = raw ? JSON.parse(raw) : [];
        const trip = trips.find(t => t.id === tripId);
        if (!trip) return json({ error: 'Trip not found' }, 404);
        if (!Array.isArray(trip.sharedWith)) trip.sharedWith = [];
        if (!trip.sharedWith.includes(username)) trip.sharedWith.push(username);
        await env.TRIPS_KV.put('all_trips', JSON.stringify(trips));
        return json({ ok: true, sharedWith: trip.sharedWith });
      } catch (err) {
        return json({ error: err.message }, 500);
      }
    }
    // ─── GET /api/trips/shared ───────────────────────────────────────────────
    if (path === '/api/trips/shared' && request.method === 'GET') {
      try {
        const user = url.searchParams.get('user');
        if (!user) return json({ error: 'user query param required' }, 400);
        const raw = await env.TRIPS_KV.get('all_trips');
        const trips = raw ? JSON.parse(raw) : [];
        const mine = trips.filter(t => t.created_by === user || (Array.isArray(t.sharedWith) && t.sharedWith.includes(user)));
        return json(mine);
      } catch (err) {
        return json({ error: err.message }, 500);
      }
    }
    // ─── /api/health ─────────────────────────────────────────────────────────
    if (path === '/api/health') {
      return json({
        status: 'ok',
        storage: env.TRIP_DB?'d1':'kv',
        registryVersion: env.TRIP_DB?1:null,
        edge: 'cloudflare-worker',
        gateway: 'ai-gateway',
        deepseek: CF_ACCOUNT_ID ? 'configured' : 'missing',
        supabase: SB_URL ? 'configured' : 'missing',
      });
    }

    // ─── /api/scan-trip ─────────────────────────────────────────────────────
    if (path === '/api/scan-trip' && request.method === 'POST') {
      try {
        const { image } = await request.json();
        if (!image) return json({ error: 'No image provided' }, 400);

        const prompt = `You are a flight booking parser. Extract all trip details from this screenshot. Return ONLY valid JSON with these fields: {"airline":"airline name","flightNumber":"flight code","departureTime":"HH:MM","departureDate":"YYYY-MM-DD","returnDate":"YYYY-MM-DD or null","destinationCity":"city name","bookingRef":"6-char code"}. If you cant find a field use null.`;

        const content = await callDeepSeek([{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: image.startsWith('data:') ? image : `data:image/png;base64,${image}` } },
          ],
        }], { max_tokens: 500, temperature: 0.1 });

        const m = content.match(/\{[\s\S]*\}/);
        if (!m) throw new Error('No JSON in AI response: ' + content.slice(0, 200));
        const parsed = JSON.parse(m[0]);

        // Geocode
        let geo = null;
        if (parsed.destinationCity) {
          try {
            const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(parsed.destinationCity)}&count=1&language=en&format=json`);
            const d = await r.json();
            if (d.results?.[0]) {
              const c = d.results[0];
              geo = { name: c.name, country: c.country, cc: c.country_code, lat: c.latitude, lon: c.longitude, tz: c.timezone };
            }
          } catch {}
        }

        // Weather
        let weather = null;
        if (geo) {
          try {
            const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${geo.lat.toFixed(2)}&longitude=${geo.lon.toFixed(2)}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max&timezone=${encodeURIComponent(geo.tz || 'auto')}&forecast_days=14`);
            weather = await r.json();
          } catch {}
        }

        // Packing list
        const items = {};
        [['apparel','Tops / Tees',3],['apparel','Pants / Shorts',2],['apparel','Evening Fit',1],['apparel','Sleepwear',1],['apparel','Underwear & Socks',5],['apparel','Light Jacket',1],['grooming','Skincare',1],['grooming','Deodorant',1],['grooming','Hair Products',1],['grooming','Toothbrush & Paste',1],['grooming','Shower Kit',1],['gear','Sneakers',1],['gear','Dress Shoes',1],['gear','Sunglasses & Watch',1],['gear','Day Bag',1],['tech','Phone + Cable',1],['tech','Power Bank',1],['tech','Earbuds / Headphones',1],['tech','Wallet & ID',1]].forEach(([cat,label,qty]) => { items['seed-'+cat+'-'+label] = {cat,label,checked:false,qty,auto:false}; });
        if (weather?.daily) {
          const d = weather.daily;
          let maxT=22,minT=15,rain=false,snow=false,uvHi=false;
          const di = parsed.departureDate ? d.time.indexOf(parsed.departureDate) : 0;
          const n = Math.min(7, d.time.length - Math.max(0, di));
          for (let i = Math.max(0, di); i < Math.max(0, di) + n && i < d.time.length; i++) {
            maxT = Math.max(maxT, d.temperature_2m_max[i]);
            minT = Math.min(minT, d.temperature_2m_min[i]);
            if ((d.precipitation_probability_max?.[i] ?? 0) > 30) rain = true;
            if (d.weather_code[i] >= 71 && d.weather_code[i] <= 77) snow = true;
            if ((d.uv_index_max?.[i] ?? 0) > 6) uvHi = true;
          }
          const add = (label, cat, key) => { if (!items['auto-' + key]) items['auto-' + key] = { cat, label, checked: false, qty: 1, auto: true }; };
          if (maxT >= 28) { add('Sunscreen', 'grooming', 'sunscreen'); add('Hat / Cap', 'apparel', 'hat'); }
          if (minT <= 5) { add('Heavy jacket', 'apparel', 'heavy-jacket'); add('Thermal base layer', 'apparel', 'thermal'); add('Gloves', 'apparel', 'gloves'); }
          if (minT <= -5) { add('Scarf', 'apparel', 'scarf'); add('Warm beanie', 'apparel', 'beanie'); }
          if (rain) { add('Rain jacket', 'gear', 'rain-jacket'); add('Umbrella', 'gear', 'umbrella'); }
          if (snow) { add('Snow boots', 'gear', 'snow-boots'); }
          if (uvHi) { add('Sunglasses', 'gear', 'sunglasses'); }
          if (maxT <= 18 && minT >= 6) { add('Light layer', 'apparel', 'light-layer'); }
        }

        const trip = {
          id: crypto.randomUUID(),
          city: geo?.name || parsed.destinationCity || 'Unknown',
          country: geo?.country || '', cc: geo?.cc || '',
          lat: geo?.lat || 0, lon: geo?.lon || 0, tz: geo?.tz || 'auto',
          depart: parsed.departureDate || null, return_date: parsed.returnDate || null,
          airline: parsed.airline || '', flight_num: parsed.flightNumber || '',
          flight_time: parsed.departureTime || '', booking_ref: parsed.bookingRef || '',
          items, closet: [], style: [], weather, source: 'screenshot',
          raw_ocr: JSON.stringify(parsed),
        };

        // Persist to Supabase
        if (SB_URL && SB_KEY) {
          try {
            await fetch(`${SB_URL}/rest/v1/trips`, {
              method: 'POST',
              headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
              body: JSON.stringify(trip),
            });
          } catch {}
        }

        return json({
          success: true,
          trip: {
            id: trip.id, city: trip.city, country: trip.country, cc: trip.cc,
            lat: trip.lat, lon: trip.lon, tz: trip.tz,
            depart: trip.depart, return: trip.return_date,
            airline: trip.airline, flightNum: trip.flight_num, flightTime: trip.flight_time, bookingRef: trip.booking_ref,
            items: trip.items, closet: [], style: [], weather: trip.weather, source: 'screenshot',
          },
          parsed,
        });
      } catch (err) {
        return json({ error: err.message || 'Scan failed' }, 500);
      }
    }

    // ─── /api/suggest-packing ────────────────────────────────────────────────
    if (path === '/api/suggest-packing' && request.method === 'POST') {
      try {
        const body = await request.json();
        if (!body?.destination) return json({ error: 'destination is required' }, 400);

        const days = body.departDate && body.returnDate
          ? Math.max(1, Math.round((new Date(body.returnDate) - new Date(body.departDate)) / 86400000))
          : null;

        const lines = [
          'You are an expert travel packing assistant. Generate a smart, context-aware packing list.',
          '',
          `Destination: ${body.destination}.`,
          `Departure: ${body.departDate || 'unspecified'}.`,
          `Return: ${body.returnDate || 'unspecified'}.`,
          `Duration: ${days ? days + ' day' + (days === 1 ? '' : 's') : 'unspecified'}.`,
          `Trip type: ${body.tripType || 'general'}.`,
        ];
        if (body.weather && typeof body.weather === 'object' && Object.keys(body.weather).length > 0) {
          lines.push(`Weather (JSON): ${JSON.stringify(body.weather)}`);
          lines.push('Adapt packing based on weather — rain gear if wet, warm layers if cold, sun protection if high UV, snow gear if snow.');
        } else {
          lines.push('Weather: not provided. Infer climate from destination and season.');
        }
        lines.push('');
        lines.push('Consider destination climate, trip duration, and trip type (beach / business / city / adventure / ski).');
        lines.push('Adjust quantities for the trip length — enough clothing for the days, with laundry assumptions for longer trips.');
        lines.push('');
        lines.push('Return ONLY valid JSON with this shape, no markdown fences, no prose:');
        lines.push('{ "categories": [ { "id": "kebab-case", "name": "Category", "items": [ { "label": "Item", "qty": 1, "essential": true, "note": "optional" } ] } ] }');
        lines.push('Rules: 4-8 categories, 3-12 items each. qty is a positive integer. essential is boolean.');

        const content = await callDeepSeek(
          [{ role: 'user', content: lines.join('\n') }],
          { max_tokens: 2000, temperature: 0.3, json_mode: true }
        );

        let parsed;
        try {
          parsed = JSON.parse(content);
        } catch {
          const m2 = content.match(/\{[\s\S]*\}/);
          if (!m2) throw new Error('AI response not valid JSON: ' + content.slice(0, 200));
          parsed = JSON.parse(m2[0]);
        }

        if (!parsed?.categories || !Array.isArray(parsed.categories)) {
          throw new Error('AI response missing categories array');
        }

        parsed.categories = parsed.categories.map((cat, i) => ({
          id: typeof cat?.id === 'string' && cat.id.trim() ? cat.id.trim() : `category-${i + 1}`,
          name: typeof cat?.name === 'string' && cat.name.trim() ? cat.name.trim() : `Category ${i + 1}`,
          items: Array.isArray(cat?.items) ? cat.items.map((it, j) => ({
            label: typeof it?.label === 'string' ? it.label : `Item ${j + 1}`,
            qty: Number.isFinite(it?.qty) ? Math.max(1, Math.floor(it.qty)) : 1,
            essential: Boolean(it?.essential),
            ...(typeof it?.note === 'string' && it.note.trim() ? { note: it.note.trim() } : {}),
          })) : [],
        }));

        return json(parsed);
      } catch (err) {
        return json({ error: err.message || 'Suggest failed' }, 500);
      }
    }

    // ─── /schema.sql ──────────────────────────────────────────────────────────
    if (path === '/schema.sql') {
      return new Response(SCHEMA_SQL, { headers: { ...CORS, 'Content-Type': 'application/sql' } });
    }

    const towerResponse = await handleTower(request, env);
    if (towerResponse) return towerResponse;
    const productionUi=serveProductionUi(request);
    if(productionUi)return productionUi;

    // ─── Static assets ────────────────────────────────────────────────────────
    if (env.ASSETS) {
      const assetRes = await env.ASSETS.fetch(request);
      if (assetRes.status !== 404) return assetRes;
    }

    // ─── SPA fallback ──────────────────────────────────────────────────────────
    return new Response(INDEX_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  },
};
