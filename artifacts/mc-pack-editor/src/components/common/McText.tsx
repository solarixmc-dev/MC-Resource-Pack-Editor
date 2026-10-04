import { parseMcText } from "../../lib/colorUtils";
import { useState, useEffect } from "react";

export interface McTextProps {
  text: string;
  fallback?: string;
}

export function McText({ text, fallback = "—" }: McTextProps) {
  const segments = parseMcText(text);
  const [obfuscatedChars, setObfuscatedChars] = useState<Record<number, string>>({});

  // Update obfuscated characters periodically to simulate Minecraft's effect
  useEffect(() => {
    const obfuscatedIndices = segments
      .map((seg, i) => (seg.obfuscated ? i : -1))
      .filter(i => i !== -1);

    if (obfuscatedIndices.length === 0) return;

    const updateObfuscated = () => {
      const chars: Record<number, string> = {};
      const randomChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";
      
      obfuscatedIndices.forEach(index => {
        const seg = segments[index];
        if (seg.obfuscated && seg.text) {
          chars[index] = seg.text
            .split('')
            .map(() => randomChars[Math.floor(Math.random() * randomChars.length)])
            .join('');
        }
      });
      
      setObfuscatedChars(chars);
    };

    updateObfuscated();
    const interval = setInterval(updateObfuscated, 100);
    return () => clearInterval(interval);
  }, [segments]);

  if (!segments.length) {
    return <span className="text-slate-400 dark:text-dark-text-tertiary italic text-xs">{fallback}</span>;
  }
  return (
    <>
      {segments.map((seg, i) => {
        const dec = [seg.underlined && "underline", seg.strikethrough && "line-through"]
          .filter(Boolean).join(" ");
        const displayText = seg.obfuscated ? (obfuscatedChars[i] || seg.text) : seg.text;
        
        return (
          <span
            key={i}
            style={{
              color: seg.color ?? "#FFFFFF",
              fontWeight: seg.bold ? "bold" : undefined,
              fontStyle: seg.italic ? "italic" : undefined,
              textDecoration: dec || undefined,
              textShadow: seg.color ? `1px 1px 2px rgba(0,0,0,0.8)` : undefined,
            }}
          >
            {displayText}
          </span>
        );
      })}
    </>
  );
}

export default McText;
