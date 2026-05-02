import { useState } from "react";
import { useListProducts, useCreateProduct, useDeleteProduct, useListOrders, getListProductsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, ShoppingBag, Package, Trash2 } from "lucide-react";
import { format } from "date-fns";

export default function Marketplace() {
  const queryClient = useQueryClient();
  const { data: products, isLoading } = useListProducts();
  const { data: orders, isLoading: ordersLoading } = useListOrders();
  const createProduct = useCreateProduct();
  const deleteProduct = useDeleteProduct();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", category: "flowers" as const, price: "", imageUrl: "" });

  const handleCreate = () => {
    createProduct.mutate(
      { data: { name: form.name, description: form.description, category: form.category, price: Number(form.price), imageUrl: form.imageUrl, inStock: true } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          setOpen(false);
          setForm({ name: "", description: "", category: "flowers", price: "", imageUrl: "" });
        },
      }
    );
  };

  const statusColor = (s: string) => {
    const map: Record<string, string> = { pending: "secondary", paid: "default", processing: "default", shipped: "default", delivered: "default", cancelled: "destructive" };
    return (map[s] || "secondary") as any;
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Marketplace</h1>
          <p className="text-muted-foreground mt-1">Manage product catalog and customer orders.</p>
        </div>
      </div>
      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products" data-testid="tab-products">Products</TabsTrigger>
          <TabsTrigger value="orders" data-testid="tab-orders">Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-6">
          <div className="flex justify-end mb-4">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-product"><Plus className="h-4 w-4 mr-2" />Add Product</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Product</DialogTitle><DialogDescription>Add a new product to your marketplace catalog.</DialogDescription></DialogHeader>
                <div className="space-y-4">
                  <div><Label>Name</Label><Input className="mt-1" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} data-testid="input-product-name" /></div>
                  <div><Label>Description</Label><Textarea className="mt-1" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} data-testid="input-product-desc" /></div>
                  <div>
                    <Label>Category</Label>
                    <select className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as any }))} data-testid="select-category">
                      <option value="flowers">Flowers</option>
                      <option value="urns">Urns</option>
                      <option value="services">Services</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div><Label>Price ($)</Label><Input className="mt-1" type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} data-testid="input-product-price" /></div>
                  <div><Label>Image URL</Label><Input className="mt-1" value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} data-testid="input-product-image" /></div>
                  <Button onClick={handleCreate} disabled={createProduct.isPending} className="w-full" data-testid="button-submit-product">
                    {createProduct.isPending ? "Adding..." : "Add Product"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[1,2,3].map(i => <Card key={i} className="h-52 animate-pulse bg-muted" />)}</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {products?.map(product => (
                <Card key={product.id} className="overflow-hidden hover:border-primary/40 transition-colors" data-testid={`card-product-${product.id}`}>
                  {product.imageUrl && (
                    <div className="h-40 overflow-hidden">
                      <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-sm">{product.name}</p>
                        <Badge variant="outline" className="text-xs mt-1">{product.category}</Badge>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary">${product.price}</p>
                        <Badge variant={product.inStock ? "default" : "destructive"} className="text-xs mt-1">
                          {product.inStock ? "In Stock" : "Out of Stock"}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="orders" className="mt-6">
          {ordersLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Card key={i} className="h-20 animate-pulse bg-muted" />)}</div>
          ) : (
            <div className="space-y-3">
              {orders?.map(order => (
                <Card key={order.id} className="hover:border-primary/30 transition-colors" data-testid={`card-order-${order.id}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{order.customerName}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(order.createdAt), "MMM d, yyyy")}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {Array.isArray(order.items) ? order.items.map((i: any) => `${i.quantity}x ${i.productName}`).join(", ") : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">${order.totalAmount}</p>
                        <Badge variant={statusColor(order.status)} className="text-xs mt-1">{order.status}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {(!orders || orders.length === 0) && (
                <div className="text-center py-16 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>No orders yet.</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
