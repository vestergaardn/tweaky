"use strict";(()=>{var P=document.currentScript||document.querySelector("script[data-project-id]"),b=P?new URL(P.src).origin:window.location.origin;async function q(i){let t=await fetch(`${b}/api/sandbox/create`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({scriptTagId:i})});if(!t.ok){let e=await t.json().catch(()=>({}));throw new Error(e.error||"Failed to create sandbox")}return t.json()}async function M(i,t){let e=await fetch(`${b}/api/sandbox/prompt`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sandboxId:i,prompt:t})});if(!e.ok)throw new Error("Failed to apply prompt");return e.json()}async function O({sandboxId:i,projectId:t,prompt:e,bountyAmount:r,userEmail:d}){let p=await fetch(`${b}/api/sandbox/submit`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sandboxId:i,scriptTagId:t,prompt:e,bountyAmount:r,userEmail:d})});if(!p.ok)throw new Error("Failed to submit PR");return p.json()}function H(i){fetch(`${b}/api/sandbox/${i}`,{method:"DELETE"}).catch(()=>{})}function R(i,t){document.body.style.overflow="hidden";let e=document.createElement("div");e.id="lc-overlay",e.style.cssText=`
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    background: #f4f4f5;
    display: flex;
    flex-direction: column;
    font-family: system-ui, -apple-system, sans-serif;
  `,e.innerHTML=`
    <style>
      #lc-overlay * { box-sizing: border-box; }

      /* \u2500\u2500 Top bar \u2500\u2500 */
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
      #lc-topbar-actions {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      #lc-chat-toggle {
        background: none;
        border: none;
        color: #fff;
        cursor: pointer;
        font-size: 13px;
        opacity: 0.6;
        padding: 4px 8px;
        display: flex;
        align-items: center;
        gap: 4px;
        border-radius: 6px;
      }
      #lc-chat-toggle:hover { opacity: 1; }
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

      /* \u2500\u2500 Main layout \u2500\u2500 */
      #lc-main {
        flex: 1;
        display: flex;
        overflow: hidden;
      }

      /* \u2500\u2500 Preview \u2500\u2500 */
      #lc-preview {
        flex: 1;
        position: relative;
        overflow: hidden;
        min-width: 0;
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

      /* \u2500\u2500 Chat side panel \u2500\u2500 */
      #lc-panel {
        width: 380px;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        border-left: 1px solid #e4e4e7;
        background: #fff;
        transition: width 0.25s ease, opacity 0.25s ease;
        overflow: hidden;
      }
      #lc-panel.collapsed {
        width: 0;
        border-left: none;
        opacity: 0;
      }

      #lc-panel-header {
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 16px;
        border-bottom: 1px solid #e4e4e7;
        flex-shrink: 0;
        font-size: 13px;
        font-weight: 600;
        color: #18181b;
      }
      #lc-collapse-btn {
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        opacity: 0.5;
      }
      #lc-collapse-btn:hover { opacity: 1; }

      /* \u2500\u2500 Messages \u2500\u2500 */
      #lc-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        gap: 8px;
      }
      .lc-msg {
        padding: 10px 14px;
        font-size: 13px;
        line-height: 1.5;
        max-width: 88%;
        animation: lc-msg-in 0.25s ease-out;
      }
      @keyframes lc-msg-in {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .lc-msg.user {
        background: #18181b;
        color: #fff;
        align-self: flex-end;
        border-radius: 14px 14px 4px 14px;
      }
      .lc-msg.assistant {
        background: #f4f4f5;
        color: #18181b;
        align-self: flex-start;
        border-radius: 14px 14px 14px 4px;
      }

      /* \u2500\u2500 Input pill \u2500\u2500 */
      #lc-input-pill {
        margin: 12px;
        border: 1px solid #e4e4e7;
        border-radius: 18px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        min-height: 104px;
        display: flex;
        flex-direction: column;
        flex-shrink: 0;
        background: #fff;
      }
      #lc-prompt {
        flex: 1;
        border: none;
        outline: none;
        background: none;
        resize: none;
        padding: 16px 16px 8px;
        font-size: 13px;
        font-family: inherit;
        line-height: 1.5;
        color: #18181b;
      }
      #lc-prompt::placeholder { color: #a1a1aa; }
      #lc-prompt:disabled { opacity: 0.5; }
      #lc-send {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: #18181b;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        align-self: flex-end;
        margin: 0 12px 12px 0;
        flex-shrink: 0;
        transition: background 0.15s ease;
      }
      #lc-send:disabled { background: #e4e4e7; cursor: not-allowed; }

      /* \u2500\u2500 Submit section \u2500\u2500 */
      #lc-submit-section {
        border-top: 1px solid #f4f4f5;
        padding: 12px;
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
      #lc-bounty { width: 110px; }
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

      /* \u2500\u2500 Status \u2500\u2500 */
      #lc-status {
        padding: 6px 16px 10px;
        font-size: 11px;
        color: #a1a1aa;
        text-align: center;
        flex-shrink: 0;
      }
    </style>

    <div id="lc-topbar">
      <span id="lc-topbar-title">\u2726 Tweaky \u2014 Sandbox Preview</span>
      <div id="lc-topbar-actions">
        <button id="lc-chat-toggle" title="Toggle chat panel">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 3.5h9M2.5 7h9M2.5 10.5h5" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/></svg>
          Chat
        </button>
        <button id="lc-close-btn">\xD7</button>
      </div>
    </div>

    <div id="lc-main">
      <div id="lc-preview">
        <div id="lc-loading">
          <div id="lc-spinner"></div>
          <span>Starting sandbox \u2014 cloning repo and installing dependencies\u2026</span>
        </div>
      </div>

      <div id="lc-panel">
        <div id="lc-panel-header">
          <span>Chat</span>
          <button id="lc-collapse-btn" title="Collapse panel">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3L9 7L5 11" stroke="#71717a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>

        <div id="lc-messages"></div>

        <div id="lc-input-pill">
          <textarea id="lc-prompt" placeholder="Describe a change\u2026" rows="1" disabled></textarea>
          <button id="lc-send" disabled>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 13V3M8 3L3 8M8 3L13 8" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>

        <div id="lc-submit-section" style="display:none">
          <input type="email" id="lc-email" placeholder="Your email" />
          <input type="number" id="lc-bounty" placeholder="Bounty (pts)" min="1" />
          <button id="lc-submit">Submit PR \u2192</button>
        </div>

        <div id="lc-status">Initialising\u2026</div>
      </div>
    </div>
  `,document.body.appendChild(e);let r=null,d=!1,p=[],T=e.querySelector("#lc-loading"),E=e.querySelector("#lc-preview"),x=e.querySelector("#lc-panel"),c=e.querySelector("#lc-messages"),n=e.querySelector("#lc-prompt"),f=e.querySelector("#lc-send"),C=e.querySelector("#lc-submit-section"),g=e.querySelector("#lc-submit"),B=e.querySelector("#lc-status");function s(o){B.textContent=o}function m(o,a){let l=document.createElement("div");l.className=`lc-msg ${o}`,l.textContent=a,c.appendChild(l),c.scrollTop=c.scrollHeight}let j=new ResizeObserver(()=>{c.scrollTop=c.scrollHeight});j.observe(c),n.addEventListener("input",()=>{n.style.height="auto";let a=(parseFloat(getComputedStyle(n).lineHeight)||20)*4;n.style.height=Math.min(n.scrollHeight,a)+"px"});let y=e.querySelector("#lc-chat-toggle");function L(){let o=x.classList.contains("collapsed");y.style.opacity=o?"1":"0.6",y.style.background=o?"rgba(255,255,255,0.15)":"none"}y.addEventListener("click",()=>{x.classList.toggle("collapsed"),L()}),e.querySelector("#lc-collapse-btn").addEventListener("click",()=>{x.classList.add("collapsed"),L()});function F(){j.disconnect(),document.body.style.overflow="",r&&H(r),e.remove(),t()}e.querySelector("#lc-close-btn").addEventListener("click",F),(async()=>{try{s("Cloning repo and installing dependencies \u2014 this may take a minute\u2026");let{sandboxId:o,previewUrl:a}=await q(i);r=o,T.style.display="none";let l=document.createElement("iframe");l.src=a,l.setAttribute("sandbox","allow-same-origin allow-scripts allow-forms allow-popups allow-modals"),l.setAttribute("allow","clipboard-read; clipboard-write"),E.appendChild(l),n.disabled=!1,f.disabled=!1,s("Ready \u2014 the app is running live. Describe a change below.")}catch(o){T.innerHTML=`
        <div style="color:#ef4444;font-size:20px;margin-bottom:4px;">\u2716</div>
        <span style="color:#71717a;">Failed to start sandbox. Please close and try again.</span>
      `,s("Something went wrong."),console.error("[Tweaky]",o)}})();async function z(){let o=n.value.trim();if(!(!o||d||!r)){d=!0,p.push(o),f.disabled=!0,n.disabled=!0,n.value="",n.style.height="auto",m("user",o),s("Applying changes\u2026");try{let{changedFiles:a}=await M(r,o);m("assistant",`Done \u2014 changed: ${a.join(", ")}`),C.style.display="flex",s("Changes applied. Review the app above, then submit your PR.")}catch{m("assistant","Something went wrong. Please try again."),s("Error applying changes.")}finally{d=!1,f.disabled=!1,n.disabled=!1,n.focus()}}}f.addEventListener("click",z),n.addEventListener("keydown",o=>{o.key==="Enter"&&!o.shiftKey&&(o.preventDefault(),z())}),g.addEventListener("click",async()=>{let o=e.querySelector("#lc-email").value.trim(),a=e.querySelector("#lc-bounty").value.trim();if(!o||!a){s("Please enter your email and a bounty amount.");return}g.disabled=!0,s("Opening PR on GitHub\u2026");try{let{prUrl:l}=await O({sandboxId:r,projectId:i,prompt:p.join(`
`),bountyAmount:parseInt(a,10),userEmail:o}),h=document.createElement("div");h.style.cssText="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;font-family:system-ui,sans-serif;color:#18181b;";let v=document.createElement("div");v.style.fontSize="48px",v.textContent="\u{1F389}";let w=document.createElement("div");w.style.cssText="font-size:20px;font-weight:700",w.textContent="PR opened!";let k=document.createElement("div");k.style.cssText="font-size:14px;color:#71717a",k.textContent="The company will review your change.";let u=document.createElement("a");u.href=/^https:\/\/github\.com\//.test(l)?l:"#",u.target="_blank",u.style.cssText="color:#18181b;font-size:14px;font-weight:500;text-decoration:none;border-bottom:1px solid #18181b;",u.textContent="View on GitHub \u2192",h.append(v,w,k,u),E.replaceChildren(h),C.style.display="none",s("Submitted successfully."),r=null}catch{s("Failed to submit. Please try again."),g.disabled=!1}})}var $=document.currentScript||document.querySelector("script[data-project-id]"),S=$?.getAttribute("data-project-id");S?document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>I(S)):I(S):console.error("[Tweaky] Missing data-project-id on script tag");function I(i){let t=document.createElement("button");t.id="lc-trigger",t.textContent="\u2726 Tweak this",t.style.cssText=`
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
  `,t.onmouseenter=()=>{t.style.transform="scale(1.04)",t.style.boxShadow="0 6px 28px rgba(0,0,0,0.3)"},t.onmouseleave=()=>{t.style.transform="scale(1)",t.style.boxShadow="0 4px 20px rgba(0,0,0,0.25)"},document.body.appendChild(t),t.addEventListener("click",()=>{t.style.display="none",R(i,()=>{t.style.display="block"})})}})();
