import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import { BleClient, numbersToDataView, type BleDevice } from "@capacitor-community/bluetooth-le";
import { useAuth } from "./AuthContext";
import { buildReceiptBytes, chunkBytes, PAPER_WIDTHS, type PaperWidthKey } from "../lib/escpos";
import type { ReceiptData } from "../components/Receipt";

export type PrinterStatus = "disconnected" | "scanning" | "connecting" | "connected" | "printing" | "error";

interface SavedPrinter {
  deviceId: string;
  name: string;
  paperWidth: PaperWidthKey;
  autoPrint: boolean;
}

interface WriteTarget {
  service: string;
  characteristic: string;
  writeWithoutResponse: boolean;
}

function storageKey(storeId: number): string {
  return `retailpos:printer:${storeId}`;
}

function loadSaved(storeId: number): SavedPrinter | null {
  try {
    const raw = localStorage.getItem(storageKey(storeId));
    return raw ? (JSON.parse(raw) as SavedPrinter) : null;
  } catch {
    return null;
  }
}

function persistSaved(storeId: number, saved: SavedPrinter | null) {
  try {
    if (saved) localStorage.setItem(storageKey(storeId), JSON.stringify(saved));
    else localStorage.removeItem(storageKey(storeId));
  } catch {
    // Device storage full or unavailable — worst case the printer just needs
    // to be reconnected next launch instead of auto-reconnecting.
  }
}

// Thermal printers advertise their own vendor-specific service, so there's
// no fixed UUID to filter on — instead, once connected, inspect every
// discovered characteristic and pick the first one that accepts writes.
// This is the same heuristic used by every generic BLE-ESC/POS bridge (there
// really is only ever one writable characteristic on these devices).
async function findWriteTarget(deviceId: string): Promise<WriteTarget | null> {
  const services = await BleClient.getServices(deviceId);
  for (const service of services) {
    for (const characteristic of service.characteristics) {
      if (characteristic.properties.write || characteristic.properties.writeWithoutResponse) {
        return {
          service: service.uuid,
          characteristic: characteristic.uuid,
          writeWithoutResponse: characteristic.properties.writeWithoutResponse,
        };
      }
    }
  }
  return null;
}

function friendlyError(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/location/i.test(message)) return "Aktifkan Layanan Lokasi di HP untuk mencari printer Bluetooth.";
  if (/bluetooth.*(disabled|off|not enabled)/i.test(message)) return "Bluetooth mati — aktifkan Bluetooth di HP terlebih dahulu.";
  if (/permission/i.test(message)) return "Izin Bluetooth belum diberikan. Buka pengaturan aplikasi dan izinkan akses Bluetooth.";
  if (/timeout/i.test(message)) return "Waktu tunggu habis. Pastikan printer menyala dan berada dekat dengan HP.";
  return `${fallback} (${message})`;
}

interface PrinterContextValue {
  status: PrinterStatus;
  error: string | null;
  devices: BleDevice[];
  connectedName: string | null;
  paperWidth: PaperWidthKey;
  autoPrint: boolean;
  isNative: boolean;
  scan: () => Promise<void>;
  stopScan: () => Promise<void>;
  connect: (device: BleDevice) => Promise<void>;
  disconnect: () => Promise<void>;
  setPaperWidth: (width: PaperWidthKey) => void;
  setAutoPrint: (value: boolean) => void;
  printReceipt: (data: ReceiptData, store: { storeName: string; storeAddress?: string; storePhone?: string; footerNote?: string }) => Promise<void>;
}

const PrinterContext = createContext<PrinterContextValue | undefined>(undefined);

export function PrinterProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const storeId = user?.storeId;

  const [status, setStatus] = useState<PrinterStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<BleDevice[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<BleDevice | null>(null);
  const [paperWidth, setPaperWidthState] = useState<PaperWidthKey>("58");
  const [autoPrint, setAutoPrintState] = useState(false);

  const writeTargetRef = useRef<WriteTarget | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRef = useRef<SavedPrinter | null>(null);

  // Load this device's saved printer once we know which store is logged in,
  // and silently try to reconnect — a cashier shouldn't have to re-pair the
  // printer every time they open the app.
  useEffect(() => {
    if (!storeId) return;
    const saved = loadSaved(storeId);
    savedRef.current = saved;
    if (!saved) return;
    setPaperWidthState(saved.paperWidth);
    setAutoPrintState(saved.autoPrint);
    (async () => {
      try {
        setStatus("connecting");
        await BleClient.initialize();
        await BleClient.connect(saved.deviceId, () => {
          setStatus("disconnected");
          setConnectedDevice(null);
          writeTargetRef.current = null;
        });
        const target = await findWriteTarget(saved.deviceId);
        if (!target) throw new Error("Perangkat tersimpan bukan printer yang didukung");
        writeTargetRef.current = target;
        setConnectedDevice({ deviceId: saved.deviceId, name: saved.name });
        setStatus("connected");
      } catch {
        // Printer off / out of range at app launch is normal, not an error
        // worth surfacing — the settings page shows "belum terhubung" and
        // the user can reconnect from there when they're ready to print.
        setStatus("disconnected");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const scan = useCallback(async () => {
    setError(null);
    setDevices([]);
    try {
      await BleClient.initialize();
      setStatus("scanning");
      const seen = new Map<string, BleDevice>();
      await BleClient.requestLEScan({ allowDuplicates: false }, (result) => {
        if (!result.device.name) return; // unnamed devices are never receipt printers
        seen.set(result.device.deviceId, result.device);
        setDevices([...seen.values()]);
      });
      scanTimerRef.current = setTimeout(async () => {
        await BleClient.stopLEScan();
        setStatus((s) => (s === "scanning" ? "disconnected" : s));
      }, 10_000);
    } catch (err) {
      setStatus("error");
      setError(friendlyError(err, "Tidak bisa mulai mencari printer"));
    }
  }, []);

  const stopScan = useCallback(async () => {
    if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    try {
      await BleClient.stopLEScan();
    } catch {
      // already stopped — nothing to clean up
    }
    setStatus((s) => (s === "scanning" ? "disconnected" : s));
  }, []);

  const connect = useCallback(
    async (device: BleDevice) => {
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
      try {
        await BleClient.stopLEScan();
      } catch {
        // ignore
      }
      setError(null);
      setStatus("connecting");
      try {
        await BleClient.connect(device.deviceId, () => {
          setStatus("disconnected");
          setConnectedDevice(null);
          writeTargetRef.current = null;
        });
        const target = await findWriteTarget(device.deviceId);
        if (!target) {
          await BleClient.disconnect(device.deviceId).catch(() => {});
          throw new Error("Perangkat ini terdeteksi tapi sepertinya bukan printer thermal yang didukung");
        }
        writeTargetRef.current = target;
        setConnectedDevice(device);
        setStatus("connected");
        if (storeId) {
          const saved: SavedPrinter = { deviceId: device.deviceId, name: device.name || "Printer", paperWidth, autoPrint };
          savedRef.current = saved;
          persistSaved(storeId, saved);
        }
      } catch (err) {
        setStatus("error");
        setError(friendlyError(err, "Gagal terhubung ke printer"));
      }
    },
    [storeId, paperWidth, autoPrint]
  );

  const disconnect = useCallback(async () => {
    if (connectedDevice) {
      await BleClient.disconnect(connectedDevice.deviceId).catch(() => {});
    }
    writeTargetRef.current = null;
    setConnectedDevice(null);
    setStatus("disconnected");
    if (storeId) {
      savedRef.current = null;
      persistSaved(storeId, null);
    }
  }, [connectedDevice, storeId]);

  const setPaperWidth = useCallback(
    (width: PaperWidthKey) => {
      setPaperWidthState(width);
      if (storeId && savedRef.current) {
        savedRef.current = { ...savedRef.current, paperWidth: width };
        persistSaved(storeId, savedRef.current);
      }
    },
    [storeId]
  );

  const setAutoPrint = useCallback(
    (value: boolean) => {
      setAutoPrintState(value);
      if (storeId && savedRef.current) {
        savedRef.current = { ...savedRef.current, autoPrint: value };
        persistSaved(storeId, savedRef.current);
      }
    },
    [storeId]
  );

  const printReceipt = useCallback(
    async (data: ReceiptData, store: { storeName: string; storeAddress?: string; storePhone?: string; footerNote?: string }) => {
      if (!connectedDevice || !writeTargetRef.current) {
        throw new Error("Printer belum terhubung. Buka Pengaturan > Printer struk untuk menghubungkan.");
      }
      const target = writeTargetRef.current;
      setStatus("printing");
      setError(null);
      try {
        const bytes = buildReceiptBytes(data, { ...store, paperWidth });
        let mtu = 20; // the pre-negotiation BLE default — safe floor if getMtu isn't supported
        try {
          mtu = await BleClient.getMtu(connectedDevice.deviceId);
        } catch {
          // web / older Android — fall back to the safe default above
        }
        const chunkSize = Math.max(20, mtu - 3);
        const chunks = chunkBytes(bytes, chunkSize);
        for (const chunk of chunks) {
          const view = numbersToDataView([...chunk]);
          if (target.writeWithoutResponse) {
            await BleClient.writeWithoutResponse(connectedDevice.deviceId, target.service, target.characteristic, view);
          } else {
            await BleClient.write(connectedDevice.deviceId, target.service, target.characteristic, view);
          }
          // A handful of cheap printers drop bytes if flooded faster than
          // their print head can consume them — a small gap between writes
          // fixes that without noticeably slowing down a normal-length receipt.
          await new Promise((r) => setTimeout(r, 15));
        }
        setStatus("connected");
      } catch (err) {
        setStatus("connected");
        throw new Error(friendlyError(err, "Gagal mencetak. Struk mungkin tercetak sebagian"));
      }
    },
    [connectedDevice, paperWidth]
  );

  return (
    <PrinterContext.Provider
      value={{
        status,
        error,
        devices,
        connectedName: connectedDevice?.name ?? null,
        paperWidth,
        autoPrint,
        isNative: Capacitor.isNativePlatform(),
        scan,
        stopScan,
        connect,
        disconnect,
        setPaperWidth,
        setAutoPrint,
        printReceipt,
      }}
    >
      {children}
    </PrinterContext.Provider>
  );
}

export function usePrinter(): PrinterContextValue {
  const ctx = useContext(PrinterContext);
  if (!ctx) throw new Error("usePrinter must be used within PrinterProvider");
  return ctx;
}

export { PAPER_WIDTHS };
