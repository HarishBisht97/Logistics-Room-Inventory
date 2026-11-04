import { useEffect, useRef, useState, type FormEvent } from 'react';
import { BarcodeFormat, BrowserMultiFormatReader } from '@zxing/browser';
import { DecodeHintType } from '@zxing/library';
import { CameraOff, Keyboard, LoaderCircle, SwitchCamera } from 'lucide-react';
import { focusRing, orangeButton, textInput, textInputError } from './styles';

const FORMATS = [
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.QR_CODE,
];

interface BarcodeScannerProps {
  onDetected: (barcode: string) => void;
}

export function BarcodeScanner({ onDetected }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectedRef = useRef(onDetected);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const [manual, setManual] = useState('');
  const [manualError, setManualError] = useState('');

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || cameraError) return undefined;

    let cancelled = false;
    let controls: { stop: () => void } | null = null;
    setReady(false);

    const timer = window.setTimeout(() => {
      if (cancelled) return;
      const hints = new Map<DecodeHintType, unknown>();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, FORMATS);
      const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 });
      video.muted = true;
      video.setAttribute('playsinline', 'true');

      reader.decodeFromConstraints(
        {
          audio: false,
          video: deviceId
            ? { deviceId: { exact: deviceId } }
            : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        },
        video,
        (result, _error, scannerControls) => {
          const text = result?.getText().trim();
          if (!text || cancelled) return;
          cancelled = true;
          scannerControls.stop();
          onDetectedRef.current(text);
        },
      ).then(async (scannerControls) => {
        controls = scannerControls;
        if (cancelled) {
          scannerControls.stop();
          return;
        }
        setReady(true);
        try {
          const listed = await BrowserMultiFormatReader.listVideoInputDevices();
          if (!cancelled) setDevices(listed.filter((device) => device.deviceId));
        } catch {
          if (!cancelled) setDevices([]);
        }
      }).catch((error: unknown) => {
        if (!cancelled) setCameraError(cameraErrorMessage(error));
      });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controls?.stop();
      const stream = video.srcObject;
      if (stream instanceof MediaStream) {
        for (const track of stream.getTracks()) track.stop();
      }
    };
  }, [cameraError, deviceId]);

  function submitManual(event: FormEvent) {
    event.preventDefault();
    const value = manual.trim();
    if (!value) {
      setManualError('Enter a barcode to continue.');
      return;
    }
    if (value.length > 128) {
      setManualError('Barcode must be 128 characters or less.');
      return;
    }
    setManualError('');
    onDetectedRef.current(value);
  }

  function switchCamera() {
    if (devices.length < 2) return;
    const currentIndex = devices.findIndex((device) => device.deviceId === deviceId);
    const next = devices[(currentIndex + 1) % devices.length];
    if (next) setDeviceId(next.deviceId);
  }

  return (
    <div className="space-y-4">
      {cameraError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
          <div className="flex items-start gap-3">
            <CameraOff className="mt-0.5 shrink-0" size={20} />
            <div>
              <p className="font-semibold">Camera unavailable</p>
              <p className="mt-1 text-sm leading-6">{cameraError}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative mx-auto h-[52dvh] max-h-[520px] min-h-[280px] w-full max-w-md overflow-hidden rounded-3xl bg-slate-900 shadow-sm md:h-[360px]">
          <video ref={videoRef} className="h-full w-full object-cover" muted autoPlay playsInline />
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute top-[18%] right-[12%] bottom-[22%] left-[12%] rounded-2xl border-2 border-white/85 shadow-[0_0_0_999px_rgba(15,23,42,0.35)]" />
            <div className="scanline absolute right-[14%] left-[14%] h-0.5 bg-orange-400 shadow-[0_0_12px_rgba(251,146,60,0.9)]" />
          </div>
          {!ready ? (
            <div className="absolute inset-0 grid place-items-center bg-slate-900/70 text-sm text-white" role="status">
              <span className="flex items-center gap-2">
                <LoaderCircle className="animate-spin" size={18} />
                Starting camera
              </span>
            </div>
          ) : null}
          {devices.length > 1 ? (
            <button
              type="button"
              onClick={switchCamera}
              className={`absolute top-3 right-3 grid h-11 w-11 place-items-center rounded-full bg-white/90 text-slate-900 ${focusRing}`}
              aria-label="Switch camera"
            >
              <SwitchCamera size={18} />
            </button>
          ) : null}
          <p className="absolute inset-x-0 bottom-4 text-center text-sm font-medium text-white">
            Point the camera at a barcode
          </p>
        </div>
      )}

      <form onSubmit={submitManual} className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Keyboard size={16} />
          Enter barcode manually
        </div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="manual-barcode">
          Barcode / Item ID
        </label>
        <input
          id="manual-barcode"
          value={manual}
          onChange={(event) => {
            setManual(event.target.value);
            if (manualError) setManualError('');
          }}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={128}
          placeholder="Type or paste the barcode"
          aria-invalid={manualError ? true : undefined}
          aria-describedby={manualError ? 'manual-barcode-error' : undefined}
          className={`${textInput} font-mono ${manualError ? textInputError : ''}`}
        />
        {manualError ? (
          <p id="manual-barcode-error" className="mt-2 text-sm text-red-600" role="alert">{manualError}</p>
        ) : (
          <p className="mt-2 text-sm text-slate-500">Use this if the code will not scan.</p>
        )}
        <button type="submit" className={`${orangeButton} mt-4 w-full`}>
          Continue
        </button>
      </form>
    </div>
  );
}

function cameraErrorMessage(error: unknown): string {
  const name = error instanceof DOMException || error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : '';
  const haystack = `${name} ${message}`.toLowerCase();
  if (haystack.includes('notallowed') || haystack.includes('permission')) {
    return 'Camera access was blocked. Allow camera permission in your browser settings, or enter the barcode manually.';
  }
  if (haystack.includes('notfound') || haystack.includes('devicesnotfound')) {
    return 'No camera was found on this device. Enter the barcode manually.';
  }
  if (haystack.includes('notreadable') || haystack.includes('trackstart') || haystack.includes('in use')) {
    return 'The camera is already in use by another app. Close it, or enter the barcode manually.';
  }
  return 'The camera could not be started. Enter the barcode manually.';
}
