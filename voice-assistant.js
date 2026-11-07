(() => {
  const normalize = text => text.toLowerCase().replace(/&/g, " and ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const numbers = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split(" ");
  const decades = "twenty thirty forty fifty sixty seventy eighty ninety".split(" ");
  function number(text) {
    if (/^\d+$/.test(text)) return Number(text);
    if (numbers.includes(text)) return numbers.indexOf(text);
    const [prefix, suffix, extra] = text.split(" ");
    const decade = decades.indexOf(prefix);
    const digit = suffix ? numbers.indexOf(suffix) : 0;
    return decade >= 0 && digit >= 0 && digit < 10 && !extra ? (decade + 2) * 10 + digit : null;
  }

  const aliases = {
    "post a job": ["#jobcreator"], "create a job": ["#jobcreator"], "new job": ["#jobcreator"],
    "new requisition": ["#jobcreator"], "job creator": ["#jobcreator"],
    "pipeline": ["#pipeline"], "applications": ["#applications"], "requisitions": ["#requisitions"],
    "my projects": ["#projects"], "interview studio": ["#studio"], "passport": ["#passport"],
    "wallet": ["#wallet"], "notifications": ["#bell"], "home": ["#home"],
    "generate a draft": ["#gen"], "create requisition": ["#create"],
    "publish": ["#approve"], "publish this job": ["#approve"],
  };
  const selector = 'a[href], button, input, select, textarea, summary, tr[data-h], [role="button"], [role="link"]';

  function available(el) {
    return el.isConnected && !el.matches(':disabled,[readonly]') &&
      !el.closest('[hidden],[inert],[aria-hidden="true"],[aria-disabled="true"],[data-voice-ignore]') &&
      el.getClientRects().length && getComputedStyle(el).visibility === "visible";
  }

  function controls() {
    const scope = [...document.querySelectorAll('dialog[open],[aria-modal="true"]')].filter(available).at(-1) || document;
    return [...scope.querySelectorAll(selector)].filter(el => {
      if (!available(el) || el.matches('input[type="password"],input[type="file"],input[type="hidden"]')) return false;
      if (/password|one-time-code|cc-|transaction-|webauthn/i.test(el.autocomplete || "")) return false;
      return !(el instanceof HTMLAnchorElement) || /^(#|https?:)/i.test(el.getAttribute("href"));
    });
  }

  function label(el) {
    if (el.matches("tr[data-h]")) return el.cells[1]?.querySelector("b")?.textContent || el.cells[0]?.textContent || "";
    const labelled = el.getAttribute("aria-labelledby")?.split(/\s+/)
      .map(id => document.getElementById(id)?.textContent.trim()).filter(Boolean).join(" ");
    return (labelled || el.getAttribute("aria-label") || [...(el.labels || [])].map(node => node.textContent).join(" ") ||
      el.getAttribute("title") || (el.matches("input, select, textarea") ? el.placeholder : el.innerText) || "")
      .replace(/\s+/g, " ").trim();
  }

  function find(elements, target, navigationOnly) {
    const term = normalize(target).replace(/^the /, "").replace(/ button$/, "");
    const ordinal = /^(?:number|control|option) (.+)$/.exec(term);
    if (ordinal) {
      const el = elements[number(ordinal[1]) - 1];
      return el && (!navigationOnly || el.matches("a[href],tr[data-h],#bell")) ? [el] : [];
    }
    const candidates = navigationOnly ? elements.filter(el => el.matches("a[href],tr[data-h],#bell")) : elements;
    const routes = aliases[term];
    if (routes) {
      const matches = candidates.filter(el => routes.includes(el.getAttribute("href")) || routes.includes("#" + el.id));
      if (matches.length) return [matches[0]];
    }
    const exact = candidates.filter(el => normalize(label(el)) === term);
    // A menu link and a page shortcut sometimes have the same label and destination.
    return exact.filter((el, index) => !el.matches('a[href^="#"]') ||
      !exact.slice(0, index).some(peer => peer.getAttribute("href") === el.getAttribute("href")));
  }

  function fill(el, raw) {
    if (el instanceof HTMLSelectElement) {
      const matches = [...el.options].filter(option => !option.disabled && !option.hidden &&
        !option.closest("optgroup[disabled]") && normalize(option.label) === normalize(raw));
      if (matches.length !== 1) return "That choice isn’t available.";
      el.value = matches[0].value;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return null;
    }
    if (!el.matches('textarea,input:not([type]),input[type="text"],input[type="email"],input[type="search"],input[type="tel"],input[type="url"],input[type="number"],input[type="range"],input[type="date"],input[type="time"]')) {
      return "That control isn’t a text field or a list.";
    }
    const value = el.matches('input[type="number"],input[type="range"]') && /^[a-z ]+$/i.test(raw)
      ? String(number(normalize(raw)) ?? raw) : raw;
    const probe = el.cloneNode();
    probe.value = value;
    if (probe.value !== value || (value && !probe.validity.valid) || (el.maxLength >= 0 && value.length > el.maxLength)) {
      return "That value doesn’t fit this field.";
    }
    el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    if (el.isConnected) el.dispatchEvent(new Event("change", { bubbles: true }));
    return null;
  }

  function mount(host) {
    host.dataset.voiceIgnore = "";
    host.innerHTML = `
      <button class="btn sm" type="button" aria-expanded="false" aria-controls="assistant-panel">Voice Assistant</button>
      <section id="assistant-panel" aria-label="Voice Assistant" hidden>
        <div class="row"><button class="btn sm pri" type="button" id="assistant-mic">Start listening</button>
          <label><input type="checkbox" id="assistant-replies"> Speak replies</label></div>
        <p class="small dim">Use the microphone for English commands. Your browser may send audio to its speech service.</p>
        <form class="row"><input aria-label="Type a command" placeholder="Try: I want to post a job" autocomplete="off"><button class="btn sm">Run</button></form>
        <p class="small" role="status">Ready for a command.</p>
        <div class="row" id="assistant-confirm" hidden><button class="btn sm pri" type="button">Confirm</button><button class="btn sm" type="button">Cancel</button></div>
        <details><summary>Command examples</summary>
          <p class="small dim">“Take me to my applications”, “I want to post a job”, “Set title to Data Analyst”, “Create requisition”, “Confirm”, “Show controls”, “Stop listening”.</p>
        </details>
        <ol class="small" hidden></ol>
      </section>`;
    const launch = host.querySelector("button"), panel = host.querySelector("section");
    const mic = host.querySelector("#assistant-mic"), status = host.querySelector('[role="status"]');
    const confirmRow = host.querySelector("#assistant-confirm"), list = host.querySelector("ol");
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const replies = host.querySelector("#assistant-replies");
    let listening = false, active, timer, pending, expiry, listed, spokenCommand;

    const report = text => {
      status.textContent = text;
      if (spokenCommand && replies.checked && window.speechSynthesis) {
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
      }
    };
    const clear = () => { pending = null; confirmRow.hidden = true; clearTimeout(expiry); };
    function releaseMic() {
      clearTimeout(timer);
      timer = null;
      const previous = active;
      active = null;
      previous?.abort();
    }
    function stop(message) {
      listening = false;
      releaseMic();
      clear();
      mic.textContent = "Start listening";
      if (message) report(message);
    }

    function run(raw) {
      const text = raw.trim().replace(/^(?:hey aste\s*ai[, ]+|(?:please|can you|could you|i want to|i need to)\s+)/i, "");
      const plain = normalize(text).replace(/ please$/, "");
      if (/^(confirm|yes confirm|yes do it)$/.test(plain)) {
        const action = pending;
        clear();
        if (!action || action.url !== location.href || !controls().includes(action.el) || label(action.el) !== action.name ||
            action.href !== action.el.getAttribute("href")) return report("There’s no current action to confirm.");
        action.el.click();
        return report(`Activated ${action.name}.`);
      }
      clear();
      if (/^(cancel|never mind|no cancel)$/.test(plain)) return report("Cancelled.");
      if (/^(stop listening|turn off (?:voice|the microphone))$/.test(plain)) return stop("Microphone off.");
      if (/^(go back|back)$/.test(plain)) { history.back(); return report("Going back."); }
      if (/^scroll (up|down)$/.test(plain)) {
        window.scrollBy(0, (plain.endsWith("up") ? -1 : 1) * innerHeight * .7);
        return report("Scrolled.");
      }
      if (/^(read this|read (?:the )?page)$/.test(plain)) {
        const passage = document.querySelector("#card, main")?.innerText.trim();
        if (!passage || !window.speechSynthesis) return report("Reading aloud is unavailable here.");
        status.textContent = "Reading the page.";
        releaseMic();
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(passage.slice(0, 750)));
        if (listening) timer = setTimeout(listen, 350);
        return;
      }
      const elements = controls().filter(el => label(el));
      if (/^(help|what can (?:you|i) do|show controls)$/.test(plain)) {
        listed = { url: location.href, elements };
        list.replaceChildren(...elements.map(el => {
          const item = document.createElement("li");
          item.textContent = label(el);
          return item;
        }));
        list.hidden = false;
        return report("Use a control name or say “select number” followed by its number.");
      }
      const edit = /^(?:set|change|fill|choose|put)\s+(.+?)\s+(?:to|with)\s+([\s\S]+)$/i.exec(text);
      const navigation = /^(?:open|go to|take me to|show me|show) (.+)$/.exec(plain);
      const action = /^(?:activate|select|click|press|tap|choose) (.+)$/.exec(plain);
      const next = plain === "next" ? elements.filter(el => normalize(label(el)) === "next") : null;
      const term = edit?.[1] || navigation?.[1] || action?.[1] || plain;
      const numbered = /^(?:number|control|option) /.test(normalize(term));
      const source = numbered && listed?.url === location.href ? listed.elements : elements;
      const matches = (next || find(source, term, Boolean(navigation))).filter(el => elements.includes(el));
      if (matches.length > 1) return report("Several controls have that name. Say “show controls” and use a number.");
      const [el] = matches;
      if (!el) return report("I couldn’t match that to an available action. Try “show controls”.");
      const name = label(el);
      if (edit) return report(fill(el, edit[2]) || `Updated ${name}.`);
      if (el.matches('a[href^="#"]') && el.id !== "mcbtn") {
        el.click();
        return report(`Opening ${name}.`);
      }
      if (el.matches('select,textarea,input:not([type="checkbox"],[type="radio"],[type="submit"],[type="button"])')) {
        el.focus();
        return report(`Focused ${name}. Say “set ${name} to” and the value.`);
      }
      pending = { el, name, url: location.href, href: el.getAttribute("href") };
      confirmRow.hidden = false;
      expiry = setTimeout(() => { clear(); report("Confirmation expired."); }, 30_000);
      return report(`${name}? Say “confirm” or “cancel”.`);
    }

    function listen() {
      timer = null;
      if (!listening || active) return;
      if (document.hidden) return stop("Microphone paused because the page is hidden.");
      if (window.speechSynthesis?.speaking || window.speechSynthesis?.pending) { timer = setTimeout(listen, 300); return; }
      try {
        const recognition = new Recognition();
        active = recognition;
        recognition.lang = "en-IN";
        let transcript = "";
        recognition.onresult = event => {
          transcript = [...event.results].filter(result => result.isFinal).map(result => result[0].transcript).join(" ");
        };
        recognition.onerror = ({ error }) => {
          if (active !== recognition || error === "no-speech") return;
          stop(error === "not-allowed" || error === "service-not-allowed"
            ? "Microphone blocked. Allow access in your browser or type a command."
            : "Speech service stopped. Retry or type a command.");
        };
        recognition.onend = () => {
          if (active !== recognition) return;
          active = null;
          if (transcript) {
            spokenCommand = true;
            try { run(transcript); } finally { spokenCommand = false; }
          }
          if (listening && !timer) timer = setTimeout(listen, 350);
        };
        recognition.start();
      } catch {
        stop("Couldn’t start the microphone. Retry or type a command.");
      }
    }

    launch.onclick = () => {
      panel.hidden = !panel.hidden;
      launch.setAttribute("aria-expanded", String(!panel.hidden));
      if (panel.hidden) stop("Microphone off.");
    };
    mic.disabled = !Recognition || !window.isSecureContext;
    if (mic.disabled) report("Speech recognition is unavailable here. Try Chrome or type a command below.");
    mic.onclick = () => {
      if (listening) return stop("Microphone off.");
      window.speechSynthesis?.cancel();
      listening = true;
      mic.textContent = "Stop listening";
      report("Listening. What would you like to do?");
      listen();
    };
    host.querySelector("form").onsubmit = event => {
      event.preventDefault();
      const field = event.currentTarget.querySelector("input");
      if (field.value.trim()) run(field.value);
      field.value = "";
    };
    confirmRow.firstElementChild.onclick = () => run("confirm");
    confirmRow.lastElementChild.onclick = () => run("cancel");
    window.addEventListener("hashchange", () => { clear(); listed = null; list.hidden = true; });
    window.addEventListener("pagehide", () => stop());
    document.addEventListener("visibilitychange", () => { if (document.hidden) stop("Microphone off."); });
    window.addEventListener("asteai:other-audio", () => {
      if (listening) stop("Assistant paused while this feature uses audio.");
    });
  }

  window.AsteVoiceAssistant = { mount };
})();
