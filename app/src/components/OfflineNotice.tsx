// Sin conexión. At the register (Flujo E): nothing is saved for later, to avoid duplicates; a request that
// fails says so too (web/offline.ts). On the customer's screens (Flujo 5): the code keeps showing, the stamps
// catch up when it's back. The phone says when it loses its connection.
import { useSyncExternalStore } from "react";
import { Alert } from "./Alert";

export const OFFLINE_MESSAGE = "Sin conexión. No se puede sumar ni canjear hasta que vuelva.";
export const CUSTOMER_OFFLINE_MESSAGE = "Sin conexión. Tus sellos se actualizan cuando vuelva.";

function subscribe(changed: () => void) {
  window.addEventListener("online", changed);
  window.addEventListener("offline", changed);
  return () => {
    window.removeEventListener("online", changed);
    window.removeEventListener("offline", changed);
  };
}

/** Whether the phone says it's online. On the server, it is. */
export function useOnline() {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

/**
 * At the register it's an error: nothing can be added. The customer is only told calmly (voz.md, "Sin
 * conexión": tranquilizador): their code keeps working.
 */
export function OfflineNotice({
  message = OFFLINE_MESSAGE,
  tone = "error",
}: {
  message?: string;
  tone?: "error" | "info";
}) {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="offline-notice">
      <Alert tone={tone}>{message}</Alert>
    </div>
  );
}
