import nodemailer from 'nodemailer';

function getTransporter() {
  const hasSmtpConfig = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;
  const hasEmailConfig = hasSmtpConfig || (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD);
  
  if (!hasEmailConfig) {
    return null;
  }
  
  if (hasSmtpConfig) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
    return nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }
  
  return null;
}

export async function sendOTPEmail(email, otp) {
  const transporter = getTransporter();
  
  if (!transporter) {
    console.log(`📧 DEVELOPMENT MODE - OTP would be sent to ${email} (SMTP not configured)`);
    return true;
  }

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'LockBlip - Email Verification OTP',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; max-width:600px; margin:0 auto; color:#111;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7fb; padding:30px 0;">
          <tr>
            <td align="center">
              <table role="presentation" width="600" style="background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 6px 18px rgba(32,33,36,0.08);">
                <tr style="background:linear-gradient(90deg,#5865F2,#1877F2);">
                  <td style="padding:18px 24px; color:#fff;">
                    <div style="display:flex; align-items:center; gap:12px;">
                      <div style="width:40px; height:40px; background:rgba(255,255,255,0.12); border-radius:8px; display:flex; align-items:center; justify-content:center; font-weight:700;">S</div>
                      <div style="font-size:18px; font-weight:700;">LockBlip</div>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px 36px;">
                    <h2 style="margin:0 0 8px 0; font-size:20px; color:#0f172a;">Verify your email</h2>
                    <p style="margin:0 0 18px 0; color:#475569;">Use the code below to confirm your email address. This code will expire in 10 minutes.</p>

                    <div style="margin:20px 0; text-align:center;">
                      <div style="display:inline-block; background:#f4f6ff; border-radius:10px; padding:18px 28px; font-size:28px; letter-spacing:6px; font-weight:700; color:#111;">${otp}</div>
                    </div>

                    <p style="margin:8px 0 18px 0; color:#64748b; font-size:13px;">If you didn't request this, you can safely ignore this email.</p>

                    <div style="text-align:center; margin-top:6px;">
                      <a href="#" style="display:inline-block; background:#5865F2; color:#fff; padding:10px 18px; border-radius:8px; text-decoration:none; font-weight:600;">Open LockBlip</a>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 36px; background:#f8fafc; font-size:12px; color:#94a3b8;">
                    <div>© ${new Date().getFullYear()} LockBlip — Built with care</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✓ OTP email sent successfully to ${email}`);
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
}

export async function sendIPAuthorizationEmail(email, username, ip, authUrl) {
  const transporter = getTransporter();
  
  if (!transporter) {
    console.log('\n===========================================');
    console.log('📧 DEVELOPMENT MODE - IP AUTHORIZATION EMAIL');
    console.log('===========================================');
    console.log(`To: ${email}`);
    console.log(`Username: ${username}`);
    console.log(`IP: ${ip}`);
    console.log(`Authorization URL: ${authUrl}`);
    console.log('===========================================\n');
    return true;
  }

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'LockBlip - New Login Detected',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; max-width:600px; margin:0 auto; color:#111;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7fb; padding:30px 0;">
          <tr>
            <td align="center">
              <table role="presentation" width="600" style="background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 6px 18px rgba(32,33,36,0.08);">
                <tr style="background:linear-gradient(90deg,#5865F2,#1877F2);">
                  <td style="padding:14px 20px; color:#fff;">
                    <div style="display:flex; align-items:center; gap:10px;"><div style="width:36px; height:36px; background:rgba(255,255,255,0.12); border-radius:8px; display:flex; align-items:center; justify-content:center; font-weight:700;">S</div><div style="font-size:16px; font-weight:700;">LockBlip</div></div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:22px 30px;">
                    <h3 style="margin:0 0 8px 0; font-size:18px; color:#0f172a;">New sign-in attempt</h3>
                    <p style="margin:0 0 14px 0; color:#475569;">Hi <strong>${username}</strong>, we detected a login attempt from a new device or IP address.</p>

                    <div style="background:#f8fafc; border-radius:8px; padding:12px; margin-bottom:16px;">
                      <div style="font-size:14px; color:#334155;"><strong>IP Address:</strong> ${ip}</div>
                      <div style="font-size:13px; color:#64748b;"><strong>Time:</strong> ${new Date().toLocaleString()}</div>
                    </div>

                    <p style="margin:0 0 18px 0; color:#475569;">If this was you, authorize this device by clicking below. If it wasn't you, secure your account immediately.</p>

                    <div style="text-align:center; margin-top:8px;">
                      <a href="${authUrl}" style="display:inline-block; background:#1877F2; color:#fff; padding:10px 18px; border-radius:8px; text-decoration:none; font-weight:600;">Authorize This Device</a>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 30px; background:#f8fafc; font-size:12px; color:#94a3b8;">
                    <div>If you didn't try to sign in, please change your password and enable two-factor authentication.</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✓ IP Authorization email sent successfully to ${email}`);
    return true;
  } catch (error) {
    console.error('IP Authorization email error:', error);
    return false;
  }
}
