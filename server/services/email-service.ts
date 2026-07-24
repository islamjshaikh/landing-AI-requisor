import {
  TransactionalEmailsApi,
  SendSmtpEmail,
  TransactionalEmailsApiApiKeys,
} from "@getbrevo/brevo";
import { ProjectInvitation, Project, User } from "@shared/schema";

// Initialize Brevo TransactionalEmailsApi
let emailAPI = new TransactionalEmailsApi();

// Set up API key if available
if (process.env.BREVO_API_KEY) {
  // Use proper SDK authentication method
  emailAPI.setApiKey(
    TransactionalEmailsApiApiKeys.apiKey,
    process.env.BREVO_API_KEY,
  );
} else {
  console.error("BREVO_API_KEY not set. Email sending will be disabled.");
  console.error("Please set BREVO_API_KEY in your environment variables.");
}

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

/**
 * Send an email using Brevo
 */
export async function sendEmail(params: EmailParams): Promise<boolean> {
  try {
    if (!process.env.BREVO_API_KEY) {
      console.warn("Email not sent: BREVO_API_KEY not configured");
      return false;
    }

    console.log("Sending email with the following parameters:");
    console.log(`To: ${params.to}`);
    console.log(`From: ${params.from}`);
    console.log(`Subject: ${params.subject}`);

    // Parse email addresses for Brevo format
    const parseEmail = (email: string): { name?: string; email: string } => {
      const emailPattern = new RegExp("^(.+?)\\s*<(.+)>$");
      const match = emailPattern.exec(email);
      if (match && match[1] && match[2]) {
        return {
          name: match[1].replace(/^\s+|\s+$/g, ""),
          email: match[2].replace(/^\s+|\s+$/g, ""),
        };
      }
      return { email: email.replace(/^\s+|\s+$/g, "") };
    };

    const fromEmail = parseEmail(params.from);
    const toEmail = parseEmail(params.to);

    // Create the email object for Brevo
    let message = new SendSmtpEmail();
    message.subject = params.subject;
    message.sender = fromEmail;
    message.to = [toEmail];

    if (params.text) {
      message.textContent = params.text;
    }
    if (params.html) {
      message.htmlContent = params.html;
    }

    // Send the email
    const result = await emailAPI.sendTransacEmail(message);

    console.log(`Email sent successfully to ${params.to}`);
    console.log("Brevo response:", result);
    return true;
  } catch (err: any) {
    console.error("Brevo email error:", err);
    if (err.response) {
      console.error("Brevo API error details:");
      console.error(`Status code: ${err.response.status}`);
      console.error("Response body:", err.response.data);
    } else if (err.body) {
      console.error("Error body:", err.body);
    }
    return false;
  }
}

/**
 * Send a project invitation email
 */
export async function sendInvitationEmail(
  invitation: ProjectInvitation,
  project: Project,
  inviter: User,
): Promise<boolean> {
  // Get the hostname for the callback URL
  const appUrl = process.env.APP_DOMAIN;

  console.log(`Using app URL for invitation: ${appUrl}`);
  const acceptUrl = `${appUrl}/accept-invitation?token=${invitation.token}`;

  // For Brevo, we MUST use a verified sender email
  // This email must be verified in your Brevo account
  if (!process.env.SenderEmail) {
    console.error("SenderEmail not set. Cannot send invitation email.");
    console.error(
      "Please set SenderEmail to a verified email address in your Brevo account.",
    );
    return false;
  }
  const fromEmail = process.env.SenderEmail;
  const fromName = "Requisor Team";

  console.log(`Using sender email: ${fromEmail}`);

  const subject = `${inviter.firstName} invited you to collaborate on ${project.name}`;

  const text = `
    Hello,
    
    ${inviter.firstName} has invited you to collaborate on the project "${project.name}" in Requisor.
    
    You've been invited as a ${invitation.role}.
    
    To accept this invitation, please visit:
    ${acceptUrl}
    
    This invitation will expire in 7 days.
    
    Thank you,
    The Requisor Team
  `;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background-color: #0C9488; padding: 20px; text-align: center;">
    <h1 style="color: white; margin: 0;">Requisor</h1>
  </div>
</div>

      
      <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
        <p style="font-size: 16px; color: #374151;">Hello,</p>
        
        <p style="font-size: 16px; color: #374151;">
          <strong>${inviter.firstName}</strong> has invited you to collaborate on the project 
          "<strong>${project.name}</strong>" in Requisor.
        </p>
        
        <p style="font-size: 16px; color: #374151;">
          You've been invited as a <strong>${invitation.role}</strong>.
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${acceptUrl}" 
            style="background-color: #0C9488; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
            Accept Invitation
          </a>
        </div>
        
        <p style="font-size: 14px; color: #6b7280;">
          This invitation will expire in 7 days. If the button above doesn't work, 
          copy and paste this link into your browser:
        </p>
        
        <p style="font-size: 14px; color: #6b7280; word-break: break-all;">
          ${acceptUrl}
        </p>
        
        <p style="font-size: 16px; color: #374151; margin-top: 30px;">
          Thank you,<br>
          The Requisor Team
        </p>
      </div>
      
      <div style="padding: 15px; text-align: center; font-size: 12px; color: #6b7280;">
        <p>Requisor - Smart Project Management for Small Businesses</p>
      </div>
    </div>
  `;

  return sendEmail({
    to: invitation.email,
    from: `${fromName} <${fromEmail}>`,
    subject,
    text,
    html,
  });
}

/**
 * Send a password reset email
 */
export async function sendPasswordResetEmail(
  userEmail: string,
  userName: string,
  resetToken: string,
): Promise<boolean> {
  // Reset-link base URL — env-driven only.
  const appUrl = process.env.APP_DOMAIN;

  console.log(`Using app URL for password reset: ${appUrl}`);
  const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;

  // For Brevo, we MUST use a verified sender email
  if (!process.env.BREVO_FROM_EMAIL) {
    console.error(
      "BREVO_FROM_EMAIL not set. Cannot send password reset email.",
    );
    console.error(
      "Please set BREVO_FROM_EMAIL to a verified email address in your Brevo account.",
    );
    return false;
  }
  const fromEmail = process.env.BREVO_FROM_EMAIL;
  const fromName = "Requisor Security";

  console.log(`Using sender email for password reset: ${fromEmail}`);

  const subject = "Password Reset - Action Required";

  const text = `
    Hello ${userName},
    
    We received a request to reset your password for your Requisor account.
    
    If you requested this reset, please click the link below to set a new password:
    ${resetUrl}
    
    This link will expire in 24 hours for security reasons.
    
    If you didn't request this password reset, please ignore this email. Your account remains secure.
    
    For security questions, please contact our support team.
    
    Thank you,
    The Requisor Security Team
  `;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
            <h2 style="color: #333; margin-bottom: 20px;">Password Reset Request</h2>
            
            <p>Hello ${userName},</p>
            
            <p>We received a request to reset your password for your Requisor account.</p>
            
            <div style="background-color: #fff3e0; padding: 20px; border-radius: 6px; margin: 20px 0;">
                <h3 style="margin: 0 0 10px 0; color: #f57c00;">🔒 Reset Your Password</h3>
                <p style="margin: 0;">Click the button below to create a new password for your account.</p>
            </div>
            
            <div style="margin: 30px 0; text-align: center;">
                <a href="${resetUrl}" 
                   style="background-color: #1976d2; color: white; padding: 15px 30px; 
                          text-decoration: none; border-radius: 6px; font-weight: bold;">
                    Reset Your Password Now
                </a>
            </div>
            
            <p style="color: #666; font-size: 14px;">
                This password reset link expires in 24 hours. If you don't reset your password within this time, 
                you'll need to request a new reset link.
            </p>
            
            <p style="color: #666; font-size: 14px;">
                If you didn't request this password reset, please ignore this email. Your account remains secure.
            </p>
            
            <p style="color: #666; font-size: 14px;">
                For security questions, please contact our support team.
            </p>
        </div>
        
        <div style="margin-top: 30px; text-align: center; color: #999; font-size: 12px;">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>Requisor - Smart Project Management for Small Businesses</p>
        </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: userEmail,
    from: `${fromName} <${fromEmail}>`,
    subject,
    text,
    html,
  });
}

// --- EMAIL VERIFICATION ---

export async function sendVerificationEmail(
  toEmail: string,
  verifyUrl: string,
): Promise<boolean> {
  // Prefer a verified sender. Use either BREVO_FROM_EMAIL or SenderEmail (whichever you already verified in Brevo)
  const fromEmail = process.env.BREVO_FROM_EMAIL || process.env.SenderEmail;
  if (!fromEmail) {
    console.error(
      "No verified sender configured. Set BREVO_FROM_EMAIL or SenderEmail.",
    );
    return false;
  }

  if (!process.env.BREVO_API_KEY) {
    console.warn("BREVO_API_KEY not set. Skipping verification email send.");
    return false;
  }

  const fromName = "Requisor Accounts";
  const subject = "Verify your email to finish creating your Requisor account";

  const text = `
Welcome to Requisor!

Please verify your email to finish creating your account.

Verify your email: ${verifyUrl}

If you did not sign up, you can ignore this email.
  `.trim();

  const html = `
  <!doctype html>
  <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #111827;">
      <h2 style="margin:0 0 12px;">Verify your email</h2>
      <p style="margin:0 0 16px;">Thanks for signing up! Please confirm your email address to activate your account.</p>

      <div style="text-align:center; margin: 24px 0;">
        <a href="${verifyUrl}"
           style="background:#10b981; color:#fff; text-decoration:none; padding:12px 20px; border-radius:6px; display:inline-block; font-weight:600;">
          Verify Email
        </a>
      </div>

      <p style="font-size:14px; color:#4b5563; margin: 0 0 8px;">
        Or copy and paste this link into your browser:
      </p>
      <p style="font-size:12px; color:#6b7280; word-break:break-all;">${verifyUrl}</p>

      <p style="font-size:12px; color:#6b7280; margin-top:24px;">
        This link expires in 24 hours. If you didn’t request this, you can safely ignore this email.
      </p>

      <p style="font-size:12px; color:#6b7280;">— The Requisor Team</p>
    </body>
  </html>
  `;

  return sendEmail({
    to: toEmail,
    from: `${fromName} <${fromEmail}>`,
    subject,
    text,
    html,
  });
}
