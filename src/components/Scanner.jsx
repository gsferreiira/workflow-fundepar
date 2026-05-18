import { useEffect, useRef, useState } from 'react'
import { X, CheckCircle2, ArrowRightLeft, MapPin, User, UserCheck, Package } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { useToast } from '../contexts/ToastContext.jsx'
import { formatAssetNumber } from '../utils/format.js'

/**
 * Scanner unificado — modo individual e modo lote.
 *
 * Props:
 *   open, mode ('single' | 'lote'), onClose,
 *   onLoteItem(asset, eqId, eqName), onConcluirLote()
 *   onMaquinaLocalizada(mov, asset), onSemHistorico(asset)
 */
export function Scanner({
  open,
  mode = 'single',
  onClose,
  onLoteItem,
  onConcluirLote,
  onMaquinaLocalizada,
  onSemHistorico,
  loteCount = 0,
  loteRecentList = [],
}) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const detectorRef = useRef(null)
  const animFrameRef = useRef(null)
  const ocrIntervalRef = useRef(null)
  const ocrWorkerRef = useRef(null)
  const zxingReaderRef = useRef(null)
  const handledRef = useRef(false)
  const { showToast } = useToast()

  useEffect(() => {
    if (!open) return
    handledRef.current = false
    start()
    return () => {
      stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode])

  const stop = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    if (ocrIntervalRef.current) {
      clearInterval(ocrIntervalRef.current)
      ocrIntervalRef.current = null
    }
    // Termina o worker do Tesseract pra liberar a memória (~5-10 MB de WASM)
    if (ocrWorkerRef.current) {
      const w = ocrWorkerRef.current
      ocrWorkerRef.current = null
      w.terminate().catch(() => {})
    }
    if (zxingReaderRef.current) {
      try {
        zxingReaderRef.current.reset()
      } catch (e) {
        /* noop */
      }
      zxingReaderRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    detectorRef.current = null
  }

  const start = async () => {
    if (typeof BarcodeDetector !== 'undefined') {
      await startNative()
    } else {
      await startZXing()
    }
  }

  const startNative = async () => {
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })
    } catch (err) {
      showToast('Não foi possível acessar a câmera. Verifique as permissões.', 'danger')
      onClose?.()
      return
    }
    streamRef.current = stream

    const video = videoRef.current
    if (!video) return
    video.srcObject = stream
    await video.play().catch(() => {})

    const wanted = [
      'code_128', 'code_39', 'code_93', 'ean_13', 'ean_8',
      'upc_a', 'upc_e', 'qr_code', 'itf', 'codabar', 'data_matrix',
    ]
    const supported = await BarcodeDetector.getSupportedFormats().catch(() => [])
    const formats = supported.length ? supported.filter((f) => wanted.includes(f)) : wanted
    // eslint-disable-next-line no-undef
    detectorRef.current = new BarcodeDetector({
      formats: formats.length ? formats : ['code_128', 'ean_13', 'qr_code'],
    })

    loopNative()
    startOCR()
  }

  const loopNative = async () => {
    if (handledRef.current) return
    const video = videoRef.current
    const detector = detectorRef.current
    if (!video || !detector) return
    if (video.readyState >= 2) {
      try {
        const results = await detector.detect(video)
        if (results.length > 0) {
          handleSuccess(results[0].rawValue)
          return
        }
      } catch (e) {
        /* noop */
      }
    }
    animFrameRef.current = requestAnimationFrame(loopNative)
  }

  const startOCR = async () => {
    // Cria um worker do Tesseract UMA VEZ e reutiliza nas chamadas seguintes.
    // Antes, cada `Tesseract.recognize()` criava um worker novo (~5-10 MB de WASM)
    // a cada 1.5s, vazando memória progressivamente em sessões longas.
    try {
      const Tesseract = (await import('tesseract.js')).default
      // Em runs anteriores, o worker pode ter sido criado mas a câmera ainda
      // não estava pronta. Se já existir, reutiliza.
      if (!ocrWorkerRef.current) {
        const worker = await Tesseract.createWorker('eng')
        await worker.setParameters({ tessedit_char_whitelist: '0123456789.' })
        ocrWorkerRef.current = worker
      }
    } catch (err) {
      // Falha ao criar worker — silencia (BarcodeDetector é o fallback)
      return
    }

    ocrIntervalRef.current = setInterval(async () => {
      if (handledRef.current) return
      const worker = ocrWorkerRef.current
      const video = videoRef.current
      if (!worker || !video) return
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      try {
        ctx.drawImage(video, 0, 0)
        const result = await worker.recognize(canvas)
        const text = result.data.text || ''
        const match = text.match(/\b\d{3}\.\d{3}\.\d{3}\.\d{3}\b/)
        if (match) handleSuccess(match[0])
      } catch (err) {
        // OCR falha silenciosamente — frame ruim, próxima iteração tenta de novo
      }
    }, 1500)
  }

  const startZXing = async () => {
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/library')
      const reader = new BrowserMultiFormatReader()
      zxingReaderRef.current = reader
      reader
        .decodeFromVideoDevice(undefined, videoRef.current, (result) => {
          if (result && !handledRef.current) {
            handleSuccess(result.getText())
          }
        })
        .catch(() => {
          showToast('Não foi possível acessar a câmera. Verifique as permissões.', 'danger')
          onClose?.()
        })
    } catch (e) {
      showToast('Erro ao iniciar scanner.', 'danger')
      onClose?.()
    }
  }

  const handleSuccess = async (decoded) => {
    if (handledRef.current) return
    handledRef.current = true

    const raw = String(decoded).trim()
    const digits = raw.replace(/\D/g, '')
    const assetNumber =
      digits.length === 12
        ? `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}.${digits.slice(9, 12)}`
        : raw

    if (mode === 'lote') {
      await handleLoteSuccess(assetNumber)
      return
    }

    showToast(`Código lido: ${assetNumber}`, 'success')

    const { data: movements, error } = await supabase
      .from('asset_movements')
      .select(
        '*, equipment(name), destination_room:destination_room_id(id,name), origin_room:origin_room_id(name)',
      )
      .eq('asset_number', assetNumber)
      .is('deleted_at', null)
      .order('moved_at', { ascending: false })
      .limit(1)

    if (error) {
      showToast('Erro ao buscar patrimônio: ' + error.message, 'danger')
      onClose?.()
      return
    }

    if (movements && movements.length > 0) {
      const mov = movements[0]
      if (mov.moved_by) {
        // .maybeSingle() retorna null em vez de erro quando o perfil foi
        // soft-deletado ou não existe mais. Antes, o .single() abortava a
        // exibição inteira do resultado.
        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', mov.moved_by)
          .maybeSingle()
        if (prof) mov.profile = prof
      }
      onMaquinaLocalizada?.(mov, assetNumber)
    } else {
      showToast(`PAT "${assetNumber}" não encontrado — preencha a movimentação.`, 'warning')
      onSemHistorico?.(assetNumber)
    }
  }

  const handleLoteSuccess = async (assetNumber) => {
    let equipmentId = ''
    let equipmentName = ''
    const { data: loc } = await supabase
      .from('equipment_locations')
      .select('equipment_id, equipment:equipment_id(name)')
      .eq('asset_number', assetNumber)
      .limit(1)

    if (loc && loc.length > 0) {
      equipmentId = loc[0].equipment_id || ''
      equipmentName = loc[0].equipment?.name || ''
    } else {
      const { data: movs } = await supabase
        .from('asset_movements')
        .select('equipment_id, equipment:equipment_id(name)')
        .eq('asset_number', assetNumber)
        .is('deleted_at', null)
        .order('moved_at', { ascending: false })
        .limit(1)
      if (movs && movs.length > 0) {
        equipmentId = movs[0].equipment_id || ''
        equipmentName = movs[0].equipment?.name || ''
      }
    }

    // Tenta inserir; o pai decide se é duplicata
    const ok = onLoteItem?.(assetNumber, equipmentId, equipmentName)
    if (ok === false) {
      showToast(`PAT ${assetNumber} já foi adicionado.`, 'warning')
    } else {
      showToast(`+ ${assetNumber}${equipmentName ? ' — ' + equipmentName : ''}`, 'success')
    }

    // Reseta para próxima leitura
    handledRef.current = false
    if (mode === 'lote' && videoRef.current && detectorRef.current) {
      loopNative()
    }
  }

  if (!open) return null

  return (
    <div className="modal-overlay" id="scanner-modal">
      <div className="modal-content" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <div>
            <h3>{mode === 'lote' ? 'Escanear Patrimônios' : 'Escanear Patrimônio'}</h3>
            {mode === 'lote' ? (
              <div
                id="lote-scan-counter"
                style={{
                  fontSize: 13,
                  color: 'var(--success-color)',
                  fontWeight: 600,
                  marginTop: 2,
                }}
              >
                {loteCount} {loteCount === 1 ? 'item escaneado' : 'itens escaneados'}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                Aponte a câmera para o código de barras
              </div>
            )}
          </div>
          <button className="modal-close" type="button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="scanner-viewport">
          <video ref={videoRef} id="scanner-video" autoPlay playsInline muted />
          <div className="scanner-overlay">
            <div className="scanner-frame">
              <div className="scanner-line"></div>
            </div>
          </div>
        </div>
        <p
          style={{
            fontSize: 12,
            color: 'var(--text-secondary)',
            textAlign: 'center',
            margin: mode === 'lote' ? '0 0 10px' : '0 0 14px',
          }}
        >
          {mode === 'lote'
            ? 'Aponte para o código — o scanner continua após cada leitura'
            : 'Posicione o código de barras dentro da área marcada'}
        </p>
        {mode === 'lote' && (
          <>
            <div
              id="lote-scan-list"
              style={{
                maxHeight: 110,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                marginBottom: 12,
              }}
            >
              {loteRecentList.map((item, i) => (
                <div className="lote-scan-item" key={`${item.assetNumber}-${i}`}>
                  <CheckCircle2 size={13} style={{ color: 'var(--success-color)', flexShrink: 0 }} />
                  <span>{item.assetNumber}</span>
                  {item.equipmentName ? (
                    <span className="lote-scan-item-name"> — {item.equipmentName}</span>
                  ) : (
                    <span className="lote-scan-item-name lote-scan-item-unknown">
                      {' '}— equipamento não cadastrado
                    </span>
                  )}
                </div>
              ))}
            </div>
            <button
              id="lote-scan-concluir"
              className="btn-primary"
              style={{ width: '100%' }}
              onClick={onConcluirLote}
            >
              Concluir ({loteCount} {loteCount === 1 ? 'item' : 'itens'})
            </button>
          </>
        )}
        {mode !== 'lote' && (
          <button
            className="btn-primary"
            style={{ background: '#e2e8f0', color: '#475569', width: '100%' }}
            onClick={onClose}
          >
            <X size={14} /> Cancelar
          </button>
        )}
      </div>
    </div>
  )
}

/* Modal mostrando uma máquina já localizada após scan */
export function ScanResultModal({ movement, assetNumber, onClose, onRegistrar }) {
  if (!movement) return null
  const m = movement
  return (
    <div className="modal-overlay" id="scan-result-modal">
      <div className="modal-content" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <div>
            <h3>Máquina Localizada</h3>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
              PAT: <strong>{formatAssetNumber(assetNumber)}</strong>
            </div>
          </div>
          <button className="modal-close" type="button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                background: 'rgba(99,102,241,.1)',
                color: '#6366f1',
                padding: 12,
                borderRadius: 10,
                flexShrink: 0,
              }}
            >
              <Package size={22} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{m.equipment?.name || '—'}</div>
              {m.serial_number && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Série: {m.serial_number}
                </div>
              )}
            </div>
          </div>
          <div
            style={{
              background: 'rgba(12,74,110,.07)',
              border: '1.5px solid var(--accent-color)',
              borderRadius: 12,
              padding: 16,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: 'var(--accent-color)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '.5px',
                marginBottom: 8,
              }}
            >
              Localização atual
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 17,
                fontWeight: 800,
                color: 'var(--accent-color)',
              }}
            >
              <MapPin size={18} style={{ flexShrink: 0 }} />
              {m.destination_room?.name || '—'}
            </div>
            {m.profile && (
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  marginTop: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <User size={13} /> Responsável: {m.profile.full_name}
              </div>
            )}
            {m.received_by && (
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  marginTop: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <UserCheck size={13} /> Com: {m.received_by}
              </div>
            )}
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-secondary)',
                marginTop: 8,
                opacity: 0.7,
              }}
            >
              Última movimentação: {new Date(m.moved_at).toLocaleDateString('pt-BR')}
            </div>
          </div>
          <div
            style={{
              background: 'var(--bg-main)',
              borderRadius: 10,
              padding: 14,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              Deseja registrar uma movimentação?
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              A origem será preenchida automaticamente com a sala atual.
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button
            className="btn-primary"
            style={{ background: '#e2e8f0', color: '#475569', flex: 1 }}
            onClick={onClose}
          >
            Fechar
          </button>
          <button className="btn-primary" style={{ flex: 1 }} onClick={onRegistrar}>
            <ArrowRightLeft size={14} /> Registrar Movimentação
          </button>
        </div>
      </div>
    </div>
  )
}
