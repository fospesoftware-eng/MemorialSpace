import { useState } from "react";
import { useListProducts, useCreateOrder, getListProductsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ShoppingCart, Flower, Package, Wrench, Plus, Minus, Check } from "lucide-react";

const categoryIcon = (cat: string) => {
  if (cat === "flowers") return <Flower className="h-4 w-4" />;
  if (cat === "urns") return <Package className="h-4 w-4" />;
  return <Wrench className="h-4 w-4" />;
};

const CATEGORIES = ["all", "flowers", "urns", "services", "other"] as const;

type CartItem = { productId: number; productName: string; quantity: number; unitPrice: number };

export default function PublicShop() {
  const { data: allProducts, isLoading } = useListProducts();
  const createOrder = useCreateOrder();
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutForm, setCheckoutForm] = useState({ name: "", email: "" });
  const [ordered, setOrdered] = useState(false);

  const products = activeCategory === "all" ? allProducts : allProducts?.filter(p => p.category === activeCategory);

  const addToCart = (product: typeof allProducts extends (infer T)[] | undefined ? T : never) => {
    setCart(c => {
      const existing = c.find(i => i.productId === (product as any).id);
      if (existing) return c.map(i => i.productId === (product as any).id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...c, { productId: (product as any).id, productName: (product as any).name, quantity: 1, unitPrice: (product as any).price }];
    });
  };

  const updateQty = (productId: number, delta: number) => {
    setCart(c => c.map(i => i.productId === productId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i).filter(i => i.quantity > 0));
  };

  const total = cart.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

  const handleCheckout = () => {
    createOrder.mutate(
      { data: { customerName: checkoutForm.name, customerEmail: checkoutForm.email, items: cart, totalAmount: total } },
      {
        onSuccess: () => {
          setOrdered(true);
          setCart([]);
          setTimeout(() => { setOrdered(false); setCartOpen(false); }, 3000);
        },
      }
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold">Memorial Shop</h1>
          <p className="text-muted-foreground mt-2">Flowers, urns, and services for your loved ones.</p>
        </div>
        <Button variant="outline" className="relative" onClick={() => setCartOpen(true)} data-testid="button-open-cart">
          <ShoppingCart className="h-5 w-5 mr-2" />Cart
          {cart.length > 0 && <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs">{cart.reduce((s, i) => s + i.quantity, 0)}</Badge>}
        </Button>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap mb-8">
        {CATEGORIES.map(cat => (
          <Button key={cat} variant={activeCategory === cat ? "default" : "outline"} size="sm" onClick={() => setActiveCategory(cat)} className="capitalize" data-testid={`button-category-${cat}`}>{cat}</Button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{[1,2,3,4,5,6].map(i => <Card key={i} className="h-72 animate-pulse bg-muted" />)}</div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {products?.map(product => (
            <Card key={product.id} className="overflow-hidden hover:border-primary/40 transition-colors group" data-testid={`card-product-${product.id}`}>
              {product.imageUrl && (
                <div className="h-48 overflow-hidden">
                  <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                </div>
              )}
              <CardContent className="pt-4 pb-5">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="font-semibold text-sm">{product.name}</h3>
                    <div className="flex items-center gap-1 mt-1">
                      <Badge variant="outline" className="text-xs flex items-center gap-1">
                        {categoryIcon(product.category)}{product.category}
                      </Badge>
                    </div>
                  </div>
                  <span className="font-bold text-primary shrink-0">${product.price}</span>
                </div>
                {product.description && <p className="text-xs text-muted-foreground mb-4 line-clamp-2">{product.description}</p>}
                <Button size="sm" className="w-full" disabled={!product.inStock} onClick={() => addToCart(product)} data-testid={`button-add-to-cart-${product.id}`}>
                  {product.inStock ? "Add to Cart" : "Out of Stock"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Cart Dialog */}
      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Your Cart</DialogTitle><DialogDescription>Review your selected items and complete checkout.</DialogDescription></DialogHeader>
          {ordered ? (
            <div className="text-center py-8">
              <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">Order Placed!</h3>
              <p className="text-muted-foreground text-sm mt-1">Thank you, {checkoutForm.name}. We'll be in touch.</p>
            </div>
          ) : cart.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>Your cart is empty.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map(item => (
                <div key={item.productId} className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.productName}</p>
                    <p className="text-xs text-muted-foreground">${item.unitPrice} each</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(item.productId, -1)}><Minus className="h-3 w-3" /></Button>
                    <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(item.productId, 1)}><Plus className="h-3 w-3" /></Button>
                  </div>
                  <span className="text-sm font-semibold w-16 text-right">${(item.quantity * item.unitPrice).toFixed(2)}</span>
                </div>
              ))}
              <div className="border-t pt-3">
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>
              <div className="space-y-3 border-t pt-3">
                <div><Label>Full Name</Label><Input className="mt-1" value={checkoutForm.name} onChange={e => setCheckoutForm(f => ({ ...f, name: e.target.value }))} data-testid="input-checkout-name" /></div>
                <div><Label>Email</Label><Input className="mt-1" type="email" value={checkoutForm.email} onChange={e => setCheckoutForm(f => ({ ...f, email: e.target.value }))} data-testid="input-checkout-email" /></div>
                <Button className="w-full" onClick={handleCheckout} disabled={createOrder.isPending || !checkoutForm.name} data-testid="button-place-order">
                  {createOrder.isPending ? "Placing order..." : `Place Order — $${total.toFixed(2)}`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
