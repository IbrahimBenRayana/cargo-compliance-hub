import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle } from 'lucide-react';

export default function IntegrationsApi() {
  const [apiKey, setApiKey] = useState('cc_live_xxxxxxxxxxxxxxxx');
  const [isProduction, setIsProduction] = useState(false);
  const [connected] = useState(true);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">API Settings</h1>
        <p className="text-muted-foreground text-sm">Configure your CustomsCity integration</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connection Status</CardTitle>
          <CardDescription>CustomsCity API connection</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {connected ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-[hsl(var(--status-accepted))]" />
                <span className="text-sm font-medium">Connected</span>
                <Badge variant="secondary" className="ml-2">{isProduction ? 'Production' : 'Sandbox'}</Badge>
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-destructive" />
                <span className="text-sm font-medium">Disconnected</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">API Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>API Key</Label>
            <Input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Production Mode</Label>
              <p className="text-xs text-muted-foreground">Switch between sandbox and production environments</p>
            </div>
            <Switch checked={isProduction} onCheckedChange={setIsProduction} />
          </div>
          <Button className="w-full">Save Settings</Button>
        </CardContent>
      </Card>
    </div>
  );
}
