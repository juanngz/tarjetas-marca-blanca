// The register's camera (Flujo B and E of the staff flows), above Buscar tarjeta: off until the barista taps
// its box, so it isn't on all day. Off, it's a rubber stamp waiting: the Club's seal, turning slowly. Reading only opens the card: it never adds a stamp. Only in the browser.
// It reads with ZXing (WebAssembly) on every phone, even where Chrome has its own reader: Chrome's needs
// Google Play Services, and some Android phones don't have it (docs/implementacion/plan.md, stage 4).
import {
  type IDetectedBarcode,
  type IScannerError,
  Scanner,
  setZXingModuleOverrides,
} from "@yudiel/react-qr-scanner";
import { useEffect, useState, useSyncExternalStore } from "react";
import zxingWasm from "zxing-wasm/reader/zxing_reader.wasm?url";
import { Alert } from "../../components/Alert";
import { sealName, useBrand } from "../../components/brand";
import { ScanIcon } from "../../components/icons";
import { readCardCode } from "../../core/codes";
import { oneCameraAtATime } from "../../web/camera";

// ZXing is served by the app, not by a CDN: the register doesn't depend on someone else's server.
setZXingModuleOverrides({
  locateFile: (path: string, prefix: string) =>
    path.endsWith(".wasm") ? zxingWasm : prefix + path,
});

// The scanner asks for the camera itself (navigator.mediaDevices.getUserMedia): it goes in line, one at a time,
// so on the iPhone it doesn't stay gray (web/camera.ts). Once, for as long as the page lives.
const cameraLost = new Set<() => void>();
const devices = typeof navigator === "undefined" ? undefined : navigator.mediaDevices;
const inLine = Symbol.for("club.oneCameraAtATime");
if (devices?.getUserMedia && !(inLine in devices)) {
  devices.getUserMedia = oneCameraAtATime(devices.getUserMedia.bind(devices), () => {
    for (const lost of cameraLost) lost();
  });
  Object.defineProperty(devices, inLine, { value: true });
}

const NOT_A_CLUB_CARD = "Este código no es una tarjeta del Club. Apuntá al código de su tarjeta.";

/** Without a camera to use, the field is the way: each case says so in its own words. */
type CameraProblem = "denied" | "failed" | "none" | "lost";

function cameraProblem(error: IScannerError): CameraProblem {
  switch (error.kind) {
    case "permission-denied":
      return "denied";
    // A phone without a camera, a browser without one, or not https: there's only the field.
    case "no-camera":
    case "unsupported":
    case "insecure-context":
      return "none";
    default:
      return "failed";
  }
}

function subscribeToVisibility(changed: () => void) {
  document.addEventListener("visibilitychange", changed);
  return () => document.removeEventListener("visibilitychange", changed);
}

/** Whether the screen is in sight: with the phone locked or in another app, the camera is off. */
function useVisible() {
  return useSyncExternalStore(
    subscribeToVisibility,
    () => document.visibilityState === "visible",
    () => true,
  );
}

/** The Club's seal: its name around a circle, like the rubber stamp on paper cards. */
function ClubSeal() {
  const { club } = useBrand();
  return (
    <svg className="seal__ring" viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <path id="seal-circle" d="M60 60 m-46 0 a46 46 0 1 1 92 0 a46 46 0 1 1 -92 0" />
      </defs>
      <circle cx="60" cy="60" r="57" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle
        cx="60"
        cy="60"
        r="35"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="2 4"
      />
      <text>
        <textPath href="#seal-circle" textLength="285">
          {`${sealName(club)} · SUMAR SELLO ·`}
        </textPath>
      </text>
    </svg>
  );
}

export default function CardScanner({
  onCode,
  busy,
}: {
  /** A Club card's code, read from its QR. */
  onCode: (code: string) => void;
  /** While the card is being looked up, the camera waits. */
  busy: boolean;
}) {
  const visible = useVisible();
  const [on, setOn] = useState(false);
  const [problem, setProblem] = useState<CameraProblem>();
  const [notAClubCard, setNotAClubCard] = useState(false);

  // If the phone cuts the camera (it stays gray), the box again: tapping it opens it anew.
  useEffect(() => {
    const lost = () => {
      setProblem("lost");
      setOn(false);
    };
    cameraLost.add(lost);
    return () => {
      cameraLost.delete(lost);
    };
  }, []);

  function read([detected]: IDetectedBarcode[]) {
    if (!detected) return;
    const isClubCard = readCardCode(detected.rawValue) !== null;
    setNotAClubCard(!isClubCard);
    if (isClubCard) onCode(detected.rawValue);
  }

  if (problem === "none") return <p>Pedile al cliente el código de su tarjeta.</p>;

  // Off, or it couldn't open: the box again, with what happened. Tapping it asks for the camera again.
  if (!on) {
    return (
      <>
        <button
          type="button"
          className="scanner scanner--off"
          onClick={() => {
            setProblem(undefined);
            setOn(true);
          }}
        >
          <span className="scanner__frame" aria-hidden="true" />
          <span className="scanner__start">
            <span className="seal">
              <ClubSeal />
              <span className="seal__core">
                <ScanIcon />
              </span>
            </span>
            Tocá para escanear
          </span>
        </button>
        {problem === "denied" && (
          <Alert>
            Para escanear, permití usar la cámara. Tocá el ícono que está a la izquierda de la
            dirección y activá la cámara. Mientras, buscala a mano acá abajo.
          </Alert>
        )}
        {problem === "lost" && <Alert>Se cortó la cámara. Tocá para escanear de nuevo.</Alert>}
        {problem === "failed" && (
          <Alert>No pudimos abrir la cámara. Buscala a mano acá abajo.</Alert>
        )}
      </>
    );
  }

  return (
    <>
      <div className="scanner">
        <Scanner
          onScan={read}
          onError={(error) => {
            setProblem(cameraProblem(error));
            setOn(false);
          }}
          formats={["qr_code"]}
          paused={busy || !visible}
          components={{ finder: false, torch: false, onOff: false, zoom: false }}
          classNames={{ container: "scanner__camera", video: "scanner__video" }}
          constraints={{ facingMode: "environment" }}
          retryDelay={150}
          sound
        />
        <div className="scanner__frame" aria-hidden="true" />
        <p className="scanner__hint">
          <ScanIcon />
          Apuntá al código de la tarjeta
        </p>
      </div>
      {notAClubCard && <Alert>{NOT_A_CLUB_CARD}</Alert>}
    </>
  );
}
