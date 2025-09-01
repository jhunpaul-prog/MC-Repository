// utils/sendVerificationEmail.ts
import emailjs from "@emailjs/browser";

export const sendVerificationCode = async (email: string, code: string) => {
  const templateParams = {
    user_email: email,
    verification_code: code,
  };

  try {
    const result = await emailjs.send(
      "service_twy3zv8", // replace with your service ID
      "template_vx7z1fd", // replace with your template ID
      templateParams,
      "J546bOV5Isg49oKNc" // replace with your public key
    );
    console.log("Email sent:", result.text);
    return true;
  } catch (error) {
    console.error("Email send error:", error);
    return false;
  }
};
