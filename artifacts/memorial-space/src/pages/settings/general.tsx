import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings, Bell, Globe, Shield, Palette } from "lucide-react";

export default function GeneralSettings() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your MemorialSpace platform settings.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Platform</CardTitle>
            </div>
            <CardDescription>General platform configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div><Label>Platform Name</Label><Input className="mt-1" defaultValue="MemorialSpace" data-testid="input-platform-name" /></div>
            <div><Label>Support Email</Label><Input className="mt-1" type="email" defaultValue="support@memorialspace.app" data-testid="input-support-email" /></div>
            <div><Label>Default Language</Label><Input className="mt-1" defaultValue="English (US)" data-testid="input-language" /></div>
            <Button size="sm" data-testid="button-save-platform">Save Changes</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Notifications</CardTitle>
            </div>
            <CardDescription>Email and system notification preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: "New booking notifications", id: "notif-booking", defaultChecked: true },
              { label: "Work order updates", id: "notif-workorder", defaultChecked: true },
              { label: "QR code scan alerts", id: "notif-qr", defaultChecked: false },
              { label: "Weekly summary reports", id: "notif-weekly", defaultChecked: true },
            ].map(item => (
              <div key={item.id} className="flex items-center justify-between">
                <Label htmlFor={item.id} className="cursor-pointer">{item.label}</Label>
                <Switch id={item.id} defaultChecked={item.defaultChecked} data-testid={`switch-${item.id}`} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Security</CardTitle>
            </div>
            <CardDescription>Access control and security settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: "Two-factor authentication", id: "sec-2fa", defaultChecked: false },
              { label: "Require email verification", id: "sec-email", defaultChecked: true },
              { label: "Session timeout (8h)", id: "sec-timeout", defaultChecked: true },
            ].map(item => (
              <div key={item.id} className="flex items-center justify-between">
                <Label htmlFor={item.id} className="cursor-pointer">{item.label}</Label>
                <Switch id={item.id} defaultChecked={item.defaultChecked} data-testid={`switch-${item.id}`} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Appearance</CardTitle>
            </div>
            <CardDescription>White-label and branding options</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div><Label>Primary Color</Label><Input className="mt-1" type="color" defaultValue="#2d6a4f" data-testid="input-primary-color" /></div>
            <div><Label>Logo URL</Label><Input className="mt-1" placeholder="https://your-logo.png" data-testid="input-logo-url" /></div>
            <div><Label>Custom Domain</Label><Input className="mt-1" placeholder="memorial.yourcompany.com" data-testid="input-custom-domain" /></div>
            <Button size="sm" data-testid="button-save-appearance">Save Appearance</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
