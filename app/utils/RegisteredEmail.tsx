import emailjs from "@emailjs/browser";

export const sendRegisteredEmail = async (
  email: string,
  name: string,
  password: string
) => {
  const templateParams = {
    user_email: email,
    user_name: name,
    user_password: password,
  };

  try {
    const result = await emailjs.send(
      "service_zir53b9", // ✅ your EmailJS service ID
      "template_oyk8b4h",
      // ✅ your EmailJS template ID
      templateParams,
      "I4gmyV6o0moJsNGIf" // ✅ your EmailJS public key
    );

    console.log("Registered email sent:", result.text);
    return true;
  } catch (error) {
    console.error("Failed to send registration email:", error);
    return false;
  }
};
