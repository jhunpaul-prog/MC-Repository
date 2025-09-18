// utils/sendVerificationEmail.ts
import emailjs from "@emailjs/browser";

export const sendVerificationCode = async (email: string, code: string) => {
  const templateParams = {
    user_email: email,
    verification_code: code,
  };

  try {
    const result = await emailjs.send(
      "service_jguik2x", // replace with your service ID
      "template_frmo3v8", // replace with your template ID
      templateParams,
      "oX8QpIgc-0rG-h5y1" // replace with your public key
    );
    console.log("Email sent:", result.text);
    return true;
  } catch (error) {
    console.error("Email send error:", error);
    return false;
  }
};
