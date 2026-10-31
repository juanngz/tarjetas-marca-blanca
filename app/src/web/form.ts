// Reading a submitted form. A field that's missing or isn't text (a file) comes as null.
import { data } from "react-router";

/**
 * The form a phone sent. A body that isn't a form (JSON, plain text: only a program sends one) is a 400,
 * not a server error: the screens never send it, so it doesn't fill the log.
 */
export async function formOf(request: Request): Promise<FormData> {
  try {
    return await request.formData();
  } catch {
    throw data("Algo no salió bien. Probá de nuevo.", { status: 400 });
  }
}

export function formText(form: FormData, name: string): string | null {
  const value = form.get(name);
  return typeof value === "string" ? value : null;
}
