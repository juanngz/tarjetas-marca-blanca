// The register's camera, one at a time. The scanner asks for it each time it starts: after each stamp, after
// waiting for a card, when coming back to the screen. On the iPhone the page has a single camera: asking for it
// again mutes the one before, and a request still on its way when the next one starts (the scanner going away)
// arrives late and mutes the new one, which stays gray for good. Here each request waits for the one before and
// stops it before asking: the newest one keeps the camera.

type AskForCamera = (constraints: MediaStreamConstraints) => Promise<MediaStream>;

/** How long a muted camera may stay gray before the scanner gives up on it (iPhone mutes it for a moment). */
const GRAY_FOR = 2000;

function stop(stream: MediaStream) {
  for (const track of stream.getTracks()) track.stop();
}

/**
 * `ask` in line, one camera open at a time. `lost`: the phone ended the camera, or muted it and it stayed
 * gray. Not when the app stopped it.
 */
export function oneCameraAtATime(ask: AskForCamera, lost: () => void): AskForCamera {
  let line: Promise<unknown> = Promise.resolve();
  let open: MediaStream[] = [];

  function watch(stream: MediaStream) {
    for (const track of stream.getVideoTracks()) {
      let gray: ReturnType<typeof setTimeout> | undefined;
      const stillOurs = () => track.readyState === "live" && open.includes(stream);
      track.addEventListener("ended", () => {
        clearTimeout(gray);
        if (open.includes(stream)) lost();
      });
      track.addEventListener("mute", () => {
        clearTimeout(gray);
        gray = setTimeout(() => {
          if (track.muted && stillOurs()) lost();
        }, GRAY_FOR);
      });
      track.addEventListener("unmute", () => clearTimeout(gray));
    }
  }

  return (constraints) => {
    const request = line.then(async () => {
      for (const stream of open) stop(stream);
      open = [];
      const stream = await ask(constraints);
      open.push(stream);
      watch(stream);
      return stream;
    });
    line = request.catch(() => {});
    return request;
  };
}
