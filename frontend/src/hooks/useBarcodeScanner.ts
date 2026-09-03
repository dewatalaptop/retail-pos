import { useEffect, useRef } from "react";

const SCAN_GAP_MS = 60; // a scanner "types" a barcode far faster than any human can
const MIN_BARCODE_LENGTH = 3;

/**
 * Listens for the fast burst-of-keystrokes-then-Enter pattern a USB/Bluetooth
 * barcode scanner produces (it emulates a keyboard). Only active while focus
 * is on `document.body` — i.e. not inside a text input, textarea, or select —
 * so it never steals characters from the product search box or a qty field
 * someone is actually typing into.
 */
export function useBarcodeScanner(onScan: (code: string) => void): void {
  const bufferRef = useRef("");
  const lastKeyTimeRef = useRef(0);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    function isTypingTarget(el: EventTarget | null): boolean {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;

      const now = performance.now();
      const gap = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;
      if (gap > SCAN_GAP_MS) bufferRef.current = "";

      if (e.key === "Enter") {
        const code = bufferRef.current;
        bufferRef.current = "";
        if (code.length >= MIN_BARCODE_LENGTH) onScanRef.current(code);
        return;
      }

      if (e.key.length === 1) {
        bufferRef.current += e.key;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);
}
