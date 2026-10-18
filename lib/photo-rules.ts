export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const photoPathPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$/i;

export function isPhotoPath(value: string) {
  return photoPathPattern.test(value);
}

export function isAllowedPhotoFile(file: File) {
  if (file.size <= 0 || file.size > MAX_PHOTO_BYTES) return false;
  const type = file.type.toLowerCase();
  if (type === "image/jpeg" || type === "image/png" || type === "image/webp") {
    return true;
  }
  return /\.(jpe?g|png|webp)$/i.test(file.name);
}

export function sniffImageType(bytes: Uint8Array) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export function extensionMatchesType(path: string, mimeType: string) {
  const extension = path.split(".").pop()?.toLowerCase();
  if (mimeType === "image/jpeg") return extension === "jpg" || extension === "jpeg";
  if (mimeType === "image/png") return extension === "png";
  if (mimeType === "image/webp") return extension === "webp";
  return false;
}
