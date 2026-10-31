import { afterEach, describe, expect, it, vi } from "vitest";
import { oneCameraAtATime } from "./camera";

/** A camera track like the phone's: it can be stopped, muted by the phone, or end on its own. */
class FakeTrack extends EventTarget {
  readonly kind = "video";
  readyState: "live" | "ended" = "live";
  muted = false;
  stop() {
    // Like the browser's: stopping it doesn't fire "ended".
    this.readyState = "ended";
  }
  mute() {
    this.muted = true;
    this.dispatchEvent(new Event("mute"));
  }
  unmute() {
    this.muted = false;
    this.dispatchEvent(new Event("unmute"));
  }
  end() {
    this.readyState = "ended";
    this.dispatchEvent(new Event("ended"));
  }
}

function fakeStream() {
  const track = new FakeTrack();
  const stream = {
    track,
    getTracks: () => [track],
    getVideoTracks: () => [track],
  };
  return stream as unknown as MediaStream & { track: FakeTrack };
}

/** The phone's getUserMedia, answering when the test says so. */
function fakeCamera() {
  const pending: ((stream: MediaStream) => void)[] = [];
  const ask = vi.fn(
    () =>
      new Promise<MediaStream>((resolve) => {
        pending.push(resolve);
      }),
  );
  const answer = async () => {
    const stream = fakeStream();
    // Wait until the request has actually been made.
    await vi.waitFor(() => expect(pending.length).toBeGreaterThan(0));
    pending.shift()?.(stream);
    return stream;
  };
  return { ask, answer };
}

const video = { video: { facingMode: "environment" } };

afterEach(() => {
  vi.useRealTimers();
});

describe("the register's camera, one at a time", () => {
  it("opening it again stops the one before", async () => {
    const camera = fakeCamera();
    const open = oneCameraAtATime(camera.ask, () => {});

    const first = open(video);
    const firstStream = await camera.answer();
    await first;
    const second = open(video);
    await camera.answer();
    await second;

    expect(firstStream.track.readyState).toBe("ended");
  });

  it("a late request doesn't take the camera from the new one", async () => {
    // The scanner going away asked for the camera and the phone hasn't answered yet; the new one asks too.
    const camera = fakeCamera();
    const open = oneCameraAtATime(camera.ask, () => {});

    const late = open(video);
    const newer = open(video);
    // The new one waits: the phone has only one camera.
    await Promise.resolve();
    expect(camera.ask).toHaveBeenCalledTimes(1);

    const lateStream = await camera.answer();
    await late;
    const newerStream = await camera.answer();
    await newer;

    expect(lateStream.track.readyState).toBe("ended");
    expect(newerStream.track.readyState).toBe("live");
  });

  it("a request the phone refuses doesn't block the next one", async () => {
    const ask = vi
      .fn<(c: MediaStreamConstraints) => Promise<MediaStream>>()
      .mockRejectedValueOnce(new Error("NotAllowedError"))
      .mockResolvedValueOnce(fakeStream());
    const open = oneCameraAtATime(ask, () => {});

    await expect(open(video)).rejects.toThrow("NotAllowedError");
    await expect(open(video)).resolves.toBeDefined();
  });

  it("says so when the phone ends the camera", async () => {
    const lost = vi.fn();
    const camera = fakeCamera();
    const open = oneCameraAtATime(camera.ask, lost);

    const opening = open(video);
    const stream = await camera.answer();
    await opening;
    stream.track.end();

    expect(lost).toHaveBeenCalledTimes(1);
  });

  it("says so when the phone mutes it and it stays gray", async () => {
    vi.useFakeTimers();
    const lost = vi.fn();
    const camera = fakeCamera();
    const open = oneCameraAtATime(camera.ask, lost);

    const opening = open(video);
    const stream = await camera.answer();
    await opening;
    stream.track.mute();
    vi.advanceTimersByTime(2000);

    expect(lost).toHaveBeenCalledTimes(1);
  });

  it("a short mute isn't a lost camera", async () => {
    vi.useFakeTimers();
    const lost = vi.fn();
    const camera = fakeCamera();
    const open = oneCameraAtATime(camera.ask, lost);

    const opening = open(video);
    const stream = await camera.answer();
    await opening;
    stream.track.mute();
    vi.advanceTimersByTime(500);
    stream.track.unmute();
    vi.advanceTimersByTime(2000);

    expect(lost).not.toHaveBeenCalled();
  });

  it("a camera the app closed isn't a lost one", async () => {
    vi.useFakeTimers();
    const lost = vi.fn();
    const camera = fakeCamera();
    const open = oneCameraAtATime(camera.ask, lost);

    const opening = open(video);
    const stream = await camera.answer();
    await opening;
    // The scanner stops it (paused, or another screen), and then the phone mutes it.
    stream.track.stop();
    stream.track.mute();
    vi.advanceTimersByTime(2000);

    expect(lost).not.toHaveBeenCalled();
  });
});
