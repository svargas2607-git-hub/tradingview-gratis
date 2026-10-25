import type { FibLineStyle } from "@/lib/fibonacci";

export type RectangleHAlign = "left" | "center" | "right";
export type RectangleVAlign = "top" | "middle" | "bottom";

/** Per-drawing style, editable from the settings dialog */
export interface RectangleSettings {
  border: boolean;
  borderColor: string;
  borderWidth: number;
  borderStyle: FibLineStyle;
  background: boolean;
  backgroundColor: string;
  /** 0–100, like TradingView's slider */
  backgroundOpacity: number;
  /** Extend the sides to the chart edge */
  extendLeft: boolean;
  extendRight: boolean;
  middleLine: boolean;
  middleColor: string;
  middleWidth: number;
  middleStyle: FibLineStyle;
  /** Prices of the top and bottom edges on the right side */
  priceLabels: boolean;
  /** Text inside the rectangle (empty = none) */
  text: string;
  textColor: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  textHAlign: RectangleHAlign;
  textVAlign: RectangleVAlign;
}

// TradingView defaults: blue border and translucent blue background
export function defaultRectangleSettings(): RectangleSettings {
  return {
    border: true,
    borderColor: "#2962ff",
    borderWidth: 2,
    borderStyle: "solid",
    background: true,
    backgroundColor: "#2962ff",
    backgroundOpacity: 20,
    extendLeft: false,
    extendRight: false,
    middleLine: false,
    middleColor: "#2962ff",
    middleWidth: 1,
    middleStyle: "dashed",
    priceLabels: false,
    text: "",
    textColor: "#2962ff",
    fontSize: 14,
    bold: false,
    italic: false,
    textHAlign: "center",
    textVAlign: "middle",
  };
}

/**
 * Drawings saved before a setting existed get its default; the first
 * version stored a single `color` for border and background.
 */
export function rectangleSettingsOf(r: {
  color?: string;
  settings?: Partial<RectangleSettings>;
}): RectangleSettings {
  const legacy = r.color
    ? { borderColor: r.color, backgroundColor: r.color, middleColor: r.color, textColor: r.color }
    : {};
  return { ...defaultRectangleSettings(), ...legacy, ...r.settings };
}

interface Px {
  x: number;
  y: number;
}

export interface RectangleBox {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

/** Drawn box: the two corners, with the sides pushed to the edge when extended */
export function rectangleBox(
  a: Px,
  b: Px,
  settings: Pick<RectangleSettings, "extendLeft" | "extendRight">,
  width: number,
): RectangleBox {
  return {
    x1: settings.extendLeft ? 0 : Math.min(a.x, b.x),
    x2: settings.extendRight ? width : Math.max(a.x, b.x),
    y1: Math.min(a.y, b.y),
    y2: Math.max(a.y, b.y),
  };
}
