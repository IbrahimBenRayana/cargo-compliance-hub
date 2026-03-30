import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">Manage your account and company settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Your personal information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>First Name</Label>
              <Input defaultValue="John" />
            </div>
            <div className="space-y-1.5">
              <Label>Last Name</Label>
              <Input defaultValue="Smith" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input defaultValue="john@usimports.com" type="email" />
          </div>
          <Button>Save Changes</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company Settings</CardTitle>
          <CardDescription>Importer of Record details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Company Name</Label>
            <Input defaultValue="US Imports Inc." />
          </div>
          <div className="space-y-1.5">
            <Label>IOR Number</Label>
            <Input defaultValue="IOR-2026-0001" />
          </div>
          <Button>Save Changes</Button>
        </CardContent>
      </Card>
    </div>
  );
}
