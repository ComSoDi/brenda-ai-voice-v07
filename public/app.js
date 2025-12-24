// public/app.js (module)
import { detectLocale } from "./locale.js";
import { t } from "./i18n.js";

class BrendaApp {
  constructor() {
    this.locale = detectLocale(); // { lang, variant }
    this.mode = "talk"; // "talk" | "text"

    // Voice agent (already working)
    this.agent = new window.VoiceAgent();
    this.transcriptBuffer = { user: "", assistant: "" };

    // Text chat state
    this.chat = []; // [{role:"user"|"assistant", content:string}]

    this.elements = {
      // Mode panels
      panelTalk: document.getElementById("panelTalk"),
      panelText: document.getElementById("panelText"),

      // Buttons
      toggleBtnTalk: document.getElementById("toggleBtnTalk"),
      toggleBtnText: document.getElementById("toggleBtnText"),

      // Talk UI
      hintTalk: document.getElementById("hintTalk"),
      transcript: document.getElementById("transcript"),
      canvas: document.getElementById("waveform"),
      avatar: document.getElementById("brendaAvatar"),

      // Text UI
      chatMessages: document.getElementById("chatMessages"),
      chatInput: document.getElementById("chatInput"),
      chatSendBtn: document.getElementById("chatSendBtn"),

      // Text hint
      hintText: document.getElementById("hintText"),
    };

    // Canvas
    this.canvasCtx = this.elements.canvas.getContext("2d");
    this.audioData = new Float32Array(128);

    this.init();
  }

  init() {
    // Localise hints + placeholders
    if (this.elements.hintTalk) this.elements.hintTalk.textContent = t(this.locale.variant, "hintTalk");
    if (this.elements.hintText) this.elements.hintText.textContent = t(this.locale.variant, "hintText");

    // Talk transcript placeholder
    if (this.elements.transcript) {
      this.elements.transcript.setAttribute("data-placeholder", t(this.locale.variant, "placeholder"));
    }

    // Text input placeholder + send label
    if (this.elements.chatInput) {
      this.elements.chatInput.placeholder = t(this.locale.variant, "textInputPlaceholder") || "Type a message...";
    }
    if (this.elements.chatSendBtn) {
      this.elements.chatSendBtn.textContent = t(this.locale.variant, "send") || "Send";
    }

    // Buttons
    this.elements.toggleBtnTalk.addEventListener("click", () => this.onTalkButton());
    this.elements.toggleBtnText.addEventListener("click", () => this.onTextButton());

    // Text send
    this.elements.chatSendBtn.addEventListener("click", () => this.sendTextMessage());
    this.elements.chatInput.addEventListener("keydown", (e) => {
      // Enter to send, Shift+Enter for newline
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendTextMessage();
      }
    });

    // Voice callbacks
    this.agent.onStatusChange = (s) => this.updateVoiceStatus(s);
    this.agent.onTranscript = (role, text) => this.addVoiceTranscript(role, text);
    this.agent.onAudioData = (data) => this.updateWaveform(data);
    this.agent.onError = (err) => this.showError(err);

    // Start in talk mode (UI)
    this.setMode("talk");
    this.setTalkButtonState({ connected: false, disabled: false });

    // Make canvas responsive and crisp
    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());

    this.animateWaveform();
  }

  /* --------------------
     Mode switching
  -------------------- */
  setMode(mode) {
    this.mode = mode;

    if (mode === "talk") {
      this.elements.panelTalk.classList.remove("hidden");
      this.elements.panelText.classList.add("hidden");
      // Highlight the active mode button
      this.elements.toggleBtnText.classList.add("btn-connect-text");
      this.elements.toggleBtnText.classList.remove("btn-disconnect-text");
    } else {
      this.elements.panelTalk.classList.add("hidden");
      this.elements.panelText.classList.remove("hidden");
      // Ensure chat container renders properly
      this.renderChat();
    }
  }

  onTalkButton() {
    // Always switch UI to talk mode
    this.setMode("talk");

    // Toggle voice connection
    const isDisconnect = this.elements.toggleBtnTalk.classList.contains("btn-disconnect-talk");
    if (isDisconnect) {
      this.agent.disconnect();
      return;
    }

    this.connectVoice();
  }

  onTextButton() {
    // Switch UI to text mode
    this.setMode("text");
    // Focus input
    setTimeout(() => this.elements.chatInput?.focus(), 50);
  }

  /* --------------------
     Voice (Talk)
  -------------------- */
  async connectVoice() {
    try {
      this.setTalkButtonState({ connected: false, disabled: true });

      // reset transcript
      this.elements.transcript.innerHTML = "";
      this.transcriptBuffer = { user: "", assistant: "" };

      await this.agent.connect("anon", this.locale.variant);
      // updateVoiceStatus("connected") will flip button
    } catch (e) {
      console.error(e);
      alert("Voice connect failed: " + e.message);
      this.setTalkButtonState({ connected: false, disabled: false });
    }
  }

  setTalkButtonState({ connected, disabled }) {
    const btn = this.elements.toggleBtnTalk;
    btn.disabled = !!disabled;

    if (connected) {
      btn.textContent = t(this.locale.variant, "disconnect");
      btn.classList.remove("btn-connect-talk");
      btn.classList.add("btn-disconnect-talk");
    } else {
      btn.textContent = t(this.locale.variant, "connect"); // your i18n maps to "Talk/Habla"
      btn.classList.add("btn-connect-talk");
      btn.classList.remove("btn-disconnect-talk");
    }
  }

  updateVoiceStatus(status) {
    // speaking glow
    if (this.elements.avatar) {
      this.elements.avatar.classList.toggle("speaking", status === "speaking");
    }

    if (status === "connected" || status === "speaking") {
      this.setTalkButtonState({ connected: true, disabled: false });
    } else if (status === "connecting") {
      this.setTalkButtonState({ connected: false, disabled: true });
    } else {
      this.setTalkButtonState({ connected: false, disabled: false });
    }
  }

  addVoiceTranscript(role, text) {
    this.transcriptBuffer[role] += text;
    this.renderVoiceTranscript();
  }

  renderVoiceTranscript() {
    const esc = (s) => {
      const d = document.createElement("div");
      d.textContent = s;
      return d.innerHTML;
    };

    let html = "";
    if (this.transcriptBuffer.user) {
      html += `
        <div class="transcript-item">
          <div class="transcript-label">${t(this.locale.variant, "youLabel")}:</div>
          <div>${esc(this.transcriptBuffer.user)}</div>
        </div>`;
    }

    if (this.transcriptBuffer.assistant) {
      html += `
        <div class="transcript-item">
          <div class="transcript-label assistant">${t(this.locale.variant, "assistantLabel")}:</div>
          <div>${esc(this.transcriptBuffer.assistant)}</div>
        </div>`;
    }

    this.elements.transcript.innerHTML = html;
    this.elements.transcript.scrollTop = this.elements.transcript.scrollHeight;
  }

  /* --------------------
     Text chat (WhatsApp-style)
  -------------------- */
  renderChat() {
    // ensure inner wrapper to push content to bottom
    this.elements.chatMessages.innerHTML = `<div class="chat-messages-inner" id="chatMessagesInner"></div>`;
    const inner = document.getElementById("chatMessagesInner");

    for (const msg of this.chat) {
      const div = document.createElement("div");
      div.className = `bubble ${msg.role === "user" ? "user" : "ai"}`;
      div.textContent = msg.content;
      inner.appendChild(div);
    }

    this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
  }

  async sendTextMessage() {
    const input = this.elements.chatInput;
    const btn = this.elements.chatSendBtn;
    const text = (input.value || "").trim();
    if (!text) return;

    // optimistic UI
    this.chat.push({ role: "user", content: text });
    input.value = "";
    this.autoGrowTextarea();
    this.renderChat();

    btn.disabled = true;

    try {
      const reply = await this.callChatAPI(text);
      this.chat.push({ role: "assistant", content: reply });
      this.renderChat();
    } catch (e) {
      console.error(e);
      this.chat.push({ role: "assistant", content: `(${e.message})` });
      this.renderChat();
    } finally {
      btn.disabled = false;
      input.focus();
    }
  }

  async callChatAPI(message) {
    // Include simple history so Brenda can be coherent
    const history = this.chat.slice(-12); // last N messages
    const payload = {
      localeVariant: this.locale.variant,
      messages: history.concat([{ role: "user", content: message }]),
    };

    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 25000);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).finally(() => clearTimeout(to));

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Chat error ${res.status}: ${t}`);
    }

    const data = await res.json();
    if (!data.reply) throw new Error("No reply returned");
    return data.reply;
  }

  autoGrowTextarea() {
    const ta = this.elements.chatInput;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(120, ta.scrollHeight) + "px";
  }

  /* --------------------
     Waveform
  -------------------- */
  resizeCanvas() {
    const c = this.elements.canvas;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();

    c.width = Math.floor(rect.width * dpr);
    c.height = Math.floor(rect.height * dpr);
    
    this.canvasCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  updateWaveform(floatTimeDomain) {
    const step = Math.floor(floatTimeDomain.length / this.audioData.length);
    for (let i = 0; i < this.audioData.length; i++) {
      this.audioData[i] = Math.abs(floatTimeDomain[i * step]) || 0;
    }
  }

  animateWaveform() {
    const c = this.elements.canvas;
    const ctx = this.canvasCtx;

    ctx.fillStyle = "#f5f5f5";
    ctx.fillRect(0, 0, c.width, c.height);

    const baselineY = c.height - 6;
    const maxHeight = (c.height - 12) * 0.6;

    ctx.strokeStyle = "#667eea";
    ctx.lineWidth = 2;
    ctx.beginPath();

    const slice = c.width / this.audioData.length;
    let x = 0;

    for (let i = 0; i < this.audioData.length; i++) {
      const v = Math.max(0, Math.min(1, this.audioData[i]));
      const y = baselineY - v * maxHeight;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += slice;
    }

    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, baselineY);
    ctx.lineTo(c.width, baselineY);
    ctx.stroke();

    requestAnimationFrame(() => this.animateWaveform());
  }

  showError(err) {
    alert("Error: " + (err?.message || String(err)));
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.__app = new BrendaApp();
});
