export function money(amountCents: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(
    amountCents / 100,
  );
}

export function when(iso: string | null): string {
  return iso ? iso.replace("T", " ").replace(".000Z", "Z") : "—";
}
