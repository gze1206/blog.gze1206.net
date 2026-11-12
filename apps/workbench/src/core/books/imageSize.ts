export function readImageSize(
  bytes: Uint8Array,
): { width: number; height: number; type: 'jpeg' | 'png' | 'webp' } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (offset: number, text: string) =>
    [...text].every((c, i) => bytes[offset + i] === c.charCodeAt(0));
  const result = (width: number, height: number, type: 'jpeg' | 'png' | 'webp') =>
    width > 0 && height > 0 ? { width, height, type } : null;
  if (bytes.length >= 24 && bytes[0] === 137 && ascii(1, 'PNG\r\n\x1a\n') && ascii(12, 'IHDR'))
    return result(view.getUint32(16), view.getUint32(20), 'png');
  if (bytes.length >= 12 && ascii(0, 'RIFF') && ascii(8, 'WEBP')) {
    if (bytes.length >= 30 && ascii(12, 'VP8X'))
      return result(
        1 + view.getUint8(24) + (view.getUint8(25) << 8) + (view.getUint8(26) << 16),
        1 + view.getUint8(27) + (view.getUint8(28) << 8) + (view.getUint8(29) << 16),
        'webp',
      );
    if (bytes.length >= 25 && ascii(12, 'VP8L') && bytes[20] === 47) {
      const n = view.getUint32(21, true);
      return result((n & 0x3fff) + 1, ((n >>> 14) & 0x3fff) + 1, 'webp');
    }
    if (
      bytes.length >= 30 &&
      ascii(12, 'VP8 ') &&
      bytes[23] === 157 &&
      bytes[24] === 1 &&
      bytes[25] === 42
    )
      return result(view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff, 'webp');
    return null;
  }
  if (bytes[0] !== 255 || bytes[1] !== 216) return null;
  let i = 2;
  while (i + 3 < bytes.length) {
    if (bytes[i] !== 255) return null;
    while (bytes[i] === 255) i++;
    const marker = bytes[i++];
    if (marker === undefined || marker === 217 || marker === 218 || i + 2 > bytes.length)
      return null;
    const length = view.getUint16(i);
    if (length < 2 || i + length > bytes.length) return null;
    if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) {
      if (length < 7) return null;
      return result(view.getUint16(i + 5), view.getUint16(i + 3), 'jpeg');
    }
    i += length;
  }
  return null;
}
