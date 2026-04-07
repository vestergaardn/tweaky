"use strict";(()=>{var U=document.currentScript||document.querySelector("script[data-project-id]"),h=U?new URL(U.src).origin:window.location.origin;async function N(s){let n=await fetch(`${h}/api/sandbox/create`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({scriptTagId:s})});if(!n.ok){let l=await n.json().catch(()=>({}));throw new Error(l.error||"Failed to create sandbox")}return n.json()}async function J(s,n){let l=await fetch(`${h}/api/sandbox/prompt`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sandboxId:s,prompt:n})});if(!l.ok)throw new Error("Failed to apply prompt");return l.json()}async function K({sandboxId:s,projectId:n,prompt:l,bountyAmount:d,userEmail:m}){let f=await fetch(`${h}/api/sandbox/submit`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sandboxId:s,scriptTagId:n,prompt:l,bountyAmount:d,userEmail:m})});if(!f.ok)throw new Error("Failed to submit PR");return f.json()}function Y(s){fetch(`${h}/api/sandbox/${s}`,{method:"DELETE"}).catch(()=>{})}async function G(s){let n=await fetch(`${h}/api/projects/${s}`);if(!n.ok)throw new Error("Failed to fetch project config");return n.json()}async function V(s,n){let l=await fetch(`${h}/api/projects/${s}/submissions?email=${encodeURIComponent(n)}`);if(!l.ok)throw new Error("Failed to fetch submissions");return l.json()}function Q(s,n,l){document.body.style.overflow="hidden";let d=n?.widget_button_color||"#18181b",m=n?.widget_logo_url||null,f=n?.widget_welcome_message||null;function T(t){let o=t.replace("#",""),i=parseInt(o.substring(0,2),16),c=parseInt(o.substring(2,4),16),y=parseInt(o.substring(4,6),16);return(.299*i+.587*c+.114*y)/255>.5?"#18181b":"#fff"}let g=T(d),e=document.createElement("div");e.id="lc-overlay",e.style.cssText=`
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    background: #f4f4f5;
    display: flex;
    flex-direction: column;
    font-family: system-ui, -apple-system, sans-serif;
  `;let u=m?`<img src="${m}" alt="Logo" style="height:28px;max-width:160px;object-fit:contain;" />`:'<span id="lc-topbar-title" style="font-size:13px;font-weight:600;letter-spacing:-0.01em;opacity:0.9;">\u2726 Tweaky \u2014 Sandbox Preview</span>';e.innerHTML=`
    <style>
      #lc-overlay * { box-sizing: border-box; }

      /* \u2500\u2500 Top bar \u2500\u2500 */
      #lc-topbar {
        height: 44px;
        background: ${d};
        color: ${g};
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 16px;
        flex-shrink: 0;
      }
      #lc-topbar-actions {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      #lc-chat-toggle {
        background: none;
        border: none;
        color: ${g};
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
        color: ${g};
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
        border-top-color: ${d};
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

      /* \u2500\u2500 Tabs \u2500\u2500 */
      #lc-tabs {
        display: flex;
        border-bottom: 1px solid #e4e4e7;
        flex-shrink: 0;
      }
      .lc-tab {
        flex: 1;
        background: none;
        border: none;
        border-bottom: 2px solid transparent;
        padding: 10px 16px;
        font-size: 13px;
        font-weight: 600;
        color: #a1a1aa;
        cursor: pointer;
        transition: color 0.15s, border-color 0.15s;
      }
      .lc-tab:hover { color: #71717a; }
      .lc-tab.active {
        color: #18181b;
        border-bottom-color: ${d};
      }
      #lc-tab-collapse {
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.5;
        flex-shrink: 0;
      }
      #lc-tab-collapse:hover { opacity: 1; }

      /* \u2500\u2500 Tab content \u2500\u2500 */
      #lc-chat-content, #lc-history-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      #lc-history-content { display: none; }

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

      /* \u2500\u2500 History \u2500\u2500 */
      #lc-history-list {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
      }
      #lc-history-email-form {
        padding: 24px 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        align-items: center;
      }
      #lc-history-email-form input {
        border: 1px solid #e4e4e7;
        border-radius: 10px;
        padding: 8px 12px;
        font-size: 13px;
        font-family: inherit;
        outline: none;
        width: 100%;
        max-width: 260px;
      }
      #lc-history-email-form input:focus { border-color: #18181b; }
      #lc-history-email-form button {
        background: #18181b;
        color: #fff;
        border: none;
        border-radius: 10px;
        padding: 8px 20px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
      }
      #lc-history-email-form button:disabled { opacity: 0.5; cursor: not-allowed; }
      .lc-history-item {
        padding: 12px;
        border: 1px solid #e4e4e7;
        border-radius: 10px;
        margin-bottom: 8px;
      }
      .lc-history-item:last-child { margin-bottom: 0; }
      .lc-history-prompt {
        font-size: 13px;
        color: #18181b;
        line-height: 1.4;
        margin-bottom: 6px;
      }
      .lc-history-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 11px;
        color: #a1a1aa;
      }
      .lc-history-badge {
        display: inline-block;
        padding: 1px 6px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
      }
      .lc-badge-merged { background: #dcfce7; color: #16a34a; }
      .lc-badge-rejected { background: #fee2e2; color: #dc2626; }
      .lc-badge-pending { background: #fef9c3; color: #a16207; }
      .lc-history-empty {
        text-align: center;
        color: #a1a1aa;
        font-size: 13px;
        padding: 32px 16px;
      }
    </style>

    <div id="lc-topbar">
      ${u}
      <div id="lc-topbar-actions">
        <button id="lc-chat-toggle" title="Toggle chat panel">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 3.5h9M2.5 7h9M2.5 10.5h5" stroke="${g}" stroke-width="1.3" stroke-linecap="round"/></svg>
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
        <div id="lc-tabs">
          <button class="lc-tab active" data-tab="chat">Chat</button>
          <button class="lc-tab" data-tab="history">History</button>
          <button id="lc-tab-collapse" title="Collapse panel">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3L9 7L5 11" stroke="#71717a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>

        <div id="lc-chat-content">
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

        <div id="lc-history-content">
          <div id="lc-history-email-form">
            <p style="font-size:13px;color:#71717a;text-align:center;">Enter your email to see your past submissions.</p>
            <input type="email" id="lc-history-email" placeholder="your@email.com" />
            <button id="lc-history-load">Show history</button>
          </div>
          <div id="lc-history-list" style="display:none"></div>
        </div>
      </div>
    </div>
  `,document.body.appendChild(e);let a=null,w=!1,k=[],X=null,M=e.querySelector("#lc-loading"),P=e.querySelector("#lc-preview"),E=e.querySelector("#lc-panel"),x=e.querySelector("#lc-messages"),r=e.querySelector("#lc-prompt"),S=e.querySelector("#lc-send"),H=e.querySelector("#lc-submit-section"),L=e.querySelector("#lc-submit"),Z=e.querySelector("#lc-status");function p(t){Z.textContent=t}function C(t,o){let i=document.createElement("div");i.className=`lc-msg ${t}`,i.textContent=o,x.appendChild(i),x.scrollTop=x.scrollHeight}f&&C("assistant",f);let F=new ResizeObserver(()=>{x.scrollTop=x.scrollHeight});F.observe(x),r.addEventListener("input",()=>{r.style.height="auto";let o=(parseFloat(getComputedStyle(r).lineHeight)||20)*4;r.style.height=Math.min(r.scrollHeight,o)+"px"});let O=e.querySelectorAll(".lc-tab"),I=e.querySelector("#lc-chat-content"),R=e.querySelector("#lc-history-content");O.forEach(t=>{t.addEventListener("click",()=>{let o=t.getAttribute("data-tab");O.forEach(i=>i.classList.remove("active")),t.classList.add("active"),o==="chat"?(I.style.display="flex",R.style.display="none"):(I.style.display="none",R.style.display="flex")})});let B=e.querySelector("#lc-history-email"),b=e.querySelector("#lc-history-load"),ee=e.querySelector("#lc-history-email-form"),$=e.querySelector("#lc-history-list");b.addEventListener("click",async()=>{let t=B.value.trim();if(t){b.disabled=!0,b.textContent="Loading...";try{let o=await V(s,t);X=o,oe(o),ee.style.display="none",$.style.display="block"}catch{b.textContent="Failed \u2014 try again"}finally{b.disabled=!1,b.textContent==="Loading..."&&(b.textContent="Show history")}}}),B.addEventListener("keydown",t=>{t.key==="Enter"&&(t.preventDefault(),b.click())});function te(t){let o=Date.now()-new Date(t).getTime(),i=Math.floor(o/6e4);if(i<1)return"just now";if(i<60)return`${i}m ago`;let c=Math.floor(i/60);return c<24?`${c}h ago`:`${Math.floor(c/24)}d ago`}function oe(t){if(!t.length){$.innerHTML='<div class="lc-history-empty">No submissions found for this email.</div>';return}$.innerHTML=t.map(o=>{let i=o.status==="merged"?"lc-badge-merged":o.status==="rejected"?"lc-badge-rejected":"lc-badge-pending",c=o.user_prompt.length>80?o.user_prompt.slice(0,80)+"\u2026":o.user_prompt,y=o.pr_url?`<a href="${o.pr_url}" target="_blank" rel="noopener" style="color:${d};text-decoration:none;font-weight:500;">PR #${o.pr_number}</a>`:"";return`
        <div class="lc-history-item">
          <div class="lc-history-prompt">${ne(c)}</div>
          <div class="lc-history-meta">
            <span class="lc-history-badge ${i}">${o.status}</span>
            ${y}
            <span>${te(o.created_at)}</span>
          </div>
        </div>
      `}).join("")}function ne(t){let o=document.createElement("div");return o.textContent=t,o.innerHTML}let j=e.querySelector("#lc-chat-toggle");function A(){let t=E.classList.contains("collapsed");j.style.opacity=t?"1":"0.6",j.style.background=t?"rgba(255,255,255,0.15)":"none"}j.addEventListener("click",()=>{E.classList.toggle("collapsed"),A()}),e.querySelector("#lc-tab-collapse").addEventListener("click",()=>{E.classList.add("collapsed"),A()});function ie(){F.disconnect(),document.body.style.overflow="",a&&Y(a),e.remove(),l()}e.querySelector("#lc-close-btn").addEventListener("click",ie),(async()=>{try{p("Cloning repo and installing dependencies \u2014 this may take a minute\u2026");let{sandboxId:t,previewUrl:o}=await N(s);a=t,M.style.display="none";let i=document.createElement("iframe");i.src=o,i.setAttribute("sandbox","allow-same-origin allow-scripts allow-forms allow-popups allow-modals"),i.setAttribute("allow","clipboard-read; clipboard-write"),P.appendChild(i),r.disabled=!1,S.disabled=!1,p("Ready \u2014 the app is running live. Describe a change below.")}catch(t){M.innerHTML=`
        <div style="color:#ef4444;font-size:20px;margin-bottom:4px;">\u2716</div>
        <span style="color:#71717a;">Failed to start sandbox. Please close and try again.</span>
      `,p("Something went wrong."),console.error("[Tweaky]",t)}})();async function D(){let t=r.value.trim();if(!(!t||w||!a)){w=!0,k.push(t),S.disabled=!0,r.disabled=!0,r.value="",r.style.height="auto",C("user",t),p("Applying changes\u2026");try{let{changedFiles:o}=await J(a,t);C("assistant",`Done \u2014 changed: ${o.join(", ")}`),H.style.display="flex",p("Changes applied. Review the app above, then submit your PR.")}catch{C("assistant","Something went wrong. Please try again."),p("Error applying changes.")}finally{w=!1,S.disabled=!1,r.disabled=!1,r.focus()}}}S.addEventListener("click",D),r.addEventListener("keydown",t=>{t.key==="Enter"&&!t.shiftKey&&(t.preventDefault(),D())}),L.addEventListener("click",async()=>{let t=e.querySelector("#lc-email").value.trim(),o=e.querySelector("#lc-bounty").value.trim();if(!t||!o){p("Please enter your email and a bounty amount.");return}L.disabled=!0,p("Opening PR on GitHub\u2026");try{let{prUrl:i}=await K({sandboxId:a,projectId:s,prompt:k.join(`
`),bountyAmount:parseInt(o,10),userEmail:t}),c=document.createElement("div");c.style.cssText="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;font-family:system-ui,sans-serif;color:#18181b;";let y=document.createElement("div");y.style.fontSize="48px",y.textContent="\u{1F389}";let z=document.createElement("div");z.style.cssText="font-size:20px;font-weight:700",z.textContent="PR opened!";let q=document.createElement("div");q.style.cssText="font-size:14px;color:#71717a",q.textContent="The company will review your change.";let v=document.createElement("a");v.href=/^https:\/\/github\.com\//.test(i)?i:"#",v.target="_blank",v.style.cssText="color:#18181b;font-size:14px;font-weight:500;text-decoration:none;border-bottom:1px solid #18181b;",v.textContent="View on GitHub \u2192",c.append(y,z,q,v),P.replaceChildren(c),H.style.display="none",p("Submitted successfully."),a=null}catch{p("Failed to submit. Please try again."),L.disabled=!1}})}var se=document.currentScript||document.querySelector("script[data-project-id]"),_=se?.getAttribute("data-project-id");_?document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>W(_)):W(_):console.error("[Tweaky] Missing data-project-id on script tag");async function W(s){let n;try{n=await G(s)}catch(e){console.error("[Tweaky] Failed to load config, using defaults",e),n={}}let l=n.widget_launch_type||"button",d=n.widget_button_color||"#18181b",m=n.widget_button_text||"\u2726 Tweak this",f=n.widget_icon_only||!1;function T(e){let u=e.replace("#",""),a=parseInt(u.substring(0,2),16),w=parseInt(u.substring(2,4),16),k=parseInt(u.substring(4,6),16);return(.299*a+.587*w+.114*k)/255>.5?"#18181b":"#fff"}function g(e){e&&(e.style.display="none"),Q(s,n,()=>{e&&(e.style.display="")})}if(l==="text-link"){let e=document.querySelectorAll("[data-tweaky-trigger]");e.forEach(u=>{u.addEventListener("click",a=>{a.preventDefault(),g(null)})}),e.length||console.warn("[Tweaky] Launch type is text-link but no [data-tweaky-trigger] elements found")}else{let e=document.createElement("button");e.id="lc-trigger",e.textContent=f?"\u2726":m;let u=T(d);e.style.cssText=`
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483646;
      background: ${d};
      color: ${u};
      border: none;
      border-radius: 9999px;
      padding: ${f?"12px 14px":"10px 20px"};
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(0,0,0,0.25);
      font-family: system-ui, -apple-system, sans-serif;
      letter-spacing: -0.01em;
      transition: transform 0.15s, box-shadow 0.15s;
    `,e.onmouseenter=()=>{e.style.transform="scale(1.04)",e.style.boxShadow="0 6px 28px rgba(0,0,0,0.3)"},e.onmouseleave=()=>{e.style.transform="scale(1)",e.style.boxShadow="0 4px 20px rgba(0,0,0,0.25)"},document.body.appendChild(e),e.addEventListener("click",()=>{g(e)})}}})();
