import emailjs from "@emailjs/browser";

export const sendVerificationCode = async (email: string, code: string) => {
  const templateParams = {
    user_email: email,
    verification_code: code,
  };

  try {
    // Initialize with your Public Key
    emailjs.init("I4gmyV6o0moJsNGIf");

    const result = await emailjs.send(
      "service_zir53b9",
      "template_j3r73oe",
      templateParams,
    );

    console.log("Email sent successfully:", result.status, result.text);
    return true;
  } catch (error: any) {
    // Log the full text from EmailJS for detailed diagnosis
    console.error("Email send error:", error?.text || error);
    return false;
  }
};
