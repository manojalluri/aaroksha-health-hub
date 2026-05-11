/**
 * compressImage - Compresses any image File before upload to Supabase Storage.
 * Resizes to max 800px on longest side, encodes as JPEG at 75% quality.
 * Result: ~80-200 KB per image vs 2-5 MB originals (10-30x smaller).
 */
export const compressImage = (file: File, maxPx = 800, quality = 0.75): Promise<File> => {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let w = img.width;
      let h = img.height;
      if (w > h && w > maxPx) { h = Math.round((h * maxPx) / w); w = maxPx; }
      else if (h > maxPx) { w = Math.round((w * maxPx) / h); h = maxPx; }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          const name = file.name.replace(/\.[^.]+$/, ".jpg");
          resolve(new File([blob], name, { type: "image/jpeg" }));
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
    img.src = objectUrl;
  });
};
