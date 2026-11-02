// Produce a full photo (for detail views) plus a small thumbnail (for lists /
// galleries) so DB payloads stay small on Vercel's ~4.5MB response cap.
export function compressVariants(file: File): Promise<{ data: string; thumb: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const draw = (maxW: number, quality: number) => {
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', quality);
      };
      const data = draw(800, 0.72); // full photo, kept for detail views
      const thumb = draw(120, 0.6); // small thumbnail for list/gallery payloads
      URL.revokeObjectURL(url);
      resolve({ data, thumb });
    };
    img.onerror = reject;
    img.src = url;
  });
}
