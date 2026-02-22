const SibApiV3Sdk = require('@sendinblue/client');

const getApiInstance = () => {
  const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
  apiInstance.setApiKey(
    SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey,
    process.env.BREVO_API_KEY
  );
  return apiInstance;
};

const buildSender = () => {
  return {
    email: process.env.BREVO_SENDER_EMAIL,
    name: process.env.BREVO_SENDER_NAME || 'Conference Management',
  };
};

exports.sendEmail = async ({ to, subject, htmlContent }) => {
  const apiInstance = getApiInstance();
  const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

  sendSmtpEmail.sender = buildSender();
  sendSmtpEmail.to = [{ email: to }];
  sendSmtpEmail.subject = subject;
  sendSmtpEmail.htmlContent = htmlContent;

  try {
    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log(`[OK] Email sent to ${to}`);
    return result;
  } catch (error) {
    console.error('[ERROR] Email sending failed:', error.message);
    throw new Error('Failed to send email');
  }
};
