# Supabase Email Template Configuration

Below is the production-grade, responsive HTML email template for **Chupa**. It supports both **Magic Link** button click and **6-Digit OTP Code** verification in the exact same email.

---

### Supabase Dashboard Settings
1. Go to **Supabase Dashboard** -> **Authentication** -> **Email Templates**.
2. Under **Magic Link or OTP**, ensure your settings are configured as desired.
3. Use the following **Subject** and **Body**.

---

### Email Subject
```text
Your Chupa Sign-In Code & Magic Link
```

---

### Email Body (HTML)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in to Chupa</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1a1a2e;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f7; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 460px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e2e8; box-shadow: 0 4px 16px rgba(0,0,0,0.04); overflow: hidden;">
          
          <!-- Header / Brand -->
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #f0f0f4;">
              <div style="display: inline-block; width: 44px; height: 44px; border-radius: 10px; background: linear-gradient(135deg, #059669, #10b981); text-align: center; line-height: 44px;">
                <span style="color: #ffffff; font-size: 22px; font-weight: bold;">💬</span>
              </div>
              <h1 style="margin: 12px 0 0; font-size: 24px; font-weight: 800; color: #1a1a2e; letter-spacing: -0.02em;">Chupa</h1>
              <p style="margin: 4px 0 0; font-size: 13px; color: #6b6b80;">Distraction-free messaging</p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 28px 32px; text-align: center;">
              <p style="margin: 0 0 20px; font-size: 15px; color: #4a4a5a; line-height: 1.5;">
                Use the 6-digit code below to sign in, or click the direct link to log in instantly.
              </p>

              <!-- OTP Code Display -->
              <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
                <span style="display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #059669; margin-bottom: 6px;">Your One-Time Code</span>
                <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #047857; display: block;">{{ .Token }}</span>
              </div>

              <!-- Magic Link Button -->
              <a href="{{ .ConfirmationURL }}" target="_blank" style="display: block; width: 100%; box-sizing: border-box; background-color: #059669; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 20px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
                Sign In Instantly (Magic Link) →
              </a>

              <p style="margin: 0; font-size: 12px; color: #9d9db0; line-height: 1.4;">
                This code and link will expire in 10 minutes. If you did not request this email, you can safely ignore it.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #fafafa; border-top: 1px solid #f0f0f4; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #9d9db0;">
                Sent with security by <strong>Chupa</strong> • Fast & Private
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```
