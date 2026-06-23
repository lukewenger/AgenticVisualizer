#!/usr/bin/env node
/**
 * Generates minimal valid placeholder icon files (icon.png, icon.ico) for
 * electron-builder so packaging doesn't fail on missing icon assets.
 *
 * TODO: replace desktop/assets/icon.png, icon.ico, and icon.icns with real
 * artwork before shipping a real release. These placeholders are solid-color
 * squares and are NOT suitable for production.
 *
 * icon.icns is NOT generated here — there is no simple way to produce a
 * valid .icns without native tooling (iconutil, which only exists on
 * macOS) or a third-party encoder. A placeholder .icns is intentionally
 * left out; macOS packaging will fail until a real .icns is added (see
 * TODO in electron-builder.config.js).
 */
'use strict'

const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const ASSETS_DIR = path.join(__dirname, '..', 'assets')
fs.mkdirSync(ASSETS_DIR, { recursive: true })

// --- Minimal solid-color PNG encoder (no deps) ---------------------------

function crc32(buf) {
  let c
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      c = n
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      }
      t[n] = c
    }
    return t
  })())
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

/** Builds a square RGBA PNG of `size` filled with a solid indigo color. */
function buildSolidPng(size) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0) // width
  ihdr.writeUInt32BE(size, 4) // height
  ihdr.writeUInt8(8, 8) // bit depth
  ihdr.writeUInt8(6, 9) // color type: RGBA
  ihdr.writeUInt8(0, 10) // compression
  ihdr.writeUInt8(0, 11) // filter
  ihdr.writeUInt8(0, 12) // interlace

  // Agent Flow brand-ish indigo: #4F46E5
  const r = 0x4f, g = 0x46, b = 0xe5, a = 0xff
  const rowLen = 1 + size * 4 // filter byte + RGBA per pixel
  const raw = Buffer.alloc(rowLen * size)
  for (let y = 0; y < size; y++) {
    const rowStart = y * rowLen
    raw[rowStart] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      const px = rowStart + 1 + x * 4
      raw[px] = r
      raw[px + 1] = g
      raw[px + 2] = b
      raw[px + 3] = a
    }
  }
  const idatData = zlib.deflateSync(raw)

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idatData),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// --- Minimal ICO encoder (wraps one PNG, modern Windows supports PNG-in-ICO) --

function buildIco(pngBuf, size) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(1, 4) // count: 1 image

  const entry = Buffer.alloc(16)
  entry.writeUInt8(size >= 256 ? 0 : size, 0) // width (0 = 256)
  entry.writeUInt8(size >= 256 ? 0 : size, 1) // height (0 = 256)
  entry.writeUInt8(0, 2) // color palette
  entry.writeUInt8(0, 3) // reserved
  entry.writeUInt16LE(1, 4) // color planes
  entry.writeUInt16LE(32, 6) // bits per pixel
  entry.writeUInt32LE(pngBuf.length, 8) // image data size
  entry.writeUInt32LE(6 + 16, 12) // offset to image data

  return Buffer.concat([header, entry, pngBuf])
}

const png256 = buildSolidPng(256)
fs.writeFileSync(path.join(ASSETS_DIR, 'icon.png'), png256)
console.log('Wrote assets/icon.png (256x256 placeholder)')

const icoPng = buildSolidPng(256)
fs.writeFileSync(path.join(ASSETS_DIR, 'icon.ico'), buildIco(icoPng, 256))
console.log('Wrote assets/icon.ico (256x256 placeholder, PNG-in-ICO)')

console.log(
  '\nNOTE: assets/icon.icns was NOT generated (requires macOS iconutil or a ' +
  'third-party encoder). mac packaging will need a real .icns before it can ' +
  'run end-to-end. All three icons here are placeholders — replace with real ' +
  'artwork before shipping.'
)
