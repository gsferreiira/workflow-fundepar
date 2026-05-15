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

  open: async () => {
    App.scanner._handled = false;
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

  _onSuccess: async (decoded) => {
    if (App.scanner._handled) return;
    App.scanner._handled = true;
    App.scanner.close();

    const raw = decoded.trim();
    const digits = raw.replace(/\D/g, "");
    const assetNumber =
      digits.length === 12
        ? `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}.${digits.slice(9, 12)}`
        : raw;

    UI.showToast(`Código lido: ${assetNumber}`, "success");

    const { data: movements, error: scanError } = await supabaseClient
      .from("asset_movements")
      .select(
        "*, equipment(name), destination_room:destination_room_id(id,name), origin_room:origin_room_id(name), profile:moved_by(full_name)",
      )
      .eq("asset_number", assetNumber)
      .is("deleted_at", null)
      .order("moved_at", { ascending: false })
      .limit(1);

    if (scanError) {
      UI.showToast("Erro ao buscar patrimônio: " + scanError.message, "danger");
      return;
    }

    if (movements && movements.length > 0) {
      document.getElementById("modal-root").innerHTML =
        Views.app.scanResultModal(movements[0], assetNumber);
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
