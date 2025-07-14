import emailjs from "@emailjs/browser";

export const sendRegisteredEmail = async (email: string, name: string, password: string) => {
  const templateParams = {
    user_email: email,
    user_name: name,
    user_password: password,
  };

  try {
    const result = await emailjs.send(
      "service_jguik2x",              // ✅ your EmailJS service ID
      "template_wj2xaql", 
         // ✅ your EmailJS template ID
      templateParams,
      "oX8QpIgc-0rG-h5y1"             // ✅ your EmailJS public key
    );

    console.log("Registered email sent:", result.text);
    return true;
  } catch (error) {
    console.error("Failed to send registration email:", error);
    return false;
  }
};
