import { splitForHighlight } from "@/app/lib/globalSearch";

export function HighlightedText({ text, query }: { text: string; query: string }) {
  const segments = splitForHighlight(text, query);
  return (
    <>
      {segments.map((segment, index) =>
        segment.match ? (
          <mark key={index} className="global-search-highlight">
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        )
      )}
    </>
  );
}
