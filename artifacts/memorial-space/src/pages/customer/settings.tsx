import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bell, Lock, User as UserIcon, CreditCard, Save } from "lucide-react";

export default function CustomerSettings() {
  const [profile, setProfile] = useState({ name: "Sarah Chen", email: "sarah.chen@email.com", phone: "+1 (415) 555-0142" });
  const [notif, setNotif] = useState({ email: true, sms: false, anniversaries: true, tributes: true, orders: true });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your profile, notifications, and billing preferences.</p>
      </div>

      <Card className="border-border/60">
        <CardHeader><CardTitle className="flex items-center gap-2"><UserIcon className="h-5 w-5 text-primary" />Profile</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border border-primary/30">
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">SC</AvatarFallback>
            </Avatar>
            <div>
              <Button variant="outline" size="sm">Upload photo</Button>
              <p className="text-xs text-muted-foreground mt-1">JPG or PNG, max 2MB</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Full name</Label><Input className="mt-1" value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} data-testid="input-name" /></div>
            <div><Label>Email</Label><Input className="mt-1" type="email" value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })} data-testid="input-email" /></div>
            <div className="md:col-span-2"><Label>Phone</Label><Input className="mt-1" value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} data-testid="input-phone" /></div>
          </div>
          <Button className="bg-primary hover:bg-primary/90"><Save className="h-4 w-4 mr-2" />Save changes</Button>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary" />Notifications</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: "email" as const, label: "Email notifications", desc: "Order updates, tributes, and reminders" },
            { key: "sms" as const, label: "SMS notifications", desc: "Time-sensitive delivery and visit reminders" },
            { key: "anniversaries" as const, label: "Anniversary reminders", desc: "Birthdays and remembrance dates" },
            { key: "tributes" as const, label: "New tributes", desc: "When someone leaves a tribute on your memorials" },
            { key: "orders" as const, label: "Order updates", desc: "Shipping, delivery, and subscription renewals" },
          ].map((n) => (
            <label key={n.key} className="flex items-center justify-between p-3 rounded-lg border border-border/40 hover:border-border transition-colors cursor-pointer">
              <div>
                <p className="font-medium text-sm">{n.label}</p>
                <p className="text-xs text-muted-foreground">{n.desc}</p>
              </div>
              <input
                type="checkbox"
                checked={notif[n.key]}
                onChange={(e) => setNotif({ ...notif, [n.key]: e.target.checked })}
                className="h-5 w-5 accent-primary"
                data-testid={`toggle-${n.key}`}
              />
            </label>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-border/60">
          <CardHeader><CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5 text-primary" />Security</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start">Change password</Button>
            <Button variant="outline" className="w-full justify-start">Enable two-factor auth</Button>
            <Button variant="outline" className="w-full justify-start">Active sessions</Button>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" />Payment methods</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg border border-border/40">
              <div>
                <p className="font-medium text-sm">Visa •••• 4242</p>
                <p className="text-xs text-muted-foreground">Expires 04/28</p>
              </div>
              <span className="text-xs text-primary">Default</span>
            </div>
            <Button variant="outline" className="w-full">Add payment method</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
