import { useCallback, useEffect, useState } from "react";

export type CartItem = {
  productId: number;
  productSlug: string;
  name: string;
  price: number;
  quantity: number;
  photoUrl: string | null;
};

const KEY = (slug: string) => `cemetery-cart:${slug}`;

function readStorage(slug: string): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY(slug));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (i): i is CartItem =>
        i &&
        typeof i.productId === "number" &&
        typeof i.name === "string" &&
        typeof i.price === "number" &&
        typeof i.quantity === "number" &&
        i.quantity > 0,
    );
  } catch {
    return [];
  }
}

function writeStorage(slug: string, items: CartItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY(slug), JSON.stringify(items));
    window.dispatchEvent(new CustomEvent(`cemetery-cart-changed:${slug}`));
  } catch {
    // Ignore quota / disabled storage — cart simply doesn't persist.
  }
}

export function useCart(slug: string) {
  const [items, setItems] = useState<CartItem[]>(() => readStorage(slug));

  useEffect(() => {
    setItems(readStorage(slug));
    const onChange = () => setItems(readStorage(slug));
    const eventName = `cemetery-cart-changed:${slug}`;
    window.addEventListener(eventName, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(eventName, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [slug]);

  const add = useCallback(
    (item: Omit<CartItem, "quantity">, quantity = 1) => {
      const current = readStorage(slug);
      const existing = current.find((i) => i.productId === item.productId);
      let next: CartItem[];
      if (existing) {
        next = current.map((i) =>
          i.productId === item.productId
            ? { ...i, quantity: Math.min(99, i.quantity + quantity) }
            : i,
        );
      } else {
        next = [...current, { ...item, quantity: Math.max(1, quantity) }];
      }
      writeStorage(slug, next);
    },
    [slug],
  );

  const setQuantity = useCallback(
    (productId: number, quantity: number) => {
      const current = readStorage(slug);
      const next =
        quantity <= 0
          ? current.filter((i) => i.productId !== productId)
          : current.map((i) =>
              i.productId === productId ? { ...i, quantity: Math.min(99, quantity) } : i,
            );
      writeStorage(slug, next);
    },
    [slug],
  );

  const remove = useCallback(
    (productId: number) => {
      const next = readStorage(slug).filter((i) => i.productId !== productId);
      writeStorage(slug, next);
    },
    [slug],
  );

  const clear = useCallback(() => writeStorage(slug, []), [slug]);

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const totalQuantity = items.reduce((s, i) => s + i.quantity, 0);

  return { items, add, setQuantity, remove, clear, subtotal, totalQuantity };
}
