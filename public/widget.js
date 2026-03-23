"use strict";(()=>{var C=document.currentScript||document.querySelector("script[data-project-id]"),b=C?new URL(C.src).origin:window.location.origin;async function z(n){let e=await fetch(`${b}/api/sandbox/create`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({scriptTagId:n})});if(!e.ok){let t=await e.json().catch(()=>({}));throw new Error(t.error||"Failed to create sandbox")}return e.json()}async function P(n,e){let t=await fetch(`${b}/api/sandbox/prompt`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sandboxId:n,prompt:e})});if(!t.ok)throw new Error("Failed to apply prompt");return t.json()}async function j({sandboxId:n,projectId:e,prompt:t,bountyAmount:a,userEmail:c}){let d=await fetch(`${b}/api/sandbox/submit`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sandboxId:n,scriptTagId:e,prompt:t,bountyAmount:a,userEmail:c})});if(!d.ok)throw new Error("Failed to submit PR");return d.json()}function q(n){fetch(`${b}/api/sandbox/${n}`,{method:"DELETE"}).catch(()=>{})}function L(n,e){document.body.style.overflow="hidden";let t=document.createElement("div");t.id="lc-overlay",t.style.cssText=`
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    background: #f4f4f5;
    display: flex;
    flex-direction: column;
    font-family: system-ui, -apple-system, sans-serif;
  `,t.innerHTML=`
    <style>
      #lc-overlay * { box-sizing: border-box; }

      #lc-topbar {
        height: 44px;
        background: #18181b;
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 16px;
        flex-shrink: 0;
      }
      #lc-topbar-title {
        font-size: 13px;
        font-weight: 600;
        letter-spacing: -0.01em;
        opacity: 0.9;
      }
      #lc-close-btn {
        background: none;
        border: none;
        color: #fff;
        cursor: pointer;
        font-size: 20px;
        opacity: 0.6;
        line-height: 1;
        padding: 0;
      }
      #lc-close-btn:hover { opacity: 1; }

      #lc-preview {
        flex: 1;
        position: relative;
        overflow: hidden;
      }
      #lc-preview iframe {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        border: none;
      }
      #lc-loading {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        color: #71717a;
        font-size: 14px;
      }
      #lc-spinner {
        width: 28px;
        height: 28px;
        border: 2.5px solid #e4e4e7;
        border-top-color: #18181b;
        border-radius: 50%;
        animation: lc-spin 0.7s linear infinite;
      }
      @keyframes lc-spin { to { transform: rotate(360deg); } }

      #lc-toolbar {
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        width: min(680px, calc(100vw - 32px));
        background: #fff;
        border: 1px solid #e4e4e7;
        border-radius: 16px;
        box-shadow: 0 8px 40px rgba(0,0,0,0.15);
        overflow: hidden;
      }

      #lc-messages {
        max-height: 160px;
        overflow-y: auto;
        padding: 10px 12px 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      #lc-messages:empty { display: none; }
      .lc-msg {
        padding: 7px 11px;
        border-radius: 10px;
        font-size: 13px;
        line-height: 1.45;
        max-width: 88%;
      }
      .lc-msg.user { background: #18181b; color: #fff; align-self: flex-end; }
      .lc-msg.assistant { background: #f4f4f5; color: #18181b; align-self: flex-start; }

      #lc-input-row {
        display: flex;
        align-items: flex-end;
        gap: 8px;
        padding: 10px 12px;
      }
      #lc-prompt {
        flex: 1;
        border: 1px solid #e4e4e7;
        border-radius: 10px;
        padding: 8px 12px;
        font-size: 13px;
        font-family: inherit;
        resize: none;
        min-height: 38px;
        max-height: 120px;
        outline: none;
        line-height: 1.4;
      }
      #lc-prompt:focus { border-color: #18181b; }
      #lc-prompt:disabled { background: #fafafa; }
      #lc-send {
        background: #18181b;
        color: #fff;
        border: none;
        border-radius: 10px;
        padding: 9px 16px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        height: 38px;
      }
      #lc-send:disabled { opacity: 0.35; cursor: not-allowed; }

      #lc-submit-section {
        border-top: 1px solid #f4f4f5;
        padding: 10px 12px;
        display: flex;
        gap: 8px;
        align-items: center;
      }
      #lc-email, #lc-bounty {
        border: 1px solid #e4e4e7;
        border-radius: 10px;
        padding: 7px 11px;
        font-size: 13px;
        font-family: inherit;
        outline: none;
      }
      #lc-email:focus, #lc-bounty:focus { border-color: #18181b; }
      #lc-email { flex: 1; }
      #lc-bounty { width: 130px; }
      #lc-submit {
        background: #16a34a;
        color: #fff;
        border: none;
        border-radius: 10px;
        padding: 8px 16px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        white-space: nowrap;
      }
      #lc-submit:disabled { opacity: 0.35; cursor: not-allowed; }

      #lc-status {
        padding: 5px 12px 8px;
        font-size: 11px;
        color: #a1a1aa;
        text-align: center;
      }
    </style>

    <div id="lc-topbar">
      <span id="lc-topbar-title">\u2726 Tweaky \u2014 Sandbox Preview</span>
      <button id="lc-close-btn">\xD7</button>
    </div>

    <div id="lc-preview">
      <div id="lc-loading">
        <div id="lc-spinner"></div>
        <span>Starting sandbox \u2014 cloning repo and installing dependencies\u2026</span>
      </div>
    </div>

    <div id="lc-toolbar">
      <div id="lc-messages"></div>
      <div id="lc-input-row">
        <textarea id="lc-prompt" placeholder="Describe a change\u2026" rows="1" disabled></textarea>
        <button id="lc-send" disabled>Send</button>
      </div>
      <div id="lc-submit-section" style="display:none">
        <input type="email" id="lc-email" placeholder="Your email" />
        <input type="number" id="lc-bounty" placeholder="Bounty (points)" min="1" />
        <button id="lc-submit">Submit PR \u2192</button>
      </div>
      <div id="lc-status">Initialising\u2026</div>
    </div>
  `,document.body.appendChild(t);let a=null,c=!1,d=[],S=t.querySelector("#lc-loading"),k=t.querySelector("#lc-preview"),f=t.querySelector("#lc-messages"),r=t.querySelector("#lc-prompt"),u=t.querySelector("#lc-send"),E=t.querySelector("#lc-submit-section"),m=t.querySelector("#lc-submit"),R=t.querySelector("#lc-status");function s(o){R.textContent=o}function x(o,l){let i=document.createElement("div");i.className=`lc-msg ${o}`,i.textContent=l,f.appendChild(i),f.scrollTop=f.scrollHeight}function I(){document.body.style.overflow="",a&&q(a),t.remove(),e()}t.querySelector("#lc-close-btn").addEventListener("click",I),(async()=>{try{s("Cloning repo and installing dependencies \u2014 this may take a minute\u2026");let{sandboxId:o,previewUrl:l}=await z(n);a=o,S.style.display="none";let i=document.createElement("iframe");i.src=l,i.setAttribute("sandbox","allow-same-origin allow-scripts allow-forms allow-popups allow-modals"),i.setAttribute("allow","clipboard-read; clipboard-write"),k.appendChild(i),r.disabled=!1,u.disabled=!1,s("Ready \u2014 the app is running live. Describe a change below.")}catch(o){S.innerHTML=`
        <div style="color:#ef4444;font-size:20px;margin-bottom:4px;">\u2716</div>
        <span style="color:#71717a;">Failed to start sandbox. Please close and try again.</span>
      `,s("Something went wrong."),console.error("[Tweaky]",o)}})();async function T(){let o=r.value.trim();if(!(!o||c||!a)){c=!0,d.push(o),u.disabled=!0,r.disabled=!0,r.value="",x("user",o),s("Applying changes\u2026");try{let{changedFiles:l}=await P(a,o);x("assistant",`Done \u2014 changed: ${l.join(", ")}`),E.style.display="flex",s("Changes applied. Review the app above, then submit your PR.")}catch{x("assistant","Something went wrong. Please try again."),s("Error applying changes.")}finally{c=!1,u.disabled=!1,r.disabled=!1,r.focus()}}}u.addEventListener("click",T),r.addEventListener("keydown",o=>{o.key==="Enter"&&!o.shiftKey&&(o.preventDefault(),T())}),m.addEventListener("click",async()=>{let o=t.querySelector("#lc-email").value.trim(),l=t.querySelector("#lc-bounty").value.trim();if(!o||!l){s("Please enter your email and a bounty amount.");return}m.disabled=!0,s("Opening PR on GitHub\u2026");try{let{prUrl:i}=await j({sandboxId:a,projectId:n,prompt:d.join(`
`),bountyAmount:parseInt(l,10),userEmail:o}),y=document.createElement("div");y.style.cssText="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;font-family:system-ui,sans-serif;color:#18181b;";let g=document.createElement("div");g.style.fontSize="48px",g.textContent="\u{1F389}";let h=document.createElement("div");h.style.cssText="font-size:20px;font-weight:700",h.textContent="PR opened!";let w=document.createElement("div");w.style.cssText="font-size:14px;color:#71717a",w.textContent="The company will review your change.";let p=document.createElement("a");p.href=/^https:\/\/github\.com\//.test(i)?i:"#",p.target="_blank",p.style.cssText="color:#18181b;font-size:14px;font-weight:500;text-decoration:none;border-bottom:1px solid #18181b;",p.textContent="View on GitHub \u2192",y.append(g,h,w,p),k.replaceChildren(y),E.style.display="none",s("Submitted successfully."),a=null}catch{s("Failed to submit. Please try again."),m.disabled=!1}})}var $=document.currentScript||document.querySelector("script[data-project-id]"),v=$?.getAttribute("data-project-id");v?document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>O(v)):O(v):console.error("[Tweaky] Missing data-project-id on script tag");function O(n){let e=document.createElement("button");e.id="lc-trigger",e.textContent="\u2726 Tweak this",e.style.cssText=`
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 2147483646;
    background: #18181b;
    color: #fff;
    border: none;
    border-radius: 9999px;
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 20px rgba(0,0,0,0.25);
    font-family: system-ui, -apple-system, sans-serif;
    letter-spacing: -0.01em;
    transition: transform 0.15s, box-shadow 0.15s;
  `,e.onmouseenter=()=>{e.style.transform="scale(1.04)",e.style.boxShadow="0 6px 28px rgba(0,0,0,0.3)"},e.onmouseleave=()=>{e.style.transform="scale(1)",e.style.boxShadow="0 4px 20px rgba(0,0,0,0.25)"},document.body.appendChild(e),e.addEventListener("click",()=>{e.style.display="none",L(n,()=>{e.style.display="block"})})}})();
