import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/Sidebar";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { 
  User, 
  Lock, 
  CreditCard, 
  Bell,
  Save,
  Loader2,
  Copy,
  ExternalLink,
  Mail,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

export default function SettingsPage() {
  const { user, refetch } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Profile form state
  const [profile, setProfile] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    phone: user?.phone || '',
    address: user?.address || '',
    city: user?.city || '',
    state: user?.state || '',
    zip: user?.zip || '',
    bio: user?.bio || '',
  });

  // Password form state
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Payout form state
  const [payout, setPayout] = useState({
    payoutMethod: user?.payoutMethod || 'pending',
    payoutEmail: user?.payoutEmail || '',
  });

  // Notification preferences state
  const defaultPrefs = (user?.emailPreferences as { emailOnPaused?: boolean; emailOnCancelled?: boolean; emailOnReactivated?: boolean; emailOnDealFunded?: boolean; emailOnTeamSignup?: boolean; emailOnCommissionEarned?: boolean; emailOnExpiryWarning?: boolean; emailOnPaymentRetrySuccess?: boolean; emailOnPaymentRetryFailed?: boolean } | null) ?? {};
  const [notifPrefs, setNotifPrefs] = useState({
    emailOnPaused: defaultPrefs.emailOnPaused !== false,
    emailOnCancelled: defaultPrefs.emailOnCancelled !== false,
    emailOnReactivated: defaultPrefs.emailOnReactivated !== false,
    emailOnDealFunded: defaultPrefs.emailOnDealFunded !== false,
    emailOnTeamSignup: defaultPrefs.emailOnTeamSignup !== false,
    emailOnCommissionEarned: defaultPrefs.emailOnCommissionEarned !== false,
    emailOnExpiryWarning: defaultPrefs.emailOnExpiryWarning !== false,
    emailOnPaymentRetrySuccess: defaultPrefs.emailOnPaymentRetrySuccess !== false,
    emailOnPaymentRetryFailed: defaultPrefs.emailOnPaymentRetryFailed !== false,
  });

  type NotifPrefKey = 'emailOnPaused' | 'emailOnCancelled' | 'emailOnReactivated';
  const [pendingDisable, setPendingDisable] = useState<NotifPrefKey | null>(null);

  const notifLabels: Record<NotifPrefKey, { title: string; missMessage: string }> = {
    emailOnPaused: {
      title: 'Subscription Paused',
      missMessage: "You won't receive emails when one of your subscriptions is paused.",
    },
    emailOnCancelled: {
      title: 'Subscription Cancelled',
      missMessage: "You won't receive emails when one of your subscriptions is cancelled.",
    },
    emailOnReactivated: {
      title: 'Subscription Reactivated',
      missMessage: "You won't receive emails when one of your subscriptions is reactivated.",
    },
  };

  const handleToggleChange = (key: NotifPrefKey, checked: boolean) => {
    if (!checked) {
      setPendingDisable(key);
    } else {
      setNotifPrefs(p => ({ ...p, [key]: true }));
    }
  };

  const confirmDisable = () => {
    if (pendingDisable) {
      setNotifPrefs(p => ({ ...p, [pendingDisable]: false }));
      setPendingDisable(null);
    }
  };

  const cancelDisable = () => {
    setPendingDisable(null);
  };

  // Mutations
  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof profile) => {
      const res = await fetch(api.agents.updateProfile.path, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to update profile');
      return res.json();
    },
    onSuccess: () => {
      refetch();
      toast({ title: "Success", description: "Profile updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update profile", variant: "destructive" });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const res = await fetch(api.auth.changePassword.path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to change password');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Password Changed", description: "Your password was updated. Please sign in again." });
      queryClient.clear();
      setTimeout(() => setLocation("/login"), 1500);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updatePayoutMutation = useMutation({
    mutationFn: async (data: typeof payout) => {
      const res = await fetch(api.agents.updatePayoutMethod.path, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to update payout method');
      return res.json();
    },
    onSuccess: () => {
      refetch();
      toast({ title: "Success", description: "Payout method updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update payout method", variant: "destructive" });
    },
  });

  const updateNotifPrefsMutation = useMutation({
    mutationFn: async (data: typeof notifPrefs) => {
      const res = await fetch(api.agents.updateNotificationPreferences.path, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to update notification preferences');
      return res.json();
    },
    onSuccess: () => {
      refetch();
      toast({ title: "Success", description: "Notification preferences saved" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save notification preferences", variant: "destructive" });
    },
  });

  const handlePasswordChange = () => {
    if (passwords.newPassword !== passwords.confirmPassword) {
      toast({ title: "Error", description: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (passwords.newPassword.length < 8) {
      toast({ title: "Error", description: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }
    changePasswordMutation.mutate({
      currentPassword: passwords.currentPassword,
      newPassword: passwords.newPassword,
    });
  };

  const copyReferralLink = () => {
    const link = `${window.location.origin}/signup?ref=${user?.referralCode || user?.id}`;
    navigator.clipboard.writeText(link);
    toast({ title: "Copied!", description: "Referral link copied to clipboard" });
  };

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      <Sidebar />
      
      <main className="flex-1 lg:ml-64 p-4 pt-20 lg:pt-8 lg:p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-display font-bold text-primary">Settings</h1>
          <p className="text-muted-foreground mt-2">
            Manage your account settings and preferences.
          </p>
        </header>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="bg-white border">
            <TabsTrigger value="profile" className="gap-2">
              <User className="w-4 h-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Lock className="w-4 h-4" />
              Security
            </TabsTrigger>
            <TabsTrigger value="payout" className="gap-2">
              <CreditCard className="w-4 h-4" />
              Payout
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2" data-testid="tab-notifications">
              <Mail className="w-4 h-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="referral" className="gap-2">
              <ExternalLink className="w-4 h-4" />
              Referral
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Update your personal details and contact information.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>First Name</Label>
                    <Input 
                      value={profile.firstName}
                      onChange={(e) => setProfile(p => ({ ...p, firstName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    <Input 
                      value={profile.lastName}
                      onChange={(e) => setProfile(p => ({ ...p, lastName: e.target.value }))}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input 
                    value={profile.phone}
                    onChange={(e) => setProfile(p => ({ ...p, phone: e.target.value }))}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Street Address</Label>
                  <Input 
                    value={profile.address}
                    onChange={(e) => setProfile(p => ({ ...p, address: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input 
                      value={profile.city}
                      onChange={(e) => setProfile(p => ({ ...p, city: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>State</Label>
                    <Input 
                      value={profile.state}
                      onChange={(e) => setProfile(p => ({ ...p, state: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>ZIP Code</Label>
                    <Input 
                      value={profile.zip}
                      onChange={(e) => setProfile(p => ({ ...p, zip: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Bio</Label>
                  <Textarea 
                    value={profile.bio}
                    onChange={(e) => setProfile(p => ({ ...p, bio: e.target.value }))}
                    placeholder="Tell your team a little about yourself..."
                    rows={3}
                  />
                </div>

                <Button 
                  onClick={() => updateProfileMutation.mutate(profile)}
                  disabled={updateProfileMutation.isPending}
                >
                  {updateProfileMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>Update your password to keep your account secure.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label>Current Password</Label>
                  <Input 
                    type="password"
                    value={passwords.currentPassword}
                    onChange={(e) => setPasswords(p => ({ ...p, currentPassword: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>New Password</Label>
                  <Input 
                    type="password"
                    value={passwords.newPassword}
                    onChange={(e) => setPasswords(p => ({ ...p, newPassword: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Confirm New Password</Label>
                  <Input 
                    type="password"
                    value={passwords.confirmPassword}
                    onChange={(e) => setPasswords(p => ({ ...p, confirmPassword: e.target.value }))}
                  />
                </div>
                <Button 
                  onClick={handlePasswordChange}
                  disabled={changePasswordMutation.isPending}
                >
                  {changePasswordMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Update Password
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payout Tab */}
          <TabsContent value="payout">
            <Card>
              <CardHeader>
                <CardTitle>Payout Settings</CardTitle>
                <CardDescription>Configure how you receive your commissions.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 max-w-md">
                <div className="space-y-2">
                  <Label>Payout Method</Label>
                  <Select 
                    value={payout.payoutMethod} 
                    onValueChange={(v) => setPayout(p => ({ ...p, payoutMethod: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Not Set Up</SelectItem>
                      <SelectItem value="paypal">PayPal</SelectItem>
                      <SelectItem value="bank">Bank Transfer (ACH)</SelectItem>
                      <SelectItem value="stripe">Stripe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(payout.payoutMethod === 'paypal' || payout.payoutMethod === 'stripe') && (
                  <div className="space-y-2">
                    <Label>Payout Email</Label>
                    <Input 
                      type="email"
                      value={payout.payoutEmail}
                      onChange={(e) => setPayout(p => ({ ...p, payoutEmail: e.target.value }))}
                      placeholder="your@email.com"
                    />
                  </div>
                )}

                {payout.payoutMethod === 'bank' && (
                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-100">
                    <p className="text-sm text-amber-800">
                      <strong>Note:</strong> Bank transfer setup requires additional verification. 
                      Please contact support to complete your bank account setup.
                    </p>
                  </div>
                )}

                <Button 
                  onClick={() => updatePayoutMutation.mutate(payout)}
                  disabled={updatePayoutMutation.isPending}
                >
                  {updatePayoutMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save Payout Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Email Notifications</CardTitle>
                <CardDescription>
                  Choose which emails you want to receive. Preferences take effect immediately.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 max-w-lg">
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Subscription Paused</Label>
                      <p className="text-xs text-muted-foreground">
                        Receive an email when one of your subscriptions is paused.
                      </p>
                    </div>
                    <Switch
                      data-testid="toggle-email-on-paused"
                      checked={notifPrefs.emailOnPaused}
                      onCheckedChange={(checked) => handleToggleChange('emailOnPaused', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between py-3 border-b">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Subscription Cancelled</Label>
                      <p className="text-xs text-muted-foreground">
                        Receive an email when one of your subscriptions is cancelled.
                      </p>
                    </div>
                    <Switch
                      data-testid="toggle-email-on-cancelled"
                      checked={notifPrefs.emailOnCancelled}
                      onCheckedChange={(checked) => handleToggleChange('emailOnCancelled', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between py-3 border-b">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Subscription Reactivated</Label>
                      <p className="text-xs text-muted-foreground">
                        Receive an email when one of your subscriptions is reactivated.
                      </p>
                    </div>
                    <Switch
                      data-testid="toggle-email-on-reactivated"
                      checked={notifPrefs.emailOnReactivated}
                      onCheckedChange={(checked) => handleToggleChange('emailOnReactivated', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between py-3 border-b">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Deal Funded</Label>
                      <p className="text-xs text-muted-foreground">
                        Receive an email when one of your deals is funded.
                      </p>
                    </div>
                    <Switch
                      data-testid="toggle-email-on-deal-funded"
                      checked={notifPrefs.emailOnDealFunded}
                      onCheckedChange={(checked) => setNotifPrefs(p => ({ ...p, emailOnDealFunded: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between py-3 border-b">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">New Team Signup</Label>
                      <p className="text-xs text-muted-foreground">
                        Receive an email when a new agent joins your team.
                      </p>
                    </div>
                    <Switch
                      data-testid="toggle-email-on-team-signup"
                      checked={notifPrefs.emailOnTeamSignup}
                      onCheckedChange={(checked) => setNotifPrefs(p => ({ ...p, emailOnTeamSignup: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between py-3 border-b">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Commission Earned</Label>
                      <p className="text-xs text-muted-foreground">
                        Receive an email when you earn a commission (sponsor overrides, fulfillment, binary bonuses).
                      </p>
                    </div>
                    <Switch
                      data-testid="toggle-email-on-commission-earned"
                      checked={notifPrefs.emailOnCommissionEarned}
                      onCheckedChange={(checked) => setNotifPrefs(p => ({ ...p, emailOnCommissionEarned: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between py-3 border-b">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Subscription Expiry Warning</Label>
                      <p className="text-xs text-muted-foreground">
                        Receive an email when a subscription is approaching its expiry date.
                      </p>
                    </div>
                    <Switch
                      data-testid="toggle-email-on-expiry-warning"
                      checked={notifPrefs.emailOnExpiryWarning}
                      onCheckedChange={(checked) => setNotifPrefs(p => ({ ...p, emailOnExpiryWarning: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between py-3 border-b">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Payment Retry Successful</Label>
                      <p className="text-xs text-muted-foreground">
                        Receive an email when an outstanding payment for one of your subscriptions is successfully processed.
                      </p>
                    </div>
                    <Switch
                      data-testid="toggle-email-on-payment-retry-success"
                      checked={notifPrefs.emailOnPaymentRetrySuccess}
                      onCheckedChange={(checked) => setNotifPrefs(p => ({ ...p, emailOnPaymentRetrySuccess: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between py-3 border-b">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Payment Retry Failed</Label>
                      <p className="text-xs text-muted-foreground">
                        Receive an email when a payment retry for one of your subscriptions fails.
                      </p>
                    </div>
                    <Switch
                      data-testid="toggle-email-on-payment-retry-failed"
                      checked={notifPrefs.emailOnPaymentRetryFailed}
                      onCheckedChange={(checked) => setNotifPrefs(p => ({ ...p, emailOnPaymentRetryFailed: checked }))}
                    />
                  </div>
                </div>

                {!notifPrefs.emailOnPaused && !notifPrefs.emailOnCancelled && !notifPrefs.emailOnReactivated && (
                  <div
                    data-testid="warning-all-notifications-off"
                    className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    <span>You have disabled all subscription email notifications. You will not receive emails when your subscriptions change status.</span>
                  </div>
                )}

                <Button
                  data-testid="button-save-notification-prefs"
                  onClick={() => updateNotifPrefsMutation.mutate(notifPrefs)}
                  disabled={updateNotifPrefsMutation.isPending}
                >
                  {updateNotifPrefsMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <Save className="w-4 h-4 mr-2" />
                  Save Preferences
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Referral Tab */}
          <TabsContent value="referral">
            <Card>
              <CardHeader>
                <CardTitle>Your Referral Link</CardTitle>
                <CardDescription>Share this link with prospects to grow your team.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 bg-gray-50 rounded-lg border">
                  <Label className="text-xs text-muted-foreground mb-2 block">Your Referral Code</Label>
                  <p className="text-2xl font-bold text-primary">{user?.referralCode || user?.id}</p>
                </div>

                <div className="space-y-2">
                  <Label>Referral Link</Label>
                  <div className="flex gap-2">
                    <Input 
                      readOnly
                      value={`${window.location.origin}/signup?ref=${user?.referralCode || user?.id}`}
                      className="bg-gray-50"
                    />
                    <Button variant="outline" onClick={copyReferralLink}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="p-4 bg-primary/5 rounded-lg border border-primary/10">
                  <h4 className="font-medium text-primary mb-2">How It Works</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Share your referral link with potential agents</li>
                    <li>• When they sign up, they'll be placed in your team</li>
                    <li>• Earn generation overrides on their deals</li>
                    <li>• Build your binary tree to earn binary bonuses</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <AlertDialog open={pendingDisable !== null} onOpenChange={(open) => { if (!open) cancelDisable(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Turn off {pendingDisable ? notifLabels[pendingDisable].title : ''} emails?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDisable ? notifLabels[pendingDisable].missMessage : ''}{' '}
              You can re-enable this notification at any time in Settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="dialog-cancel-disable" onClick={cancelDisable}>
              Keep Enabled
            </AlertDialogCancel>
            <AlertDialogAction data-testid="dialog-confirm-disable" onClick={confirmDisable}>
              Turn Off
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
