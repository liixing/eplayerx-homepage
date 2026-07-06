/** @jsxImportSource hono/jsx */
/**
 * Server-rendered pages for the EplayerX Blocks portal.
 * Dark, modern UI built with hono/jsx + a little vanilla JS (no build step).
 */

import { raw } from "hono/html";
import {
	type BlockCategory,
	DEFAULT_LANGUAGE,
	type DisplayBlock,
	type SubmissionRow,
	TMDB_LANGUAGES,
} from "./types.js";

// Brand logo (EplayerX), vectorized so it needs no static-file hosting.
const LOGO_SVG = `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="exg" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#93F9A6"/><stop offset="1" stop-color="#16E0D4"/></linearGradient></defs><g fill="url(#exg)"><rect x="205" y="170" width="600" height="206" rx="103" transform="rotate(-7 505 273)"/><rect x="150" y="455" width="345" height="180" rx="90"/><path d="M566 452 L694 516 L602 606 Z" fill="url(#exg)" stroke="url(#exg)" stroke-width="46" stroke-linejoin="round"/><rect x="282" y="650" width="600" height="206" rx="103" transform="rotate(-7 582 753)"/></g></svg>`;

const STYLES = `
:root{--bg:#080a0f;--card:#13171f;--card2:#1b212d;--line:#252d3c;--fg:#eaeef6;--mut:#8b94a7;--b1:#4be08f;--b2:#16e0d4;--acc:#16e0d4;--acc2:#4be08f;--danger:#ff6b6b;--grad:linear-gradient(120deg,#4be08f,#16e0d4)}
*{box-sizing:border-box}
body{margin:0;color:var(--fg);font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;background:var(--bg);background-image:radial-gradient(900px 480px at 78% -8%,rgba(22,224,212,.12),transparent 60%),radial-gradient(760px 420px at 8% 2%,rgba(75,224,143,.10),transparent 55%);background-attachment:fixed;-webkit-tap-highlight-color:transparent}
a{color:var(--acc);text-decoration:none}
.wrap{max-width:900px;margin:0 auto;padding:28px 20px 90px}
.nav{display:flex;gap:20px;align-items:center;padding:14px 22px;border-bottom:1px solid var(--line);position:sticky;top:0;background:rgba(8,10,15,.72);backdrop-filter:blur(14px);z-index:10}
.nav .brand{display:flex;align-items:center;gap:10px;font-weight:700;letter-spacing:.2px;margin-right:6px}
.nav .brand .logo{width:26px;height:26px;display:block;filter:drop-shadow(0 2px 8px rgba(22,224,212,.35))}
.nav .brand .wm{font-size:16px}
.nav .brand .wm b{background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.nav .brand .sfx{color:var(--mut);font-weight:600}
.nav a:not(.brand){color:var(--mut);font-size:14px;padding:6px 2px;position:relative}
.nav a.active{color:var(--fg)}
.nav a.active::after{content:"";position:absolute;left:0;right:0;bottom:-15px;height:2px;border-radius:2px;background:var(--grad)}
.nav .spacer{flex:1}
.nav .cta{color:#062a20!important;background:var(--grad);padding:8px 16px!important;border-radius:999px;font-weight:700;font-size:13px}
h1{font-size:26px;margin:26px 0 6px;letter-spacing:-.3px}
.gradtext{background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.sub{color:var(--mut);margin:0 0 24px}
.card{background:linear-gradient(180deg,rgba(255,255,255,.02),transparent),var(--card);border:1px solid var(--line);border-radius:18px;padding:22px;margin-bottom:18px;box-shadow:0 12px 36px -20px rgba(0,0,0,.7)}
label{display:block;font-size:13px;color:var(--mut);margin:14px 0 6px}
input,select,textarea{width:100%;background:var(--card2);border:1px solid var(--line);color:var(--fg);border-radius:11px;padding:11px 13px;font-size:14px;transition:border-color .15s,box-shadow .15s;font-family:inherit}
input:focus,select:focus,textarea:focus{outline:none;border-color:var(--b2);box-shadow:0 0 0 3px rgba(22,224,212,.16)}
textarea{min-height:64px;resize:vertical}
code,.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.row{display:flex;gap:12px;flex-wrap:wrap}
.row>div{flex:1;min-width:140px}
.chips{display:flex;gap:8px;flex-wrap:wrap}
.chip{padding:9px 15px;border:1px solid var(--line);border-radius:999px;cursor:pointer;background:var(--card2);font-size:14px;user-select:none;transition:all .15s}
.chip:hover{border-color:#3a4456}
.chip.on{border-color:transparent;color:#062a20;font-weight:600;background:var(--grad)}
.btn{display:inline-flex;align-items:center;gap:8px;background:var(--grad);color:#062a20;border:none;border-radius:11px;padding:12px 20px;font-size:14px;font-weight:700;cursor:pointer;transition:transform .12s,box-shadow .15s,opacity .15s;box-shadow:0 8px 22px -10px rgba(22,224,212,.6)}
.btn:hover{transform:translateY(-1px);box-shadow:0 12px 26px -10px rgba(22,224,212,.75)}
.btn.sec{background:var(--card2);border:1px solid var(--line);color:var(--fg);box-shadow:none}
.btn.danger{background:transparent;border:1px solid var(--danger);color:var(--danger);box-shadow:none}
.btn:disabled{opacity:.5;cursor:not-allowed;transform:none;box-shadow:none}
.hint{font-size:12px;color:var(--mut);margin-top:6px}
.tabs{display:flex;gap:8px;margin:0 0 20px;flex-wrap:wrap}
.tabs .tab{padding:7px 16px;border-radius:999px;border:1px solid var(--line);background:transparent;color:var(--mut);font-size:14px;font-family:inherit;cursor:pointer;transition:color .15s,background .15s}
.tabs .tab:hover{color:var(--fg)}
.tabs .tab.on{border-color:transparent;color:#062a20;font-weight:600;background:var(--grad)}
.hide{display:none!important}
.blk{margin:0 0 6px}
.blk-head{display:flex;align-items:center;gap:6px;padding:20px 4px 12px}
.blk-head .bt{font-size:17px;font-weight:600;color:var(--fg)}
.blk-head .chev{color:var(--mut);font-size:18px;line-height:1;margin-left:-2px}
.blk-head .meta-inline{color:var(--mut);font-size:12px;margin-left:auto;white-space:nowrap}
.scroller{display:flex;overflow-x:auto;padding:2px 0 6px;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;scrollbar-width:none}
.scroller::-webkit-scrollbar{display:none}
.it{flex:0 0 auto;padding:0 8px;scroll-snap-align:start}
.it-thumb{width:200px}
.it-poster{width:136px}
.it-hero{width:min(82vw,560px)}
.art{position:relative;border-radius:12px;overflow:hidden;background:var(--card2);transition:transform .18s,filter .18s,box-shadow .18s}
.it:hover .art{transform:scale(1.03);box-shadow:0 10px 28px -12px rgba(0,0,0,.8)}
.art img{width:100%;height:100%;object-fit:cover;display:block}
.art-thumb{width:100%;height:112px}
.art-poster{width:100%;aspect-ratio:2/3}
.art-hero{width:100%;aspect-ratio:16/9;border-radius:16px}
.cap{display:flex;align-items:center;gap:8px;margin-top:8px}
.cap .rk{font-size:30px;font-weight:700;line-height:1;color:rgba(234,238,246,.5);flex:0 0 auto;text-shadow:1px 1px 2px rgba(0,0,0,.3)}
.cap .txt{min-width:0;flex:1}
.t1{font-size:13px;font-weight:500;color:var(--fg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.t2{font-size:11px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
.t2.ov{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.35}
.shimmer{background:linear-gradient(100deg,var(--card2) 30%,#222b3a 50%,var(--card2) 70%);background-size:200% 100%;animation:sh 1.3s linear infinite}
@keyframes sh{to{background-position:-200% 0}}
.sk-line{height:11px;border-radius:4px;width:80%}
.prev-empty{color:var(--mut);font-size:13px;padding:16px 8px}
.ph{position:absolute;inset:0;background:linear-gradient(135deg,#222b3a,#141a25)}
.preview-wrap{margin-top:12px;border:1px dashed var(--line);border-radius:12px;padding:10px 0 4px;background:rgba(255,255,255,.015)}
.preview-wrap .scroller{padding-left:8px}
.msg{padding:10px 14px;border-radius:10px;margin:12px 0;font-size:14px;display:none}
.msg.err{background:rgba(255,107,107,.12);color:var(--danger);display:block}
.msg.ok{background:rgba(75,224,143,.14);color:var(--b1);display:block}
.tag{display:inline-block;font-size:12px;color:var(--mut);background:var(--card2);border:1px solid var(--line);border-radius:6px;padding:2px 8px;margin-right:6px}
.tag-official{color:#062a20;font-weight:700;border-color:transparent;background:var(--grad)}
.hide{display:none}
.spin{width:16px;height:16px;border:2px solid rgba(6,42,32,.35);border-top-color:#062a20;border-radius:50%;animation:sp .7s linear infinite;display:inline-block}
@keyframes sp{to{transform:rotate(360deg)}}
.meta{color:var(--mut);font-size:13px;margin-top:6px}
/* Collection builder (multi-select + bottom bar) */
.blk .pick{display:none;width:22px;height:22px;border-radius:50%;border:2px solid var(--mut);flex:0 0 auto;align-items:center;justify-content:center;font-size:13px;color:#062a20;line-height:1}
body.selecting .blk .pick{display:inline-flex}
.blk.sel .pick{background:var(--grad);border-color:transparent;font-weight:700}
.blk.sel .pick::before{content:"✓"}
body.selecting .blk{cursor:pointer}
body.selecting .blk.sel .blk-head .bt{color:var(--acc)}
body.pack-pick .blk{margin-bottom:14px}
body.pack-pick .blk.sel .blk-head .pick{box-shadow:0 0 0 3px rgba(22,224,212,.25)}
body.pack-pick .hp-card,body.pack-pick .pager{display:none!important}
body.pack-pick .selbar{display:none!important}
.selbar{position:fixed;left:0;right:0;bottom:0;z-index:20;background:rgba(8,10,15,.88);backdrop-filter:blur(14px);border-top:1px solid var(--line);padding:14px 20px calc(14px + env(safe-area-inset-bottom))}
.selbar .inner{max-width:900px;margin:0 auto;display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.selbar input{flex:1;min-width:160px;width:auto}
.selbar .selcount{color:var(--mut);font-size:13px;white-space:nowrap}
.selbar .msg{flex-basis:100%;margin:0}
.colresult{flex-basis:100%;display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.colresult .srcbox{flex:1;min-width:200px;margin-top:0}
body.selecting:not(.pack-pick){padding-bottom:90px}
.blk .share{flex:0 0 auto;background:none;border:1px solid var(--line);color:var(--mut);border-radius:999px;padding:3px 10px;font-size:12px;cursor:pointer}
.blk .share:hover{color:var(--fg);border-color:var(--mut)}
body.selecting .blk .share{display:none}
/* Homepage pack builder */
.pack-steps{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 8px}
.pack-steps .step{font-size:12px;color:var(--mut);padding:5px 12px;border:1px solid var(--line);border-radius:999px;transition:all .18s}
.pack-steps .step.on{color:#062a20;border-color:transparent;background:var(--grad);font-weight:600;box-shadow:0 4px 14px -6px rgba(22,224,212,.45)}
.pack-pick-head{display:none;position:fixed;top:0;left:0;right:0;z-index:50;flex-direction:column;background:rgba(8,10,15,.96);backdrop-filter:blur(16px);border-bottom:1px solid var(--line)}
body.pack-pick.pack-fullscreen .pack-pick-head{display:flex}
body.pack-pick.pack-fullscreen .nav,body.pack-pick.pack-fullscreen .wrap>h1,body.pack-pick.pack-fullscreen .wrap>.sub{display:none!important}
body.pack-pick.pack-fullscreen{overflow:hidden}
body.pack-pick.pack-fullscreen .wrap{position:fixed;top:var(--pick-chrome-h,118px);left:0;right:0;bottom:0;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:0 20px 32px;max-width:none;z-index:40}
body.pack-pick.pack-fullscreen .pack-pick-head .filters{position:relative;top:auto;margin:0;padding:10px 16px 12px;border-bottom:none;background:transparent;animation:none}
body.pack-pick.pack-fullscreen .pack-pick-head .filters .mkbtn{display:none}
body.pack-pick.pack-fullscreen #packSelectedBar{display:flex!important;position:fixed;left:0;right:0;bottom:0;z-index:45;margin:0;border-radius:18px 18px 0 0;border-left:none;border-right:none;border-bottom:none;padding:14px 16px calc(14px + env(safe-area-inset-bottom));background:rgba(8,10,15,.94);backdrop-filter:blur(16px);box-shadow:0 -12px 40px -20px rgba(0,0,0,.8);max-height:38vh;overflow-y:auto}
body.pack-pick.pack-fullscreen #packSelectedBar.hide~*,body.pack-pick.pack-fullscreen .wrap:has(#packSelectedBar.hide){padding-bottom:32px}
body.pack-pick.pack-fullscreen .wrap:has(#packSelectedBar:not(.hide)){padding-bottom:calc(120px + env(safe-area-inset-bottom))}
.pp-toolbar{display:flex;align-items:center;gap:10px;padding:8px 16px calc(8px + env(safe-area-inset-top));border-bottom:1px solid var(--line)}
.pack-pick-head .pp-mid{flex:1;min-width:0;text-align:center}
.pack-pick-head .pack-steps{justify-content:center;margin:0 0 4px}
.pack-pick-head .pp-sub{font-size:12px;color:var(--mut);margin:0;line-height:1.35}
#packPreviewList{display:flex;flex-direction:column;gap:14px;padding:4px 0 20px}
#packPreviewList .pack-slot{margin:0!important}
#packPreviewList .blk{margin-bottom:0}
#packPreviewList .blk .pick,#packPreviewList .blk .share{display:none!important}
#packPreviewList.pack-sorting .pack-slot{transition:transform .28s cubic-bezier(.25,1,.5,1),box-shadow .22s,border-color .22s}
.pack-sort-ghost{opacity:.45!important;background:rgba(22,224,212,.06)!important;border:2px dashed rgba(22,224,212,.35)!important;box-shadow:none!important;transform:none!important}
.pack-sort-ghost *{visibility:hidden}
.pack-sort-chosen{box-shadow:0 16px 40px -14px rgba(0,0,0,.65);border-color:rgba(22,224,212,.45)!important;cursor:grabbing!important}
.pack-sort-drag{opacity:.98;transform:scale(1.015);box-shadow:0 24px 56px -18px rgba(0,0,0,.82);border-color:rgba(22,224,212,.55)!important;z-index:8}
#packSelectedBar{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-start;margin:0 0 16px;padding:12px 14px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.02)}
#packSelectedBar.hide{display:none!important}
#packSelectedBar .slabel{font-size:13px;color:var(--mut);padding-top:6px}
#packSelectedBar .chips{flex:1}
#packSelectedBar .chip.on{position:relative;padding-right:28px}
#packSelectedBar .chip .x{position:absolute;right:8px;top:50%;transform:translateY(-50%);opacity:.7;cursor:pointer}
.blk-stylebar{display:none;gap:8px;flex-wrap:wrap;align-items:center;padding:8px 10px;margin:0 0 6px;border-radius:10px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05)}
body.pack-pick .blk-stylebar{display:none!important}
body.pack-edit .pack-slot .blk-stylebar{display:flex}
.blk-stylebar .slabel{font-size:11px;color:var(--mut);white-space:nowrap;text-transform:uppercase;letter-spacing:.04em}
.blk-stylebar .chips{gap:5px}
.blk-stylebar .chip{padding:7px 13px;font-size:12px;border-radius:10px}
.blk-stylebar .tog{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--fg);cursor:pointer;user-select:none;white-space:nowrap;padding:6px 10px;border-radius:10px;border:1px solid var(--line);background:var(--card2)}
.blk-stylebar .tog input{width:auto;margin:0;accent-color:var(--acc)}
body.pack-edit .blk:not(.pack-slot){display:none!important}
body.pack-edit .hp-card{display:none!important}
body.pack-pick #packEditor{display:none!important}
body.pack-fullscreen{overflow:hidden}
.pack-editor{position:fixed;inset:0;z-index:50;display:flex;flex-direction:column;background:var(--bg);background-image:radial-gradient(900px 480px at 78% -8%,rgba(22,224,212,.12),transparent 60%),radial-gradient(760px 420px at 8% 2%,rgba(75,224,143,.10),transparent 55%)}
.pack-editor.hide{display:none!important}
.pe-head{display:flex;align-items:flex-start;gap:12px;padding:12px 16px calc(12px + env(safe-area-inset-top));border-bottom:1px solid var(--line);background:rgba(8,10,15,.94);backdrop-filter:blur(16px);flex:0 0 auto}
.pe-head .pe-mid{flex:1;min-width:0}
.pe-head .pack-steps{margin-bottom:6px}
.pe-head .pe-title{font-size:16px;font-weight:650}
.pe-head .pe-sub{font-size:12px;color:var(--mut);margin-top:2px}
.pe-body{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px 16px 28px}
.pe-body .wrap-inner{max-width:900px;margin:0 auto}
.pe-final-header{margin:0 0 24px;padding:8px 4px 0}
.pe-final-header h1{font-size:28px;margin:0 0 10px}
.pe-final-header .hp-byline{color:var(--mut);font-size:13px;margin:0 0 6px}
.pe-final-header .hp-meta{color:var(--mut);font-size:13px;margin:0}
body.pack-preview .blk-stylebar,body.pack-preview .drag-handle{display:none!important}
body.pack-preview .pack-slot{border-color:rgba(255,255,255,.04);box-shadow:none;background:transparent;padding:0 4px 8px}
body.pack-preview .pe-foot .pe-edit-only{display:none}
body.pack-edit .pe-foot .pe-preview-only{display:none}
.pe-foot{flex:0 0 auto;padding:16px 16px calc(16px + env(safe-area-inset-bottom));border-top:1px solid var(--line);background:rgba(8,10,15,.94);backdrop-filter:blur(16px)}
.pe-foot .inner{max-width:900px;margin:0 auto}
.pe-foot .msg{margin:10px 0 0}
.pe-meta{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
.pe-meta .pe-field-wide{grid-column:1/-1}
.pe-meta label{display:block;font-size:11px;color:var(--mut);margin:0 0 5px;letter-spacing:.03em}
.pe-meta input{width:100%}
.pe-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.pe-actions .btn{flex:1;min-width:140px;justify-content:center}
.pack-slot{border:none;border-radius:0;padding:0;background:transparent;box-shadow:none}
.pack-slot .blk-head{padding-top:4px}
.pack-slot .drag-handle{flex:0 0 auto;background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:10px;color:var(--mut);cursor:grab;touch-action:none;padding:6px 10px;font-size:14px;letter-spacing:-3px;line-height:1;font-family:inherit;transition:color .15s,border-color .15s,background .15s}
.pack-slot .drag-handle:hover{color:var(--acc);border-color:rgba(22,224,212,.35);background:rgba(22,224,212,.08)}
.pack-slot .drag-handle:active{cursor:grabbing;color:var(--acc)}
body.pack-fullscreen .selbar{display:none!important}
/* Type dropdown + search + language filter + builder buttons */
.filters{display:flex;gap:10px;margin:0 0 18px;flex-wrap:wrap;animation:up .55s .2s cubic-bezier(.22,.68,.3,1) both}
.filters input{flex:1;min-width:180px}
.filters select{width:auto;min-width:110px}
.filters .mkbtn{flex:0 0 auto;background:var(--card2);border:1px solid var(--line);color:var(--fg);border-radius:12px;padding:0 16px;font-size:14px;cursor:pointer;font-family:inherit;transition:border-color .15s,background .15s}
.filters .mkbtn:hover{border-color:var(--acc)}
.filters .mkbtn.on{background:var(--grad);color:#062a20;border-color:transparent;font-weight:600}
.pager{display:flex;align-items:center;justify-content:center;gap:12px;margin:26px 0 4px}
.pager .pbtn{background:var(--card2);border:1px solid var(--line);color:var(--fg);border-radius:999px;padding:9px 16px;font-size:14px}
.pager .pbtn:hover{border-color:var(--acc)}
.pager .pbtn.off{opacity:.45;pointer-events:none}
.pager .pnum{color:var(--mut);font-size:13px}
/* Homepage cards (published packs) + detail page */
.hp-card{cursor:pointer}
.hp-card:hover .bt{color:var(--acc)}
.hp-cover{width:100%;aspect-ratio:1200/630;border:1px solid var(--line);border-radius:16px;overflow:hidden;background:var(--card2);margin:4px 0 12px}
.hp-cover img{width:100%;height:100%;object-fit:cover;display:block}
.hp-chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.hp-chips .hc{background:var(--card2);border:1px solid var(--line);border-radius:999px;padding:5px 13px;font-size:13px;color:var(--mut);white-space:nowrap}
.hp-chips .hc.more{color:var(--acc)}
.hp-actions{display:flex;gap:10px;margin:4px 0 26px;flex-wrap:wrap;align-items:center;animation:up .55s .2s cubic-bezier(.22,.68,.3,1) both}
.hp-actions .msg{margin:0}
.hp-byline{color:var(--mut);font-size:13px;margin:0 0 20px}
/* Collection rows: capsule cards with fanned poster stacks */
.scroller.caps{gap:14px;padding:6px 0 10px}
.capsule{display:inline-flex;align-items:center;gap:12px;flex:0 0 auto;background:rgba(27,33,45,.88);border:1px solid rgba(255,255,255,.06);border-radius:999px;padding:10px 20px 10px 16px;cursor:pointer;color:var(--fg);font-family:inherit;transition:border-color .15s,background .15s,transform .12s;min-height:70px}
.capsule:hover{border-color:#3a4456}
.capsule:active{transform:scale(.96)}
.capsule.on{border-color:rgba(22,224,212,.6);background:linear-gradient(120deg,rgba(75,224,143,.16),rgba(22,224,212,.16))}
/* Deck-style stack: back posters shrink and peek out as thin slivers. */
.capsule .stack{position:relative;width:50px;height:50px;flex:0 0 auto}
.capsule .stack img,.capsule .stack .ph{position:absolute;width:36px;object-fit:cover;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,.5);background:#222b3a;inset:auto}
.capsule .stack .s1{height:50px;left:0;top:0;z-index:3}
.capsule .stack .s2{height:41px;left:7px;top:4px;z-index:2;filter:brightness(.55)}
.capsule .stack .s3{height:32px;left:14px;top:9px;z-index:1;filter:brightness(.35)}
.capsule .clabel{font-size:17px;font-weight:650;white-space:nowrap}
.capsule .cbadge{font-size:11px;color:#062a20;background:var(--grad);border-radius:999px;padding:1px 7px;font-weight:700;margin-left:-4px}
.colprev{min-height:0}
.col-rank,.col-banner,.col-image,.col-image-landscape,.col-image-portrait{flex:0 0 auto;border:1px solid rgba(255,255,255,.06);background:rgba(27,33,45,.9);color:var(--fg);font-family:inherit;cursor:pointer;transition:transform .12s,border-color .15s}
.col-rank:hover,.col-banner:hover,.col-image:hover,.col-image-landscape:hover,.col-image-portrait:hover{border-color:#3a4456}
.capsule:focus,.col-rank:focus,.col-banner:focus,.col-image:focus,.col-image-landscape:focus,.col-image-portrait:focus{outline:none}
.col-rank.on,.col-banner.on,.col-image.on,.col-image-landscape.on,.col-image-portrait.on{border-color:rgba(22,224,212,.32);background:linear-gradient(120deg,rgba(75,224,143,.08),rgba(22,224,212,.08))}
.col-rank{width:300px;height:264px;border-radius:26px;padding:18px;text-align:left;position:relative;overflow:hidden}
.col-rank .rn{display:none}
.rank-title{display:flex;align-items:center;justify-content:center;gap:8px;margin:0 0 12px;color:rgba(234,238,246,.48)}
.rank-title .laurel{width:25px;height:18px;flex:0 0 auto;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.rank-title .laurel.r{transform:scaleX(-1)}
.col-rank .rt{display:block;min-width:0;font-size:18px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#eaeef6;text-align:center}
.rank-posters{display:flex;justify-content:space-between;height:112px;margin-bottom:12px}
.rank-posters .ph,.rank-posters img{width:74px;height:112px;object-fit:cover;border-radius:8px;background:#222b3a}
.rank-lines{display:flex;flex-direction:column;gap:5px;color:rgba(234,238,246,.82);font-size:16px;line-height:20px;height:70px;overflow:hidden;padding-top:0}
.rank-lines span{height:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.col-banner{width:320px;height:160px;border-radius:28px;overflow:hidden;text-align:left;padding:0;position:relative}
.banner-grid{position:absolute;width:202px;height:286px;right:-50px;top:-26px;display:grid;grid-template-columns:repeat(3,62px);grid-auto-rows:90px;gap:8px;transform:rotate(17deg);background:transparent}
.banner-grid .ph,.banner-grid img{width:62px;height:90px;object-fit:cover;border-radius:8px;background:#222b3a}
.banner-grid .s2,.banner-grid .s5,.banner-grid .s8{transform:translateY(36px)}
.banner-grid .s3,.banner-grid .s6,.banner-grid .s9{transform:translateY(-44px)}
.col-banner .bt2{position:absolute;left:24px;top:50%;transform:translateY(-50%);width:124px;display:block;font-size:22px;line-height:1.12;font-weight:800;white-space:normal;overflow:hidden;text-overflow:ellipsis;color:#eaeef6}
.col-banner .banner-logo{position:absolute;left:24px;top:50%;transform:translateY(-50%);width:124px;height:56px;object-fit:contain;display:none}
.col-banner.has-logo .bt2{display:none}
.col-banner.has-logo .banner-logo{display:block}
.col-image{width:184px;border-radius:20px;overflow:hidden;text-align:left;padding:0}
.col-image .logo-img{height:108px;display:flex;align-items:center;justify-content:center;background:#0d1118}
.col-image .logo-img img{max-width:82%;max-height:82%;object-fit:contain}
.col-image .logo-img .stack{position:relative;width:62px;height:62px}
.col-image .logo-img .stack img,.col-image .logo-img .stack .ph{position:absolute;width:44px;object-fit:cover;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.5);background:#222b3a;inset:auto}
.col-image .logo-img .stack .s1{height:62px;left:0;top:0;z-index:3}
.col-image .logo-img .stack .s2{height:52px;left:9px;top:5px;z-index:2;filter:brightness(.55)}
.col-image .logo-img .stack .s3{height:42px;left:18px;top:10px;z-index:1;filter:brightness(.35)}
.col-image .bt2{display:block;padding:10px 12px;font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.col-image-landscape{width:200px;border-radius:20px;overflow:hidden;text-align:left;padding:0}
.col-image-landscape .logo-img{aspect-ratio:16/9;width:100%;display:flex;align-items:center;justify-content:center;background:#0d1118}
.col-image-landscape .logo-img img{width:100%;height:100%;object-fit:cover}
.col-image-landscape .logo-img .stack{position:relative;width:72px;height:40px}
.col-image-landscape .logo-img .stack img,.col-image-landscape .logo-img .stack .ph{position:absolute;width:52px;object-fit:cover;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,.5);background:#222b3a;inset:auto}
.col-image-landscape .logo-img .stack .s1{height:40px;left:0;top:0;z-index:3}
.col-image-landscape .logo-img .stack .s2{height:34px;left:10px;top:3px;z-index:2;filter:brightness(.55)}
.col-image-landscape .logo-img .stack .s3{height:28px;left:20px;top:6px;z-index:1;filter:brightness(.35)}
.col-image-landscape .bt2{display:block;padding:10px 12px;font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.col-image-portrait{width:136px;border-radius:20px;overflow:hidden;text-align:left;padding:0}
.col-image-portrait .logo-img{aspect-ratio:2/3;width:100%;display:flex;align-items:center;justify-content:center;background:#0d1118}
.col-image-portrait .logo-img img{width:100%;height:100%;object-fit:cover}
.col-image-portrait .logo-img .stack{position:relative;width:62px;height:62px}
.col-image-portrait .logo-img .stack img,.col-image-portrait .logo-img .stack .ph{position:absolute;width:44px;object-fit:cover;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.5);background:#222b3a;inset:auto}
.col-image-portrait .logo-img .stack .s1{height:62px;left:0;top:0;z-index:3}
.col-image-portrait .logo-img .stack .s2{height:52px;left:9px;top:5px;z-index:2;filter:brightness(.55)}
.col-image-portrait .logo-img .stack .s3{height:42px;left:18px;top:10px;z-index:1;filter:brightness(.35)}
.col-image-portrait .bt2{display:block;padding:10px 12px;font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* Collection submit panel inside the selection bar */
.grouppanel{flex-basis:100%;border-top:1px solid var(--line);padding-top:12px;margin-top:4px}
.grouppanel .grow{display:flex;gap:10px;align-items:center;margin-bottom:8px}
.grouppanel .grow .gt{flex:1;min-width:0;color:var(--mut);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.grouppanel .grow input{flex:0 0 150px}
.grouppanel .gfoot{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:10px}
.grouppanel .gfoot input{flex:1;min-width:140px}
.colkids{margin-top:14px;border:1px solid var(--line);border-radius:12px;overflow:hidden}
.colkid{display:flex;align-items:center;gap:12px;padding:8px 12px}
.colkid+.colkid{border-top:1px solid var(--line)}
.colkid:hover{background:rgba(255,255,255,.025)}
.colkid .thumb{width:56px;height:28px;flex:none;display:flex;align-items:center;justify-content:center;border-radius:6px;background:rgba(255,255,255,.04);border:1px dashed var(--line);overflow:hidden}
.colkid .thumb.has{border-style:solid}
.colkid .thumb img{max-width:100%;max-height:100%;object-fit:contain}
.colkid .thumb i{font-style:normal;font-size:10px;color:var(--mut);opacity:.7}
.colkid .name{flex:1;font-size:13px}
.btn.mini{padding:5px 12px;font-size:12px;font-weight:600;border-radius:8px;gap:4px}
.bllist{display:flex;flex-direction:column;gap:16px}
.bllist .card{margin-bottom:0;transition:transform .15s,border-color .15s}
.bllist .card:hover{border-color:#33405a}
.srcbox{background:var(--card2);border:1px solid var(--line);border-radius:10px;padding:10px 12px;font-size:12px;color:var(--mut);margin-top:10px;word-break:break-all}
.check{display:flex;align-items:center;gap:8px;color:var(--fg)}
.check input{width:auto}
/* Motion & interaction polish */
@keyframes up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
h1{animation:up .55s .04s cubic-bezier(.22,.68,.3,1) both}
.sub{animation:up .55s .1s cubic-bezier(.22,.68,.3,1) both}
.tabs{animation:up .55s .16s cubic-bezier(.22,.68,.3,1) both}
.blk{opacity:0;transform:translateY(18px);transition:opacity .55s cubic-bezier(.22,.68,.3,1),transform .55s cubic-bezier(.22,.68,.3,1)}
.blk.vis{opacity:1;transform:none}
.scroller.in .it{animation:up .5s cubic-bezier(.22,.68,.3,1) both}
.art img{opacity:0;transition:opacity .45s ease}
.art img.ld{opacity:1}
.blk-head .chev{transition:transform .2s,color .2s}
.blk:hover .chev{transform:translateX(3px);color:var(--acc)}
.it{transition:transform .16s}
.it[data-tid]{cursor:pointer}
.it[data-tid]:hover .t1{color:var(--acc)}
.it[data-tid]:active{transform:scale(.95)}
.it[data-tid]:active .art{filter:brightness(.75)}
.t1{transition:color .15s}
.tabs .tab:active,.chip:active{transform:scale(.94)}
.btn:active{transform:scale(.97)}
.nav .cta{transition:transform .15s,box-shadow .2s}
.nav .cta:hover{transform:translateY(-1px);box-shadow:0 6px 18px -6px rgba(22,224,212,.5)}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}.blk{opacity:1;transform:none}}
`;

const FAVICON = `data:image/svg+xml,${encodeURIComponent(LOGO_SVG)}`;

// iOS deep-link contract: items open the client's detail screen, matching the
// expo-router route `app/tmdb-info/detail.tsx` (params: id + type).
const APP_STORE_ID = "6747369377";
const DETAIL_PATH = "/tmdb-info/detail";
const UNIVERSAL_LINK_BASE = "https://eplayerx.com";
const APP_SCHEME = "eplayerx";
// Universal-link entry for importing blocks/collections into the client.
// Must stay outside `/blocks*`, which the AASA file keeps in the browser.
const IMPORT_LINK_BASE = `${UNIVERSAL_LINK_BASE}/import/blocks`;

type NavKey = "explore" | "submit" | "none";

interface LayoutProps {
	title: string;
	active: NavKey;
	description?: string;
	children?: unknown;
}

const Layout = ({ title, active, description, children }: LayoutProps) => (
	<html lang="zh">
		<head>
			<meta charset="utf-8" />
			<meta name="viewport" content="width=device-width, initial-scale=1" />
			<meta name="apple-itunes-app" content={`app-id=${APP_STORE_ID}`} />
			{description ? <meta name="description" content={description} /> : null}
			<meta property="og:title" content={`${title} · EplayerX Blocks`} />
			{description ? (
				<meta property="og:description" content={description} />
			) : null}
			<meta property="og:type" content="website" />
			<title>{title} · EplayerX Blocks</title>
			<link rel="icon" href={FAVICON} />
			<style dangerouslySetInnerHTML={{ __html: STYLES }} />
		</head>
		<body>
			<nav class="nav">
				<a href="/blocks" class="brand">
					<span
						class="logo"
						dangerouslySetInnerHTML={{
							__html: raw(LOGO_SVG) as unknown as string,
						}}
					/>
					<span class="wm">
						<b>EplayerX</b> <span class="sfx">Blocks</span>
					</span>
				</a>
				<a href="/blocks" class={active === "explore" ? "active" : ""}>
					社区库
				</a>
				<span class="spacer" />
				<a href="/blocks/submit" class="cta">
					+ 投稿
				</a>
			</nav>
			<div class="wrap">{children}</div>
		</body>
	</html>
);

// MARK: - Community library (home)

/** Explore type filter: media categories plus collections and homepages. */
export type ExploreCategory = "all" | BlockCategory | "collection" | "homepage";

const EXPLORE_FILTERS: { id: ExploreCategory; label: string }[] = [
	{ id: "all", label: "全部" },
	{ id: "movie", label: "电影" },
	{ id: "tv", label: "电视剧" },
	{ id: "anime", label: "动漫" },
	{ id: "collection", label: "合集" },
	{ id: "homepage", label: "首页" },
];

/** Published homepage summary, shown as a card on the explore page. */
export interface HomepageSummary {
	collectionId: string;
	title: string;
	blockCount: number;
	installs: number;
	blockTitles: string[];
	authorName?: string | null;
	description?: string | null;
}

interface ExploreProps {
	blocks: DisplayBlock[];
	imageBase: string;
	category: ExploreCategory;
	/** Distinct community languages, for the filter menu. */
	languages: string[];
	homepages: HomepageSummary[];
	pagination: {
		page: number;
		prevHref?: string;
		nextHref?: string;
	};
	/** Admin session detected: renders the collection builder (direct publish). */
	isAdmin: boolean;
}

function languageLabel(code: string): string {
	return TMDB_LANGUAGES.find((l) => l.code === code)?.label ?? code;
}

/** Server-rendered shimmer placeholders, replaced by real artwork once data loads. */
const SkeletonRow = ({ preset }: { preset: DisplayBlock["preset"] }) => {
	const isHero = preset === "hero-list";
	const isPoster = preset === "poster-list";
	const count = isHero ? 2 : isPoster ? 6 : 5;
	const artClass = isHero ? "art-hero" : isPoster ? "art-poster" : "art-thumb";
	const itClass = isHero ? "it-hero" : isPoster ? "it-poster" : "it-thumb";
	return (
		<>
			{Array.from({ length: count }).map(() => (
				<div class={`it ${itClass}`}>
					<div class={`art ${artClass} shimmer`} />
					<div class="cap">
						<div class="txt">
							<div class="sk-line shimmer" />
						</div>
					</div>
				</div>
			))}
		</>
	);
};

/** Whether a section starts hidden for the server-rendered filter value. */
function blockHidden(b: DisplayBlock, category: ExploreCategory): boolean {
	if (category === "all") return false;
	if (category === "homepage") return true;
	if (category === "collection") return !b.collectionChildren;
	return b.category !== category;
}

/** One block row: header + preview strip (chart) or capsules (collection). */
const BlockSection = ({ b, hidden }: { b: DisplayBlock; hidden?: boolean }) => (
	<section
		class={`blk${hidden ? " hide" : ""}`}
		data-id={b.id}
		data-category={b.category}
		data-src={b.previewSrc}
		data-preset={b.preset}
		data-rank={b.showRank ? "1" : "0"}
		data-ov={b.showOverview ? "1" : "0"}
		data-title={b.title}
		data-author={b.author ?? ""}
		data-lang={b.language ?? ""}
		data-kind={b.collectionChildren ? "collection" : "chart"}
		data-mode={b.collectionMode ?? ""}
		data-colstyle={b.collectionStyle ?? ""}
		data-children={
			b.collectionChildren
				? JSON.stringify(
						b.collectionChildren.map((ch) => ({
							id: ch.id,
							label: ch.label,
							weekday: ch.weekday,
							image: ch.image,
							previewSrc: ch.previewSrc,
						})),
					)
				: undefined
		}
	>
		<div class="blk-head">
			<span class="pick" />
			<span class="bt">{b.title}</span>
			<span class="chev">›</span>
			{b.collectionChildren ? <span class="tag tag-official">合集</span> : null}
			<span class="meta-inline">
				{b.collectionChildren
					? `${b.collectionChildren.length} 个榜单 · 安装 ${b.installs ?? 0}`
					: b.official
						? ""
						: `${b.itemCount ?? 0} 项 · 安装 ${b.installs ?? 0}`}
				{b.author ? ` · @${b.author}` : ""}
			</span>
			<button class="share" type="button" data-share={b.id}>
				安装
			</button>
		</div>
		{b.collectionChildren ? (
			<CollectionRow b={b} />
		) : (
			<div class="scroller">
				<SkeletonRow preset={b.preset as "thumb-list"} />
			</div>
		)}
	</section>
);

/** Compact homepage card: title + block-title chips; opens the detail page. */
const HomepageCard = ({
	hp,
	hidden,
}: {
	hp: HomepageSummary;
	hidden: boolean;
}) => (
	<section
		class={`blk hp-card${hidden ? " hide" : ""}`}
		data-hp={hp.collectionId}
		data-title={hp.title}
	>
		<div class="blk-head">
			<span class="bt">{hp.title}</span>
			<span class="chev">›</span>
			<span class="tag tag-official">首页</span>
			<span class="meta-inline">
				{hp.blockCount} 个区块 · 安装 {hp.installs}
			</span>
		</div>
		{hp.authorName ? <div class="hp-byline">by {hp.authorName}</div> : null}
		{hp.description ? <div class="hp-byline">{hp.description}</div> : null}
		<div class="hp-chips">
			{hp.blockTitles.slice(0, 6).map((t) => (
				<span class="hc">{t}</span>
			))}
			{hp.blockTitles.length > 6 ? (
				<span class="hc more">+{hp.blockTitles.length - 6}</span>
			) : null}
		</div>
	</section>
);

/** Capsule cards for a collection row (poster stacks filled in by JS). */
const CollectionRow = ({ b }: { b: DisplayBlock }) => {
	const children = b.collectionChildren ?? [];
	const style = b.collectionStyle ?? "";
	const sharedAttrs = (ch: (typeof children)[number]) => ({
		"data-cid": ch.id,
		"data-csrc": ch.previewSrc,
		"data-wd": ch.weekday ?? "",
	});
	const deck = (
		<span class="stack">
			<span class="ph s1" />
			<span class="ph s2" />
			<span class="ph s3" />
		</span>
	);
	let cards: unknown;
	if (style === "rank") {
		cards = children.map((ch, index) => (
			<button type="button" class="col-rank" {...sharedAttrs(ch)}>
				<span class="rn">{ch.weekday ?? index + 1}</span>
				<span class="rank-title">
					<svg class="laurel" viewBox="0 0 28 20" aria-hidden="true">
						<path d="M22 17 C14 15 8 10 6 3" />
						<path d="M15 13 C14 10 16 8 19 8 C19 11 18 13 15 13" />
						<path d="M11 9 C10 6 12 4 15 4 C15 7 14 9 11 9" />
						<path d="M8 5 C7 3 8.5 1.5 11 1.5 C11 4 10 5.5 8 5" />
					</svg>
					<span class="rt">{ch.label}</span>
					<svg class="laurel r" viewBox="0 0 28 20" aria-hidden="true">
						<path d="M22 17 C14 15 8 10 6 3" />
						<path d="M15 13 C14 10 16 8 19 8 C19 11 18 13 15 13" />
						<path d="M11 9 C10 6 12 4 15 4 C15 7 14 9 11 9" />
						<path d="M8 5 C7 3 8.5 1.5 11 1.5 C11 4 10 5.5 8 5" />
					</svg>
				</span>
				<span class="rank-posters">
					<span class="ph s1" />
					<span class="ph s2" />
					<span class="ph s3" />
				</span>
				<span class="rank-lines" />
			</button>
		));
	} else if (style === "banner") {
		cards = children.map((ch) => (
			<button
				type="button"
				class={`col-banner${ch.image ? " has-logo" : ""}`}
				{...sharedAttrs(ch)}
			>
				<span class="banner-grid">
					<span class="ph s1" />
					<span class="ph s2" />
					<span class="ph s3" />
					<span class="ph s4" />
					<span class="ph s5" />
					<span class="ph s6" />
					<span class="ph s7" />
					<span class="ph s8" />
					<span class="ph s9" />
				</span>
				{ch.image ? (
					<img class="banner-logo" src={ch.image} alt="" loading="lazy" />
				) : null}
				<span class="bt2">{ch.label}</span>
			</button>
		));
	} else if (
		style === "image" ||
		style === "image-landscape" ||
		style === "image-portrait"
	) {
		const imageClass =
			style === "image-landscape"
				? "col-image-landscape"
				: style === "image-portrait"
					? "col-image-portrait"
					: "col-image";
		cards = children.map((ch) => (
			<button type="button" class={imageClass} {...sharedAttrs(ch)}>
				<span class="logo-img">
					{ch.image ? <img src={ch.image} alt="" loading="lazy" /> : deck}
				</span>
				<span class="bt2">{ch.label}</span>
			</button>
		));
	} else {
		cards = children.map((ch) => (
			<button type="button" class="capsule" {...sharedAttrs(ch)}>
				{deck}
				<span class="clabel">{ch.label}</span>
			</button>
		));
	}
	return (
		<>
			<div class="scroller caps">{cards}</div>
			<div class="scroller colprev" data-colprev />
		</>
	);
};

export const ExplorePage = ({
	blocks,
	imageBase,
	category,
	languages,
	homepages,
	pagination,
	isAdmin,
}: ExploreProps) => (
	<Layout title="社区库" active="explore">
		<h1 class="gradtext">社区 Blocks</h1>
		<p class="sub">官方默认板块与社区共建板块,挑你喜欢的加进客户端首页。</p>

		<div class="pack-pick-head hide" id="packPickHead">
			<div class="pp-toolbar">
				<button type="button" class="btn sec" id="packPickCancel">
					取消
				</button>
				<div class="pp-mid">
					<div class="pp-sub" id="packPickSub">
						挑选区块 · 点击加入，可跨页翻页
					</div>
				</div>
				<button type="button" class="btn" id="packPickDone" disabled>
					完成
				</button>
			</div>
		</div>

		<div class="filters">
			<select id="catSel">
				{EXPLORE_FILTERS.map((t) => (
					<option value={t.id} selected={category === t.id}>
						{t.label}
					</option>
				))}
			</select>
			<input id="q" type="search" placeholder="搜索标题 / 作者" />
			<select id="langSel">
				<option value="">全部语言</option>
				{languages.map((code) => (
					<option value={code}>{languageLabel(code)}</option>
				))}
			</select>
			{isAdmin ? (
				<button type="button" class="mkbtn" id="makeGroupBtn">
					生成合集
				</button>
			) : null}
			<button type="button" class="mkbtn" id="makeHomeBtn">
				生成首页
			</button>
		</div>

		<div class="pack-steps hide" id="packSteps">
			<span class="step on" id="packStepPick">
				1. 挑选
			</span>
			<span class="step" id="packStepEdit">
				2. 编辑
			</span>
			<span class="step" id="packStepPreview">
				3. 预览
			</span>
		</div>

		<div class="hide" id="packSelectedBar">
			<span class="slabel">已选</span>
			<div class="chips" id="packSelectedChips" />
		</div>

		{blocks.length === 0 ? (
			<div class="card">
				<p class="meta">这个分类还没有板块,去投稿一个吧。</p>
			</div>
		) : (
			blocks.map((b) => (
				<BlockSection b={b} hidden={blockHidden(b, category)} />
			))
		)}
		{homepages.map((hp) => (
			<HomepageCard hp={hp} hidden={category !== "homepage"} />
		))}
		{category !== "homepage" && (pagination.prevHref || pagination.nextHref) ? (
			<nav class="pager" aria-label="分页">
				{pagination.prevHref ? (
					<a class="pbtn" href={pagination.prevHref} data-page-link>
						上一页
					</a>
				) : (
					<span class="pbtn off">上一页</span>
				)}
				<span class="pnum">第 {pagination.page} 页</span>
				{pagination.nextHref ? (
					<a class="pbtn" href={pagination.nextHref} data-page-link>
						下一页
					</a>
				) : (
					<span class="pbtn off">下一页</span>
				)}
			</nav>
		) : null}
		<div
			class={`card${
				category === "homepage" && homepages.length === 0 ? "" : " hide"
			}`}
			id="hpEmpty"
		>
			<p class="meta">还没有已发布的首页,选中几个区块点「生成首页」试试。</p>
		</div>

		<div class="selbar hide" id="selbar">
			<div class="inner">
				<span class="selcount" id="selCount">
					已选 0
				</span>
				{isAdmin ? (
					<button class="btn" id="groupBtn" type="button">
						发布合集
					</button>
				) : null}
				<button class="btn sec" id="selCancelBtn" type="button">
					取消
				</button>
				<div class="msg" id="colMsg" />

				{isAdmin ? (
					<div class="grouppanel hide" id="groupPanel">
						<div class="gfoot" style="margin:0 0 10px">
							<input
								id="grpTitle"
								placeholder="合集标题,如 每日新番榜"
								maxlength={40}
							/>
							<div class="chips" id="grpMode">
								<div class="chip on" data-v="custom">
									自定义
								</div>
								<div class="chip" data-v="weekday">
									按星期
								</div>
							</div>
						</div>
						<div class="gfoot" style="margin:0 0 10px">
							<span class="hint">合集样式</span>
							<div class="chips" id="grpStyle">
								<div class="chip on" data-v="">
									胶囊
								</div>
								<div class="chip" data-v="rank">
									排行
								</div>
								<div class="chip" data-v="banner">
									横幅
								</div>
								<div class="chip" data-v="image">
									图片
								</div>
								<div class="chip" data-v="image-landscape">
									横图
								</div>
								<div class="chip" data-v="image-portrait">
									竖图
								</div>
							</div>
						</div>
						<div id="grpRows" />
						<div class="gfoot">
							<button class="btn" id="grpSubmitBtn" type="button">
								创建并发布
							</button>
						</div>
						<div class="hint">
							管理员操作:合集直接发布上架社区库,以一行胶囊卡片展示在首页。
						</div>
					</div>
				) : null}
			</div>
		</div>

		<div class="pack-editor hide" id="packEditor">
			<header class="pe-head">
				<button type="button" class="btn sec" id="packEditorBack">
					继续挑选
				</button>
				<div class="pe-mid" id="packEditorMid">
					<div class="pe-title">编辑首页</div>
					<div class="pe-sub">⋮⋮ 拖动排序 · 下方可改样式</div>
				</div>
				<button type="button" class="btn" id="packGoPreviewHead">
					预览
				</button>
			</header>
			<div class="pe-body">
				<div class="wrap-inner">
					<div class="pe-final-header hide" id="packFinalHeader" />
					<div id="packPreviewList" />
				</div>
			</div>
			<footer class="pe-foot">
				<div class="inner pe-edit-only">
					<div class="pe-meta">
						<div class="pe-field">
							<label for="packTitle">标题</label>
							<input
								id="packTitle"
								placeholder="如 周末片单"
								maxlength={40}
							/>
						</div>
						<div class="pe-field">
							<label for="packAuthor">作者</label>
							<input
								id="packAuthor"
								placeholder="可选"
								maxlength={40}
							/>
						</div>
						<div class="pe-field pe-field-wide">
							<label for="packDesc">简介</label>
							<input
								id="packDesc"
								placeholder="可选"
								maxlength={160}
							/>
						</div>
					</div>
					<div class="pe-actions">
						<button class="btn" id="packGoPreviewBtn" type="button">
							预览首页
						</button>
					</div>
					<div class="msg" id="packEditorMsg" />
				</div>
				<div class="inner pe-preview-only hide" id="packPreviewFoot">
					<div class="gfoot">
						<button class="btn sec" id="packBackEditBtn" type="button">
							返回编辑
						</button>
						<button class="btn" id="makePackBtn" type="button">
							确认发布
						</button>
					</div>
					<div class="colresult hide" id="colResult">
						<div class="srcbox mono" id="colUrl" />
						<button class="btn sec" id="copyColBtn" type="button">
							复制链接
						</button>
						<a class="btn sec" id="viewHpBtn" href="#">
							查看首页
						</a>
					</div>
					<div class="msg" id="packPreviewMsg" />
				</div>
			</footer>
		</div>
		<script
			src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.6/Sortable.min.js"
			crossorigin="anonymous"
		/>
		<script
			dangerouslySetInnerHTML={{
				__html: raw(exploreJs(imageBase, isAdmin)) as unknown as string,
			}}
		/>
	</Layout>
);

// MARK: - Homepage detail

interface HomepageDetailProps {
	homepage: HomepageSummary;
	blocks: DisplayBlock[];
	imageBase: string;
}

/** Full view of a published homepage: every block, plus an install link. */
export const HomepageDetailPage = ({
	homepage,
	blocks,
	imageBase,
}: HomepageDetailProps) => {
	const importUrl = `${IMPORT_LINK_BASE}?collectionId=${homepage.collectionId}`;
	const description =
		homepage.description ||
		`${homepage.blockCount} 个区块 · 安装 ${homepage.installs}`;
	return (
		<Layout title={homepage.title} active="explore" description={description}>
			<h1 class="gradtext">{homepage.title}</h1>
			{homepage.authorName ? (
				<div class="hp-byline">by {homepage.authorName}</div>
			) : null}
			{homepage.description ? (
				<div class="hp-byline">{homepage.description}</div>
			) : null}
			<p class="sub">
				{homepage.blockCount} 个区块 · 安装 {homepage.installs}
				。在 iPhone 上安装后会作为一个新首页出现在客户端。
			</p>
			<div class="hp-actions">
				<a
					class="btn"
					href={importUrl}
					id="hpInstallBtn"
					data-cid={homepage.collectionId}
				>
					安装到 App
				</a>
				<button
					class="btn sec"
					id="copyHpBtn"
					type="button"
					data-url={importUrl}
				>
					复制链接
				</button>
				<span class="msg" id="hpMsg" />
			</div>
			{blocks.map((b) => (
				<BlockSection b={b} />
			))}
			<script
				dangerouslySetInnerHTML={{
					__html: raw(homepageJs(imageBase)) as unknown as string,
				}}
			/>
		</Layout>
	);
};

// MARK: - Submit

export const SubmitPage = () => (
	<Layout title="投稿" active="submit">
		<h1 class="gradtext">投稿一个 Block</h1>
		<p class="sub">
			填一个数据源和展示信息,提交后由管理员抓取审核,通过即进社区库。
		</p>

		<div class="card">
			<label>TMDB API Token（必填,投稿凭证,管理员抓取时使用）</label>
			<input id="token" placeholder="以 eyJ 开头的 Read Access Token" />
			<div class="hint">
				提交时会校验有效性。没有的话去
				<a
					href="https://www.themoviedb.org/settings/api"
					target="_blank"
					rel="noreferrer"
				>
					{" "}
					TMDB 申请
				</a>
				。
			</div>

			<label>分类</label>
			<div class="chips" id="category">
				<div class="chip on" data-v="movie">
					电影
				</div>
				<div class="chip" data-v="tv">
					电视剧
				</div>
				<div class="chip" data-v="anime">
					动漫
				</div>
			</div>

			<label>名称</label>
			<input id="title" placeholder="如 高分悬疑剧精选" />

			<label>语言（TMDB 返回标题/简介的语言）</label>
			<select id="language">
				{TMDB_LANGUAGES.map((l) => (
					<option value={l.code} selected={l.code === DEFAULT_LANGUAGE}>
						{l.label}（{l.code}）
					</option>
				))}
			</select>

			<label>榜单地址 / 数据</label>
			<textarea
				id="source"
				class="mono"
				style="min-height:120px"
				placeholder={
					"填一个榜单接口地址,如 /tmdb/trending/movie 或完整 URL\n" +
					'或直接粘贴 JSON 数据,如 [{"id":603,"title":"黑客帝国"}, ...]'
				}
			/>
			<div class="hint">
				只需给一个能拿到榜单的地址,或把整段 JSON
				数据贴进来。抓取与整理由管理员处理。
			</div>

			<label>展示样式</label>
			<div class="chips" id="preset">
				<div class="chip on" data-v="thumb-list">
					横图流
				</div>
				<div class="chip" data-v="poster-list">
					竖图流
				</div>
				<div class="chip" data-v="hero-list">
					大图流
				</div>
			</div>

			<div class="preview-wrap">
				<div class="scroller" id="presetPreview" />
			</div>
			<div class="hint" id="ovNote" style="display:none">
				简介仅在「缩略图流」下展示,海报流/大图流不显示简介。
			</div>

			<div class="row" style="margin-top:6px">
				<div>
					<label class="check">
						<input type="checkbox" id="m_rank" />
						显示排行序号
					</label>
				</div>
				<div>
					<label class="check">
						<input type="checkbox" id="m_overview" />
						显示简介
					</label>
				</div>
			</div>

			<label>署名（可选）</label>
			<input id="m_author" placeholder="昵称,可留空" />

			<div style="margin-top:20px">
				<button class="btn" id="submitBtn" type="button">
					提交审核
				</button>
			</div>
			<div class="msg" id="msg" />
		</div>

		<script
			dangerouslySetInnerHTML={{ __html: raw(SUBMIT_JS) as unknown as string }}
		/>
	</Layout>
);

// MARK: - Admin

interface ImportLandingProps {
	title: string;
	blockTitles: string[];
	importUrl: string;
}

/**
 * Browser fallback for the universal link. Phones with the app installed
 * never see this page (the link opens the app directly); everyone else gets
 * a preview plus the App Store link, with the Smart App Banner on iOS.
 */
export const ImportLandingPage = ({
	title,
	blockTitles,
	importUrl,
}: ImportLandingProps) => (
	<Layout title={title} active="none">
		<h1 class="gradtext">{title}</h1>
		<p class="sub">
			{blockTitles.length} 个区块 · 在 iPhone 上打开本页即可导入 EplayerX
			并生成新首页。
		</p>
		<div class="card">
			{blockTitles.map((blockTitle) => (
				<p class="meta">· {blockTitle}</p>
			))}
		</div>
		<p style="display:flex;gap:10px;flex-wrap:wrap">
			<a class="btn" href={importUrl} id="openAppBtn">
				在 App 中导入
			</a>
			<a class="btn sec" href={`https://apps.apple.com/app/id${APP_STORE_ID}`}>
				下载 EplayerX
			</a>
		</p>
		<script
			dangerouslySetInnerHTML={{
				__html: raw(LANDING_JS) as unknown as string,
			}}
		/>
	</Layout>
);

// Same-domain anchor can't trigger the universal link; try the custom scheme
// first, then fall back to the App Store if the app doesn't take over.
const LANDING_JS = `
const btn=document.getElementById('openAppBtn');
if(btn)btn.addEventListener('click',e=>{
  if(!/iPad|iPhone|iPod/.test(navigator.userAgent))return;
  e.preventDefault();
  const q=(btn.getAttribute('href').split('?')[1])||'';
  const t=setTimeout(()=>{location.href=${JSON.stringify(
		`https://apps.apple.com/app/id${APP_STORE_ID}`,
	)};},1200);
  addEventListener('pagehide',()=>clearTimeout(t),{once:true});
  location.href=${JSON.stringify(`${APP_SCHEME}://import/blocks`)}+'?'+q;
});
`;

export const AdminLoginPage = ({ error }: { error?: boolean }) => (
	<Layout title="审核" active="none">
		<h1 class="gradtext">审核登录</h1>
		<div class="card" style="max-width:420px">
			<form method="post" action="/admin/login">
				<label>管理员密码</label>
				<input type="password" name="password" />
				{error ? <div class="msg err">密码错误</div> : null}
				<div style="margin-top:16px">
					<button class="btn" type="submit">
						登录
					</button>
				</div>
			</form>
		</div>
	</Layout>
);

/** Published collection summary for the admin panel. */
export interface AdminCollectionRow {
	blockId: string;
	title: string;
	mode: "weekday" | "custom";
	children: { id: string; label: string; image?: string }[];
	installs: number;
}

interface AdminPageProps {
	pending: SubmissionRow[];
	collections: AdminCollectionRow[];
}

const ADMIN_CATEGORY_OPTIONS: { value: BlockCategory; label: string }[] = [
	{ value: "movie", label: "电影" },
	{ value: "tv", label: "电视剧" },
	{ value: "anime", label: "动漫" },
];

const ADMIN_PRESET_OPTIONS = [
	{ value: "thumb-list", label: "横图流" },
	{ value: "poster-list", label: "竖图流" },
	{ value: "hero-list", label: "大图流" },
] as const;

/** Pending collection submission: no snapshot/blockId, just review + publish. */
const PendingCollectionCard = ({ s }: { s: SubmissionRow }) => (
	<div class="card" data-id={s.id} data-kind="collection">
		<div>
			<strong style="font-size:16px">{s.title}</strong>
			<div class="meta">
				<span class="tag tag-official">合集</span>
				<span class="tag">{s.category}</span>
				<span class="tag">{s.language}</span>
				{s.author ? ` · @${s.author}` : ""}
			</div>
			<div class="meta">{s.created_at}</div>
		</div>
		<div class="srcbox mono">{s.source_spec}</div>
		<label>名称</label>
		<input data-f="title" data-id={s.id} value={s.title} />
		<label>分类</label>
		<select data-f="category" data-id={s.id}>
			{ADMIN_CATEGORY_OPTIONS.map((o) => (
				<option value={o.value} selected={s.category === o.value}>
					{o.label}
				</option>
			))}
		</select>
		<div class="hint">
			通过后自动生成 blockId 并发布为 collection-list 区块,无需跑发布脚本。
		</div>
		<div style="margin-top:14px;display:flex;gap:10px">
			<button class="btn" type="button" data-act="approve" data-id={s.id}>
				通过并发布
			</button>
			<button class="btn danger" type="button" data-act="reject" data-id={s.id}>
				驳回
			</button>
		</div>
		<div class="msg" data-msg={s.id} />
	</div>
);

export const AdminPage = ({ pending, collections }: AdminPageProps) => (
	<Layout title="审核" active="none">
		<h1 class="gradtext">管理后台</h1>
		<div class="tabs" id="adminTabs">
			<button class="tab on" type="button" data-tab="pending">
				待审投稿（{pending.length}）
			</button>
			<button class="tab" type="button" data-tab="collections">
				合集管理（{collections.length}）
			</button>
		</div>

		<div data-panel="pending">
			<p class="sub">
				先在本地跑发布脚本（scripts/blocks/）抓取并上传 R2,再把输出的 blockId
				填进来;参数可按需修改,点“校验并通过”即发布。合集投稿无需脚本,直接通过。
			</p>
			{pending.length === 0 ? (
				<div class="card">
					<p class="meta">暂无待审投稿。</p>
				</div>
			) : (
				<div class="bllist">
					{pending.map((s) =>
						s.preset === "collection-list" ? (
							<PendingCollectionCard s={s} />
						) : (
							<div class="card" data-id={s.id}>
								<div>
									<strong style="font-size:16px">{s.title}</strong>
									<div class="meta">
										<span class="tag">{s.category}</span>
										<span class="tag">{s.preset}</span>
										<span class="tag">{s.language}</span>
										{s.show_rank ? " · 排行" : ""}
										{s.show_overview ? " · 简介" : ""}
										{s.author ? ` · @${s.author}` : ""}
									</div>
									<div class="meta">{s.created_at}</div>
								</div>
								<div class="srcbox mono">{s.source_spec}</div>
								<label>
									投稿 ID（发布脚本里填 submissionId,token 会自动读取）
								</label>
								<div class="srcbox mono">{s.id}</div>
								<label>名称</label>
								<input data-f="title" data-id={s.id} value={s.title} />
								<div class="row">
									<div>
										<label>分类</label>
										<select data-f="category" data-id={s.id}>
											{ADMIN_CATEGORY_OPTIONS.map((o) => (
												<option
													value={o.value}
													selected={s.category === o.value}
												>
													{o.label}
												</option>
											))}
										</select>
									</div>
									<div>
										<label>媒体类型</label>
										<select data-f="mediaType" data-id={s.id}>
											<option value="movie" selected={s.media_type === "movie"}>
												movie
											</option>
											<option value="tv" selected={s.media_type === "tv"}>
												tv
											</option>
										</select>
									</div>
									<div>
										<label>展示样式</label>
										<select data-f="preset" data-id={s.id}>
											{ADMIN_PRESET_OPTIONS.map((o) => (
												<option value={o.value} selected={s.preset === o.value}>
													{o.label}
												</option>
											))}
										</select>
									</div>
								</div>
								<div class="row" style="margin-top:6px">
									<div>
										<label class="check">
											<input
												type="checkbox"
												data-f="showRank"
												data-id={s.id}
												checked={!!s.show_rank}
											/>
											显示排行序号
										</label>
									</div>
									<div>
										<label class="check">
											<input
												type="checkbox"
												data-f="showOverview"
												data-id={s.id}
												checked={!!s.show_overview}
											/>
											显示简介
										</label>
									</div>
									<div>
										<label class="check">
											<input
												type="checkbox"
												data-f="isAnime"
												data-id={s.id}
												checked={!!s.is_anime}
											/>
											动漫标记
										</label>
									</div>
								</div>
								<label>blockId（本地发布脚本输出）</label>
								<input
									class="mono"
									data-f="blockId"
									data-id={s.id}
									placeholder="community-xxxxxxxxxxxx"
								/>
								<div class="hint">
									本地执行 bun run scripts/blocks/&lt;name&gt;.ts 上传快照后,把
									blockId 粘贴到这里。
								</div>
								<div style="margin-top:14px;display:flex;gap:10px">
									<button
										class="btn"
										type="button"
										data-act="approve"
										data-id={s.id}
									>
										校验并通过
									</button>
									<button
										class="btn danger"
										type="button"
										data-act="reject"
										data-id={s.id}
									>
										驳回
									</button>
								</div>
								<div class="msg" data-msg={s.id} />
							</div>
						),
					)}
				</div>
			)}
		</div>

		<div class="hide" data-panel="collections">
			<p class="sub">
				把已有榜单（社区或官方）组合成一个合集,客户端首页以一行胶囊卡片展示。
			</p>
			<div class="card">
				<strong>新建合集</strong>
				<label>标题</label>
				<input id="ncTitle" placeholder="如 每日新番榜" maxlength={40} />
				<div class="row">
					<div>
						<label>分类</label>
						<select id="ncCategory">
							{ADMIN_CATEGORY_OPTIONS.map((o) => (
								<option value={o.value}>{o.label}</option>
							))}
						</select>
					</div>
					<div>
						<label>模式</label>
						<select id="ncMode">
							<option value="custom">自定义</option>
							<option value="weekday">按星期（今天优先）</option>
						</select>
					</div>
				</div>
				<label>
					子榜单（每行一个: blockId | 标签 | 星期1-7,星期仅按星期模式需要）
				</label>
				<textarea
					id="ncChildren"
					class="mono"
					style="min-height:120px"
					placeholder={
						"community-abc123 | 周一 | 1\ncommunity-def456 | 周二 | 2\ntrending-movies | 热门电影"
					}
				/>
				<div style="margin-top:14px">
					<button class="btn" id="ncCreateBtn" type="button">
						创建并发布
					</button>
				</div>
				<div class="msg" id="ncMsg" />
			</div>
			{collections.length > 0 ? (
				<div class="bllist">
					{collections.map((col) => (
						<div class="card" data-col={col.blockId}>
							<strong style="font-size:16px">{col.title}</strong>
							<div class="meta">
								<span class="tag">
									{col.mode === "weekday" ? "按星期" : "自定义"}
								</span>
								<span class="tag mono">{col.blockId}</span>
								安装 {col.installs}
							</div>
							<div class="colkids">
								{col.children.map((ch) => (
									<div class="colkid">
										<span class={ch.image ? "thumb has" : "thumb"}>
											{ch.image ? <img src={ch.image} alt="" /> : <i>无图</i>}
										</span>
										<span class="name">{ch.label}</span>
										<button
											class="btn sec mini"
											type="button"
											data-colimg={`${col.blockId}|${ch.id}`}
										>
											{ch.image ? "换图" : "传图"}
										</button>
										{ch.image ? (
											<button
												class="btn danger mini"
												type="button"
												data-colimgclear={`${col.blockId}|${ch.id}`}
											>
												清除
											</button>
										) : null}
									</div>
								))}
							</div>
							<div style="margin-top:12px">
								<button
									class="btn danger"
									type="button"
									data-coldel={col.blockId}
								>
									删除
								</button>
							</div>
							<div class="msg" data-colmsg={col.blockId} />
						</div>
					))}
				</div>
			) : null}
		</div>

		<script
			dangerouslySetInnerHTML={{ __html: raw(ADMIN_JS) as unknown as string }}
		/>
	</Layout>
);

// MARK: - Client scripts

/** Shared preview renderer used by the explore and homepage-detail pages. */
function rendererJs(imageBase: string): string {
	return `
const IMG=${JSON.stringify(imageBase)};
function pickList(j){
  if(Array.isArray(j))return j;
  if(j&&typeof j==='object'){
    if(Array.isArray(j.results))return j.results;
    if(Array.isArray(j.data))return j.data;
    for(const v of Object.values(j))if(Array.isArray(v))return v;
  }
  return [];
}
function esc(s){return String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function img(p,sz){return p?(IMG+'/'+sz+p):'';}
function yr(it){const d=it.release_date||it.first_air_date||'';return d?String(d).slice(0,4):'';}
function tt(it){return it.title||it.name||'';}
function pic(u){return u?'<img loading="lazy" src="'+u+'">':'';}
// Deep-link attributes: snapshots carry tmdbId, raw TMDB payloads carry id.
function attrs(it){
  const id=it.tmdbId||it.id;if(!id)return '';
  const mt=it.media_type==='movie'||it.media_type==='tv'?it.media_type:'';
  return ' data-tid="'+id+'"'+(mt?' data-mt="'+mt+'"':'');
}
function cap(it,rankHtml){return '<div class="cap">'+(rankHtml||'')+'<div class="txt"><div class="t1">'+esc(tt(it))+'</div><div class="t2">'+esc(yr(it))+'</div></div></div>';}
function thumb(it,i,rank,ov){
  const u=img(it.thumb||it.backdrop_path||it.poster_path,'w500');
  const rk=rank?'<span class="rk">'+(i+1)+'</span>':'';
  const useOv=!!(ov&&it.overview);
  const sub=useOv?'<div class="t2 ov">'+esc(it.overview)+'</div>':'<div class="t2">'+esc(yr(it))+'</div>';
  return '<div class="it it-thumb"'+attrs(it)+'><div class="art art-thumb">'+pic(u)+'</div><div class="cap">'+rk+'<div class="txt"><div class="t1">'+esc(tt(it))+'</div>'+sub+'</div></div></div>';
}
function poster(it){
  const u=img(it.poster_path||it.thumb||it.backdrop_path,'w342');
  return '<div class="it it-poster"'+attrs(it)+'><div class="art art-poster">'+pic(u)+'</div>'+cap(it)+'</div>';
}
function hero(it){
  const u=img(it.thumb||it.backdrop_path||it.poster_path,'w780');
  return '<div class="it it-hero"'+attrs(it)+'><div class="art art-hero">'+pic(u)+'</div>'+cap(it)+'</div>';
}
const BUILD={'thumb-list':thumb,'poster-list':poster,'hero-list':hero};
// SWR preview cache: keep only the fields the renderers read, capped per row,
// so dozens of blocks stay well under the localStorage quota.
const CK='epx:prev:';
const inflight=new Map();
function slim(it){
  return {id:it.tmdbId||it.id,media_type:it.media_type,title:tt(it),
    release_date:it.release_date||it.first_air_date||'',overview:it.overview||'',
    thumb:it.thumb||'',backdrop_path:it.backdrop_path||'',poster_path:it.poster_path||''};
}
function readCache(src){
  try{const v=JSON.parse(localStorage.getItem(CK+src));return Array.isArray(v)&&v.length?v:null;}catch(e){return null;}
}
function writeCache(src,items){
  if(items&&items.length)try{localStorage.setItem(CK+src,JSON.stringify(items));}catch(e){}
}
async function fetchFresh(src,limit){
  if(inflight.has(src))return inflight.get(src);
  const p=(async()=>{
    const r=await fetch(src);if(!r.ok)throw 0;
    const items=pickList(await r.json()).slice(0,limit).map(slim);
    writeCache(src,items);
    return items;
  })();
  inflight.set(src,p);
  try{return await p;}finally{inflight.delete(src);}
}
function render(sc,items,preset,rank,ov,animate){
  const b=BUILD[preset]||thumb;
  sc.innerHTML=items.map((it,i)=>b(it,i,rank,ov)).join('');
  if(animate)Array.from(sc.children).forEach((el,i)=>{el.style.animationDelay=Math.min(i*45,360)+'ms';});
  sc.querySelectorAll('img').forEach(im=>{
    if(im.complete&&im.naturalWidth)im.classList.add('ld');
    else im.addEventListener('load',()=>im.classList.add('ld'),{once:true});
  });
  sc.classList.add('in');
}
function sameItems(a,b){return !!a&&!!b&&JSON.stringify(a)===JSON.stringify(b);}
function fillCapsule(c,items){
  const lines=c.querySelector('.rank-lines');
  if(lines){
    lines.innerHTML=items.slice(0,3).map((it,i)=>'<span>'+((i+1)+'. '+(it.title||'未命名'))+'</span>').join('');
  }
  const max=c.classList.contains('col-banner')?9:3;
  const basePosters=items.map(it=>img(it.poster_path||it.thumb||it.backdrop_path,'w154')).filter(Boolean);
  const posters=basePosters.length&&c.classList.contains('col-banner')
    ? Array.from({length:max},(_,i)=>basePosters[i%basePosters.length])
    : basePosters.slice(0,max);
  posters.forEach((u,i)=>{
    const ph=c.querySelector('.ph.s'+(i+1)+',img.s'+(i+1));if(!ph)return;
    const im=document.createElement('img');
    im.className='s'+(i+1);im.loading='lazy';im.src=u;
    ph.replaceWith(im);
  });
}
function weekdayToday(){return ((new Date().getDay()+6)%7)+1;}
const LAUREL='<svg class="laurel" viewBox="0 0 28 20" aria-hidden="true"><path d="M22 17 C14 15 8 10 6 3"/><path d="M15 13 C14 10 16 8 19 8 C19 11 18 13 15 13"/><path d="M11 9 C10 6 12 4 15 4 C15 7 14 9 11 9"/><path d="M8 5 C7 3 8.5 1.5 11 1.5 C11 4 10 5.5 8 5"/></svg>';
const LAUREL_R='<svg class="laurel r" viewBox="0 0 28 20" aria-hidden="true"><path d="M22 17 C14 15 8 10 6 3"/><path d="M15 13 C14 10 16 8 19 8 C19 11 18 13 15 13"/><path d="M11 9 C10 6 12 4 15 4 C15 7 14 9 11 9"/><path d="M8 5 C7 3 8.5 1.5 11 1.5 C11 4 10 5.5 8 5"/></svg>';
const COL_DECK='<span class="stack"><span class="ph s1"></span><span class="ph s2"></span><span class="ph s3"></span></span>';
function colAttrs(ch){
  return ' data-cid="'+esc(ch.id)+'" data-csrc="'+esc(ch.previewSrc||'')+'"'+(ch.weekday?' data-wd="'+ch.weekday+'"':'');
}
function buildCollectionCapsHtml(children,style){
  return children.map((ch,i)=>{
    const a=colAttrs(ch);
    if(style==='rank'){
      const rn=ch.weekday||i+1;
      return '<button type="button" class="col-rank"'+a+'><span class="rank-title">'+LAUREL+'<span class="rt">'+esc(ch.label)+'</span>'+LAUREL_R+'</span><span class="rank-posters"><span class="ph s1"></span><span class="ph s2"></span><span class="ph s3"></span></span><span class="rank-lines"></span></button>';
    }
    if(style==='banner'){
      const logo=ch.image?'<img class="banner-logo" src="'+esc(ch.image)+'" alt="" loading="lazy">':'';
      return '<button type="button" class="col-banner'+(ch.image?' has-logo':'')+'"'+a+'><span class="banner-grid"><span class="ph s1"></span><span class="ph s2"></span><span class="ph s3"></span><span class="ph s4"></span><span class="ph s5"></span><span class="ph s6"></span><span class="ph s7"></span><span class="ph s8"></span><span class="ph s9"></span></span>'+logo+'<span class="bt2">'+esc(ch.label)+'</span></button>';
    }
    if(style==='image'||style==='image-landscape'||style==='image-portrait'){
      const cls=style==='image-landscape'?'col-image-landscape':style==='image-portrait'?'col-image-portrait':'col-image';
      const img=ch.image?'<img src="'+esc(ch.image)+'" alt="" loading="lazy">':COL_DECK;
      return '<button type="button" class="'+cls+'"'+a+'><span class="logo-img">'+img+'</span><span class="bt2">'+esc(ch.label)+'</span></button>';
    }
    return '<button type="button" class="capsule"'+a+'>'+COL_DECK+'<span class="clabel">'+esc(ch.label)+'</span></button>';
  }).join('');
}
function readCollectionChildren(sec){
  try{
    const parsed=JSON.parse(sec.dataset.children||'[]');
    if(Array.isArray(parsed)&&parsed.length)return parsed;
  }catch(e){}
  return Array.from(sec.querySelectorAll('[data-csrc]')).map((c,i)=>({
    id:c.dataset.cid||('c'+i),
    label:(c.querySelector('.clabel,.rt,.bt2')||{}).textContent||'',
    weekday:c.dataset.wd?+c.dataset.wd:undefined,
    image:(c.querySelector('.banner-logo,.logo-img img')||{}).src||undefined,
    previewSrc:c.dataset.csrc||'',
  }));
}
function styleToPreset(style,fallback){
  if(style==='poster')return 'poster-list';
  if(style==='hero')return 'hero-list';
  if(style==='thumb')return 'thumb-list';
  return fallback||'thumb-list';
}
function reloadBlockPreview(sec){
  if(!sec)return;
  if(sec.dataset.kind==='collection'){
    const caps=sec.querySelector('.scroller.caps');
    const prev=sec.querySelector('[data-colprev]');
    if(!caps)return;
    const children=readCollectionChildren(sec);
    const style=sec.dataset.colstyle||'';
    caps.innerHTML=buildCollectionCapsHtml(children,style);
    if(prev){prev.innerHTML='';prev.classList.remove('in');}
    sec.querySelectorAll('[data-csrc].on').forEach(c=>c.classList.remove('on'));
    sec.dataset.loaded='';
    loadCollection(sec);
    return;
  }
  const sc=sec.querySelector('.scroller:not(.caps):not(.colprev)');
  if(!sc)return;
  sec.dataset.loaded='';
  sc.classList.remove('in');
  sc.innerHTML='';
  load(sec);
}
function chartBodyHtml(preset){
  const isHero=preset==='hero-list';
  const isPoster=preset==='poster-list';
  const count=isHero?2:isPoster?6:5;
  const artClass=isHero?'art-hero':isPoster?'art-poster':'art-thumb';
  const itClass=isHero?'it-hero':isPoster?'it-poster':'it-thumb';
  let h='';
  for(let i=0;i<count;i++){
    h+='<div class="it '+itClass+'"><div class="art '+artClass+' shimmer"></div><div class="cap"><div class="txt"><div class="sk-line shimmer"></div></div></div></div>';
  }
  return '<div class="scroller">'+h+'</div>';
}
function collectionBodyHtml(b){
  const children=(b.collectionChildren||[]).map(ch=>({
    id:ch.id,label:ch.label,weekday:ch.weekday,image:ch.image,previewSrc:ch.previewSrc,
  }));
  const style=b.collectionStyle||'';
  return '<div class="scroller caps">'+buildCollectionCapsHtml(children,style)+'</div><div class="scroller colprev" data-colprev></div>';
}
function buildBlockSectionEl(b){
  const sec=document.createElement('section');
  sec.className='blk pack-slot sel vis';
  sec.dataset.id=b.id;
  sec.dataset.category=b.category||'tv';
  sec.dataset.src=b.previewSrc||'';
  sec.dataset.preset=b.preset||'thumb-list';
  sec.dataset.rank=b.showRank?'1':'0';
  sec.dataset.ov=b.showOverview?'1':'0';
  sec.dataset.title=b.title||'';
  sec.dataset.author=b.author||'';
  sec.dataset.lang=b.language||'';
  sec.dataset.kind=b.collectionChildren?'collection':'chart';
  sec.dataset.mode=b.collectionMode||'';
  sec.dataset.colstyle=b.collectionStyle||'';
  if(b.collectionChildren){
    sec.dataset.children=JSON.stringify(b.collectionChildren.map(ch=>({
      id:ch.id,label:ch.label,weekday:ch.weekday,image:ch.image,previewSrc:ch.previewSrc,
    })));
  }
  const meta=b.collectionChildren
    ? (b.collectionChildren.length+' 个榜单')
    : ((b.itemCount||0)+' 项');
  sec.innerHTML='<div class="blk-head"><button type="button" class="drag-handle" aria-label="拖拽排序">⋮⋮</button><span class="bt">'+esc(b.title)+'</span><span class="chev">›</span>'
    +(b.collectionChildren?'<span class="tag tag-official">合集</span>':'')
    +'<span class="meta-inline">'+esc(meta)+'</span></div>'
    +(b.collectionChildren?collectionBodyHtml(b):chartBodyHtml(b.preset));
  return sec;
}
// Collection rows: fan the first posters of each child into the capsule
// stacks; weekday collections rotate so today's chart comes first.
async function loadCollection(sec){
  const caps=sec.querySelector('.scroller.caps');if(!caps)return;
  if(sec.dataset.mode==='weekday'){
    const today=weekdayToday();
    const cards=Array.from(caps.querySelectorAll('[data-csrc]'));
    const key=c=>c.dataset.wd?(((+c.dataset.wd)-today+7)%7):99;
    cards.sort((a,b)=>key(a)-key(b)).forEach(c=>caps.appendChild(c));
  }
  caps.classList.add('in');
  caps.querySelectorAll('[data-csrc]').forEach(async c=>{
    const src=c.dataset.csrc;
    const cached=readCache(src);
    if(cached)fillCapsule(c,cached);
    try{
      const fresh=await fetchFresh(src,20);
      if(!sameItems(cached,fresh))fillCapsule(c,fresh);
    }catch(e){}
  });
}
// Tap a capsule -> load that chart into the preview strip below the row.
async function toggleCapsule(sec,cap){
  const prev=sec.querySelector('[data-colprev]');if(!prev)return;
  const wasOn=cap.classList.contains('on');
  sec.querySelectorAll('[data-csrc].on').forEach(c=>c.classList.remove('on'));
  if(wasOn){prev.innerHTML='';prev.classList.remove('in');return;}
  cap.classList.add('on');
  const src=cap.dataset.csrc;
  const cached=readCache(src);
  if(cached)render(prev,cached.slice(0,12),'poster-list',false,false,true);
  try{
    const fresh=await fetchFresh(src,20);
    if(!cap.classList.contains('on'))return;
    if(!fresh.length&&!cached){prev.innerHTML='<div class="prev-empty">预览暂不可用</div>';return;}
    if(!sameItems(cached,fresh))render(prev,fresh.slice(0,12),'poster-list',false,false,!cached);
  }catch(e){
    if(!cached)prev.innerHTML='<div class="prev-empty">预览暂不可用</div>';
  }
}
// Stale-while-revalidate: paint the cached preview instantly (no skeleton),
// then fetch in the background and only repaint when the data changed.
async function load(sec){
  if(sec.dataset.loaded)return;sec.dataset.loaded='1';
  if(sec.dataset.kind==='collection'){loadCollection(sec);return;}
  const sc=sec.querySelector('.scroller');
  const src=sec.dataset.src;const preset=sec.dataset.preset||'thumb-list';
  if(!src){sc.innerHTML='<div class="prev-empty">此区块会在 App 内展示</div>';return;}
  const rank=sec.dataset.rank==='1';const ov=sec.dataset.ov==='1';
  const cached=readCache(src);
  if(cached)render(sc,cached,preset,rank,ov,false);
  try{
    const max=preset==='hero-list'?8:20;
    const fresh=await fetchFresh(src,max);if(!fresh.length)throw 0;
    if(!sameItems(cached,fresh))render(sc,fresh,preset,rank,ov,!cached);
  }catch(e){
    if(cached)return; // stale preview is better than an error
    sc.dataset.loaded='';sec.dataset.loaded='';sc.innerHTML='<div class="prev-empty">预览暂不可用</div>';
  }
}
// Universal links never fire on same-domain taps, so try the custom scheme
// first and fall back to the web URL if the app doesn't take over.
const DETAIL=${JSON.stringify(`${UNIVERSAL_LINK_BASE}${DETAIL_PATH}`)};
const SCHEME=${JSON.stringify(`${APP_SCHEME}:/${DETAIL_PATH}`)};
const IMPORT_WEB=${JSON.stringify(IMPORT_LINK_BASE)};
const IMPORT_SCHEME=${JSON.stringify(`${APP_SCHEME}://import/blocks`)};
function openApp(scheme,web){
  if(/iPad|iPhone|iPod/.test(navigator.userAgent)){
    const t=setTimeout(()=>{location.href=web;},1200);
    addEventListener('pagehide',()=>clearTimeout(t),{once:true});
    location.href=scheme;
  }else{
    location.href=web;
  }
}
// Tap a card -> the iOS client's detail screen (app/tmdb-info/detail.tsx).
function openDetail(id,mt){
  const q='?id='+encodeURIComponent(id)+'&type='+(mt||'movie');
  openApp(SCHEME+q,DETAIL+q);
}
// Open the app's block import flow (app/import/blocks.tsx).
function openImport(query){openApp(IMPORT_SCHEME+'?'+query,IMPORT_WEB+'?'+query);}
async function copyText(text){
  try{await navigator.clipboard.writeText(text);return true;}
  catch(e){
    const ta=document.createElement('textarea');ta.value=text;
    document.body.appendChild(ta);ta.select();
    let ok=false;try{ok=document.execCommand('copy');}catch(e2){}
    ta.remove();return ok;
  }
}
// Page hook: return true to consume a section tap (used by selection mode).
let onBlkTap=null;
// Lazy-load on scroll; hidden (display:none) sections only load once their
// filter shows them and they enter the viewport.
const io=new IntersectionObserver((es)=>{es.forEach(e=>{if(e.isIntersecting)load(e.target);});},{rootMargin:'400px'});
// Reveal-on-scroll: fires again when a hidden section is re-shown.
const rio=new IntersectionObserver((es)=>{es.forEach(e=>{if(e.isIntersecting)e.target.classList.add('vis');});},{threshold:.08});
document.querySelectorAll('.blk').forEach(s=>{
  io.observe(s);rio.observe(s);
  const fallbackMt=s.dataset.category==='movie'?'movie':'tv';
  s.addEventListener('click',e=>{
    if(onBlkTap&&onBlkTap(s,e))return;
    const cap=e.target.closest('[data-csrc]');
    if(cap){toggleCapsule(s,cap);return;}
    const it=e.target.closest('.it');
    if(it&&it.dataset.tid)openDetail(it.dataset.tid,it.dataset.mt||fallbackMt);
  });
});
// Per-block install: open the app's import flow for that single block.
document.querySelectorAll('.share[data-share]').forEach(btn=>{
  btn.addEventListener('click',e=>{
    e.stopPropagation();
    openImport('blockId='+encodeURIComponent(btn.dataset.share));
  });
});
`;
}

/**
 * Collection builder for logged-in admins: pick charts on the explore page
 * and publish a collection directly (no review queue). Only emitted when the
 * matching admin-only DOM (makeGroupBtn/groupBtn/groupPanel) was rendered.
 */
const ADMIN_GROUP_JS = `
// ── Admin collection builder: select charts, publish directly ───────
const WD_LABELS=['周一','周二','周三','周四','周五','周六','周日'];
let grpModeV='custom';
let grpStyleV='';
const GRP_TITLE_DEFAULT_STYLE={Directors:'image-landscape',Decades:'image-landscape',Awards:'image-landscape'};
function applyGroupTitleDefaultStyle(){
  const title=document.getElementById('grpTitle').value.trim();
  const def=GRP_TITLE_DEFAULT_STYLE[title];
  if(!def)return;
  document.querySelectorAll('#grpStyle .chip').forEach(x=>{
    x.classList.toggle('on',x.dataset.v===def);
  });
  grpStyleV=def;
}
document.getElementById('grpTitle').addEventListener('input',applyGroupTitleDefaultStyle);
function buildGroupRows(){
  const rows=document.getElementById('grpRows');
  rows.innerHTML='';
  let idx=0;
  selected.forEach(id=>{
    const sec=document.querySelector('.blk[data-id="'+CSS.escape(id)+'"]');
    const title=(sec&&sec.dataset.title)||id;
    const row=document.createElement('div');row.className='grow';
    if(sec&&sec.dataset.kind==='collection'){
      row.innerHTML='<span class="gt">'+esc(title)+'（合集不可嵌套,已忽略）</span>';
      rows.appendChild(row);return;
    }
    const i=idx++;
    row.innerHTML='<span class="gt">'+esc(title)+'</span><input maxlength="14" data-gid="'+esc(id)+'" placeholder="标签">';
    rows.appendChild(row);
    row.querySelector('input').value=grpModeV==='weekday'?(WD_LABELS[i]||''):String(title).slice(0,14);
  });
}
makeGroupBtn.onclick=()=>setSelMode(selKind==='group'?'':'group');
groupBtn.onclick=()=>{
  if(!requireSelection())return;
  buildGroupRows();showPanel('group');
};
document.querySelectorAll('#grpMode .chip').forEach(c=>{
  c.onclick=()=>{
    document.querySelectorAll('#grpMode .chip').forEach(x=>x.classList.remove('on'));
    c.classList.add('on');grpModeV=c.dataset.v;buildGroupRows();
  };
});
document.querySelectorAll('#grpStyle .chip').forEach(c=>{
  c.onclick=()=>{
    document.querySelectorAll('#grpStyle .chip').forEach(x=>x.classList.remove('on'));
    c.classList.add('on');grpStyleV=c.dataset.v||'';
  };
});
// Majority category among the picked charts, for the published block.
function groupCategory(){
  const counts={};
  selected.forEach(id=>{
    const sec=document.querySelector('.blk[data-id="'+CSS.escape(id)+'"]');
    const cat=sec&&sec.dataset.category;
    if(cat)counts[cat]=(counts[cat]||0)+1;
  });
  let best='tv',n=0;
  for(const k in counts)if(counts[k]>n){best=k;n=counts[k];}
  return best;
}
document.getElementById('grpSubmitBtn').onclick=async()=>{
  const title=document.getElementById('grpTitle').value.trim();
  if(!title)return colShow('err','请填写合集标题');
  const inputs=Array.from(document.querySelectorAll('#grpRows input[data-gid]'));
  if(inputs.length<2)return colShow('err','合集至少需要 2 个榜单');
  if(grpModeV==='weekday'&&inputs.length>7)return colShow('err','按星期模式最多 7 个榜单');
  const children=inputs.map((inp,i)=>{
    const ch={blockId:inp.dataset.gid,label:inp.value.trim()};
    if(grpModeV==='weekday')ch.weekday=i+1;
    return ch;
  });
  if(children.some(ch=>!ch.label))return colShow('err','请为每个榜单填写标签');
  const btn=document.getElementById('grpSubmitBtn');
  btn.disabled=true;btn.innerHTML='<span class="spin"></span> 发布中…';
  colShow('','');
  try{
    const r=await fetch('/admin/collections/create',{method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({title,mode:grpModeV,style:grpStyleV,category:groupCategory(),children})});
    const j=await r.json();
    if(!r.ok){colShow('err',j.error||'发布失败');btn.disabled=false;btn.textContent='创建并发布';return;}
    colShow('ok','已发布 · '+j.blockId+'（刷新页面查看）');
    showPanel('');
    btn.disabled=false;btn.textContent='创建并发布';
  }catch(e){colShow('err','网络错误');btn.disabled=false;btn.textContent='创建并发布';}
};
`;

function exploreJs(imageBase: string, isAdmin: boolean): string {
	return `${rendererJs(imageBase)}
// Evict cache entries for blocks no longer on the page (all categories are
// always rendered, so data-src + capsule data-csrc is the complete live set).
try{
  const live=new Set();
  document.querySelectorAll('.blk[data-src]').forEach(s=>{if(s.dataset.src)live.add(CK+s.dataset.src);});
  document.querySelectorAll('[data-csrc]').forEach(c=>live.add(CK+c.dataset.csrc));
  for(let i=localStorage.length-1;i>=0;i--){
    const k=localStorage.key(i);
    if(k&&k.indexOf(CK)===0&&!live.has(k))localStorage.removeItem(k);
  }
}catch(e){}
// Type dropdown + free-text search + language filter, combined client-side.
const qInput=document.getElementById('q');
const langSel=document.getElementById('langSel');
const catSel=document.getElementById('catSel');
let curCat=catSel.value||'all';
function applyFilters(){
  const q=(qInput.value||'').trim().toLowerCase();
  const lang=langSel.value;
  const isHome=curCat==='homepage';
  let hpShown=0;
  document.querySelectorAll('.blk').forEach(s=>{
    let show;
    if(s.classList.contains('hp-card')){
      const qOk=!q||(s.dataset.title||'').toLowerCase().indexOf(q)>=0;
      show=isHome&&qOk&&!selMode;
      if(show)hpShown++;
    }else{
      if(packPhase==='edit'&&selKind==='pack'){
        show=s.classList.contains('pack-slot');
      }else{
        let catOk;
        if(isHome)catOk=false;
        else if(curCat==='collection')catOk=s.dataset.kind==='collection';
        else catOk=curCat==='all'||s.dataset.category===curCat;
        if(selKind==='group'&&s.dataset.kind==='collection')catOk=false;
        const langOk=!lang||s.dataset.lang===lang;
        const text=((s.dataset.title||'')+' '+(s.dataset.author||'')).toLowerCase();
        const qOk=!q||text.indexOf(q)>=0;
        show=catOk&&langOk&&qOk;
      }
    }
    if(!show)s.classList.remove('vis');
    s.classList.toggle('hide',!show);
  });
  const hint=document.getElementById('hpEmpty');
  if(hint)hint.classList.toggle('hide',!(isHome&&hpShown===0&&!selMode));
}
function applyCategory(cat){
  if(cat===curCat)return;
  curCat=cat;catSel.value=cat;
  const u=new URL(location.href);
  if(cat==='all')u.searchParams.delete('category');else u.searchParams.set('category',cat);
  u.searchParams.delete('page');
  if(selMode&&selKind==='pack'){
    savePackState();
    u.searchParams.set('pack','1');
    location.href=u;
    return;
  }
  if(selMode){
    applyFilters();
    history.replaceState(null,'',u);
    return;
  }
  location.href=u;
}
catSel.addEventListener('change',()=>applyCategory(catSel.value));
qInput.addEventListener('input',applyFilters);
langSel.addEventListener('change',applyFilters);
// Homepage cards open the detail page (full block list + install).
document.querySelectorAll('.hp-card').forEach(c=>{
  c.addEventListener('click',()=>{location.href='/blocks/homepages/'+c.dataset.hp;});
});
// ── Homepage pack builder (pick → edit → publish) ───────────────────
let selMode=false;
let selKind='';
let packPhase='';
const selected=new Set();
const selectedOrder=[];
const blockConfigs=new Map();
const selbar=document.getElementById('selbar');
const makeHomeBtn=document.getElementById('makeHomeBtn');
const packPickDone=document.getElementById('packPickDone');
const packPickHead=document.getElementById('packPickHead');
let filtersAnchor=null;
const colMsg=document.getElementById('colMsg');
const colResult=document.getElementById('colResult');
const packEditor=document.getElementById('packEditor');
const packEditorMsg=document.getElementById('packEditorMsg');
const packSteps=document.getElementById('packSteps');
const packStepPick=document.getElementById('packStepPick');
const packStepEdit=document.getElementById('packStepEdit');
const packStepPreview=document.getElementById('packStepPreview');
const packPreviewList=document.getElementById('packPreviewList');
const packFinalHeader=document.getElementById('packFinalHeader');
const makeGroupBtn=document.getElementById('makeGroupBtn');
const groupBtn=document.getElementById('groupBtn');
const groupPanel=document.getElementById('groupPanel');
const CHART_STYLES=[{v:'thumb',l:'横图'},{v:'poster',l:'竖图'},{v:'hero',l:'大图'}];
const PACK_COL_STYLES=[{v:'',l:'胶囊'},{v:'rank',l:'排行'},{v:'banner',l:'横幅'},{v:'image',l:'图片'},{v:'image-landscape',l:'横图'},{v:'image-portrait',l:'竖图'}];
function presetToStyle(preset){
  if(preset==='poster-list')return 'poster';
  if(preset==='hero-list')return 'hero';
  return 'thumb';
}
function defaultStyleForSec(sec){
  if(!sec)return 'thumb';
  if(sec.dataset.kind==='collection')return sec.dataset.colstyle||'';
  return presetToStyle(sec.dataset.preset||'thumb-list');
}
const PACK_STORE_KEY='epx:pack';
const packLabels=new Map();
const packKinds=new Map();
function packSection(id){
  return document.querySelector('.pack-slot[data-id="'+CSS.escape(id)+'"]')
    || (packPhase==='pick'?document.querySelector('.blk[data-id="'+CSS.escape(id)+'"]:not(.pack-slot)'):null);
}
function savePackState(){
  if(selKind!=='pack'){
    sessionStorage.removeItem(PACK_STORE_KEY);
    return;
  }
  const configs={};
  blockConfigs.forEach((v,k)=>{configs[k]=v;});
  const labels={};
  packLabels.forEach((v,k)=>{labels[k]=v;});
  const kinds={};
  packKinds.forEach((v,k)=>{kinds[k]=v;});
  sessionStorage.setItem(PACK_STORE_KEY,JSON.stringify({
    active:true,phase:packPhase,order:selectedOrder.slice(),configs,labels,kinds,
  }));
}
function syncPickChromeHeight(){
  if(!packPickHead||packPhase!=='pick')return;
  document.documentElement.style.setProperty('--pick-chrome-h',packPickHead.offsetHeight+'px');
}
function mountPickFilters(){
  const filters=document.querySelector('.wrap>.filters');
  if(!filters||!packPickHead)return;
  if(!filtersAnchor){
    filtersAnchor=document.createComment('filters-anchor');
    packPickHead.parentElement.insertBefore(filtersAnchor,packPickHead.nextSibling);
  }
  if(filters.parentElement!==packPickHead)packPickHead.appendChild(filters);
  syncPickChromeHeight();
}
function unmountPickFilters(){
  const filters=document.querySelector('.filters');
  if(!filters||!filtersAnchor?.parentElement)return;
  filtersAnchor.parentElement.insertBefore(filters,filtersAnchor.nextSibling);
  document.documentElement.style.removeProperty('--pick-chrome-h');
}
function placePackSteps(){
  if(!packSteps||selKind!=='pack')return;
  packSteps.classList.remove('hide');
  if(packPhase==='pick'){
    const mid=document.querySelector('#packPickHead .pp-mid');
    if(mid&&!mid.contains(packSteps))mid.insertBefore(packSteps,mid.firstChild);
    mountPickFilters();
    syncPickChromeHeight();
  }else{
    unmountPickFilters();
    const mid=document.getElementById('packEditorMid');
    if(mid&&!mid.contains(packSteps))mid.insertBefore(packSteps,mid.firstChild);
  }
}
function renderSelectedChips(){
  const box=document.getElementById('packSelectedChips');
  const bar=document.getElementById('packSelectedBar');
  if(!box||!bar)return;
  if(!selectedOrder.length||selKind!=='pack'||packPhase!=='pick'){
    bar.classList.add('hide');return;
  }
  bar.classList.remove('hide');
  box.innerHTML=selectedOrder.map(id=>{
    const title=packLabels.get(id)||id;
    const onPage=!!document.querySelector('.blk[data-id="'+CSS.escape(id)+'"]:not(.pack-slot)');
    return '<div class="chip on" data-rmid="'+esc(id)+'">'+esc(title)+(onPage?'':' · 其他页')+'<span class="x">×</span></div>';
  }).join('');
  box.querySelectorAll('[data-rmid]').forEach(ch=>{
    ch.onclick=(e)=>{
      e.stopPropagation();
      if(e.target.classList.contains('x'))unselectId(ch.dataset.rmid);
    };
  });
}
function unselectId(id){
  if(!selected.has(id))return;
  selected.delete(id);
  selectedOrder.splice(selectedOrder.indexOf(id),1);
  blockConfigs.delete(id);
  packLabels.delete(id);
  packKinds.delete(id);
  const sec=document.querySelector('.blk[data-id="'+CSS.escape(id)+'"]:not(.pack-slot)');
  if(sec){sec.classList.remove('sel');removeStyleBar(sec);}
  updateSelCount();
  renderSelectedChips();
  savePackState();
  if(packPhase==='edit'||packPhase==='preview')buildEditPreview();
}
function ensureBlockConfig(id,sec){
  if(blockConfigs.has(id))return blockConfigs.get(id);
  const cfg={
    style:defaultStyleForSec(sec),
    showRank:sec?sec.dataset.rank==='1':false,
    showOverview:sec?sec.dataset.ov==='1':false,
  };
  blockConfigs.set(id,cfg);
  return cfg;
}
function applyBlockConfig(sec){
  if(!sec)return;
  const cfg=ensureBlockConfig(sec.dataset.id,sec);
  if(sec.dataset.kind==='collection'){
    sec.dataset.colstyle=cfg.style||'';
    reloadBlockPreview(sec);
    return;
  }
  sec.dataset.preset=styleToPreset(cfg.style,sec.dataset.preset||'thumb-list');
  sec.dataset.rank=cfg.showRank?'1':'0';
  sec.dataset.ov=cfg.showOverview?'1':'0';
  reloadBlockPreview(sec);
}
function styleChips(id,styles,cur,kind){
  return styles.map(s=>'<div class="chip'+(s.v===cur?' on':'')+'" data-kind="'+kind+'" data-bid="'+esc(id)+'" data-v="'+esc(s.v)+'">'+esc(s.l)+'</div>').join('');
}
function removeStyleBar(sec){
  sec?.querySelector('.blk-stylebar')?.remove();
}
function renderStyleBar(sec){
  if(!sec||selKind!=='pack'||packPhase==='pick'){removeStyleBar(sec);return;}
  const inEditSlot=packPhase==='edit'&&sec.classList.contains('pack-slot');
  if(packPhase==='edit'&&!inEditSlot){removeStyleBar(sec);return;}
  const id=sec.dataset.id;
  const cfg=ensureBlockConfig(id,sec);
  let bar=sec.querySelector('.blk-stylebar');
  if(!bar){
    bar=document.createElement('div');
    bar.className='blk-stylebar';
    sec.querySelector('.blk-head').after(bar);
  }
  if(sec.dataset.kind==='collection'){
    bar.innerHTML='<span class="slabel">合集样式</span><div class="chips">'+styleChips(id,PACK_COL_STYLES,cfg.style,'style')+'</div>';
  }else{
    bar.innerHTML='<span class="slabel">展示</span><div class="chips">'+styleChips(id,CHART_STYLES,cfg.style,'style')+'</div>'
      +'<label class="tog"><input type="checkbox" data-kind="rank" data-bid="'+esc(id)+'"'+(cfg.showRank?' checked':'')+'>序号</label>'
      +'<label class="tog"><input type="checkbox" data-kind="ov" data-bid="'+esc(id)+'"'+(cfg.showOverview?' checked':'')+'>简介</label>';
  }
  bar.querySelectorAll('.chip').forEach(c=>{
    c.onclick=(e)=>{
      e.stopPropagation();
      const bid=c.dataset.bid;
      const cfg2=ensureBlockConfig(bid,packSection(bid));
      cfg2.style=c.dataset.v;
      c.parentElement.querySelectorAll('.chip').forEach(x=>x.classList.toggle('on',x===c));
      applyBlockConfig(packSection(bid));
      savePackState();
    };
  });
  bar.querySelectorAll('input[type=checkbox]').forEach(inp=>{
    inp.onchange=(e)=>{
      e.stopPropagation();
      const bid=inp.dataset.bid;
      const cfg2=ensureBlockConfig(bid,packSection(bid));
      if(inp.dataset.kind==='rank')cfg2.showRank=inp.checked;
      else cfg2.showOverview=inp.checked;
      applyBlockConfig(packSection(bid));
      savePackState();
    };
  });
}
function syncOrderFromDom(){
  if(!packPreviewList)return;
  const ids=[...packPreviewList.querySelectorAll('.pack-slot')].map(s=>s.dataset.id);
  if(!ids.length)return;
  selectedOrder.length=0;
  ids.forEach(id=>selectedOrder.push(id));
  packPreviewList.querySelectorAll('.pack-slot').forEach(renderStyleBar);
  savePackState();
}
let packSortable=null;
function destroyPackSortable(){
  if(packSortable){packSortable.destroy();packSortable=null;}
  packPreviewList?.classList.remove('pack-sorting');
}
function ensurePackDragHandles(list){
  list.querySelectorAll('.pack-slot').forEach(slot=>{
    if(slot.querySelector('.drag-handle'))return;
    const handle=document.createElement('button');
    handle.type='button';
    handle.className='drag-handle';
    handle.textContent='⋮⋮';
    handle.setAttribute('aria-label','拖拽排序');
    slot.querySelector('.blk-head')?.prepend(handle);
  });
}
function bindPackReorder(list){
  if(!list||packPhase!=='edit'||typeof Sortable==='undefined')return;
  destroyPackSortable();
  list.querySelector('.pack-drop-line')?.remove();
  ensurePackDragHandles(list);
  const scrollEl=document.querySelector('#packEditor .pe-body');
  packSortable=Sortable.create(list,{
    handle:'.drag-handle',
    draggable:'.pack-slot',
    animation:220,
    easing:'cubic-bezier(0.25, 1, 0.5, 1)',
    ghostClass:'pack-sort-ghost',
    chosenClass:'pack-sort-chosen',
    dragClass:'pack-sort-drag',
    direction:'vertical',
    swapThreshold:0.62,
    invertSwap:false,
    fallbackTolerance:4,
    delay:0,
    delayOnTouchOnly:true,
    touchStartThreshold:6,
    scroll:scrollEl||true,
    scrollSensitivity:80,
    scrollSpeed:14,
    bubbleScroll:true,
    onStart(){list.classList.add('pack-sorting');},
    onEnd(){list.classList.remove('pack-sorting');syncOrderFromDom();},
  });
}
async function buildEditPreview(){
  if(!packPreviewList||!selectedOrder.length||packPhase==='pick'){
    if(packPreviewList&&packPhase==='pick')packPreviewList.innerHTML='';
    return;
  }
  destroyPackSortable();
  packPreviewList.innerHTML='<div class="prev-empty">加载首页预览…</div>';
  try{
    const lang=langSel.value||'zh-CN';
    const r=await fetch('/blocks/pick-blocks?ids='+encodeURIComponent(selectedOrder.join(','))+'&language='+encodeURIComponent(lang));
    const j=await r.json();
    if(!r.ok)throw new Error(j.error||'load failed');
    packPreviewList.innerHTML='';
    const byId=new Map((j.blocks||[]).map(b=>[b.id,b]));
    selectedOrder.forEach(id=>{
      const b=byId.get(id);
      if(!b)return;
      const cfg=blockConfigs.get(id);
      if(cfg){
        if(b.collectionChildren)b.collectionStyle=cfg.style||'';
        else{
          b.preset=styleToPreset(cfg.style,b.preset);
          b.showRank=cfg.showRank;
          b.showOverview=cfg.showOverview;
        }
      }
      const sec=buildBlockSectionEl(b);
      renderStyleBar(sec);
      packPreviewList.appendChild(sec);
      io.observe(sec);
      load(sec);
    });
    bindPackReorder(packPreviewList);
  }catch(e){
    packPreviewList.innerHTML='<div class="prev-empty">预览加载失败</div>';
  }
}
function updateFinalHeader(){
  if(!packFinalHeader)return;
  const title=document.getElementById('packTitle').value.trim()||'未命名首页';
  const author=document.getElementById('packAuthor').value.trim();
  const desc=document.getElementById('packDesc').value.trim();
  packFinalHeader.innerHTML='<h1 class="gradtext">'+esc(title)+'</h1>'
    +(author?'<div class="hp-byline">by '+esc(author)+'</div>':'')
    +(desc?'<div class="hp-byline">'+esc(desc)+'</div>':'')
    +'<div class="hp-meta">'+selectedOrder.length+' 个区块 · 确认无误后发布</div>';
}
function goPreview(){
  if(!document.getElementById('packTitle').value.trim()){packShow('err','请填写首页标题');return;}
  if(!selectedOrder.length){packShow('err','请先选择区块');return;}
  packShow('','');
  setPackPhase('preview');
}
function setPackPhase(phase){
  packPhase=phase;
  document.body.classList.toggle('pack-pick',selKind==='pack'&&phase==='pick');
  document.body.classList.toggle('pack-edit',selKind==='pack'&&phase==='edit');
  document.body.classList.toggle('pack-preview',selKind==='pack'&&phase==='preview');
  document.body.classList.toggle('pack-fullscreen',selKind==='pack'&&(phase==='pick'||phase==='edit'||phase==='preview'));
  packPickHead?.classList.toggle('hide',!(selKind==='pack'&&phase==='pick'));
  packStepPick?.classList.toggle('on',phase==='pick');
  packStepEdit?.classList.toggle('on',phase==='edit');
  packStepPreview?.classList.toggle('on',phase==='preview');
  packEditor?.classList.toggle('hide',!(selKind==='pack'&&(phase==='edit'||phase==='preview')));
  placePackSteps();
  const peTitle=document.querySelector('#packEditor .pe-title');
  const peSub=document.querySelector('#packEditor .pe-sub');
  if(peTitle)peTitle.textContent=phase==='preview'?'首页预览':'编辑首页';
  if(peSub)peSub.textContent=phase==='preview'
    ? '与发布后详情页相同 · 确认后即可发布'
    : '⋮⋮ 拖动排序 · 下方可改样式';
  document.getElementById('packGoPreviewHead')?.classList.toggle('hide',phase!=='edit');
  const backBtn=document.getElementById('packEditorBack');
  if(backBtn)backBtn.textContent=phase==='preview'?'返回编辑':'继续挑选';
  packFinalHeader?.classList.toggle('hide',phase!=='preview');
  document.getElementById('packPreviewFoot')?.classList.toggle('hide',phase!=='preview');
  if(phase==='edit'){
    document.querySelector('.wrap')?.scrollTo(0,0);
    document.querySelector('#packEditor .pe-body')?.scrollTo(0,0);
    if(!packPreviewList.querySelector('.pack-slot'))buildEditPreview();
    else bindPackReorder(packPreviewList);
  }else if(phase==='preview'){
    destroyPackSortable();
    if(!packPreviewList.querySelector('.pack-slot'))buildEditPreview().then(()=>updateFinalHeader());
    else updateFinalHeader();
  }else{
    destroyPackSortable();
    unmountPickFilters();
    if(packPreviewList)packPreviewList.innerHTML='';
    if(packFinalHeader)packFinalHeader.innerHTML='';
  }
  renderSelectedChips();
  applyFilters();
  savePackState();
}
function showPanel(which){
  if(groupPanel)groupPanel.classList.toggle('hide',which!=='group');
}
function setSelMode(kind){
  selKind=kind||'';
  selMode=!!selKind;
  document.body.classList.toggle('selecting',selMode);
  selbar.classList.toggle('hide',!selMode);
  makeHomeBtn?.classList.toggle('on',selKind==='pack');
  if(makeGroupBtn)makeGroupBtn.classList.toggle('on',selKind==='group');
  if(groupBtn)groupBtn.classList.toggle('hide',selKind!=='group');
  selected.clear();
  selectedOrder.length=0;
  blockConfigs.clear();
  packLabels.clear();
  packKinds.clear();
  document.querySelectorAll('.blk.sel').forEach(s=>{s.classList.remove('sel');removeStyleBar(s);});
  if(packPreviewList)packPreviewList.innerHTML='';
  destroyPackSortable();
  unmountPickFilters();
  const pt=document.getElementById('packTitle');
  const pa=document.getElementById('packAuthor');
  const pd=document.getElementById('packDesc');
  if(pt)pt.value='';
  if(pa)pa.value='';
  if(pd)pd.value='';
  colMsg.className='msg';colMsg.textContent='';
  colResult?.classList.add('hide');
  showPanel('');
  updateSelCount();
  if(selKind==='pack'){
    if(curCat==='homepage'){curCat='all';catSel.value='all';}
    setPackPhase('pick');
  }else{
    packPhase='';
    document.body.classList.remove('pack-pick','pack-edit','pack-preview','pack-fullscreen');
    packSteps?.classList.add('hide');
    packPickHead?.classList.add('hide');
    packEditor?.classList.add('hide');
    unmountPickFilters();
    document.getElementById('packSelectedBar')?.classList.add('hide');
    sessionStorage.removeItem(PACK_STORE_KEY);
    if(selMode&&(curCat==='collection')){curCat='all';catSel.value='all';}
    applyFilters();
  }
  if(selMode&&selKind!=='pack')applyFilters();
}
function updateSelCount(){
  const n=selected.size;
  const selCount=document.getElementById('selCount');
  if(selCount)selCount.textContent='已选 '+n+'（可跨页）';
  if(packPickDone)packPickDone.disabled=n===0;
  const sub=document.getElementById('packPickSub');
  if(sub&&packPhase==='pick'){
    sub.style.color='var(--mut)';
    sub.textContent=n
      ? '已选 '+n+' 个 · 翻页不丢 · 点完成进入编辑'
      : '挑选区块 · 点击加入，可跨页翻页';
  }
}
function toggleSelect(sec){
  const id=sec.dataset.id;if(!id||selKind!=='pack'||packPhase!=='pick')return;
  if(selected.has(id)){
    unselectId(id);
    return;
  }
  selected.add(id);
  selectedOrder.push(id);
  packLabels.set(id,sec.dataset.title||id);
  packKinds.set(id,sec.dataset.kind||'chart');
  sec.classList.add('sel');
  ensureBlockConfig(id,sec);
  updateSelCount();
  renderSelectedChips();
  savePackState();
}
onBlkTap=(s,e)=>{
  if(!selMode)return false;
  if(selKind==='pack'){
    if(e.target.closest('.blk-stylebar,.drag-handle,.chip,.tog'))return true;
    if(packPhase==='pick'){toggleSelect(s);return true;}
    return true;
  }
  if(selKind==='group'){toggleSelectGroup(s);return true;}
  return false;
};
function toggleSelectGroup(sec){
  const id=sec.dataset.id;if(!id)return;
  if(selected.has(id)){selected.delete(id);sec.classList.remove('sel');}
  else{selected.add(id);sec.classList.add('sel');}
  updateSelCount();
}
makeHomeBtn.onclick=()=>setSelMode(selKind==='pack'?'':'pack');
document.getElementById('selCancelBtn').onclick=()=>setSelMode('');
function colShow(cls,text){colMsg.className='msg '+cls;colMsg.textContent=text;}
function requireSelection(){
  if(selected.size===0){
    if(selKind==='pack'&&packPhase==='pick'){
      const sub=document.getElementById('packPickSub');
      if(sub){sub.style.color='var(--danger)';sub.textContent='请至少选一个区块';}
    }else colShow('err','请先选择区块');
    return false;
  }
  colShow('','');return true;
}
document.getElementById('packPickDone').onclick=()=>{if(!requireSelection())return;setPackPhase('edit');};
document.getElementById('packPickCancel').onclick=()=>setSelMode('');
document.getElementById('packGoPreviewBtn').onclick=goPreview;
document.getElementById('packGoPreviewHead').onclick=goPreview;
document.getElementById('packBackEditBtn').onclick=()=>setPackPhase('edit');
document.getElementById('packEditorBack').onclick=()=>{
  if(packPhase==='preview')setPackPhase('edit');
  else setPackPhase('pick');
};
function packShow(cls,text){
  if(packPhase==='pick'){
    const sub=document.getElementById('packPickSub');
    if(sub&&text){sub.style.color=cls==='err'?'var(--danger)':'var(--mut)';sub.textContent=text;}
    return;
  }
  let msg=packEditorMsg;
  if(packPhase==='preview')msg=document.getElementById('packPreviewMsg');
  if(!msg)return;
  msg.className='msg '+cls;
  msg.textContent=text;
}
document.getElementById('makePackBtn').onclick=async()=>{
  const title=document.getElementById('packTitle').value.trim();
  if(!title)return packShow('err','请填写首页标题');
  if(!selectedOrder.length)return packShow('err','请先选择区块');
  const authorName=document.getElementById('packAuthor').value.trim();
  const description=document.getElementById('packDesc').value.trim();
  const entries=selectedOrder.map(id=>{
    const cfg=ensureBlockConfig(id,packSection(id));
    const entry={blockId:id};
    if(cfg.style)entry.style=cfg.style;
    if(packKinds.get(id)!=='collection'){
      entry.showRank=!!cfg.showRank;
      entry.showOverview=!!cfg.showOverview;
    }
    return entry;
  });
  const btn=document.getElementById('makePackBtn');
  btn.disabled=true;btn.innerHTML='<span class="spin"></span> 发布中…';
  packShow('','');
  colShow('','');
  try{
    const r=await fetch('/blocks/collections',{method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        title,
        authorName:authorName||undefined,
        description:description||undefined,
        language:langSel.value||undefined,
        entries,
      })});
    const j=await r.json();
    if(!r.ok){packShow('err',j.error||'发布失败');btn.disabled=false;btn.textContent='发布首页';return;}
    document.getElementById('colUrl').textContent=j.importUrl;
    const viewHp=document.getElementById('viewHpBtn');
    if(viewHp)viewHp.href=j.detailUrl||('/blocks/homepages/'+j.collectionId);
    colResult.classList.remove('hide');
    packShow('ok','首页已发布,可在「首页」分类查看,或在 iPhone 上打开链接导入。');
    btn.disabled=false;btn.textContent='发布首页';
  }catch(e){packShow('err','网络错误');btn.disabled=false;btn.textContent='发布首页';}
};
document.getElementById('copyColBtn').onclick=async()=>{
  const url=document.getElementById('colUrl').textContent;
  if(url&&await copyText(url))packShow('ok','已复制导入链接');
};
document.querySelectorAll('[data-page-link]').forEach(a=>{
  a.addEventListener('click',()=>{if(selKind==='pack')savePackState();});
});
(function initPackRestore(){
  try{
    const raw=sessionStorage.getItem(PACK_STORE_KEY);
    const url=new URL(location.href);
    if(!raw&&!url.searchParams.has('pack'))return;
    if(!raw)return;
    const st=JSON.parse(raw);
    if(!st||!st.active)return;
    (st.order||[]).forEach(id=>{
      selected.add(id);
      selectedOrder.push(id);
    });
    Object.entries(st.configs||{}).forEach(([k,v])=>blockConfigs.set(k,v));
    Object.entries(st.labels||{}).forEach(([k,v])=>packLabels.set(k,v));
    Object.entries(st.kinds||{}).forEach(([k,v])=>packKinds.set(k,v));
    selKind='pack';
    selMode=true;
    document.body.classList.add('selecting');
    selbar.classList.remove('hide');
    makeHomeBtn.classList.add('on');
    packSteps.classList.remove('hide');
    document.querySelectorAll('.blk[data-id]:not(.pack-slot)').forEach(sec=>{
      if(selected.has(sec.dataset.id)){
        sec.classList.add('sel');
        renderStyleBar(sec);
      }
    });
    setPackPhase(st.phase||'pick');
    updateSelCount();
    if(url.searchParams.has('pack')){
      url.searchParams.delete('pack');
      history.replaceState(null,'',url);
    }
  }catch(e){
    sessionStorage.removeItem(PACK_STORE_KEY);
  }
})();
window.addEventListener('resize',()=>{if(packPhase==='pick')syncPickChromeHeight();});
${isAdmin ? ADMIN_GROUP_JS : ""}
`;
}

/** Homepage detail page: shared renderer + install/copy actions. */
function homepageJs(imageBase: string): string {
	return `${rendererJs(imageBase)}
// Same-domain anchor would just reload the page; go scheme-first instead.
const hpInstall=document.getElementById('hpInstallBtn');
if(hpInstall)hpInstall.addEventListener('click',e=>{
  e.preventDefault();
  openImport('collectionId='+encodeURIComponent(hpInstall.dataset.cid));
});
const hpCopy=document.getElementById('copyHpBtn');
if(hpCopy)hpCopy.onclick=async()=>{
  if(await copyText(hpCopy.dataset.url)){
    const msg=document.getElementById('hpMsg');
    msg.className='msg ok';msg.textContent='已复制导入链接';
  }
};
`;
}

const SUBMIT_JS = `
const $=(s)=>document.querySelector(s);
const state={category:'movie',preset:'thumb-list'};
function chips(id,key,onChange){
  document.querySelectorAll('#'+id+' .chip').forEach(c=>{
    c.onclick=()=>{
      document.querySelectorAll('#'+id+' .chip').forEach(x=>x.classList.remove('on'));
      c.classList.add('on');state[key]=c.dataset.v;
      if(onChange)onChange();
    };
  });
}
const SAMPLE=[
  {t:'流浪地球',y:'2023',g:'科幻',r:'8.9',o:'太阳即将毁灭,人类启动“流浪地球”计划,带着地球逃离太阳系。'},
  {t:'三体',y:'2024',g:'科幻',r:'8.7',o:'物理学家叶文洁向宇宙发出信号,引来三体文明对地球的窥伺。'},
  {t:'繁花',y:'2024',g:'剧情',r:'8.5',o:'上世纪 90 年代的上海,阿宝在时代浪潮中起伏沉沦。'},
  {t:'漫长的季节',y:'2023',g:'悬疑',r:'9.4',o:'一桩旧案牵出东北小城几个家庭长达二十年的纠葛。'},
  {t:'狂飙',y:'2023',g:'犯罪',r:'8.4',o:'刑警安欣与黑恶势力高启强长达二十年的较量。'},
  {t:'去有风的地方',y:'2023',g:'剧情',r:'8.6',o:'许红豆辞职来到云南小村,在有风的地方治愈自己。'}
];
function previewCard(preset,it,i,rank,ov){
  if(preset==='poster-list')
    return '<div class="it it-poster"><div class="art art-poster"><div class="ph"></div></div><div class="cap"><div class="txt"><div class="t1">'+it.t+'</div><div class="t2">'+it.y+'</div></div></div></div>';
  if(preset==='hero-list')
    return '<div class="it it-hero"><div class="art art-hero"><div class="ph"></div></div><div class="cap"><div class="txt"><div class="t1">'+it.t+'</div><div class="t2">'+it.y+' · '+it.g+'</div></div></div></div>';
  const sub=ov?'<div class="t2 ov">'+it.o+'</div>':'<div class="t2">'+it.y+' · '+it.g+'</div>';
  return '<div class="it it-thumb"><div class="art art-thumb"><div class="ph"></div></div><div class="cap">'+(rank?'<span class="rk">'+(i+1)+'</span>':'')+'<div class="txt"><div class="t1">'+it.t+'</div>'+sub+'</div></div></div>';
}
function renderPreview(){
  const box=document.getElementById('presetPreview');if(!box)return;
  const preset=state.preset;const rank=$('#m_rank').checked;const ov=$('#m_overview').checked;
  const note=document.getElementById('ovNote');
  if(note)note.style.display=(ov&&preset!=='thumb-list')?'block':'none';
  const n=preset==='hero-list'?3:6;
  box.innerHTML=SAMPLE.slice(0,n).map((it,i)=>previewCard(preset,it,i,rank,ov)).join('');
}
chips('category','category');chips('preset','preset',renderPreview);
$('#m_rank').addEventListener('change',renderPreview);
$('#m_overview').addEventListener('change',renderPreview);
renderPreview();
// Remember the TMDB token locally so returning submitters don't retype it.
const TOKEN_KEY='eplayerx_tmdb_token';
try{const saved=localStorage.getItem(TOKEN_KEY);if(saved)$('#token').value=saved;}catch(e){}
function show(cls,text){const m=$('#msg');m.className='msg '+cls;m.textContent=text;}
$('#submitBtn').onclick=async()=>{
  const token=$('#token').value.trim();
  const title=$('#title').value.trim();
  const source=$('#source').value.trim();
  if(!token)return show('err','请填写 TMDB Token');
  if(!title)return show('err','请填写名称');
  if(!source)return show('err','请填写榜单地址或粘贴数据');
  const btn=$('#submitBtn');btn.disabled=true;btn.innerHTML='<span class="spin"></span> 提交中…';
  show('','');
  try{
    const r=await fetch('/blocks/submit',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({token,category:state.category,title,preset:state.preset,
        language:$('#language').value,
        showRank:$('#m_rank').checked,showOverview:$('#m_overview').checked,
        author:$('#m_author').value.trim(),source})});
    const j=await r.json();
    if(!r.ok){show('err',j.error||'提交失败');btn.disabled=false;btn.textContent='提交审核';return;}
    try{localStorage.setItem(TOKEN_KEY,token);}catch(e){}
    show('ok','已提交审核,通过后会出现在社区库,感谢投稿!');
    btn.textContent='已提交';
  }catch(e){show('err','网络错误');btn.disabled=false;btn.textContent='提交审核';}
};
`;

const ADMIN_JS = `
// ── Section tabs (persisted in the URL hash) ────────────────────────
const adminTabs=document.querySelectorAll('#adminTabs .tab');
function showTab(name){
  if(!document.querySelector('[data-panel="'+name+'"]'))name='pending';
  adminTabs.forEach(t=>t.classList.toggle('on',t.dataset.tab===name));
  document.querySelectorAll('[data-panel]').forEach(p=>p.classList.toggle('hide',p.dataset.panel!==name));
}
adminTabs.forEach(t=>{t.onclick=()=>{history.replaceState(null,'','#'+t.dataset.tab);showTab(t.dataset.tab);};});
if(location.hash)showTab(location.hash.slice(1));
function field(id,name){return document.querySelector('[data-f="'+name+'"][data-id="'+id+'"]');}
function fieldVal(id,name){const el=field(id,name);return el?el.value.trim():'';}
function fieldChecked(id,name){const el=field(id,name);return el?el.checked:false;}
document.querySelectorAll('[data-act]').forEach(b=>{
  b.onclick=async()=>{
    const id=b.dataset.id,act=b.dataset.act;
    const msg=document.querySelector('[data-msg="'+id+'"]');
    let reason='';
    if(act==='reject'){reason=prompt('驳回理由?')||'';}
    const payload={reason};
    const isCollection=b.closest('.card').dataset.kind==='collection';
    if(act==='approve'&&isCollection){
      payload.title=fieldVal(id,'title');
      payload.category=fieldVal(id,'category');
    }else if(act==='approve'){
      payload.blockId=fieldVal(id,'blockId');
      if(!payload.blockId){msg.className='msg err';msg.textContent='请填写 blockId（先本地运行发布脚本）';return;}
      payload.title=fieldVal(id,'title');
      payload.category=fieldVal(id,'category');
      payload.mediaType=fieldVal(id,'mediaType');
      payload.preset=fieldVal(id,'preset');
      payload.showRank=fieldChecked(id,'showRank');
      payload.showOverview=fieldChecked(id,'showOverview');
      payload.isAnime=fieldChecked(id,'isAnime');
    }
    const card=b.closest('.card');
    card.querySelectorAll('[data-act]').forEach(x=>x.disabled=true);
    if(act==='approve'){b.innerHTML='<span class="spin"></span> 校验中…';}
    try{
      const r=await fetch('/admin/'+id+'/'+act,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload)});
      const j=await r.json();
      if(!r.ok){msg.className='msg err';msg.textContent=j.error||'操作失败';
        card.querySelectorAll('[data-act]').forEach(x=>x.disabled=false);
        if(act==='approve')b.textContent='校验并通过';return;}
      card.style.opacity='.45';
      msg.className='msg ok';
      msg.textContent=act==='approve'?('已通过 · '+(j.itemCount||0)+' 项 · '+(j.blockId||'')):'已驳回';
    }catch(e){msg.className='msg err';msg.textContent='网络错误';
      card.querySelectorAll('[data-act]').forEach(x=>x.disabled=false);
      if(act==='approve')b.textContent='校验并通过';}
  };
});
// ── Collections: admin create + delete ──────────────────────────────
const ncBtn=document.getElementById('ncCreateBtn');
if(ncBtn)ncBtn.onclick=async()=>{
  const msg=document.getElementById('ncMsg');
  function show(cls,text){msg.className='msg '+cls;msg.textContent=text;}
  const title=document.getElementById('ncTitle').value.trim();
  const mode=document.getElementById('ncMode').value;
  const category=document.getElementById('ncCategory').value;
  const lines=document.getElementById('ncChildren').value.split('\\n').map(l=>l.trim()).filter(Boolean);
  if(!title)return show('err','请填写标题');
  if(lines.length<2)return show('err','至少需要 2 个子榜单');
  const children=[];
  for(const line of lines){
    const parts=line.split('|').map(p=>p.trim());
    if(!parts[0])return show('err','存在空的 blockId 行');
    children.push({blockId:parts[0],label:parts[1]||parts[0],
      ...(parts[2]?{weekday:Number(parts[2])}:{})});
  }
  ncBtn.disabled=true;ncBtn.innerHTML='<span class="spin"></span> 创建中…';
  try{
    const r=await fetch('/admin/collections/create',{method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({title,mode,category,children})});
    const j=await r.json();
    if(!r.ok){show('err',j.error||'创建失败');ncBtn.disabled=false;ncBtn.textContent='创建并发布';return;}
    show('ok','已发布 · '+j.blockId+'（刷新页面查看）');
    ncBtn.disabled=false;ncBtn.textContent='创建并发布';
  }catch(e){show('err','网络错误');ncBtn.disabled=false;ncBtn.textContent='创建并发布';}
};
// ── Collection child logos: upload to R2, then patch the block JSON ──
function colImgMsg(blockId,cls,text){
  const msg=document.querySelector('[data-colmsg="'+blockId+'"]');
  if(msg){msg.className='msg '+cls;msg.textContent=text;}
}
async function setChildImage(blockId,childId,image){
  const r=await fetch('/admin/collections/'+blockId+'/child-image',{method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({childId,image})});
  const j=await r.json();
  if(!r.ok)throw new Error(j.error||'保存失败');
}
const colImgPicker=document.createElement('input');
colImgPicker.type='file';colImgPicker.accept='image/png,image/jpeg,image/webp,image/svg+xml';
let colImgTarget=null;
colImgPicker.onchange=async()=>{
  const file=colImgPicker.files&&colImgPicker.files[0];
  colImgPicker.value='';
  if(!file||!colImgTarget)return;
  const [blockId,childId]=colImgTarget;
  colImgMsg(blockId,'','上传中…');
  try{
    const up=await fetch('/admin/assets/upload',{method:'POST',
      headers:{'Content-Type':file.type},body:file});
    const uj=await up.json();
    if(!up.ok)throw new Error(uj.error||'上传失败');
    await setChildImage(blockId,childId,uj.url);
    colImgMsg(blockId,'ok','已保存（刷新页面查看）');
  }catch(e){colImgMsg(blockId,'err',e.message||'网络错误');}
};
document.querySelectorAll('[data-colimg]').forEach(b=>{
  b.onclick=()=>{colImgTarget=b.dataset.colimg.split('|');colImgPicker.click();};
});
document.querySelectorAll('[data-colimgclear]').forEach(b=>{
  b.onclick=async()=>{
    const [blockId,childId]=b.dataset.colimgclear.split('|');
    b.disabled=true;
    try{
      await setChildImage(blockId,childId,'');
      colImgMsg(blockId,'ok','已清除（刷新页面查看）');
    }catch(e){colImgMsg(blockId,'err',e.message||'网络错误');b.disabled=false;}
  };
});
document.querySelectorAll('[data-coldel]').forEach(b=>{
  b.onclick=async()=>{
    if(!confirm('确认删除该合集?已导入的客户端不受影响。'))return;
    const id=b.dataset.coldel;
    const msg=document.querySelector('[data-colmsg="'+id+'"]');
    b.disabled=true;
    try{
      const r=await fetch('/admin/collections/'+id+'/delete',{method:'POST'});
      const j=await r.json();
      if(!r.ok){msg.className='msg err';msg.textContent=j.error||'删除失败';b.disabled=false;return;}
      b.closest('.card').style.opacity='.4';
      msg.className='msg ok';msg.textContent='已删除';
    }catch(e){msg.className='msg err';msg.textContent='网络错误';b.disabled=false;}
  };
});
`;
