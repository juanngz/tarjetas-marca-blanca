// The document is stored only as an HMAC with DNI_HMAC_KEY: that way a customer can be looked up
// by their DNI, but if the database leaks the numbers can't be seen. See ../../../../CLAUDE.md
import type { DocumentHasher } from "../../application/ports";
import { documentKey } from "../../core/document";
import { hmac } from "./hmac.server";

/** What goes in customers.dni_hmac. The number must already be validated (core/document.ts). */
export const hmacDocumentHasher = (key: string): DocumentHasher => ({
  hmac: (type, number) => hmac(key, documentKey(type, number)),
});
