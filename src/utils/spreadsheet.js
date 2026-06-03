function safeSheetName(name) {
  return String(name || 'Planilha')
    .replace(/[:\\/?*\[\]]/g, ' ')
    .slice(0, 31)
    .trim() || 'Planilha'
}

function normalizeCellValue(value) {
  if (value == null) return ''
  if (value instanceof Date) return value
  if (typeof value === 'object') {
    if ('text' in value) return value.text || ''
    if ('result' in value) return value.result ?? ''
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text || '').join('')
  }
  return value
}

function downloadBuffer(buffer, fileName) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export async function exportXlsx({ fileName, sheets }) {
  const excelMod = await import('exceljs')
  const ExcelJS = excelMod.default || excelMod
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'workflow-fundepar'
  workbook.created = new Date()

  sheets.forEach((sheet) => {
    const worksheet = workbook.addWorksheet(safeSheetName(sheet.name))
    if (sheet.columns?.length) {
      worksheet.columns = sheet.columns.map((width) => ({ width }))
    }
    worksheet.addRows(sheet.rows || [])
    const header = worksheet.getRow(1)
    header.font = { bold: true }
    header.alignment = { vertical: 'middle' }
  })

  const buffer = await workbook.xlsx.writeBuffer()
  downloadBuffer(buffer, fileName)
}

export async function readFirstSheetAsObjects(file) {
  const excelMod = await import('exceljs')
  const ExcelJS = excelMod.default || excelMod
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await file.arrayBuffer())

  const worksheet = workbook.worksheets[0]
  if (!worksheet) return []

  const headers = []
  worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = String(normalizeCellValue(cell.value)).trim()
  })

  const rows = []
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return
    const item = {}
    headers.forEach((header, colNumber) => {
      if (!header) return
      item[header] = normalizeCellValue(row.getCell(colNumber).value)
    })
    rows.push(item)
  })
  return rows
}
