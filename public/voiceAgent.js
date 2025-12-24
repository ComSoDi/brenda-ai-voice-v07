// public/voiceAgent.js (browser)
// WebRTC transport for OpenAI Realtime + server-minted ephemeral keys.
// Supports localeVariant for dialect/vocabulary alignment.

(function () {
  class VoiceAgent {
    constructor() {
      this.pc = null;
      this.dc = null;
      this.remoteAudioEl = null;
      this.localStream = null;

      this.audioContext = null;
      this.analyser = null;
      this.analyserBuf = null;
      this._raf = null;

      this.isConnected = false;
      this.isSpeaking = false;
      this.currentResponseId = null;
      this.lastResponseTime = 0;
      this.RESPONSE_COOLDOWN = 1200;

      this.onStatusChange = null;
      this.onTranscript = null;
      this.onAudioData = null;
      this.onError = null;
    }

    updateStatus(s) {
      if (this.onStatusChange) this.onStatusChange(s);
    }

    async connect(userId = "anon", localeVariant = "en-US") {
      if (this.isConnected || this.pc) return;

      try {
        this.updateStatus("connecting");

        await this.ensureLocalAudio();

        const ephemeralKey = await Config.mintEphemeralKey({ userId, localeVariant });

        this.pc = new RTCPeerConnection({ iceServers: Config.WEBRTC.ICE_SERVERS });

        this.remoteAudioEl = document.createElement("audio");
        this.remoteAudioEl.autoplay = true;
        this.remoteAudioEl.playsInline = true;

        this.pc.ontrack = (ev) => {
          const [stream] = ev.streams;
          if (stream) {
            this.remoteAudioEl.srcObject = stream;
            this.remoteAudioEl.play().catch(() => {});
          }
        };

        const track = this.localStream.getAudioTracks()[0];
        this.pc.addTrack(track, this.localStream);

        this.dc = this.pc.createDataChannel("oai-events");
        this.dc.onopen = () => {
          this.sendEvent({
            type: "session.update",
            session: {
              modalities: Config.OPENAI.MODALITIES,
              instructions: Config.buildInstructions(localeVariant),
              voice: Config.OPENAI.VOICE,
              input_audio_transcription: { model: "whisper-1" },
              turn_detection: {
                type: "server_vad",
                threshold: 0.9,
                prefix_padding_ms: 200,
                silence_duration_ms: 900,
                create_response: true,
                interrupt_response: true
              }
            }
          });

          this.updateStatus("connected");
        };
        this.dc.onmessage = (ev) => this.handleEventMessage(ev.data);
        this.dc.onerror = (e) => this.handleError(e);

        const offer = await this.pc.createOffer({ offerToReceiveAudio: true });
        await this.pc.setLocalDescription(offer);

        await this.waitForIceGatheringComplete();

        const sdpOffer = this.pc.localDescription?.sdp;
        if (!sdpOffer) throw new Error("Missing local SDP offer");

        const url = `${Config.OPENAI.REALTIME_HTTP_URL}?model=${encodeURIComponent(Config.OPENAI.MODEL)}`;
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${ephemeralKey}`,
            "Content-Type": "application/sdp",
            "OpenAI-Beta": "realtime=v1"
          },
          body: sdpOffer
        });

        if (!resp.ok) {
          const t = await resp.text().catch(() => "");
          throw new Error(`Realtime SDP exchange failed (${resp.status}): ${t}`);
        }

        const answerSdp = await resp.text();
        await this.pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

        this.isConnected = true;

        this.pc.onconnectionstatechange = () => {
          const st = this.pc?.connectionState;
          if (st === "connected") this.updateStatus("connected");
          if (st === "failed" || st === "disconnected" || st === "closed") this.updateStatus("disconnected");
        };
      } catch (e) {
        this.handleError(e);
        this.disconnect();
      }
    }

    async ensureLocalAudio() {
      if (this.localStream) return;

      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      const src = this.audioContext.createMediaStreamSource(this.localStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      src.connect(this.analyser);

      this.analyserBuf = new Float32Array(this.analyser.fftSize);
      this.startWaveformLoop();
    }

    startWaveformLoop() {
      const tick = () => {
        if (this.analyser && this.analyserBuf) {
          this.analyser.getFloatTimeDomainData(this.analyserBuf);
          if (this.onAudioData) this.onAudioData(this.analyserBuf);
        }
        this._raf = requestAnimationFrame(tick);
      };
      if (!this._raf) this._raf = requestAnimationFrame(tick);
    }

    async waitForIceGatheringComplete() {
      if (!this.pc) return;
      if (this.pc.iceGatheringState === "complete") return;

      await new Promise((resolve) => {
        const check = () => {
          if (!this.pc) return resolve();
          if (this.pc.iceGatheringState === "complete") {
            this.pc.removeEventListener("icegatheringstatechange", check);
            resolve();
          }
        };
        this.pc.addEventListener("icegatheringstatechange", check);
        setTimeout(resolve, 1500);
      });
    }

    handleEventMessage(raw) {
      let data;
      try { data = JSON.parse(raw); } catch { return; }

      switch (data.type) {
        case "conversation.item.input_audio_transcription.completed":
          if (this.onTranscript && data.transcript) this.onTranscript("user", data.transcript);
          break;

        case "response.created": {
          const newId = data.response?.id;
          if (!newId) break;

          const dt = Date.now() - this.lastResponseTime;
          if (this.currentResponseId || dt < this.RESPONSE_COOLDOWN) {
            this.sendEvent({ type: "response.cancel", response_id: newId });
            break;
          }

          this.currentResponseId = newId;
          this.lastResponseTime = Date.now();
          this.isSpeaking = true;
          this.updateStatus("speaking");
          break;
        }

        case "response.audio_transcript.delta":
          if (this.onTranscript && data.delta) this.onTranscript("assistant", data.delta);
          break;

        case "response.done":
          if (data.response?.id === this.currentResponseId) {
            this.isSpeaking = false;
            this.currentResponseId = null;
            this.updateStatus("connected");
          }
          break;

        case "error":
          this.handleError(new Error(data.error?.message || "Realtime error"));
          break;
      }
    }

    sendEvent(evt) {
      if (this.dc && this.dc.readyState === "open") {
        this.dc.send(JSON.stringify(evt));
      }
    }

    disconnect() {
      try { if (this.dc) this.dc.close(); } catch {}
      this.dc = null;

      try { if (this.pc) this.pc.close(); } catch {}
      this.pc = null;

      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = null;

      try { if (this.localStream) this.localStream.getTracks().forEach((t) => t.stop()); } catch {}
      this.localStream = null;

      try { if (this.remoteAudioEl) this.remoteAudioEl.srcObject = null; } catch {}
      this.remoteAudioEl = null;

      try { if (this.audioContext && this.audioContext.state !== "closed") this.audioContext.close(); } catch {}
      this.audioContext = null;
      this.analyser = null;
      this.analyserBuf = null;

      this.isConnected = false;
      this.isSpeaking = false;
      this.currentResponseId = null;

      this.updateStatus("disconnected");
    }

    handleError(err) {
      console.error("VoiceAgent error:", err);
      if (this.onError) this.onError(err);
      this.updateStatus("error");
    }
  }

  window.VoiceAgent = VoiceAgent;
})();
