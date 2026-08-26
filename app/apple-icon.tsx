import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#143a30",
      borderRadius: 38,
      color: "#fffdfa",
      fontFamily: "Georgia",
      fontSize: 124,
      fontStyle: "italic",
      fontWeight: 700,
      position: "relative"
    }}>
      D
      <div style={{ position: "absolute", top: 28, right: 29, width: 18, height: 18, borderRadius: 999, backgroundColor: "#ed765c" }} />
    </div>,
    size
  );
}
