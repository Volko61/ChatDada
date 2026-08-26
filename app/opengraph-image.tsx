import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      padding: "72px",
      backgroundColor: "#f6f2e9",
      color: "#17261f",
      fontFamily: "Arial"
    }}>
      <div style={{ display: "flex", alignItems: "center", color: "#143a30", fontSize: 42, fontWeight: 700 }}>
        <span>Chat </span><span style={{ fontStyle: "italic" }}>DADA</span>
        <span style={{ marginLeft: 18, width: 16, height: 16, borderRadius: 999, backgroundColor: "#ed765c" }} />
      </div>
      <div style={{ marginTop: 38, maxWidth: 980, fontSize: 68, lineHeight: 1.08, fontWeight: 700, letterSpacing: -2 }}>
        Explorez les demandes publiques.
      </div>
      <div style={{ marginTop: 28, color: "#68716b", fontSize: 30 }}>
        Documents administratifs français, par IA.
      </div>
    </div>,
    size
  );
}
