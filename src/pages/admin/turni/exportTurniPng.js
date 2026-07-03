// Genera e scarica un PNG pulito del piano turni settimanale

const SPECIAL_COLORS = {
  OFF:      { bg: '#e5e7eb', text: '#4b5563' },
  FERIE:    { bg: '#bbf7d0', text: '#166534' },
  MALATTIA: { bg: '#fecaca', text: '#991b1b' },
  PERMESSO: { bg: '#fef08a', text: '#854d0e' },
}

async function loadLogo() {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => resolve(img)
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

function truncateText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text
  let t = text
  while (t.length > 0 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1)
  return t + '…'
}

export async function exportTurniPng({ employees, days, shifts, dept, weekRange }) {
  const SCALE   = 2
  const NAME_W  = 175
  const COL_W   = 175
  const HEAD_H  = 88
  const THEAD_H = 42
  const ROW_H   = 108   // aumentato per ospitare la riga nota
  const PAD_BOT = 24

  const W = NAME_W + COL_W * days.length
  const H = HEAD_H + THEAD_H + ROW_H * employees.length + PAD_BOT

  const canvas = document.createElement('canvas')
  canvas.width  = W * SCALE
  canvas.height = H * SCALE
  const ctx = canvas.getContext('2d')
  ctx.scale(SCALE, SCALE)

  // ── Sfondo bianco ─────────────────────────────────────────────────────────
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  // ── Header petrol ─────────────────────────────────────────────────────────
  ctx.fillStyle = '#0f2d3d'
  ctx.fillRect(0, 0, W, HEAD_H)

  const logo = await loadLogo()
  if (logo) {
    const lh = 36
    const lw = logo.naturalWidth * (lh / logo.naturalHeight)
    ctx.save()
    ctx.filter = 'invert(1)'
    ctx.globalCompositeOperation = 'screen'
    ctx.drawImage(logo, 28, (HEAD_H - lh) / 2, lw, lh)
    ctx.restore()
  }

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

    // Separatore riga — più spesso
    ctx.strokeStyle = '#b0daea'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, y + ROW_H)
    ctx.lineTo(W, y + ROW_H)
    ctx.stroke()

    // Nome: usa nickname se disponibile
    ctx.fillStyle = '#0f2d3d'
    ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif'
    ctx.textBaseline = 'middle'
    ctx.fillText(emp.nickname || emp.name, 20, y + ROW_H / 2)

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

      // Separatore colonna verticale
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

      const px = cx + 12
      const pw = COL_W - 24

      if (typeof cell === 'string') {
        // Badge stato speciale
        const sc = SPECIAL_COLORS[cell] || { bg: '#e5e7eb', text: '#374151' }
        ctx.fillStyle = sc.bg
        roundRect(ctx, px, y + 14, pw, ROW_H - 28, 7)
        ctx.fill()
        ctx.fillStyle = sc.text
        ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(cell, cx + COL_W / 2, y + ROW_H / 2)
        ctx.textAlign = 'left'

      } else if (cell.pairs?.length) {
        const pairs = cell.pairs
        const note  = cell.note || ''

        if (pairs.length === 1) {
          // Turno singolo
          ctx.font = 'bold 18px "Segoe UI Mono", "Consolas", monospace'
          ctx.textBaseline = 'alphabetic'
          ctx.fillStyle = '#1b4358'
          ctx.fillText(pairs[0].in,  px, y + ROW_H / 2 - 8)
          ctx.fillStyle = '#2a7f9e'
          ctx.fillText(pairs[0].out, px, y + ROW_H / 2 + 16)

        } else {
          // Turno spezzato
          ctx.font = 'bold 16px "Segoe UI Mono", "Consolas", monospace'
          ctx.textBaseline = 'alphabetic'
          ctx.fillStyle = '#1b4358'
          ctx.fillText(`${pairs[0].in}–${pairs[0].out}`, px, y + 28)

          // Divisore spezzato
          ctx.strokeStyle = '#d9eef6'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(px, y + ROW_H / 2)
          ctx.lineTo(px + pw, y + ROW_H / 2)
          ctx.stroke()

          ctx.fillStyle = '#2a7f9e'
          ctx.fillText(`${pairs[1].in}–${pairs[1].out}`, px, y + ROW_H / 2 + 26)
        }

        // Nota turno (se presente)
        if (note) {
          ctx.font = 'italic 10px "Segoe UI", system-ui, sans-serif'
          ctx.textBaseline = 'alphabetic'
          ctx.fillStyle = '#5a9ab5'
          ctx.fillText(truncateText(ctx, note, pw), px, y + ROW_H - 10)
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
