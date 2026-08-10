// Minimal, dependency-light .xlsx reader: just enough to pull named sheets out of
// BAG's premium-region workbook (scripts/build-premium-data.mjs). Not a general xlsx
// library — no styles/formulas/merged-cell handling, no writing.
//
// An .xlsx is a ZIP of OOXML parts. We hand-roll the ZIP central-directory reader
// (binary, fixed-width fields — low risk to get right) and lean on `fast-xml-parser`
// for the actual XML (entity/CDATA handling in hand-rolled regex XML parsing is the
// kind of thing that looks fine until it silently mis-parses a name with an `&` in
// it — not worth the risk for government data we're trusting numbers from).

import { inflateRawSync } from 'node:zlib'
import { XMLParser } from 'fast-xml-parser'

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true, // "r:id" -> "id", so we don't need the relationships namespace URI
  parseTagValue: false, // keep everything as raw strings; we coerce types ourselves
  parseAttributeValue: false,
})

const asArray = (x) => (x === undefined ? [] : Array.isArray(x) ? x : [x])

/** Reads the ZIP central directory and returns { name -> raw (decompressed) Buffer } for entries in `wantedNames`. */
function readZipEntries(buf, wantedNames) {
  const EOCD_SIG = 0x06054b50
  const CD_SIG = 0x02014b50
  const LOCAL_SIG = 0x04034b50

  let eocdPos = -1
  const searchStart = Math.max(0, buf.length - 22 - 65536)
  for (let i = buf.length - 22; i >= searchStart; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocdPos = i
      break
    }
  }
  if (eocdPos === -1) throw new Error('Not a valid zip file (no End Of Central Directory record found)')

  const totalEntries = buf.readUInt16LE(eocdPos + 10)
  let cdOffset = buf.readUInt32LE(eocdPos + 16)

  const found = new Map()
  for (let i = 0; i < totalEntries && found.size < wantedNames.size; i++) {
    if (buf.readUInt32LE(cdOffset) !== CD_SIG) throw new Error(`Corrupt zip central directory at entry ${i}`)
    const compression = buf.readUInt16LE(cdOffset + 10)
    const compressedSize = buf.readUInt32LE(cdOffset + 20)
    const fileNameLen = buf.readUInt16LE(cdOffset + 28)
    const extraLen = buf.readUInt16LE(cdOffset + 30)
    const commentLen = buf.readUInt16LE(cdOffset + 32)
    const localHeaderOffset = buf.readUInt32LE(cdOffset + 42)
    const name = buf.toString('utf8', cdOffset + 46, cdOffset + 46 + fileNameLen)

    if (wantedNames.has(name)) {
      if (buf.readUInt32LE(localHeaderOffset) !== LOCAL_SIG) throw new Error(`Corrupt zip local header for ${name}`)
      const localNameLen = buf.readUInt16LE(localHeaderOffset + 26)
      const localExtraLen = buf.readUInt16LE(localHeaderOffset + 28)
      const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen
      const raw = buf.subarray(dataStart, dataStart + compressedSize)
      if (compression === 0) found.set(name, Buffer.from(raw))
      else if (compression === 8) found.set(name, inflateRawSync(raw))
      else throw new Error(`Unsupported zip compression method ${compression} for ${name}`)
    }

    cdOffset += 46 + fileNameLen + extraLen + commentLen
  }
  return found
}

function colLettersToIndex(letters) {
  let idx = 0
  for (const ch of letters) idx = idx * 26 + (ch.charCodeAt(0) - 64)
  return idx - 1
}

/** Extracts a single cell's display text/value, handling both <v> and inline-string <is> forms. */
function cellValue(cell) {
  if (cell.is !== undefined) {
    // Inline string: either <is><t>text</t></is> or rich text <is><r><t>a</t></r><r><t>b</t></r></is>
    const runs = asArray(cell.is.r)
    if (runs.length > 0) return runs.map((r) => (typeof r.t === 'string' ? r.t : '')).join('')
    return typeof cell.is.t === 'string' ? cell.is.t : ''
  }
  return cell.v !== undefined ? String(cell.v) : undefined
}

/**
 * Reads a sheet by its *name* (as shown in the Excel tab bar, e.g. "A_COM") into an
 * array of rows, each a sparse array of cell values indexed by 0-based column.
 * Resolves name -> worksheet XML part via workbook.xml + workbook.xml.rels, rather
 * than assuming e.g. "A_COM is always sheet5.xml" — sheet order/numbering isn't
 * something BAG has committed to keeping stable year over year.
 */
export function readXlsxSheetRows(buf, sheetName) {
  const core = readZipEntries(buf, new Set(['xl/workbook.xml', 'xl/_rels/workbook.xml.rels']))
  const workbook = xmlParser.parse(core.get('xl/workbook.xml').toString('utf8'))
  const rels = xmlParser.parse(core.get('xl/_rels/workbook.xml.rels').toString('utf8'))

  const sheetMeta = asArray(workbook.workbook.sheets.sheet).find((s) => s['@_name'] === sheetName)
  if (!sheetMeta) throw new Error(`Sheet "${sheetName}" not found in workbook`)
  const rId = sheetMeta['@_id']

  const relationship = asArray(rels.Relationships.Relationship).find((r) => r['@_Id'] === rId)
  if (!relationship) throw new Error(`No relationship found for sheet "${sheetName}" (${rId})`)
  // Targets are usually relative ("worksheets/sheet5.xml"); normalize to a full zip path.
  const target = relationship['@_Target'].replace(/^\/?xl\//, '').replace(/^\//, '')
  const sheetPath = `xl/${target}`

  const sheetEntry = readZipEntries(buf, new Set([sheetPath])).get(sheetPath)
  if (!sheetEntry) throw new Error(`Worksheet part "${sheetPath}" not found in zip`)

  const parsed = xmlParser.parse(sheetEntry.toString('utf8'))
  const xmlRows = asArray(parsed.worksheet.sheetData.row)

  return xmlRows.map((xmlRow) => {
    const row = []
    for (const cell of asArray(xmlRow.c)) {
      const ref = cell['@_r'] // e.g. "C42"
      const colLetters = ref.match(/^[A-Z]+/)[0]
      row[colLettersToIndex(colLetters)] = cellValue(cell)
    }
    return row
  })
}
