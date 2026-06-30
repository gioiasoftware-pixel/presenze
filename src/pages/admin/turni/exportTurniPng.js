// Genera e scarica un PNG pulito del piano turni settimanale

const SPECIAL_COLORS = {
  OFF:      { bg: '#e5e7eb', text: '#4b5563' },
  FERIE:    { bg: '#bbf7d0', text: '#166534' },
  MALATTIA: { bg: '#fecaca', text: '#991b1b' },
  PERMESSO: { bg: '#fef08a', text: '#854d0e' },
}

// Converte il logo nero-su-bianco in bianco-su-trasparente per il header scuro
async function loadLogoWhite() {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const tmp = document.createElement('canvas')
      tmp.width  = img.naturalWidth
      tmp.height = img.naturalHeight
      const tc = tmp.getContext('2d')
      tc.drawImage(img, 0, 0)
      const d = tc.getImageData(0, 0, tmp.width, tmp.height)
      for (let i = 0; i < d.data.length; i += 4) {
        const r = d.data[i], g = d.data[i+1], b = d.data[i+2]
        if (r > 200 && g > 200 && b > 200) {
          // bianco → trasparente
          d.data[i+3] = 0
        } else {
          // nero → bianco
          d.data[i] = 255; d.data[i+1] = 255; d.data[i+2] = 255; d.data[i+3] = 255
        }
      }
      tc.putImageData(d, 0, 0)
      resolve(tmp)
    }
    img.onerror = () => resolve(null)
    img.src = '/logo.png'
  })
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y,   x + w, y + r,   r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y,   x + r, y,   r)
  ctx.closePath()
}

export async function exportTurniPng({ employees, days, shifts, dept, weekRange }) {
  const SCALE   = 2     // retina
  const NAME_W  = 165
  const COL_W   = 165
  const HEAD_H  = 88   // header logo + titolo
  const THEAD_H = 42   // intestazione colonne
  const ROW_H   = 76   // altezza riga dipendente
  const PAD_BOT = 24

  const W = NAME_W + COL_W * days.length
  const H = HEAD_H + THEAD_H + ROW_H * employees.length + PAD_BOT

  const canvas = document.createElement('canvas')
  canvas.width  = W * SCALE
  canvas.height = H * SCALE
  const ctx = canvas.getContext('2d')
  ctx.scale(SCALE, SCALE)

  // ── Sfondo totale bianco ──────────────────────────────────────────────────
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  // ── Header petrol ─────────────────────────────────────────────────────────
  ctx.fillStyle = '#0f2d3d'
  ctx.fillRect(0, 0, W, HEAD_H)

  // Logo bianco nel header
  const logoCanvas = await loadLogoWhite()
  if (logoCanvas) {
    const lh = 36
    const lw = logoCanvas.width * (lh / logoCanvas.height)
    ctx.drawImage(logoCanvas, 28, (HEAD_H - lh) / 2, lw, lh)
  }

  // Testo header
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(`Turni ${dept}`, W - 28, HEAD_H / 2 - 11)
  ctx.font = '13px "Segoe UI", system-ui, sans-serif'
  ctx.fillStyle = '#76bdd6'
  ctx.fillText(weekRange, W - 28, HEAD_H / 2 + 11)
  ctx.textAlign = 'left'

  // ── Intestazione colonne ──────────────────────────────────────────────────
  ctx.fillStyle = '#f0f8fb'
  ctx.fillRect(0, HEAD_H, W, THEAD_H)

  // Linea sotto header colonne
  ctx.strokeStyle = '#b0daea'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(0, HEAD_H + THEAD_H)
  ctx.lineTo(W, HEAD_H + THEAD_H)
  ctx.stroke()

  ctx.fillStyle = '#1e526c'
  ctx.font = 'bold 10px "Segoe UI", system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillText('DIPENDENTE', 20, HEAD_H + THEAD_H / 2)

  days.forEach((d, i) => {
    ctx.fillStyle = '#1e526c'
    ctx.font = 'bold 10px "Segoe UI", system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(d.label.toUpperCase(), NAME_W + i * COL_W + COL_W / 2, HEAD_H + THEAD_H / 2)
  })
  ctx.textAlign = 'left'

  // ── Righe dipendenti ──────────────────────────────────────────────────────
  employees.forEach((emp, ri) => {
    const y = HEAD_H + THEAD_H + ri * ROW_H

    // Zebra
    if (ri % 2 === 1) {
      ctx.fillStyle = '#f8fcfd'
      ctx.fillRect(0, y, W, ROW_H)
    }

    // Separatore riga
    ctx.strokeStyle = '#daeef5'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, y + ROW_H)
    ctx.lineTo(W, y + ROW_H)
    ctx.stroke()

    // Nome dipendente
    ctx.fillStyle = '#0f2d3d'
    ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif'
    ctx.textBaseline = 'middle'
    ctx.fillText(emp.name, 20, y + ROW_H / 2)

    // Separatore colonna nome
    ctx.strokeStyle = '#b0daea'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(NAME_W, y)
    ctx.lineTo(NAME_W, y + ROW_H)
    ctx.stroke()

    // Celle giorni
    days.forEach((d, ci) => {
      const cx = NAME_W + ci * COL_W

      // Separatore colonna
      if (ci > 0) {
        ctx.strokeStyle = '#daeef5'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(cx, y)
        ctx.lineTo(cx, y + ROW_H)
        ctx.stroke()
      }

      const cell = shifts[emp.id]?.[d.dateKey] ?? null
      if (!cell) return

      const px = cx + 10
      const pw = COL_W - 20

      if (typeof cell === 'string') {
        // Badge stato speciale
        const sc = SPECIAL_COLORS[cell] || { bg: '#e5e7eb', text: '#374151' }
        ctx.fillStyle = sc.bg
        roundRect(ctx, px, y + 10, pw, ROW_H - 20, 7)
        ctx.fill()
        ctx.fillStyle = sc.text
        ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(cell, cx + COL_W / 2, y + ROW_H / 2)
        ctx.textAlign = 'left'
      } else if (cell.pairs?.length) {
        // Orari turno
        const pairs = cell.pairs
        if (pairs.length === 1) {
          // Turno singolo: centrato
          ctx.fillStyle = '#1b4358'
          ctx.font = 'bold 12px "Segoe UI Mono", "Consolas", monospace'
          ctx.textBaseline = 'alphabetic'
          ctx.fillText(`${pairs[0].in}`, px, y + ROW_H / 2 - 3)
          ctx.fillStyle = '#2a7f9e'
          ctx.fillText(`${pairs[0].out}`, px, y + ROW_H / 2 + 14)
        } else {
          // Turno spezzato: due linee separate
          ctx.fillStyle = '#1b4358'
          ctx.font = 'bold 11px "Segoe UI Mono", "Consolas", monospace'
          ctx.textBaseline = 'alphabetic'
          ctx.fillText(`${pairs[0].in}–${pairs[0].out}`, px, y + 22)

          ctx.strokeStyle = '#d9eef6'
          ctx.lineWidth = 0.75
          ctx.beginPath()
          ctx.moveTo(px, y + ROW_H / 2 - 1)
          ctx.lineTo(px + pw, y + ROW_H / 2 - 1)
          ctx.stroke()

          ctx.fillStyle = '#2a7f9e'
          ctx.fillText(`${pairs[1].in}–${pairs[1].out}`, px, y + ROW_H - 18)
        }
      }
    })
  })

  // ── Bordo esterno ─────────────────────────────────────────────────────────
  ctx.strokeStyle = '#b0daea'
  ctx.lineWidth = 1.5
  ctx.strokeRect(0.75, HEAD_H + 0.75, W - 1.5, H - HEAD_H - 1.5)

  // ── Download ──────────────────────────────────────────────────────────────
  const filename = `Turni_${dept}_${days[0]?.dateKey ?? 'settimana'}.png`
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, 'image/png')
}
