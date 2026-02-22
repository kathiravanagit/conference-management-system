const { sendEmail } = require('../config/email');

const getClientUrl = () => {
  return process.env.CLIENT_URL || process.env.CORS_ORIGIN || 'http://localhost:3000';
};

/**
 * Send Login Confirmation Email
 */
exports.sendLoginConfirmationEmail = async (email, token) => {
  try {
    const confirmUrl = `${getClientUrl()}/confirm-login?token=${token}`;

    await sendEmail({
      to: email,
      subject: 'Confirm your login',
      htmlContent: `
        <h2>Confirm Your Login</h2>
        <p>We received a login request for your account.</p>
        <p>Please confirm the login by clicking the link below:</p>
        <p><a href="${confirmUrl}">Confirm Login</a></p>
        <p>This link expires in 15 minutes.</p>
      `,
    });
    console.log(`Login confirmation email sent to ${email}`);
  } catch (error) {
    console.error('Error sending login confirmation email:', error);
  }
};

/**
 * Send Password Reset OTP Email
 */
exports.sendPasswordResetEmail = async (email, otp) => {
  try {
    await sendEmail({
      to: email,
      subject: 'Password reset code',
      htmlContent: `
        <h2>Password Reset</h2>
        <p>Use the following code to reset your password:</p>
        <h3>${otp}</h3>
        <p>This code expires in 5 minutes.</p>
      `,
    });
    console.log(`Password reset email sent to ${email}`);
  } catch (error) {
    console.error('Error sending password reset email:', error);
  }
};

/**
 * Send Registration Confirmation Email
 */
exports.sendRegistrationEmail = async (email, userName, conferenceName, conferenceDate) => {
  try {
    await sendEmail({
      to: email,
      subject: `Registration Confirmed: ${conferenceName}`,
      htmlContent: `
        <h2>Registration Confirmed!</h2>
        <p>Hello ${userName},</p>
        <p>You have successfully registered for <strong>${conferenceName}</strong></p>
        <p><strong>Conference Date:</strong> ${new Date(conferenceDate).toLocaleDateString()}</p>
        <p>You can now login to your dashboard to view your ticket and meeting link.</p>
        <p>Best regards,<br>Conference Management Team</p>
      `,
    });
    console.log(`Registration email sent to ${email}`);
  } catch (error) {
    console.error('Error sending registration email:', error);
  }
};

/**
 * Send Conference Reminder Email
 */
exports.sendReminderEmail = async (email, userName, conferenceName, meetingLink, conferenceDate) => {
  try {
    const daysUntil = Math.floor((new Date(conferenceDate) - new Date()) / (1000 * 60 * 60 * 24));

    await sendEmail({
      to: email,
      subject: `Reminder: ${conferenceName} starts in ${daysUntil} days`,
      htmlContent: `
        <h2>Conference Reminder!</h2>
        <p>Hello ${userName},</p>
        <p><strong>${conferenceName}</strong> is starting in <strong>${daysUntil}</strong> days!</p>
        <p><strong>Date:</strong> ${new Date(conferenceDate).toLocaleDateString()}</p>
        <p><a href="${meetingLink}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Join Meeting</a></p>
        <p>Best regards,<br>Conference Management Team</p>
      `,
    });
    console.log(`Reminder email sent to ${email}`);
  } catch (error) {
    console.error('Error sending reminder email:', error);
  }
};

/**
 * Send Certificate Download Email
 */
exports.sendCertificateEmail = async (email, userName, conferenceName, certificateUrl) => {
  try {
    await sendEmail({
      to: email,
      subject: `Your Certificate for ${conferenceName}`,
      htmlContent: `
        <h2>Certificate Generated!</h2>
        <p>Hello ${userName},</p>
        <p>Congratulations! Your certificate for <strong>${conferenceName}</strong> is ready to download.</p>
        <p><a href="${certificateUrl}" style="background-color: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Download Certificate</a></p>
        <p>Best regards,<br>Conference Management Team</p>
      `,
    });
    console.log(`Certificate email sent to ${email}`);
  } catch (error) {
    console.error('Error sending certificate email:', error);
  }
};

/**
 * Send Feedback Request Email
 */
exports.sendFeedbackEmail = async (email, userName, conferenceName, feedbackLink) => {
  try {
    await sendEmail({
      to: email,
      subject: `Please rate: ${conferenceName}`,
      htmlContent: `
        <h2>We'd love your feedback!</h2>
        <p>Hello ${userName},</p>
        <p>Thank you for attending <strong>${conferenceName}</strong>. Your feedback is important to us!</p>
        <p><a href="${feedbackLink}" style="background-color: #FF9800; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Submit Feedback</a></p>
        <p>Best regards,<br>Conference Management Team</p>
      `,
    });
    console.log(`Feedback email sent to ${email}`);
  } catch (error) {
    console.error('Error sending feedback email:', error);
  }
};
/**
 * Send Conference Cancellation Email (to registered students)
 */
exports.sendCancellationEmail = async (email, userName, conferenceName) => {
  try {
    await sendEmail({
      to: email,
      subject: `Conference Cancelled: ${conferenceName}`,
      htmlContent: `
        <h2>Conference Cancelled</h2>
        <p>Hello ${userName},</p>
        <p>We regret to inform you that <strong>${conferenceName}</strong> has been cancelled.</p>
        <p>If you have any questions, please contact your department staff.</p>
        <p>Best regards,<br>Conference Management Team</p>
      `,
    });
    console.log(`Cancellation email sent to ${email}`);
  } catch (error) {
    console.error('Error sending cancellation email:', error);
  }
};

/**
 * Send Waitlist Promotion Email
 */
exports.sendWaitlistPromotionEmail = async (email, userName, conferenceName) => {
  try {
    await sendEmail({
      to: email,
      subject: `You're off the waitlist: ${conferenceName}`,
      htmlContent: `
        <h2>Great news! A spot opened up.</h2>
        <p>Hello ${userName},</p>
        <p>A slot became available for <strong>${conferenceName}</strong> and you have been automatically registered.</p>
        <p>Log in to your dashboard to view your ticket.</p>
        <p>Best regards,<br>Conference Management Team</p>
      `,
    });
    console.log(`Waitlist promotion email sent to ${email}`);
  } catch (error) {
    console.error('Error sending waitlist email:', error);
  }
};
