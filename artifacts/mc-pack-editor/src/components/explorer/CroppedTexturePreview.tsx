import { useState, useMemo, useEffect } from "react";
import { arrayBufferToDataURL } from "../../lib/zipUtils";
import { createCroppedTexturePreviewDataUrl, TEXTURE_THUMBNAIL_SIZE } from "../../lib/texturePreview";

export interface CroppedTexturePreviewProps {
  buffer: ArrayBuffer;
  path: string;
  alt: string;
  size?: number;
}

export function CroppedTexturePreview({
  buffer,
  path,
  alt,
  size = TEXTURE_THUMBNAIL_SIZE,
}: CroppedTexturePreviewProps) {
  const sourceUrl = useMemo(() => arrayBufferToDataURL(buffer, path), [buffer, path]);
  const [previewUrl, setPreviewUrl] = useState(sourceUrl);

  useEffect(() => {
    let cancelled = false;
    
    // Skip cropping for atlas textures that cause blank screen issues
    const isAtlasTexture = path.toLowerCase().includes('icons.png') || path.toLowerCase().includes('widgets.png');
    
    if (isAtlasTexture) {
      setPreviewUrl(sourceUrl);
      return;
    }
    
    createCroppedTexturePreviewDataUrl(buffer, path, size)
      .then((url) => {
        if (!cancelled) setPreviewUrl(url);
      })
      .catch(() => {
        if (!cancelled) setPreviewUrl(sourceUrl);
      });
    return () => { cancelled = true; };
  }, [buffer, path, sourceUrl, size]);

  return (
    <img
      src={previewUrl}
      alt={alt}
      className="texture-preview checkered"
      style={{ width: size, height: size, imageRendering: "pixelated" }}
    />
  );
}

export default CroppedTexturePreview;
