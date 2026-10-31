// The register's camera in the end-to-end tests: the phone's camera is replaced, before the page loads, by a
// video of a QR on white. The scanner reads it as it reads a real camera: nothing of the app is skipped.
import type { Page } from "@playwright/test";
import { encode } from "uqr";

/** A QR as an SVG, black on white, like the one on the customer's code screen. */
export function qrSvg(text: string): string {
  const { data, size } = encode(text, { ecc: "M", border: 0 });
  let path = "";
  data.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) path += `M${x} ${y}h1v1h-1z`;
    });
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><path d="${path}" fill="#000000"/></svg>`;
}

/** The customer's QR, taken from her code screen (she has it open). */
export async function qrOnScreen(customer: Page): Promise<string> {
  return customer
    .getByRole("img", { name: /^Código QR de la tarjeta/ })
    .evaluate((svg) => new XMLSerializer().serializeToString(svg));
}

/** The register's camera points at this QR. Call it before going to the page. */
export async function pointCameraAt(page: Page, svg: string) {
  // The reader is served by the app: if it went to a CDN for it, the scan would fail here.
  await page.route(/jsdelivr\.net/, (route) => route.abort());
  await page.addInitScript((svg) => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const context = canvas.getContext("2d");
    const qr = new Image();
    qr.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    const draw = () => {
      if (!context) return;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      if (qr.complete) context.drawImage(qr, 170, 90, 300, 300);
    };
    setInterval(draw, 66);
    draw();
    const asked = window as unknown as { cameraAsked: number; cameras: MediaStream[] };
    asked.cameraAsked = 0;
    asked.cameras = [];
    navigator.mediaDevices.getUserMedia = async () => {
      asked.cameraAsked++;
      const camera = canvas.captureStream(15);
      asked.cameras.push(camera);
      return camera;
    };
  }, svg);
}

/** How many of the cameras the page opened are still on (with pointCameraAt). */
export async function camerasOn(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (window as unknown as { cameras: MediaStream[] }).cameras.filter((camera) =>
        camera.getVideoTracks().some((track) => track.readyState === "live"),
      ).length,
  );
}

/** The phone cuts the camera on its own, as the iPhone sometimes does: the image stays gray. */
export async function phoneCutsCamera(page: Page) {
  await page.evaluate(() => {
    const cameras = (window as unknown as { cameras: MediaStream[] }).cameras;
    for (const track of cameras.at(-1)?.getVideoTracks() ?? []) {
      track.dispatchEvent(new Event("ended"));
    }
  });
}

/** How many times the page asked for the camera (with pointCameraAt or denyCamera). */
export async function timesCameraAsked(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { cameraAsked: number }).cameraAsked);
}

/** The barista taps the camera's box to start it. */
export async function startCamera(page: Page) {
  await page.getByRole("button", { name: "Tocá para escanear" }).click();
}

/** The person said no when the phone asked for the camera. */
export async function denyCamera(page: Page) {
  await page.addInitScript(() => {
    const asked = window as unknown as { cameraAsked: number };
    asked.cameraAsked = 0;
    navigator.mediaDevices.getUserMedia = async () => {
      asked.cameraAsked++;
      throw new DOMException("Permission denied", "NotAllowedError");
    };
  });
}
