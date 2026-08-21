import { parseMcText } from "../../lib/colorUtils";

export interface McTextProps {
  text: string;
  fallback?: string;
}

export function McText({ text, fallback = "—" }: McTextProps) {
  const segments = parseMcText(text);
  if (!segments.length) {
    return <span className="text-slate-400 dark:text-dark-text-tertiary italic text-xs">{fallback}</span>;
  }
  return (
    <>
      {segments.map((seg, i) => {
        const dec = [seg.underlined && "underline", seg.strikethrough && "line-through"]
          .filter(Boolean).join(" ");
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
            {seg.text}
          </span>
        );
      })}
    </>
  );
}

export default McText;
