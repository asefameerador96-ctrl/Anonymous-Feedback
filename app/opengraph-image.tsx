import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Anonvey — Truly Anonymous employee surveys";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Social share card.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#faf8f4",
          color: "#1a1a1a",
        }}
      >
        <div
          style={{
            fontSize: 30,
            letterSpacing: 8,
            textTransform: "uppercase",
            color: "#6b7e6b",
          }}
        >
          ▲ Anonvey
        </div>
        <div style={{ fontSize: 120, fontWeight: 700, marginTop: 24, lineHeight: 1 }}>
          Truly Anonymous
        </div>
        <div style={{ fontSize: 36, marginTop: 28, color: "#b8927a" }}>
          Even we can&apos;t see your results.
        </div>
      </div>
    ),
    { ...size }
  );
}
