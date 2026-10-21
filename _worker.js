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
<style>
:root{--bg:#faf7f0;--surface:#fff;--surface-2:#f5f0e6;--ink:#1c1c1e;--ink-2:#3a3a3c;--muted:#9999a0;--line:#e8e2d5;--line-soft:#f0ebe0;--orange:#ff4d00;--orange-hi:#ff6b2c;--pink:#ff3d7f;--teal:#0d9488;--teal-soft:#ccfbf1;--red:#ef4444;--green:#22c55e;--grad:linear-gradient(135deg,#ff3d7f,#ff4d00);--grad-teal:linear-gradient(135deg,#0d9488,#0891b2);--r:16px;--r-sm:10px;--r-xs:6px;--shadow-sm:0 1px 3px rgba(28,28,30,.06);--shadow:0 2px 12px rgba(28,28,30,.06);--shadow-lg:0 8px 30px rgba(28,28,30,.12);--safe:env(safe-area-inset-bottom,0px);--tab-h:56px}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%;-webkit-tap-highlight-color:transparent}
body{font-family:'Space Grotesk',-apple-system,system-ui,sans-serif;background:var(--bg);color:var(--ink);min-height:100vh;-webkit-font-smoothing:antialiased;overscroll-behavior-y:none;padding-bottom:calc(var(--tab-h) + var(--safe) + 8px)}
h1,h2,h3,h4{font-family:'Unbounded',sans-serif;letter-spacing:-.02em;line-height:1.15}
button,input,select,textarea{font:inherit;color:inherit}
button{cursor:pointer;border:none;background:none}
input,textarea{-webkit-appearance:none;appearance:none}
:root{color-scheme:light}
.tabbar{position:fixed;bottom:0;left:0;right:0;height:calc(var(--tab-h) + var(--safe));background:rgba(255,255,255,.85);backdrop-filter:blur(20px) saturate(1.8);-webkit-backdrop-filter:blur(20px) saturate(1.8);border-top:1px solid var(--line);display:flex;justify-content:space-around;align-items:flex-start;padding-top:8px;padding-bottom:var(--safe);z-index:100}
.tab{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:.62rem;font-weight:600;color:var(--muted);letter-spacing:.02em;flex:1;padding:4px 0;transition:color .15s;-webkit-user-select:none;user-select:none}
.tab svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.tab.active{color:var(--orange)}
.screen{display:none;max-width:520px;margin:0 auto;padding:20px 18px 40px}
.screen.active{display:block;animation:fadeIn .2s ease}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.brand-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}
.brand{font-family:'Unbounded';font-weight:800;font-size:1.1rem;display:flex;align-items:baseline;gap:1px}
.brand .a{background:var(--grad);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.brand .dot{color:var(--teal)}
.section-label{font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:0}
.trip-hero{background:var(--surface);border-radius:var(--r);padding:28px 24px;box-shadow:var(--shadow);border:1px solid var(--line);margin-bottom:20px;position:relative;overflow:hidden}
.trip-hero::before{content:'';position:absolute;top:-40px;right:-40px;width:120px;height:120px;background:var(--grad);opacity:.06;border-radius:50%;filter:blur(30px)}
.trip-hero .eyebrow{font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--orange);margin-bottom:10px;position:relative}
.trip-hero h1{font-size:clamp(1.5rem,7vw,2.1rem);font-weight:800;margin-bottom:6px;position:relative}
.trip-hero .city{font-size:.95rem;color:var(--muted);font-weight:500;position:relative}
.field-group{display:flex;flex-direction:column;gap:14px;margin-top:24px}
.field-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.lbl{font-size:.66rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:6px;display:block}
.inp{width:100%;padding:13px 14px;font-size:.92rem;font-weight:500;border:1.5px solid var(--line);border-radius:var(--r-sm);background:var(--surface-2);outline:none;transition:border-color .15s,background .15s}
.inp:focus{border-color:var(--orange);background:var(--surface)}
.inp::placeholder{color:var(--muted);font-weight:400}
.dest-results{margin-top:8px}
.dest-result{padding:12px 14px;background:var(--surface);border:1px solid var(--line);border-radius:var(--r-sm);margin-bottom:6px;font-size:.88rem;cursor:pointer;display:flex;align-items:center;gap:10px;transition:all .12s}
.dest-result:active{border-color:var(--orange);background:var(--surface-2)}
.dest-result .flag{font-size:1.2rem}
.dest-result .info{flex:1;min-width:0}
.dest-result .name{font-weight:600}
.dest-result .region{font-size:.76rem;color:var(--muted)}
.btn{font-weight:700;font-size:.86rem;padding:14px 24px;border-radius:100px;display:inline-flex;align-items:center;justify-content:center;gap:8px;transition:all .15s;-webkit-user-select:none;user-select:none;text-align:center}
.btn-fill{background:var(--grad);color:#fff}.btn-fill:active{transform:scale(.97)}
.btn-dark{background:var(--ink);color:#fff}.btn-dark:active{transform:scale(.97)}
.btn-ghost{background:transparent;border:1.5px solid var(--line);color:var(--ink-2)}.btn-ghost:active{background:var(--surface-2)}
.btn-block{display:flex;width:100%}
.btn-row{display:flex;gap:10px;margin-top:20px}
.scan-btn{display:flex;align-items:center;gap:10px;padding:14px 18px;background:var(--surface);border:1.5px dashed var(--orange);border-radius:var(--r-sm);cursor:pointer;transition:all .15s;width:100%;margin-top:16px}
.scan-btn:active{background:rgba(255,77,0,.05)}
.scan-btn .scan-text{font-size:.88rem;font-weight:600;color:var(--orange)}
.scan-btn .scan-sub{font-size:.72rem;color:var(--muted);margin-top:2px}
.trip-info{background:var(--ink);border-radius:var(--r);padding:20px 22px;margin-bottom:20px;display:flex;flex-direction:column;gap:16px}
.trip-info .row{display:flex;justify-content:space-between;align-items:center}
.trip-info .dest-name{font-family:'Unbounded';font-weight:700;font-size:1.15rem;color:#fff}
.trip-info .dates{font-size:.82rem;color:rgba(255,255,255,.6);margin-top:4px}
.trip-info .flight{display:flex;gap:16px;flex-wrap:wrap;padding-top:14px;border-top:1px solid rgba(255,255,255,.1)}
.trip-info .flight .item{font-size:.72rem;color:rgba(255,255,255,.45);text-transform:uppercase;letter-spacing:.04em}
.trip-info .flight .item strong{color:var(--orange-hi);font-weight:600;font-size:.85rem;display:block;margin-top:2px;text-transform:none;letter-spacing:0}
.trip-info .edit-link{font-size:.76rem;color:rgba(255,255,255,.4);text-decoration:none}
.trip-info .source-badge{font-size:.6rem;font-weight:700;padding:3px 8px;border-radius:100px;background:var(--teal);color:#fff;text-transform:uppercase;letter-spacing:.04em;align-self:flex-start}
.trips-list{margin-top:24px}
.trips-list .list-label{font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:12px}
.trip-card{background:var(--surface);border:1.5px solid var(--line);border-radius:var(--r-sm);padding:16px;margin-bottom:10px;cursor:pointer;transition:all .12s;display:flex;align-items:center;justify-content:space-between;gap:12px}
.trip-card:active{border-color:var(--orange)}
.trip-card.active{border-color:var(--orange);background:rgba(255,77,0,.02)}
.trip-card .tc-main{flex:1;min-width:0}
.trip-card .tc-city{font-family:'Unbounded';font-weight:700;font-size:.92rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.trip-card .tc-dates{font-size:.76rem;color:var(--muted);margin-top:3px}
.trip-card .tc-source{font-size:.58rem;font-weight:700;padding:2px 7px;border-radius:100px;background:var(--teal-soft);color:var(--teal);text-transform:uppercase;margin-top:4px;display:inline-block}
.trip-card .tc-del{width:28px;height:28px;border-radius:50%;color:var(--muted);font-size:.8rem;flex-shrink:0;display:grid;place-items:center;transition:all .12s}
.trip-card .tc-del:active{color:var(--red);background:rgba(239,68,68,.08)}
.weather-current{background:var(--grad);border-radius:var(--r);padding:24px;margin-bottom:14px;display:flex;align-items:center;gap:16px;position:relative;overflow:hidden}
.weather-current::after{content:'';position:absolute;top:-20px;right:-20px;width:80px;height:80px;border-radius:50%;background:rgba(255,255,255,.1)}
.weather-current .w-icon{font-size:2.6rem;line-height:1;z-index:1}
.weather-current .w-info{flex:1;z-index:1}
.weather-current .w-label{font-size:.68rem;text-transform:uppercase;letter-spacing:.07em;color:rgba(255,255,255,.7);font-weight:600}
.weather-current .w-cond{font-size:1.05rem;font-weight:600;color:#fff;margin-top:2px}
.weather-current .w-extra{font-size:.76rem;color:rgba(255,255,255,.6);margin-top:4px}
.weather-current .w-temp{font-family:'Unbounded';font-weight:800;font-size:2.2rem;color:#fff;z-index:1}
.weather-scroll{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;padding-bottom:4px}
.weather-scroll::-webkit-scrollbar{display:none}
.w-day{flex:0 0 78px;background:var(--surface);border:1px solid var(--line);border-radius:var(--r-sm);padding:14px 10px;text-align:center;scroll-snap-align:start}
.w-day .d-label{font-size:.62rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
.w-day .d-icon{font-size:1.5rem;margin:6px 0;line-height:1}
.w-day .d-hi{font-family:'Unbounded';font-weight:700;font-size:.95rem}
.w-day .d-lo{font-size:.75rem;color:var(--muted);font-weight:600}
.w-day .d-precip{font-size:.6rem;color:var(--teal);font-weight:600;margin-top:4px}
.cat-section{margin-bottom:16px}
.cat-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:var(--surface);border:1px solid var(--line);border-radius:var(--r-sm);cursor:pointer;transition:all .12s;-webkit-user-select:none;user-select:none}
.cat-head:active{background:var(--surface-2)}
.cat-head .left{display:flex;align-items:center;gap:10px}
.cat-head .cat-name{font-size:.9rem;font-weight:700}
.cat-head .chevron{width:18px;height:18px;transition:transform .2s;color:var(--muted)}
.cat-section.open .cat-head .chevron{transform:rotate(180deg)}
.cat-head .right{display:flex;align-items:center;gap:8px}
.cat-head .pill{font-size:.66rem;font-weight:700;padding:3px 9px;border-radius:100px;background:var(--line-soft);color:var(--ink-2)}
.cat-head .pill.done{background:var(--teal);color:#fff}
.cat-body{max-height:0;overflow:hidden;transition:max-height .25s ease}
.cat-section.open .cat-body{max-height:2000px}
.pack-list{padding:6px 0 0}
.pack-row{display:flex;align-items:center;gap:12px;padding:11px 16px;border-bottom:1px solid var(--line-soft);transition:opacity .15s}
.pack-row:last-child{border-bottom:none}
.pack-row.checked{opacity:.45}
.pack-row .check{width:24px;height:24px;border:2px solid var(--line);border-radius:7px;flex-shrink:0;display:grid;place-items:center;transition:all .15s}
.pack-row .check:active{transform:scale(.9)}
.pack-row .check svg{width:13px;height:13px;opacity:0;transition:opacity .12s}
.pack-row.checked .check{background:var(--orange);border-color:var(--orange)}
.pack-row.checked .check svg{opacity:1}
.pack-row .p-label{flex:1;font-size:.88rem;font-weight:500;min-width:0}
.pack-row.checked .p-label{text-decoration:line-through}
.pack-row .auto-badge{font-size:.58rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:2px 6px;border-radius:100px;background:var(--teal-soft);color:var(--teal);white-space:nowrap}
.pack-row .qty-control{display:flex;align-items:center;gap:6px}
.pack-row .qty-btn{width:26px;height:26px;border:1px solid var(--line);border-radius:7px;display:grid;place-items:center;font-size:.85rem;font-weight:700;color:var(--ink-2);transition:all .12s}
.pack-row .qty-btn:active{border-color:var(--orange);color:var(--orange)}
.pack-row .qty-val{font-size:.82rem;font-weight:700;min-width:18px;text-align:center}
.pack-row .del-btn{width:24px;height:24px;color:var(--muted);font-size:.8rem;opacity:0;transition:opacity .12s}
.pack-row:active .del-btn{opacity:.6}
.pack-row .del-btn:active{opacity:1;color:var(--red)}
.add-item{display:flex;gap:8px;padding:12px 16px 16px}
.add-item .ai-inp{flex:1;padding:9px 12px;font-size:.82rem;border:1px solid var(--line);border-radius:var(--r-xs);background:var(--surface-2);outline:none}
.add-item .ai-inp:focus{border-color:var(--orange)}
.add-item .ai-btn{padding:9px 16px;font-size:.78rem;font-weight:700;background:var(--ink);color:#fff;border-radius:var(--r-xs)}
.progress-card{background:var(--surface);border-radius:var(--r);padding:18px 22px;box-shadow:var(--shadow);border:1px solid var(--line);margin-bottom:20px}
.progress-card .p-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.progress-card .p-top .p-title{font-size:.82rem;font-weight:600;color:var(--ink-2)}
.progress-card .p-top .p-pct{font-family:'Unbounded';font-weight:800;font-size:1.3rem;color:var(--orange)}
.progress-card .p-track{height:7px;background:var(--line-soft);border-radius:100px;overflow:hidden}
.progress-card .p-fill{height:100%;background:var(--grad);border-radius:100px;transition:width .4s cubic-bezier(.4,0,.2,1)}
.progress-card .p-fill.done{background:var(--grad-teal)}
.upload-zone{border:2px dashed var(--line);border-radius:var(--r);padding:36px 20px;text-align:center;margin-bottom:16px;transition:all .18s;cursor:pointer;background:var(--surface)}
.upload-zone:active,.upload-zone.drag{border-color:var(--orange);background:rgba(255,77,0,.03)}
.upload-zone .uz-icon{width:44px;height:44px;margin:0 auto 10px;border-radius:12px;background:var(--surface-2);display:grid;place-items:center}
.upload-zone .uz-icon svg{width:22px;height:22px;stroke:var(--muted);fill:none;stroke-width:2}
.upload-zone .uz-text{font-size:.88rem;font-weight:600;color:var(--ink-2)}
.upload-zone .uz-sub{font-size:.75rem;color:var(--muted);margin-top:4px}
.photo-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.photo-cell{position:relative;aspect-ratio:3/4;border-radius:var(--r-sm);overflow:hidden;border:3px solid transparent;transition:border-color .15s;cursor:pointer}
.photo-cell:active{transform:scale(.96)}
.photo-cell img{width:100%;height:100%;object-fit:cover;display:block}
.photo-cell.selected{border-color:var(--teal)}
.photo-cell .pc-badge{position:absolute;top:5px;right:5px;width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,.4);backdrop-filter:blur(4px);display:grid;place-items:center;transition:all .15s}
.photo-cell.selected .pc-badge{background:var(--teal)}
.photo-cell .pc-badge svg{width:11px;height:11px;stroke:#fff;fill:none;stroke-width:3;opacity:0;transition:opacity .12s}
.photo-cell.selected .pc-badge svg{opacity:1}
.photo-cell .pc-del{position:absolute;top:5px;left:5px;width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,.4);backdrop-filter:blur(4px);color:#fff;font-size:.65rem;display:grid;place-items:center;z-index:2}
.style-tags{display:flex;gap:6px;overflow-x:auto;margin-bottom:14px;padding-bottom:4px}
.style-tags::-webkit-scrollbar{display:none}
.stag{flex:0 0 auto;font-size:.72rem;font-weight:700;padding:7px 14px;border-radius:100px;border:1.5px solid var(--line);background:transparent;color:var(--ink-2);white-space:nowrap;transition:all .12s}
.stag.active{background:var(--ink);border-color:var(--ink);color:#fff}
.stag:active{transform:scale(.95)}
.style-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
.style-card{background:var(--surface);border-radius:var(--r-sm);overflow:hidden;border:1px solid var(--line);box-shadow:var(--shadow-sm)}
.style-card img{width:100%;aspect-ratio:3/4;object-fit:cover;display:block}
.style-card .sc-body{padding:10px 12px}
.style-card .sc-tag{font-size:.64rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--orange)}
.style-card .sc-inp{width:100%;margin-top:6px;padding:5px 0;font-size:.78rem;border:none;border-bottom:1px solid var(--line-soft);outline:none;background:transparent;color:var(--ink-2)}
.style-card .sc-inp:focus{border-bottom-color:var(--orange)}
.style-card .sc-foot{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-top:1px solid var(--line-soft)}
.style-card .sc-del{font-size:.7rem;color:var(--muted)}
.style-card .sc-del:active{color:var(--red)}
.sync-card{background:var(--surface);border-radius:var(--r);padding:24px;box-shadow:var(--shadow);border:1px solid var(--line);margin-bottom:16px}
.sync-status{display:flex;align-items:center;gap:10px;padding:14px 16px;border-radius:var(--r-sm);margin-top:16px;font-size:.82rem;font-weight:600}
.sync-status.connected{background:rgba(34,197,94,.08);color:var(--green)}
.sync-status.disconnected{background:var(--surface-2);color:var(--muted)}
.sync-status .dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.sync-status.connected .dot{background:var(--green)}
.sync-status.disconnected .dot{background:var(--muted)}
.sync-trips-count{font-size:.8rem;color:var(--muted);margin-top:12px}
.empty-state{text-align:center;padding:32px 20px;color:var(--muted);font-size:.85rem;font-style:italic}
.toast{position:fixed;bottom:calc(var(--tab-h) + var(--safe) + 20px);left:50%;transform:translateX(-50%) translateY(20px);background:var(--ink);color:#fff;padding:12px 24px;border-radius:100px;font-size:.82rem;font-weight:600;z-index:200;opacity:0;transition:all .3s;pointer-events:none;white-space:nowrap;box-shadow:var(--shadow-lg)}
.toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
.modal-bg{position:fixed;inset:0;background:rgba(28,28,30,.5);backdrop-filter:blur(8px);display:none;place-items:center;z-index:300;padding:24px}
.modal-bg.show{display:grid}
.modal{background:var(--surface);border-radius:var(--r);padding:36px 28px;text-align:center;max-width:340px;width:100%;box-shadow:var(--shadow-lg)}
.modal .m-icon{font-size:2.5rem;margin-bottom:12px}
.modal h2{font-size:1.6rem;background:var(--grad);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:6px}
.modal p{font-size:.88rem;color:var(--muted);margin-bottom:24px}
.loading-overlay{position:fixed;inset:0;background:rgba(28,28,30,.6);backdrop-filter:blur(8px);display:none;place-items:center;z-index:400;padding:24px}
.loading-overlay.show{display:grid}
.loading-overlay .lo-box{background:var(--surface);border-radius:var(--r);padding:36px 28px;text-align:center;max-width:300px;width:100%;box-shadow:var(--shadow-lg)}
.loading-overlay .spinner{width:40px;height:40px;border:3px solid var(--line);border-top-color:var(--orange);border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 16px}
@keyframes spin{to{transform:rotate(360deg)}}
.loading-overlay .lo-text{font-size:.9rem;font-weight:600;color:var(--ink)}
.loading-overlay .lo-sub{font-size:.76rem;color:var(--muted);margin-top:6px}
.hidden{display:none!important}

/* Responsive — all screen sizes */
@media(max-width:640px){
  .field-row{grid-template-columns:1fr}
  .style-grid{grid-template-columns:1fr 1fr}
  .photo-grid{grid-template-columns:repeat(3,1fr)}
  .w-day{flex:0 0 70px}
  .trip-hero{padding:24px 20px}
  .trip-hero h1{font-size:clamp(1.4rem,8vw,2rem)}
  .progress-card{padding:16px 18px}
  .cat-head{padding:12px 14px}
  .pack-row{padding:10px 12px;gap:10px;min-height:48px}
  .btn{padding:12px 20px;font-size:.82rem}
  .scan-btn{padding:12px 14px}
  .upload-zone{padding:28px 16px}
  .sync-card{padding:20px}
}
@media(max-width:380px){
  .field-row{grid-template-columns:1fr}
  .style-grid{grid-template-columns:1fr}
  .photo-grid{grid-template-columns:repeat(2,1fr)}
  .w-day{flex:0 0 64px;padding:10px 8px}
  .tab{font-size:.58rem}
  .tab svg{width:20px;height:20px}
  .brand{font-size:1rem}
}
@media(min-width:641px){
  .screen{max-width:580px}
}
/* Prevent iOS input zoom */
.inp,.lbl{font-size:max(.92rem,16px)}
.inp{font-size:max(.92rem,16px)}
/* Safe area for notch phones */
.screen{padding-top:max(20px,env(safe-area-inset-top,20px))}


@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}}

/* Auth gate */
.auth-gate{position:fixed;inset:0;z-index:9999;background:var(--bg);display:flex;align-items:center;justify-content:center;padding:24px}
.auth-card{background:var(--surface);border-radius:var(--r);padding:36px 28px;max-width:340px;width:100%;box-shadow:var(--shadow-lg);border:1px solid var(--line)}
.auth-card .ac-brand{font-family:'Unbounded',sans-serif;font-weight:800;font-size:1.1rem;display:flex;align-items:baseline;gap:1px;margin-bottom:24px;justify-content:center}
.auth-card .ac-brand .a{background:var(--grad);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.auth-card .ac-brand .dot{color:var(--teal)}
.auth-card h2{font-size:1.3rem;margin-bottom:6px;text-align:center}
.auth-card .ac-sub{font-size:.82rem;color:var(--muted);text-align:center;margin-bottom:24px}
.auth-card .ac-inp{width:100%;padding:14px 16px;font-size:.95rem;font-weight:500;border:1.5px solid var(--line);border-radius:var(--r-sm);background:var(--surface-2);outline:none;transition:border-color .15s;text-align:center;letter-spacing:.1em}
.auth-card .ac-inp:focus{border-color:var(--orange);background:var(--surface)}
.auth-card .ac-btn{width:100%;margin-top:16px}
.auth-card .ac-err{font-size:.8rem;color:var(--red);text-align:center;margin-top:12px;display:none}
.auth-card .ac-err.show{display:block}
.auth-card .ac-hint{font-size:.72rem;color:var(--muted);text-align:center;margin-top:16px}

/* ─── Pack v2 improvements ─── */
.pack-stats{display:flex;gap:10px;margin-bottom:16px}
.pack-stat{flex:1;text-align:center;padding:14px 8px;background:var(--surface);border:1px solid var(--line);border-radius:var(--r-sm)}
.pack-stat .ps-num{font-family:'Unbounded',sans-serif;font-weight:800;font-size:1.5rem;line-height:1}
.pack-stat .ps-lbl{font-size:.58rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-top:4px}
.pack-search{margin-bottom:16px}
.pack-search .ps-inp{width:100%;padding:13px 14px;font-size:.9rem;border:1.5px solid var(--line);border-radius:var(--r-sm);background:var(--surface);outline:none;transition:border-color .15s}
.pack-search .ps-inp:focus{border-color:var(--orange)}
.pack-search .ps-inp::placeholder{color:var(--muted)}
.template-chips{display:flex;gap:8px;overflow-x:auto;margin-bottom:16px;padding-bottom:4px;-webkit-overflow-scrolling:touch}
.template-chips::-webkit-scrollbar{display:none}
.t-chip{flex:0 0 auto;display:flex;align-items:center;gap:5px;font-size:.76rem;font-weight:700;padding:8px 15px;border-radius:100px;border:1.5px solid var(--line);background:var(--surface);color:var(--ink-2);white-space:nowrap;transition:all .12s;cursor:pointer}
.t-chip:active{transform:scale(.95)}
.t-chip .t-icon{font-size:.9rem}
.ai-suggest-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:15px;margin-bottom:20px;background:var(--grad);color:#fff;border-radius:var(--r-sm);font-size:.86rem;font-weight:700;cursor:pointer;transition:transform .12s;border:none}
.ai-suggest-btn:active{transform:scale(.98)}
.ai-suggest-btn.loading{opacity:.6;pointer-events:none}
.essential-badge{font-size:.56rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:2px 6px;border-radius:100px;background:#fef3c7;color:#92400e;white-space:nowrap}
.cat-icon{font-size:1.05rem;line-height:1}

</style>
</head>
<body>
<nav class="tabbar">
  <button class="tab active" data-screen="trip"><svg viewBox="0 0 24 24"><path d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10"/></svg>Trip</button>
  <button class="tab" data-screen="pack"><svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>Pack</button>
  <button class="tab" data-screen="closet"><svg viewBox="0 0 24 24"><path d="M4 4h16v16H4zM4 12h16M12 4v16"/></svg>Closet</button>
  <button class="tab" data-screen="style"><svg viewBox="0 0 24 24"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg>Style</button>
  <button class="tab" data-screen="sync"><svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 11-3-6.7M21 4v5h-5"/></svg>Sync</button>
</nav>

<div class="screen active" id="screen-trip">
  <div class="brand-row"><div class="brand"><span class="a">agnamo</span><span class="dot">.</span></div><span class="section-label" style="color:var(--orange)">trip</span></div>
  <div id="tripSetup">
    <div class="trip-hero"><div class="eyebrow">Where to?</div><h1>Plan the<br>pack, not<br>the trip.</h1><p class="city">Search a city or scan a flight screenshot.</p></div>
    <div class="field-group">
      <div><label class="lbl">Destination</label><input id="destInput" class="inp" type="text" placeholder="Search any city — Tokyo, Lisbon…" autocomplete="off" autocapitalize="words"><div id="destResults" class="dest-results"></div></div>
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
    <div class="btn-row"><button class="btn btn-dark btn-block" onclick="goScreen('pack')">Start Packing →</button></div>
  </div>
  <div id="tripsList" class="trips-list hidden"><div class="list-label">My Trips</div><div id="tripsListContent"></div></div>
</div>

<div class="screen" id="screen-pack">
  <div class="brand-row"><div class="brand"><span class="a">agnamo</span><span class="dot">.</span></div><span class="section-label" style="color:var(--orange)">pack list</span></div>
  <div class="progress-card"><div class="p-top"><span class="p-title" id="pTitle">0 of 0 packed</span><span class="p-pct" id="pPct">0%</span></div><div class="p-track"><div class="p-fill" id="pFill" style="width:0%"></div></div></div>
  <div class="pack-stats"><div class="pack-stat"><div class="ps-num" id="psTotal">0</div><div class="ps-lbl">Total</div></div><div class="pack-stat"><div class="ps-num" id="psPacked" style="color:var(--teal)">0</div><div class="ps-lbl">Packed</div></div><div class="pack-stat"><div class="ps-num" id="psLeft" style="color:var(--orange)">0</div><div class="ps-lbl">Left</div></div></div>
  <div class="pack-search"><input class="ps-inp" id="packSearch" type="text" placeholder="Search items…" oninput="filterPack()"></div>
  <div class="template-chips" id="templateChips"></div>
  <button class="ai-suggest-btn" id="aiSuggestBtn" onclick="aiSuggest()">✨ AI Suggest — smart packing for your trip</button>
  <div id="packList"></div>
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
    <div class="field-group" style="margin-top:0">
      <div><label class="lbl">Supabase URL</label><input id="sbUrl" class="inp" type="text" placeholder="https://xxxxx.supabase.co" autocapitalize="none" spellcheck="false"></div>
      <div><label class="lbl">Anon Key</label><input id="sbKey" class="inp" type="password" placeholder="eyJhbGci…" autocapitalize="none" spellcheck="false"></div>
    </div>
    <div class="btn-row"><button class="btn btn-fill btn-block" onclick="syncConnect()">Connect & Sync</button></div>
    <div id="syncStatus" class="sync-status disconnected"><div class="dot"></div><span id="syncStatusText">Not connected</span></div>
    <div class="sync-trips-count" id="syncTripsCount"></div>
  </div>
  <div style="font-size:.78rem;color:var(--muted);padding:0 4px;line-height:1.6">
    <p style="margin-bottom:8px"><strong style="color:var(--ink-2)">Setup:</strong></p>
    <ol style="padding-left:20px;margin-bottom:12px"><li>Run <code style="background:var(--surface-2);padding:2px 6px;border-radius:4px;font-size:.72rem">schema.sql</code> in Supabase SQL Editor</li><li>Paste your Project URL + anon key above</li><li>Tap Connect & Sync</li></ol>
    <p>Trip details sync to Supabase. Photos stay on your device.</p>
    <p style="margin-top:12px">Send a flight screenshot to the bot on Telegram and it'll create a trip here automatically.</p>
  </div>
</div>

<div class="toast" id="toast"></div>
<div class="modal-bg" id="modalBg"><div class="modal"><div class="m-icon">✈️</div><h2>Packed.</h2><p>You're ready to move. Safe travels.</p><button class="btn btn-fill btn-block" onclick="document.getElementById('modalBg').classList.remove('show')">Done</button></div></div>
<div class="loading-overlay" id="loadingOverlay"><div class="lo-box"><div class="spinner"></div><div class="lo-text" id="loText">Scanning…</div><div class="lo-sub" id="loSub">Reading flight details</div></div></div>

<script>

const AUTH_LUX='hawaii-27';const AUTH_KIAN='hawaii';const AUTH_KEY='agnamoTripAuth';
function checkAuth(){return localStorage.getItem(AUTH_KEY)===AUTH_LUX||localStorage.getItem(AUTH_KEY)===AUTH_KIAN}
function showAuthGate(){
  const g=document.createElement('div');g.className='auth-gate';g.id='authGate';
  g.innerHTML='<div class="auth-card"><div class="ac-brand"><span class="a">agnamo</span><span class="dot">.</span>&nbsp;trip</div><h2>Access code</h2><p class="ac-sub">Enter your code to continue</p><input class="ac-inp" type="password" id="authInp" placeholder="••••••••" maxlength="8" autocomplete="off"><div class="ac-err" id="authErr">Wrong code</div><button class="btn btn-fill ac-btn" onclick="tryAuth()">Enter</button><div class="ac-hint">San Diego · Honolulu</div></div>';
  document.body.appendChild(g);
  const i=document.getElementById('authInp');i.focus();
  i.addEventListener('keydown',e=>{if(e.key==='Enter')tryAuth()});
}
function tryAuth(){
  const v=document.getElementById('authInp').value.trim();
  if(v===AUTH_LUX||v===AUTH_KIAN){localStorage.setItem(AUTH_KEY,v);document.getElementById('authGate').remove();initApp()}
  else{document.getElementById('authErr').classList.add('show');document.getElementById('authInp').value='';document.getElementById('authInp').focus()}
}

const STORE='agnamoTripPack_v3';
let S=load();let currentDest=null,destResults=[],destTimer=null;
const SB_URL='https://ioogwysicqqiknjzczhe.supabase.co';const SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlvb2d3eXNpY3FxaWtuanpjemhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NjAwNzYsImV4cCI6MjEwNjMzNjA3Nn0.N9l4iZ6taUziO3ceyXE7WGva4zmwXXDCu2I1ea4WLOI';
function load(){try{const s=JSON.parse(localStorage.getItem(STORE));if(s&&s.trips)return s}catch{}return{config:{url:SB_URL,key:SB_KEY},trips:[],activeId:null}}
function save(){localStorage.setItem(STORE,JSON.stringify(S))}
function activeTrip(){return S.trips.find(t=>t.id===S.activeId)||null}
function uuid(){return crypto.randomUUID?crypto.randomUUID():'id-'+Date.now()+'-'+Math.random().toString(36).slice(2)}
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove('show'),2400)}
function showLoading(text,sub){const o=document.getElementById('loadingOverlay');document.getElementById('loText').textContent=text||'Loading…';document.getElementById('loSub').textContent=sub||'';o.classList.add('show')}
function hideLoading(){document.getElementById('loadingOverlay').classList.remove('show')}

/* Supabase */
function sbConfigured(){return S.config.url&&S.config.key}
async function sbFetch(path,opts={}){
  if(!sbConfigured())return null;
  try{return await fetch(\`\${S.config.url}/rest/v1/\${path}\`,{...opts,headers:{'apikey':S.config.key,'Authorization':\`Bearer \${S.config.key}\`,'Content-Type':'application/json',...opts.headers}})}catch{return null}
}
function tripToRow(t){return{id:t.id,city:t.city,country:t.country,cc:t.cc,lat:t.lat,lon:t.lon,tz:t.tz,depart:t.depart,return_date:t.return,airline:t.airline,flight_num:t.flightNum,flight_time:t.flightTime,booking_ref:t.bookingRef,items:t.items,closet:t.closet,style:t.style,weather:t.weather,source:t.source,raw_ocr:t.rawOcr}}
function rowToTrip(r){return{id:r.id,city:r.city,country:r.country,cc:r.cc,lat:r.lat,lon:r.lon,tz:r.tz,depart:r.depart,return:r.return_date,airline:r.airline,flightNum:r.flight_num,flightTime:r.flight_time,bookingRef:r.booking_ref,items:r.items||{},closet:r.closet||[],style:r.style||[],weather:r.weather,source:r.source,rawOcr:r.raw_ocr}}
async function sbLoadTrips(){const r=await sbFetch('trips?order=created_at.desc');if(!r||!r.ok)return[];return(await r.json()).map(rowToTrip)}
async function sbSaveTrip(t){if(!sbConfigured())return;await sbFetch('trips',{method:'POST',headers:{'Prefer':'resolution=merge-duplicates'},body:JSON.stringify(tripToRow(t))})}
async function sbDeleteTrip(id){if(!sbConfigured())return;await sbFetch(\`trips?id=eq.\${id}\`,{method:'DELETE'})}

/* Screen nav */
function goScreen(name){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('screen-'+name).classList.add('active');
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelector(\`.tab[data-screen="\${name}"]\`).classList.add('active');
  window.scrollTo(0,0);
  if(name==='trip')renderTripsList();if(name==='pack')renderPack();if(name==='closet')renderCloset();if(name==='style')renderStyle();if(name==='sync')renderSync();
}
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>goScreen(t.dataset.screen)));

/* Destination search */
const destInput=document.getElementById('destInput'),destResultsEl=document.getElementById('destResults');
destInput.addEventListener('input',()=>{clearTimeout(destTimer);const q=destInput.value.trim();if(q.length<2){destResultsEl.innerHTML='';destResults=[];return}destTimer=setTimeout(async()=>{try{const r=await fetch(\`https://geocoding-api.open-meteo.com/v1/search?name=\${encodeURIComponent(q)}&count=5&language=en&format=json\`);const d=await r.json();destResults=d.results||[];destResultsEl.innerHTML=destResults.map((c,i)=>{const flag=c.country_code?String.fromCodePoint(...[...c.country_code.toUpperCase()].map(ch=>ch.charCodeAt(0)+0x1F1E5-65)):'📍';return \`<div class="dest-result" onclick="pickDest(\${i})"><span class="flag">\${flag}</span><div class="info"><div class="name">\${c.name}</div><div class="region">\${c.admin1||''}\${c.admin1?', ':''}\${c.country}</div></div></div>\`}).join('')}catch{}},350)});
function pickDest(i){currentDest=destResults[i];destInput.value=\`\${currentDest.name}, \${currentDest.country}\`;destResultsEl.innerHTML=''}

/* Trip CRUD */
function saveTrip(){
  if(!currentDest){toast('Search and pick a destination');destInput.focus();return}
  const data={id:activeTrip()?.id||uuid(),city:currentDest.name,country:currentDest.country,cc:currentDest.country_code,lat:currentDest.latitude,lon:currentDest.longitude,tz:currentDest.timezone,depart:document.getElementById('departDate').value||null,return:document.getElementById('returnDate').value||null,airline:document.getElementById('airline').value||'',flightNum:document.getElementById('flightNum').value||'',flightTime:document.getElementById('flightTime').value||'',bookingRef:document.getElementById('bookingRef').value||'',items:activeTrip()?.items||{},closet:activeTrip()?.closet||[],style:activeTrip()?.style||[],weather:activeTrip()?.weather||null,source:activeTrip()?.source||'manual',rawOcr:activeTrip()?.rawOcr||null};
  if(!S.activeId||!activeTrip()){S.trips.push(data);S.activeId=data.id}else Object.assign(activeTrip(),data);
  save();sbSaveTrip(data);renderTripSummary();renderTripsList();autoSuggest();toast('Trip saved');
  if(!activeTrip().weather)fetchWeather();
}
function editTrip(){document.getElementById('tripSetup').classList.remove('hidden');document.getElementById('tripSummary').classList.add('hidden');const t=activeTrip();if(!t)return;currentDest={name:t.city,country:t.country,country_code:t.cc,latitude:t.lat,longitude:t.lon,timezone:t.tz};destInput.value=\`\${t.city}, \${t.country}\`;document.getElementById('departDate').value=t.depart||'';document.getElementById('returnDate').value=t.return||'';document.getElementById('airline').value=t.airline||'';document.getElementById('flightNum').value=t.flightNum||'';document.getElementById('flightTime').value=t.flightTime||'';document.getElementById('bookingRef').value=t.bookingRef||''}
function renderTripSummary(){const t=activeTrip();if(!t)return;document.getElementById('tripSetup').classList.add('hidden');document.getElementById('tripSummary').classList.remove('hidden');document.getElementById('tsDest').textContent=\`\${t.city}, \${t.country}\`;const dates=[];if(t.depart)dates.push(fmtDate(t.depart));if(t.return)dates.push(fmtDate(t.return));document.getElementById('tsDates').textContent=dates.join(' — ');const flight=[];if(t.airline)flight.push(\`<div class="item">Airline<strong>\${t.airline}\${t.flightNum?' '+t.flightNum:''}</strong></div>\`);if(t.flightTime)flight.push(\`<div class="item">Departure<strong>\${t.flightTime}</strong></div>\`);if(t.bookingRef)flight.push(\`<div class="item">Booking Ref<strong>\${t.bookingRef}</strong></div>\`);document.getElementById('tsFlight').innerHTML=flight.join('')||'';document.getElementById('tsSource').innerHTML=t.source&&t.source!=='manual'?\`<div class="source-badge">\${t.source}</div>\`:''}
function renderTripsList(){const el=document.getElementById('tripsList');if(!S.trips.length){el.classList.add('hidden');return}el.classList.remove('hidden');document.getElementById('tripsListContent').innerHTML=S.trips.map(t=>{const dates=[];if(t.depart)dates.push(fmtDate(t.depart));if(t.return)dates.push(fmtDate(t.return));const src=t.source&&t.source!=='manual'?\`<span class="tc-source">\${t.source}</span>\`:'';return \`<div class="trip-card \${t.id===S.activeId?'active':''}" onclick="selectTrip('\${t.id}')"><div class="tc-main"><div class="tc-city">\${t.city}, \${t.country}</div><div class="tc-dates">\${dates.join(' — ')||'No dates'}</div>\${src}</div><button class="tc-del" onclick="event.stopPropagation();deleteTrip('\${t.id}')">✕</button></div>\`}).join('')}
function selectTrip(id){S.activeId=id;save();const t=activeTrip();if(t){currentDest={name:t.city,country:t.country,country_code:t.cc,latitude:t.lat,longitude:t.lon,timezone:t.tz};destInput.value=\`\${t.city}, \${t.country}\`;document.getElementById('departDate').value=t.depart||'';document.getElementById('returnDate').value=t.return||'';document.getElementById('airline').value=t.airline||'';document.getElementById('flightNum').value=t.flightNum||'';document.getElementById('flightTime').value=t.flightTime||'';document.getElementById('bookingRef').value=t.bookingRef||'';renderTripSummary();renderTripsList();renderPack()}}
function deleteTrip(id){S.trips=S.trips.filter(t=>t.id!==id);if(S.activeId===id)S.activeId=S.trips[0]?.id||null;save();sbDeleteTrip(id);if(S.activeId)selectTrip(S.activeId);else{document.getElementById('tripSetup').classList.remove('hidden');document.getElementById('tripSummary').classList.add('hidden')}renderTripsList();renderPack();toast('Trip deleted')}
function fmtDate(s){const d=new Date(s+'T00:00');return d.toLocaleDateString('en',{month:'short',day:'numeric'})}

/* Weather */
async function fetchWeather(){const t=activeTrip();if(!t)return;try{const lat=t.lat.toFixed(2),lon=t.lon.toFixed(2);const r=await fetch(\`https://api.open-meteo.com/v1/forecast?latitude=\${lat}&longitude=\${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max&timezone=\${encodeURIComponent(t.tz||'auto')}&forecast_days=14\`);t.weather=await r.json();save();sbSaveTrip(t);renderWeather();autoSuggest()}catch{toast('Weather fetch failed')}}
const W_ICON={0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',51:'🌦️',53:'🌦️',55:'🌧️',56:'🌧️',57:'🌧️',61:'🌧️',63:'🌧️',65:'🌧️',66:'🌨️',67:'🌨️',71:'❄️',73:'❄️',75:'❄️',77:'❄️',80:'🌦️',81:'🌧️',82:'⛈️',85:'🌨️',86:'🌨️',95:'⛈️',96:'⛈️',99:'⛈️'};
const W_LABEL={0:'Clear',1:'Mostly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Rime fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',56:'Freezing drizzle',57:'Heavy freezing drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',66:'Freezing rain',67:'Heavy freezing rain',71:'Light snow',73:'Snow',75:'Heavy snow',77:'Snow grains',80:'Light showers',81:'Showers',82:'Violent showers',85:'Snow showers',86:'Heavy snow showers',95:'Thunderstorm',96:'Thunderstorm + hail',99:'Severe thunderstorm'};
function renderWeather(){const t=activeTrip();if(!t||!t.weather)return;const w=t.weather,cur=w.current,daily=w.daily;let days=daily.time,start=0,end=Math.min(7,days.length);if(t.depart){const di=days.indexOf(t.depart);if(di>=0){start=di;end=t.return?Math.min((days.indexOf(t.return)??di)+1,days.length):Math.min(di+7,days.length)}}let html=\`<div class="weather-current"><div class="w-icon">\${W_ICON[cur.weather_code]||'🌡️'}</div><div class="w-info"><div class="w-label">Current in \${t.city}</div><div class="w-cond">\${W_LABEL[cur.weather_code]||'—'}</div><div class="w-extra">💧 \${cur.relative_humidity_2m}% · 💨 \${Math.round(cur.wind_speed_10m)} km/h</div></div><div class="w-temp">\${Math.round(cur.temperature_2m)}°</div></div><div class="weather-scroll">\`;for(let i=start;i<end;i++){const d=new Date(days[i]);const lbl=d.toLocaleDateString('en',{weekday:'short',day:'numeric'});const hi=Math.round(daily.temperature_2m_max[i]);const lo=Math.round(daily.temperature_2m_min[i]);const prec=daily.precipitation_probability_max?.[i]??0;html+=\`<div class="w-day"><div class="d-label">\${lbl}</div><div class="d-icon">\${W_ICON[daily.weather_code[i]]||'🌡️'}</div><div class="d-hi">\${hi}°</div><div class="d-lo">\${lo}°</div>\${prec>25?\`<div class="d-precip">💧\${prec}%</div>\`:''}</div>\`}html+='</div>';document.getElementById('weatherBlock').innerHTML=html}

/* Auto-suggest */
function autoSuggest(){const t=activeTrip();if(!t)return;const w=t.weather;let maxT=22,minT=15,rain=false,snow=false,uvHi=false;if(w?.daily){const d=w.daily;const depIdx=t.depart?d.time.indexOf(t.depart):0;const n=Math.min(7,d.time.length-depIdx);for(let i=depIdx;i<depIdx+n&&i<d.time.length;i++){maxT=Math.max(maxT,d.temperature_2m_max[i]);minT=Math.min(minT,d.temperature_2m_min[i]);if((d.precipitation_probability_max?.[i]??0)>30)rain=true;if(d.weather_code[i]>=71&&d.weather_code[i]<=77)snow=true;if((d.uv_index_max?.[i]??0)>6)uvHi=true}}const add=(label,cat,key)=>{const k=\`auto-\${key}\`;if(!t.items[k])t.items[k]={cat,label,checked:false,qty:1,auto:true}};if(maxT>=28){add('Sunscreen','grooming','sunscreen');add('Hat / Cap','apparel','hat')}if(minT<=5){add('Heavy jacket','apparel','heavy-jacket');add('Thermal base layer','apparel','thermal');add('Gloves','apparel','gloves')}if(minT<=-5){add('Scarf','apparel','scarf');add('Warm beanie','apparel','beanie')}if(rain){add('Rain jacket','gear','rain-jacket');add('Umbrella','gear','umbrella')}if(snow){add('Snow boots','gear','snow-boots')}if(uvHi){add('Sunglasses','gear','sunglasses')}if(maxT<=18&&minT>=6){add('Light layer','apparel','light-layer')}save();renderPack()}

/* Packing */
const CATS=[
  {id:'apparel',name:'Apparel',icon:'👕'},
  {id:'grooming',name:'Grooming',icon:'🧴'},
  {id:'beauty',name:'Face & Beauty',icon:'💄'},
  {id:'tech',name:'Tech',icon:'🔌'},
  {id:'health',name:'Health & Meds',icon:'💊'},
  {id:'docs',name:'Travel Docs',icon:'📄'},
  {id:'gear',name:'Gear',icon:'🎒'}
];
const TEMPLATES=[
  {id:'beach',name:'Beach',icon:'🏖️',items:[['apparel','Swimwear',1],['apparel','Sun Hat',1],['apparel','Flip Flops',1],['grooming','Sunscreen',2],['grooming','After Sun Lotion',1],['gear','Beach Bag',1],['gear','Sunglasses',1]]},
  {id:'business',name:'Business',icon:'💼',items:[['apparel','Suit / Blazer',1],['apparel','Dress Shirts',3],['gear','Dress Shoes',1],['tech','Laptop + Charger',1],['docs','Business Cards',1],['docs','Meeting Agenda',1]]},
  {id:'weekend',name:'Weekend',icon:'⚡',items:[['apparel','Tops / Tees',2],['apparel','Pants / Shorts',1],['grooming','Toothbrush & Paste',1],['tech','Phone + Cable',1],['tech','Power Bank',1]]},
  {id:'adventure',name:'Adventure',icon:'🥾',items:[['apparel','Hiking Boots',1],['apparel','Moisture-Wick Tops',2],['apparel','Trail Pants',1],['gear','Day Bag',1],['gear','Water Bottle',1],['health','First Aid Kit',1],['health','Bug Repellent',1]]},
  {id:'festival',name:'Festival',icon:'🎪',items:[['tech','Portable Charger',1],['gear','Fanny Pack',1],['gear','Earplugs',1],['gear','Reusable Cup',1],['apparel','Bandana',1],['health','Sunscreen',1],['health','Electrolytes',1]]}
];
function renderPack(){
  const el=document.getElementById('packList');const t=activeTrip();
  if(!t){el.innerHTML='<div class="empty-state">Set up a trip first → Trip tab</div>';updateProgress();renderTemplates();return}
  if(Object.keys(t.items).length===0){
    const seeds=[
      ['apparel','Tops / Tees',3,false],['apparel','Pants / Shorts',2,false],['apparel','Evening Fit',1,false],
      ['apparel','Outerwear / Jacket',1,false],['apparel','Sleepwear',1,false],['apparel','Underwear & Socks',5,true],
      ['apparel','Swimwear',1,false],['apparel','Accessories',1,false],
      ['grooming','Skincare',1,true],['grooming','Deodorant',1,true],['grooming','Hair Products',1,false],
      ['grooming','Toothbrush & Paste',1,true],['grooming','Shower Kit',1,false],['grooming','Shaving Kit',1,false],
      ['beauty','Foundation',1,false],['beauty','Concealer',1,false],['beauty','Blush / Bronzer',1,false],
      ['beauty','Eyeliner / Mascara',1,false],['beauty','Lip Color',1,false],['beauty','Brushes & Tools',1,false],
      ['beauty','Makeup Remover',1,false],['beauty','Setting Spray',1,false],
      ['tech','Phone + Cable',1,true],['tech','Power Bank',1,false],['tech','Laptop + Charger',1,false],
      ['tech','Earbuds / Headphones',1,false],['tech','Travel Adapter',1,false],
      ['health','First Aid Kit',1,false],['health','Prescription Meds',1,true],['health','Pain Reliever',1,false],
      ['health','Vitamins',1,false],['health','Sunscreen',1,false],['health','Bug Repellent',1,false],
      ['docs','Passport / ID',1,true],['docs','Boarding Pass / Tickets',1,true],['docs','Hotel Reservations',1,false],
      ['docs','Travel Insurance',1,false],['docs','Emergency Contacts',1,false],
      ['gear','Day Bag',1,true],['gear','Sunglasses',1,false],['gear','Water Bottle',1,false],
      ['gear','Umbrella',1,false],['gear','Travel Pillow',1,false],['gear','Luggage Lock',1,false]
    ];
    seeds.forEach(([cat,label,qty,essential])=>{t.items[\`seed-\${cat}-\${label}\`]={cat,label,checked:false,qty,essential:essential||false,auto:false}});
    save();
  }
  renderTemplates();
  const search=(document.getElementById('packSearch')?.value||'').trim().toLowerCase();
  let html='';
  CATS.forEach(cat=>{
    let items=Object.entries(t.items).filter(([k,v])=>v.cat===cat.id);
    if(search)items=items.filter(([k,v])=>v.label.toLowerCase().includes(search));
    if(!items.length)return;
    const done=items.filter(([k,v])=>v.checked).length;
    const allDone=items.length>0&&done===items.length;
    html+=\`<div class="cat-section\${allDone?' open':''}" data-cat="\${cat.id}"><div class="cat-head" onclick="this.parentElement.classList.toggle('open')"><div class="left"><span class="cat-icon">\${cat.icon}</span><span class="cat-name">\${cat.name}</span></div><div class="right"><span class="pill \${allDone?'done':''}">\${done}/\${items.length}</span><svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg></div></div><div class="cat-body"><div class="pack-list">\${items.map(([k,v])=>\`<div class="pack-row \${v.checked?'checked':''}" data-key="\${k}"><div class="check" onclick="toggleItem('\${k}')"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div><span class="p-label">\${v.label}\${v.essential?' <span class="essential-badge">essential</span>':''}\${v.auto?' <span class="auto-badge">weather</span>':''}\${v.fromTemplate?' <span class="auto-badge" style="background:#fef3c7;color:#92400e">'+v.fromTemplate+'</span>':''}</span><div class="qty-control"><button class="qty-btn" onclick="qtyItem('\${k}',-1)">−</button><span class="qty-val">\${v.qty||1}</span><button class="qty-btn" onclick="qtyItem('\${k}',1)">+</button></div><button class="del-btn" onclick="delItem('\${k}')">✕</button></div>\`).join('')}<div class="add-item"><input class="ai-inp" id="add-\${cat.id}" placeholder="Add \${cat.name.toLowerCase()} item…" onkeydown="if(event.key==='Enter')addItem('\${cat.id}')"><button class="ai-btn" onclick="addItem('\${cat.id}')">Add</button></div></div></div></div>\`;
  });
  el.innerHTML=html;
  updateProgress();
  if(!search){const first=el.querySelector('.cat-section');if(first)first.classList.add('open')}
}

function toggleItem(k){const t=activeTrip();if(!t||!t.items[k])return;t.items[k].checked=!t.items[k].checked;save();sbSaveTrip(t);renderPack();if(allPacked())document.getElementById('modalBg').classList.add('show')}
function qtyItem(k,dir){const t=activeTrip();if(!t||!t.items[k])return;t.items[k].qty=Math.max(1,(t.items[k].qty||1)+dir);save();sbSaveTrip(t);renderPack()}
function delItem(k){const t=activeTrip();if(!t||!t.items[k])return;delete t.items[k];save();sbSaveTrip(t);renderPack()}
function addItem(catId){const t=activeTrip();if(!t)return;const inp=document.getElementById(\`add-\${catId}\`);const label=inp.value.trim();if(!label)return;t.items[\`c-\${Date.now()}\`]={cat:catId,label,checked:false,qty:1,auto:false};inp.value='';save();sbSaveTrip(t);renderPack()}
function allPacked(){const t=activeTrip();if(!t)return false;const ks=Object.keys(t.items);return ks.length>0&&ks.every(k=>t.items[k].checked)}
function updateProgress(){
  const t=activeTrip();const ks=t?Object.keys(t.items):[];
  const total=ks.length,done=t?ks.filter(k=>t.items[k].checked).length:0;
  const pct=total?Math.round(done/total*100):0;
  document.getElementById('pPct').textContent=pct+'%';
  document.getElementById('pPct').style.color=pct===100?'var(--teal)':'var(--orange)';
  document.getElementById('pFill').style.width=pct+'%';
  document.getElementById('pFill').classList.toggle('done',pct===100);
  document.getElementById('pTitle').textContent=\`\${done} of \${total} packed\`;
  const psT=document.getElementById('psTotal'),psP=document.getElementById('psPacked'),psL=document.getElementById('psLeft');
  if(psT){psT.textContent=total;psP.textContent=done;psL.textContent=total-done}
}

/* Closet */
function handleClosetUpload(e){const t=activeTrip();if(!t){toast('Set up a trip first');return}const files=[...e.target.files];files.forEach(file=>{const reader=new FileReader();reader.onload=ev=>{t.closet.push({id:'c'+Date.now()+Math.random().toString(36).slice(2,6),src:ev.target.result,selected:false});save();renderCloset()};reader.readAsDataURL(file)});if(files.length)toast(\`Added \${files.length} photo\${files.length>1?'s':''}\`)}
function renderCloset(){const grid=document.getElementById('closetGrid');const t=activeTrip();if(!t){grid.innerHTML='<div class="empty-state" style="grid-column:1/-1;">Set up a trip first → Trip tab</div>';return}if(!t.closet.length){grid.innerHTML='<div class="empty-state" style="grid-column:1/-1;">No closet photos yet — upload above ↑</div>';return}grid.innerHTML=t.closet.map(c=>\`<div class="photo-cell \${c.selected?'selected':''}" onclick="toggleCloset('\${c.id}')"><img src="\${c.src}" alt="closet"><div class="pc-badge"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div><button class="pc-del" onclick="event.stopPropagation();delCloset('\${c.id}')">✕</button></div>\`).join('')}
function toggleCloset(id){const t=activeTrip();if(!t)return;const c=t.closet.find(x=>x.id===id);if(!c)return;c.selected=!c.selected;save();renderCloset();toast(c.selected?'Added to trip':'Removed')}
function delCloset(id){const t=activeTrip();if(!t)return;t.closet=t.closet.filter(x=>x.id!==id);save();renderCloset()}

/* Style */
const STYLE_TAGS=['Casual','Formal','Beach','Street','Athletic','Evening','Business'];let activeTag='Casual';
function handleStyleUpload(e){const t=activeTrip();if(!t){toast('Set up a trip first');return}const files=[...e.target.files];files.forEach(file=>{const reader=new FileReader();reader.onload=ev=>{t.style.push({id:'s'+Date.now()+Math.random().toString(36).slice(2,6),src:ev.target.result,tag:activeTag,note:''});save();renderStyle()};reader.readAsDataURL(file)});if(files.length)toast(\`Added \${files.length} photo\${files.length>1?'s':''}\`)}
function renderStyle(){document.getElementById('styleTags').innerHTML=STYLE_TAGS.map(t=>\`<button class="stag \${t===activeTag?'active':''}" onclick="setTag('\${t}')">\${t}</button>\`).join('');const grid=document.getElementById('styleGrid');const t=activeTrip();if(!t){grid.innerHTML='<div class="empty-state" style="grid-column:1/-1;">Set up a trip first → Trip tab</div>';return}if(!t.style.length){grid.innerHTML='<div class="empty-state" style="grid-column:1/-1;">No style photos yet — upload above ↑</div>';return}grid.innerHTML=t.style.map(s=>\`<div class="style-card"><img src="\${s.src}" alt="outfit"><div class="sc-body"><div class="sc-tag">\${s.tag}</div><input class="sc-inp" placeholder="Note…" value="\${s.note||''}" onchange="editStyleNote('\${s.id}',this.value)"></div><div class="sc-foot"><button class="sc-del" onclick="delStyle('\${s.id}')">Remove</button><span style="font-size:.65rem;color:var(--muted);">\${s.tag}</span></div></div>\`).join('')}
function setTag(t){activeTag=t;renderStyle()}
function editStyleNote(id,note){const tr=activeTrip();if(!tr)return;const s=tr.style.find(x=>x.id===id);if(s){s.note=note;save()}}
function delStyle(id){const t=activeTrip();if(!t)return;t.style=t.style.filter(x=>x.id!==id);save();renderStyle()}


/* Pack v2 — templates, filter, AI suggest */
function renderTemplates(){
  const el=document.getElementById('templateChips');if(!el)return;
  el.innerHTML=TEMPLATES.map(t=>\`<button class="t-chip" onclick="applyTemplate('\${t.id}')"><span class="t-icon">\${t.icon}</span>\${t.name}</button>\`).join('');
}
function filterPack(){renderPack()}
function applyTemplate(id){
  const t=activeTrip();if(!t){toast('Set up a trip first');return}
  const tpl=TEMPLATES.find(x=>x.id===id);if(!tpl)return;
  let added=0;
  tpl.items.forEach(([cat,label,qty])=>{
    const k=\`tpl-\${id}-\${cat}-\${label}\`;
    if(!t.items[k]){t.items[k]={cat,label,checked:false,qty,essential:false,auto:false,fromTemplate:tpl.name};added++}
  });
  save();sbSaveTrip(t);renderPack();
  if(added)toast(\`Added \${added} items from \${tpl.name} template\`);
  else toast(\`\${tpl.name} items already in your list\`);
}
async function aiSuggest(){
  const t=activeTrip();if(!t){toast('Set up a trip first');return}
  const btn=document.getElementById('aiSuggestBtn');
  if(btn){btn.classList.add('loading');btn.textContent='✨ AI is thinking…'}
  showLoading('AI Suggest','Generating smart packing list');
  try{
    const body={destination:\`\${t.city}, \${t.country}\`,departDate:t.depart,returnDate:t.return,weather:t.weather};
    const fnUrl='/api/suggest-packing';
    const r=await fetch(fnUrl,{method:'POST',headers:{'apikey':SB_KEY,'Authorization':\`Bearer \${SB_KEY}\`,'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!r.ok){const err=await r.text();throw new Error('AI suggest failed: '+err)}
    const result=await r.json();
    hideLoading();
    if(result.categories&&Array.isArray(result.categories)){
      let added=0;
      result.categories.forEach(cat=>{
        if(cat.items&&Array.isArray(cat.items)){
          cat.items.forEach(item=>{
            const k=\`ai-\${Date.now()}-\${Math.random().toString(36).slice(2,6)}\`;
            const catId=CATS.find(c=>c.name.toLowerCase()===cat.name?.toLowerCase()?.replace(' & beauty','')?.replace(' & meds',''))?.id||cat.id||'gear';
            if(!t.items[k]){t.items[k]={cat:catId,label:item.label,checked:false,qty:item.qty||1,essential:item.essential||false,auto:false,fromTemplate:'AI'};added++}
          });
        }
      });
      save();sbSaveTrip(t);renderPack();
      toast(\`AI added \${added} smart suggestions\`);
    }else{toast('AI suggestion format unexpected')}
  }catch(err){
    hideLoading();
    // Fallback: use local auto-suggest
    autoSuggest();
    toast('AI suggest unavailable — used weather-based suggestions instead');
  }
  if(btn){btn.classList.remove('loading');btn.textContent='✨ AI Suggest — smart packing for your trip'}
}


/* Screenshot OCR */
const AIRLINES={'JL':'JAL','NH':'ANA','AA':'American Airlines','UA':'United Airlines','DL':'Delta','WN':'Southwest','BA':'British Airways','AF':'Air France','LH':'Lufthansa','KL':'KLM','EK':'Emirates','QR':'Qatar Airways','SQ':'Singapore Airlines','CX':'Cathay Pacific','AC':'Air Canada','QF':'Qantas','NZ':'Air New Zealand','VS':'Virgin Atlantic','FI':'Icelandair','SK':'SAS','IB':'Iberia','AZ':'ITA Airways','KE':'Korean Air','OZ':'Asiana Airlines','CA':'Air China','MU':'China Eastern','CZ':'China Southern','TG':'Thai Airways','MH':'Malaysia Airlines','PR':'Philippine Airlines','5J':'Cebu Pacific','FJ':'Fiji Airways','HA':'Hawaiian Airlines','B6':'JetBlue','NK':'Spirit','AS':'Alaska Airlines','WS':'WestJet'};
const MONTHS={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12,january:1,february:2,march:3,april:4,june:6,july:7,august:8,september:9,october:10,november:11,december:12};
function loadTesseract(){return new Promise((resolve,reject)=>{if(window.Tesseract)return resolve();const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';s.onload=()=>resolve();s.onerror=()=>reject(new Error('Failed to load OCR'));document.head.appendChild(s)})}
async function handleScanScreenshot(e){const file=e.target.files?.[0];if(!file)return;showLoading('Scanning…','AI reading your screenshot');
try{
const reader=new FileReader();
const base64=await new Promise((res,rej)=>{reader.onload=()=>res(reader.result);reader.onerror=rej;reader.readAsDataURL(file)});
const fnUrl='/api/scan-trip';
showLoading('Analyzing…','AI vision parsing flight details');
const r=await fetch(fnUrl,{method:'POST',headers:{'apikey':SB_KEY,'Authorization':\`Bearer \${SB_KEY}\`,'Content-Type':'application/json'},body:JSON.stringify({image:base64})});
if(!r.ok){const err=await r.text();throw new Error('Scan failed: '+err)}
const result=await r.json();
if(result.error)throw new Error(result.error);
hideLoading();
if(result.trip){
const t=result.trip;
currentDest={name:t.city,country:t.country,country_code:t.cc,latitude:t.lat,longitude:t.lon,timezone:t.tz};
destInput.value=\`\${t.city}, \${t.country}\`;
document.getElementById('departDate').value=t.depart||'';
document.getElementById('returnDate').value=t.return||'';
document.getElementById('airline').value=t.airline||'';
document.getElementById('flightNum').value=t.flightNum||'';
document.getElementById('flightTime').value=t.flightTime||'';
document.getElementById('bookingRef').value=t.bookingRef||'';
const newTrip={id:t.id,city:t.city,country:t.country,cc:t.cc,lat:t.lat,lon:t.lon,tz:t.tz,depart:t.depart,return:t.return,airline:t.airline,flightNum:t.flightNum,flightTime:t.flightTime,bookingRef:t.bookingRef,items:t.items,closet:[],style:t.style||[],weather:t.weather,source:'screenshot',rawOcr:null};
S.trips.push(newTrip);S.activeId=t.id;save();
renderTripSummary();renderTripsList();renderPack();
toast('Trip scanned & saved — packing list ready');
}else if(result.parsed){
const p=result.parsed;
if(p.airline)document.getElementById('airline').value=p.airline;
if(p.flightNumber)document.getElementById('flightNum').value=p.flightNumber;
if(p.departureTime)document.getElementById('flightTime').value=p.departureTime;
if(p.departureDate)document.getElementById('departDate').value=p.departureDate;
if(p.returnDate)document.getElementById('returnDate').value=p.returnDate;
if(p.bookingRef)document.getElementById('bookingRef').value=p.bookingRef;
if(p.destinationCity){
try{const gr=await fetch(\`https://geocoding-api.open-meteo.com/v1/search?name=\${encodeURIComponent(p.destinationCity)}&count=1&language=en&format=json\`);const gd=await gr.json();if(gd.results&&gd.results[0]){currentDest=gd.results[0];destInput.value=\`\${currentDest.name}, \${currentDest.country}\`}}catch{}
}
toast('Scanned — review & save');
}
}catch(err){hideLoading();toast('Scan failed — try again or fill in manually');console.error('Scan error:',err)}
e.target.value=''}
function parseFlightText(text){const result={airline:'',flightNum:'',flightTime:'',depart:'',return:'',bookingRef:'',destCity:''};const fn=text.match(/\\b([A-Z0-9]{2})\\s*(\\d{1,4})\\b/);if(fn&&AIRLINES[fn[1]]){result.airline=AIRLINES[fn[1]];result.flightNum=\`\${fn[1]} \${fn[2]}\`}else if(fn)result.flightNum=\`\${fn[1]} \${fn[2]}\`;if(!result.airline){for(const[name,code]of Object.entries(AIRLINES)){if(text.toLowerCase().includes(name.toLowerCase())){result.airline=name;if(!result.flightNum&&code)result.flightNum=code+' ';break}}}const tm=text.match(/\\b(\\d{1,2}):(\\d{2})\\s*(AM|PM)?\\b/i);if(tm){let h=parseInt(tm[1]);const m=tm[2],ap=tm[3];if(ap&&ap.toUpperCase()==='PM'&&h<12)h+=12;if(ap&&ap.toUpperCase()==='AM'&&h===12)h=0;result.flightTime=\`\${String(h).padStart(2,'0')}:\${m}\`}const monthNames=Object.keys(MONTHS);const datesFound=[];const d4=text.match(/\\b(\\d{4})-(\\d{1,2})-(\\d{1,2})\\b/);if(d4)datesFound.push({y:+d4[1],m:+d4[2],d:+d4[3]});const d1=text.match(new RegExp(\`(\${monthNames.join('|')})\\\\.?\\\\s+(\\\\d{1,2})(?:,?\\\\s*(\\\\d{4}))?\`,'i'));if(d1){const m=MONTHS[d1[1].toLowerCase()];if(m)datesFound.push({y:d1[3]?+d1[3]:new Date().getFullYear(),m,d:+d1[2]})}const d2=text.match(new RegExp(\`(\\\\d{1,2})\\\\s+(\${monthNames.join('|')})\\\\.?(?:\\\\s+(\\\\d{4}))?\`,'i'));if(d2){const m=MONTHS[d2[2].toLowerCase()];if(m)datesFound.push({y:d2[3]?+d2[3]:new Date().getFullYear(),m,d:+d2[1]})}if(!d4){const d3=text.match(/\\b(\\d{1,2})[\\/\\-](\\d{1,2})(?:[\\/\\-](\\d{2,4}))?\\b/);if(d3){const y=d3[3]?(d3[3].length===2?2000+ +d3[3]:+d3[3]):new Date().getFullYear();datesFound.push({y,m:+d3[1],d:+d3[2]})}}if(datesFound.length>=1)result.depart=\`\${datesFound[0].y}-\${String(datesFound[0].m).padStart(2,'0')}-\${String(datesFound[0].d).padStart(2,'0')}\`;if(datesFound.length>=2)result.return=\`\${datesFound[1].y}-\${String(datesFound[1].m).padStart(2,'0')}-\${String(datesFound[1].d).padStart(2,'0')}\`;const arrow=text.match(/[A-Za-z\\s,]+?\\s*(?:→|->|—>)\\s*([A-Za-z][A-Za-z\\s,]+)/);const toM=text.match(/(?:To|Arrive|Destination|Arriving)\\s*:?\\s*([A-Za-z][A-Za-z\\s,]+?)(?:\\s*(?:\\(|\\n|$))/i);if(arrow){const city=arrow[1].trim().split(',')[0].trim();if(city.length>2)result.destCity=city}else if(toM){const city=toM[1].trim().split(',')[0].trim();if(city.length>2)result.destCity=city}const refs=text.match(/\\b([A-Z0-9]{6})\\b/g);if(refs){for(const r of refs){if(r!==result.flightNum?.replace(/\\s/g,'')&&!AIRLINES[r]){result.bookingRef=r;break}}}return result}

/* Drag & drop */
function setupDnD(uid,fid){const el=document.getElementById(uid);if(!el)return;el.addEventListener('dragover',e=>{e.preventDefault();el.classList.add('drag')});el.addEventListener('dragleave',()=>el.classList.remove('drag'));el.addEventListener('drop',e=>{e.preventDefault();el.classList.remove('drag');const inp=document.getElementById(fid);inp.files=e.dataTransfer.files;inp.dispatchEvent(new Event('change'))})}
setupDnD('closetUpload','closetFile');setupDnD('styleUpload','styleFile');

/* Sync */
function renderSync(){document.getElementById('sbUrl').value=S.config.url||'';document.getElementById('sbKey').value=S.config.key||'';const st=document.getElementById('syncStatus');if(sbConfigured()){st.className='sync-status connected';document.getElementById('syncStatusText').textContent='Connected — '+S.trips.length+' trips';document.getElementById('syncTripsCount').textContent=S.trips.length+' trips synced'}else{st.className='sync-status disconnected';document.getElementById('syncStatusText').textContent='Not connected';document.getElementById('syncTripsCount').textContent=''}}
async function syncConnect(){const url=document.getElementById('sbUrl').value.trim().replace(/\\/$/,'');const key=document.getElementById('sbKey').value.trim();if(!url||!key){toast('Enter URL and key');return}S.config={url,key};save();showLoading('Syncing…','Loading trips from Supabase');try{const trips=await sbLoadTrips();hideLoading();const sbIds=new Set(trips.map(t=>t.id));S.trips=[...S.trips.filter(t=>!sbIds.has(t.id)),...trips];if(!S.activeId&&S.trips.length)S.activeId=S.trips[0].id;save();renderSync();renderTripsList();if(activeTrip())renderTripSummary();toast(\`Synced \${trips.length} trips\`)}catch{hideLoading();toast('Sync failed — check URL and key')}}

/* Init */
async function initApp(){
  if(sbConfigured()){const trips=await sbLoadTrips().catch(()=>[]);if(trips&&trips.length){const sbIds=new Set(trips.map(t=>t.id));S.trips=[...S.trips.filter(t=>!sbIds.has(t.id)),...trips];if(!S.activeId&&S.trips.length)S.activeId=S.trips[0].id;save()}}
  if(S.activeId&&activeTrip()){const t=activeTrip();currentDest={name:t.city,country:t.country,country_code:t.cc,latitude:t.lat,longitude:t.lon,timezone:t.tz};destInput.value=\`\${t.city}, \${t.country}\`;document.getElementById('departDate').value=t.depart||'';document.getElementById('returnDate').value=t.return||'';document.getElementById('airline').value=t.airline||'';document.getElementById('flightNum').value=t.flightNum||'';document.getElementById('flightTime').value=t.flightTime||'';document.getElementById('bookingRef').value=t.bookingRef||'';renderTripSummary()}
  renderTripsList();renderPack();renderCloset();renderStyle();renderSync();
}
if(checkAuth()){initApp()}else{showAuthGate()}
</script>
</body>
</html>
`;
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

    // ─── /api/health ─────────────────────────────────────────────────────────
    if (path === '/api/health') {
      return json({
        status: 'ok',
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

    // ─── Static assets ────────────────────────────────────────────────────────
    if (env.ASSETS) {
      const assetRes = await env.ASSETS.fetch(request);
      if (assetRes.status !== 404) return assetRes;
    }

    // ─── SPA fallback ──────────────────────────────────────────────────────────
    return new Response(INDEX_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  },
};
