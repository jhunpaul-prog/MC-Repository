// utils/ChangePasswordEmail.ts
import emailjs from '@emailjs/browser';
export const ChangePasswordEmail = async (email: string, newPassword: string, userName: string) => {
  try {
    await emailjs.send(
      'service_drrq717',
      'template_sobhpcg',
      {
        user_email: email,
        user_password: newPassword,
        user_name: userName,
      },
      'bpnxlLkWVPuyNvk03'
    );
    console.log('✅ Password reset confirmation email sent!');
  } catch (error) {
    console.error('❌ Failed to send confirmation email:', error);
  }
};

