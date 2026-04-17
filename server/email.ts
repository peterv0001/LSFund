import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.FROM_EMAIL || 'Leadershield Network <noreply@leadershield.com>';
const APP_URL = process.env.APP_URL || 'https://leadershield.com';

// Email templates
const templates = {
  welcome: (data: { firstName: string; email: string; loginUrl: string }) => ({
    subject: '🎉 Welcome to Leadershield Network!',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: linear-gradient(135deg, #1e3a5f 0%, #0f1f33 100%); border-radius: 16px 16px 0 0; padding: 40px; text-align: center;">
      <h1 style="color: #d4af37; margin: 0; font-size: 28px;">Leadershield Network</h1>
      <p style="color: rgba(255,255,255,0.8); margin: 10px 0 0 0;">Agent Platform</p>
    </div>
    
    <div style="background: white; padding: 40px; border-radius: 0 0 16px 16px;">
      <h2 style="color: #1e3a5f; margin: 0 0 20px 0;">Welcome, ${data.firstName}! 🎉</h2>
      
      <p style="color: #4a5568; line-height: 1.6; margin: 0 0 20px 0;">
        Congratulations on joining Leadershield Network! You're now part of an elite network of MCA professionals 
        building two revenue streams.
      </p>
      
      <p style="color: #4a5568; line-height: 1.6; margin: 0 0 20px 0;">
        <strong>Here's what to do next:</strong>
      </p>
      
      <ol style="color: #4a5568; line-height: 1.8; margin: 0 0 30px 0; padding-left: 20px;">
        <li>Complete your profile in the back office</li>
        <li>Watch the training videos (takes ~30 min)</li>
        <li>Start reaching out to business owners</li>
        <li>Submit your first deal!</li>
      </ol>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${data.loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #1e3a5f 0%, #0f1f33 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Go to Your Dashboard →
        </a>
      </div>
      
      <p style="color: #718096; font-size: 14px; margin: 30px 0 0 0; padding-top: 20px; border-top: 1px solid #e2e8f0;">
        Questions? Reply to this email or reach out to your sponsor. We're here to help you succeed!
      </p>
    </div>
    
    <p style="color: #a0aec0; font-size: 12px; text-align: center; margin: 20px 0 0 0;">
      © ${new Date().getFullYear()} Leadershield Network. All rights reserved.
    </p>
  </div>
</body>
</html>
    `,
  }),

  dealFunded: (data: { firstName: string; merchantName: string; amount: number; commission: number; dashboardUrl: string }) => ({
    subject: `💰 Deal Funded: ${data.merchantName} - $${data.amount.toLocaleString()}!`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); border-radius: 16px 16px 0 0; padding: 40px; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 10px;">💰</div>
      <h1 style="color: white; margin: 0; font-size: 24px;">Deal Funded!</h1>
    </div>
    
    <div style="background: white; padding: 40px; border-radius: 0 0 16px 16px;">
      <h2 style="color: #1e3a5f; margin: 0 0 20px 0;">Congratulations, ${data.firstName}!</h2>
      
      <p style="color: #4a5568; line-height: 1.6; margin: 0 0 20px 0;">
        Your deal has been funded. Here are the details:
      </p>
      
      <div style="background: #f7fafc; border-radius: 12px; padding: 24px; margin: 20px 0;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
          <span style="color: #718096;">Merchant</span>
          <strong style="color: #1e3a5f;">${data.merchantName}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
          <span style="color: #718096;">Funded Amount</span>
          <strong style="color: #1e3a5f;">$${data.amount.toLocaleString()}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; padding-top: 12px; border-top: 1px solid #e2e8f0;">
          <span style="color: #718096;">Your Commission</span>
          <strong style="color: #059669; font-size: 20px;">$${data.commission.toLocaleString()}</strong>
        </div>
      </div>
      
      <p style="color: #4a5568; line-height: 1.6; margin: 20px 0;">
        Keep up the great work! Your commission will be included in your next payout.
      </p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${data.dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #1e3a5f 0%, #0f1f33 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          View Your Earnings →
        </a>
      </div>
    </div>
    
    <p style="color: #a0aec0; font-size: 12px; text-align: center; margin: 20px 0 0 0;">
      © ${new Date().getFullYear()} Leadershield Network. All rights reserved.
    </p>
  </div>
</body>
</html>
    `,
  }),

  passwordReset: (data: { firstName: string; resetUrl: string }) => ({
    subject: 'Reset Your Password - Leadershield Network',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: linear-gradient(135deg, #1e3a5f 0%, #0f1f33 100%); border-radius: 16px 16px 0 0; padding: 40px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">Password Reset Request</h1>
    </div>
    
    <div style="background: white; padding: 40px; border-radius: 0 0 16px 16px;">
      <h2 style="color: #1e3a5f; margin: 0 0 20px 0;">Hi ${data.firstName},</h2>
      
      <p style="color: #4a5568; line-height: 1.6; margin: 0 0 20px 0;">
        We received a request to reset your password. Click the button below to set a new password for your account.
      </p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${data.resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #1e3a5f 0%, #0f1f33 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Reset My Password →
        </a>
      </div>
      
      <p style="color: #718096; font-size: 14px; line-height: 1.6; margin: 20px 0;">
        This link will expire in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email — your password will remain unchanged.
      </p>
      
      <p style="color: #a0aec0; font-size: 12px; margin: 30px 0 0 0; padding-top: 20px; border-top: 1px solid #e2e8f0;">
        If the button above doesn't work, copy and paste this link into your browser:<br/>
        <a href="${data.resetUrl}" style="color: #1e3a5f; word-break: break-all;">${data.resetUrl}</a>
      </p>
    </div>
    
    <p style="color: #a0aec0; font-size: 12px; text-align: center; margin: 20px 0 0 0;">
      © ${new Date().getFullYear()} Leadershield Network. All rights reserved.
    </p>
  </div>
</body>
</html>
    `,
  }),

  subscriptionPaused: (data: { firstName: string; merchantName: string; tier: string; effectiveDate: string; dashboardUrl: string }) => ({
    subject: `⏸ Subscription Paused: ${data.merchantName}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: linear-gradient(135deg, #d97706 0%, #b45309 100%); border-radius: 16px 16px 0 0; padding: 40px; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 10px;">⏸</div>
      <h1 style="color: white; margin: 0; font-size: 24px;">Subscription Paused</h1>
    </div>

    <div style="background: white; padding: 40px; border-radius: 0 0 16px 16px;">
      <h2 style="color: #1e3a5f; margin: 0 0 20px 0;">Hi ${data.firstName},</h2>

      <p style="color: #4a5568; line-height: 1.6; margin: 0 0 20px 0;">
        Your subscription has been paused. Here are the details:
      </p>

      <div style="background: #fffbeb; border: 1px solid #fcd34d; border-radius: 12px; padding: 24px; margin: 20px 0;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
          <span style="color: #718096;">Merchant</span>
          <strong style="color: #1e3a5f;">${data.merchantName}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
          <span style="color: #718096;">Tier</span>
          <strong style="color: #1e3a5f;">${data.tier}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; padding-top: 12px; border-top: 1px solid #fcd34d;">
          <span style="color: #718096;">Effective Date</span>
          <strong style="color: #d97706;">${data.effectiveDate}</strong>
        </div>
      </div>

      <p style="color: #4a5568; line-height: 1.6; margin: 20px 0;">
        While paused, commission accrual for this subscription is on hold. You can reactivate it at any time from your dashboard.
      </p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${data.dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #1e3a5f 0%, #0f1f33 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Go to Your Dashboard →
        </a>
      </div>

      <p style="color: #718096; font-size: 14px; margin: 30px 0 0 0; padding-top: 20px; border-top: 1px solid #e2e8f0;">
        If you did not make this change or have questions, please contact support.
      </p>
    </div>

    <p style="color: #a0aec0; font-size: 12px; text-align: center; margin: 20px 0 0 0;">
      © ${new Date().getFullYear()} Leadershield Network. All rights reserved.
    </p>
  </div>
</body>
</html>
    `,
  }),

  subscriptionCancelled: (data: { firstName: string; merchantName: string; tier: string; effectiveDate: string; dashboardUrl: string }) => ({
    subject: `❌ Subscription Cancelled: ${data.merchantName}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); border-radius: 16px 16px 0 0; padding: 40px; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 10px;">❌</div>
      <h1 style="color: white; margin: 0; font-size: 24px;">Subscription Cancelled</h1>
    </div>

    <div style="background: white; padding: 40px; border-radius: 0 0 16px 16px;">
      <h2 style="color: #1e3a5f; margin: 0 0 20px 0;">Hi ${data.firstName},</h2>

      <p style="color: #4a5568; line-height: 1.6; margin: 0 0 20px 0;">
        Your subscription has been cancelled. Here are the details:
      </p>

      <div style="background: #fef2f2; border: 1px solid #fca5a5; border-radius: 12px; padding: 24px; margin: 20px 0;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
          <span style="color: #718096;">Merchant</span>
          <strong style="color: #1e3a5f;">${data.merchantName}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
          <span style="color: #718096;">Tier</span>
          <strong style="color: #1e3a5f;">${data.tier}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; padding-top: 12px; border-top: 1px solid #fca5a5;">
          <span style="color: #718096;">Effective Date</span>
          <strong style="color: #dc2626;">${data.effectiveDate}</strong>
        </div>
      </div>

      <p style="color: #4a5568; line-height: 1.6; margin: 20px 0;">
        This cancellation may affect your commission accrual for this merchant. If you believe this was done in error, please contact support immediately.
      </p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${data.dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #1e3a5f 0%, #0f1f33 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Go to Your Dashboard →
        </a>
      </div>

      <p style="color: #718096; font-size: 14px; margin: 30px 0 0 0; padding-top: 20px; border-top: 1px solid #e2e8f0;">
        If you did not make this change or have questions, please contact support.
      </p>
    </div>

    <p style="color: #a0aec0; font-size: 12px; text-align: center; margin: 20px 0 0 0;">
      © ${new Date().getFullYear()} Leadershield Network. All rights reserved.
    </p>
  </div>
</body>
</html>
    `,
  }),

  teamSignup: (data: { firstName: string; newMemberName: string; dashboardUrl: string }) => ({
    subject: `🙌 New Team Member: ${data.newMemberName} joined your team!`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%); border-radius: 16px 16px 0 0; padding: 40px; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 10px;">🙌</div>
      <h1 style="color: white; margin: 0; font-size: 24px;">Your Team is Growing!</h1>
    </div>
    
    <div style="background: white; padding: 40px; border-radius: 0 0 16px 16px;">
      <h2 style="color: #1e3a5f; margin: 0 0 20px 0;">Great news, ${data.firstName}!</h2>
      
      <p style="color: #4a5568; line-height: 1.6; margin: 0 0 20px 0;">
        <strong>${data.newMemberName}</strong> just joined Leadershield Network using your referral link!
      </p>
      
      <p style="color: #4a5568; line-height: 1.6; margin: 0 0 20px 0;">
        As their sponsor, you'll earn override commissions on every deal they close. 
        Reach out to welcome them and help them get started!
      </p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${data.dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #1e3a5f 0%, #0f1f33 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          View Your Team →
        </a>
      </div>
    </div>
    
    <p style="color: #a0aec0; font-size: 12px; text-align: center; margin: 20px 0 0 0;">
      © ${new Date().getFullYear()} Leadershield Network. All rights reserved.
    </p>
  </div>
</body>
</html>
    `,
  }),
};

// Email sending functions
export const emailService = {
  async sendWelcomeEmail(to: string, firstName: string) {
    if (!process.env.RESEND_API_KEY) {
      console.log('[Email] Skipping welcome email - RESEND_API_KEY not set');
      return;
    }

    try {
      const template = templates.welcome({
        firstName,
        email: to,
        loginUrl: `${APP_URL}/login`,
      });

      await resend.emails.send({
        from: FROM_EMAIL,
        to,
        subject: template.subject,
        html: template.html,
      });

      console.log(`[Email] Welcome email sent to ${to}`);
    } catch (error) {
      console.error('[Email] Failed to send welcome email:', error);
    }
  },

  async sendDealFundedEmail(to: string, data: { firstName: string; merchantName: string; amount: number; commission: number }) {
    if (!process.env.RESEND_API_KEY) {
      console.log('[Email] Skipping deal funded email - RESEND_API_KEY not set');
      return;
    }

    try {
      const template = templates.dealFunded({
        ...data,
        dashboardUrl: `${APP_URL}/earnings`,
      });

      await resend.emails.send({
        from: FROM_EMAIL,
        to,
        subject: template.subject,
        html: template.html,
      });

      console.log(`[Email] Deal funded email sent to ${to}`);
    } catch (error) {
      console.error('[Email] Failed to send deal funded email:', error);
    }
  },

  async sendPasswordResetEmail(to: string, data: { firstName: string; resetUrl: string }) {
    if (!process.env.RESEND_API_KEY) {
      console.log('[Email] Skipping password reset email - RESEND_API_KEY not set');
      return;
    }

    try {
      const template = templates.passwordReset(data);

      await resend.emails.send({
        from: FROM_EMAIL,
        to,
        subject: template.subject,
        html: template.html,
      });

      console.log(`[Email] Password reset email sent to ${to}`);
    } catch (error) {
      console.error('[Email] Failed to send password reset email:', error);
    }
  },

  async sendSubscriptionPausedEmail(to: string, data: { firstName: string; merchantName: string; tier: string; effectiveDate: string }) {
    if (!process.env.RESEND_API_KEY) {
      console.log('[Email] Skipping subscription paused email - RESEND_API_KEY not set');
      return;
    }

    try {
      const template = templates.subscriptionPaused({
        ...data,
        dashboardUrl: `${APP_URL}/subscriptions`,
      });

      await resend.emails.send({
        from: FROM_EMAIL,
        to,
        subject: template.subject,
        html: template.html,
      });

      console.log(`[Email] Subscription paused email sent to ${to}`);
    } catch (error) {
      console.error('[Email] Failed to send subscription paused email:', error);
    }
  },

  async sendSubscriptionCancelledEmail(to: string, data: { firstName: string; merchantName: string; tier: string; effectiveDate: string }) {
    if (!process.env.RESEND_API_KEY) {
      console.log('[Email] Skipping subscription cancelled email - RESEND_API_KEY not set');
      return;
    }

    try {
      const template = templates.subscriptionCancelled({
        ...data,
        dashboardUrl: `${APP_URL}/subscriptions`,
      });

      await resend.emails.send({
        from: FROM_EMAIL,
        to,
        subject: template.subject,
        html: template.html,
      });

      console.log(`[Email] Subscription cancelled email sent to ${to}`);
    } catch (error) {
      console.error('[Email] Failed to send subscription cancelled email:', error);
    }
  },

  async sendTeamSignupEmail(to: string, data: { firstName: string; newMemberName: string }) {
    if (!process.env.RESEND_API_KEY) {
      console.log('[Email] Skipping team signup email - RESEND_API_KEY not set');
      return;
    }

    try {
      const template = templates.teamSignup({
        ...data,
        dashboardUrl: `${APP_URL}/team`,
      });

      await resend.emails.send({
        from: FROM_EMAIL,
        to,
        subject: template.subject,
        html: template.html,
      });

      console.log(`[Email] Team signup email sent to ${to}`);
    } catch (error) {
      console.error('[Email] Failed to send team signup email:', error);
    }
  },
};

export default emailService;
