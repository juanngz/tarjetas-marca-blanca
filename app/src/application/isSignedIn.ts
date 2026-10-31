// Use case: whether the session (the customer's id, from the cookie) still belongs to a customer
// that exists. A deleted customer's cookie still has a valid signature, but no longer gets in.
import type { CustomerRepository } from "./ports";

export async function isSignedIn(
  input: { customerId: string | null },
  deps: { customers: CustomerRepository },
): Promise<boolean> {
  return input.customerId !== null && (await deps.customers.findById(input.customerId)) !== null;
}
