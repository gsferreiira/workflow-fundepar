// modules/scanner.js — Leitor de código de barras / patrimônio.
// Motor de leitura:
//   1. BarcodeDetector API (nativo Chrome/Edge/Android) — hardware-accelerated, ~60fps
//   2. ZXing BrowserMultiFormatReader (fallback Firefox/Safari)
//   3. Tesseract OCR para etiquetas danificadas
App.scanner = {
  _stream: null,
  _animFrame: null,
  _detector: null,
  _zxingReader: null,
  _ocrInterval: null,
  _handled: false,
  _loteMode: false,
  _video: null,

  open: async () => {
    App.scanner._handled = false;
    App.scanner._loteMode = false;
    App.scanner._video = null;
    document.getElementById("modal-root").innerHTML = Views.app.scannerModal();
    if (typeof lucide !== "undefined") lucide.createIcons();

    if (typeof BarcodeDetector !== "undefined") {
      await App.scanner._startNative();
    } else if (typeof ZXing !== "undefined" && ZXing.BrowserMultiFormatReader) {
      App.scanner._startZXing();
    } else {
      UI.showToast(
        "Scanner não suportado neste navegador. Use Chrome ou Edge.",
        "warning",
      );
      App.scanner.close();
    }
  },

  _startNative: async () => {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
    } catch (err) {
      UI.showToast(
        "Não foi possível acessar a câmera. Verifique as permissões.",
        "danger",
      );
      App.scanner.close();
      return;
    }
    App.scanner._stream = stream;

    const video = document.getElementById("scanner-video");
    if (!video) {
      App.scanner.close();
      return;
    }
    video.srcObject = stream;
    App.scanner._video = video;
    await video.play().catch(() => {});

    const wanted = [
      "code_128", "code_39", "code_93", "ean_13", "ean_8",
      "upc_a", "upc_e", "qr_code", "itf", "codabar", "data_matrix",
    ];
    const supported = await BarcodeDetector.getSupportedFormats().catch(() => []);
    const formats = supported.length
      ? supported.filter((f) => wanted.includes(f))
      : wanted;
    App.scanner._detector = new BarcodeDetector({
      formats: formats.length ? formats : ["code_128", "ean_13", "qr_code"],
    });

    App.scanner._loopNative(video);
    App.scanner._startOCR(video);
  },

  _loopNative: async (video) => {
    if (App.scanner._handled) return;
    if (video.readyState >= 2) {
      try {
        const results = await App.scanner._detector.detect(video);
        if (results.length > 0) {
          App.scanner._onSuccess(results[0].rawValue);
          return;
        }
      } catch (e) {}
    }
    App.scanner._animFrame = requestAnimationFrame(() =>
      App.scanner._loopNative(video),
    );
  },

  _startOCR: (video) => {
    App.scanner._ocrInterval = setInterval(async () => {
      if (App.scanner._handled) return;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      try {
        const result = await Tesseract.recognize(canvas, "eng", {
          tessedit_char_whitelist: "0123456789.",
        });
        const text = result.data.text || "";
        const match = text.match(/\b\d{3}\.\d{3}\.\d{3}\.\d{3}\b/);
        if (match) {
          App.scanner._onSuccess(match[0]);
        }
      } catch (err) {
        console.log("OCR erro:", err);
      }
    }, 1500);
  },

  _startZXing: () => {
    try {
      const reader = new ZXing.BrowserMultiFormatReader();
      App.scanner._zxingReader = reader;
      reader
        .decodeFromVideoDevice(undefined, "scanner-video", (result, err) => {
          if (result && !App.scanner._handled) {
            App.scanner._onSuccess(result.getText());
          }
        })
        .catch(() => {
          UI.showToast(
            "Não foi possível acessar a câmera. Verifique as permissões.",
            "danger",
          );
          App.scanner.close();
        });
    } catch (e) {
      UI.showToast("Erro ao iniciar scanner.", "danger");
      App.scanner.close();
    }
  },

  close: () => {
    if (App.scanner._animFrame) {
      cancelAnimationFrame(App.scanner._animFrame);
      App.scanner._animFrame = null;
    }
    if (App.scanner._ocrInterval) {
      clearInterval(App.scanner._ocrInterval);
      App.scanner._ocrInterval = null;
    }
    if (App.scanner._zxingReader) {
      try {
        App.scanner._zxingReader.reset();
      } catch (e) {}
      App.scanner._zxingReader = null;
    }
    if (App.scanner._stream) {
      App.scanner._stream.getTracks().forEach((t) => t.stop());
      App.scanner._stream = null;
    }
    App.scanner._detector = null;
    const modal = document.getElementById("scanner-modal");
    if (modal) modal.remove();
  },

  openForLote: () => {
    App.scanner._loteMode = true;
    App.scanner._handled = false;
    App.scanner._video = null;
    document.getElementById("modal-root").innerHTML = Views.app.scannerLoteModal();
    if (typeof lucide !== "undefined") lucide.createIcons();

    if (typeof BarcodeDetector !== "undefined") {
      App.scanner._startNative();
    } else if (typeof ZXing !== "undefined" && ZXing.BrowserMultiFormatReader) {
      App.scanner._startZXing();
    } else {
      UI.showToast("Scanner não suportado neste navegador.", "warning");
      App.scanner.closeLote();
    }
  },

  closeLote: () => {
    App.scanner._loteMode = false;
    App.scanner.close();
    App.modules.movimentacoes.restoreLoteModal();
  },

  _onLoteSuccess: async (assetNumber) => {
    const mod = App.modules.movimentacoes;

    // Evita duplicata no lote atual
    if (mod._loteItems.some((item) => item.assetNumber === assetNumber)) {
      UI.showToast(`PAT ${assetNumber} já foi adicionado.`, "warning");
      App.scanner._handled = false;
      if (App.scanner._video && App.scanner._detector) {
        App.scanner._loopNative(App.scanner._video);
      }
      return;
    }

    // Busca equipamento pelo patrimônio (equipment_locations tem o dado mais recente)
    let equipmentId = "";
    let equipmentName = "";
    const { data: loc } = await supabaseClient
      .from("equipment_locations")
      .select("equipment_id, equipment:equipment_id(name)")
      .eq("asset_number", assetNumber)
      .limit(1);

    if (loc && loc.length > 0) {
      equipmentId = loc[0].equipment_id || "";
      equipmentName = loc[0].equipment?.name || "";
    } else {
      const { data: movs } = await supabaseClient
        .from("asset_movements")
        .select("equipment_id, equipment:equipment_id(name)")
        .eq("asset_number", assetNumber)
        .is("deleted_at", null)
        .order("moved_at", { ascending: false })
        .limit(1);
      if (movs && movs.length > 0) {
        equipmentId = movs[0].equipment_id || "";
        equipmentName = movs[0].equipment?.name || "";
      }
    }

    mod._loteUid++;
    mod._loteItems.push({
      uid: mod._loteUid,
      equipmentId,
      equipmentName,
      assetNumber,
      serialNumber: "",
    });

    const n = mod._loteItems.length;

    // Atualiza contador e lista na UI do scanner
    const counter = document.getElementById("lote-scan-counter");
    if (counter) counter.textContent = `${n} item${n !== 1 ? "s" : ""} escaneado${n !== 1 ? "s" : ""}`;

    const scannedList = document.getElementById("lote-scan-list");
    if (scannedList) {
      const el = document.createElement("div");
      el.className = "lote-scan-item";
      el.innerHTML = `<i data-lucide="check-circle-2" style="width:13px;color:var(--success-color);flex-shrink:0;"></i><span>${escapeHtml(assetNumber)}</span>${equipmentName ? `<span class="lote-scan-item-name"> — ${escapeHtml(equipmentName)}</span>` : `<span class="lote-scan-item-name lote-scan-item-unknown"> — equipamento não cadastrado</span>`}`;
      scannedList.prepend(el);
      if (typeof lucide !== "undefined") lucide.createIcons(el);
    }

    const concluirBtn = document.getElementById("lote-scan-concluir");
    if (concluirBtn) concluirBtn.textContent = `Concluir (${n} item${n !== 1 ? "s" : ""})`;

    UI.showToast(`+ ${assetNumber}${equipmentName ? " — " + equipmentName : ""}`, "success");

    // Reseta para próxima leitura e reinicia o loop (BarcodeDetector para após cada sucesso)
    App.scanner._handled = false;
    if (App.scanner._loteMode && App.scanner._video && App.scanner._detector) {
      App.scanner._loopNative(App.scanner._video);
    }
  },

  _onSuccess: async (decoded) => {
    if (App.scanner._handled) return;
    App.scanner._handled = true;

    const raw = decoded.trim();
    const digits = raw.replace(/\D/g, "");
    const assetNumber =
      digits.length === 12
        ? `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}.${digits.slice(9, 12)}`
        : raw;

    if (App.scanner._loteMode) {
      await App.scanner._onLoteSuccess(assetNumber);
      return;
    }

    UI.showToast(`Código lido: ${assetNumber}`, "success");

    let query = supabaseClient
      .from("asset_movements")
      .select(
        "*, equipment(name), destination_room:destination_room_id(id,name), origin_room:origin_room_id(name)",
      )
      .eq("asset_number", assetNumber)
      .is("deleted_at", null)
      .order("moved_at", { ascending: false })
      .limit(1);

    let { data: movements, error: scanError } = await query;

    // Coluna deleted_at pode não existir se a migração da Onda 3 ainda não foi rodada
    if (scanError && scanError.message?.includes("deleted_at")) {
      const retry = await supabaseClient
        .from("asset_movements")
        .select(
          "*, equipment(name), destination_room:destination_room_id(id,name), origin_room:origin_room_id(name)",
        )
        .eq("asset_number", assetNumber)
        .order("moved_at", { ascending: false })
        .limit(1);
      movements = retry.data;
      scanError = retry.error;
    }

    if (scanError) {
      UI.showToast("Erro ao buscar patrimônio: " + scanError.message, "danger");
      return;
    }

    if (movements && movements.length > 0) {
      const mov = movements[0];
      // Busca nome do responsável separadamente (moved_by pode não ter FK em profiles)
      if (mov.moved_by) {
        const { data: prof } = await supabaseClient
          .from("profiles")
          .select("full_name")
          .eq("id", mov.moved_by)
          .single();
        if (prof) mov.profile = prof;
      }
      document.getElementById("modal-root").innerHTML =
        Views.app.scanResultModal(mov, assetNumber);
      if (typeof lucide !== "undefined") lucide.createIcons();
    } else {
      await App.modules.movimentacoes.showCreateModal(assetNumber);
      UI.showToast(
        `PAT "${assetNumber}" não encontrado — preencha a movimentação.`,
        "warning",
      );
    }
  },
};
