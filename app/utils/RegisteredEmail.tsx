import emailjs from "@emailjs/browser";

export const sendRegisteredEmail = async (
  email: string,
  name: string,
  password: string,
) => {
  const templateParams = {
    user_email: email,
    user_name: name,
    user_password: password,
  };

  try {
    const SERVICE_ID = "service_zir53b9"; // check under Email Services
    const TEMPLATE_ID = "template_oyk8b4h";
    const PUBLIC_KEY = "I4gmyV6o0moJsNGIf"; // check under Account > API Keys

    const result = await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID,
      templateParams,
      PUBLIC_KEY,
    );

    console.log("Registered email sent:", result.text);
    return true;
  } catch (error: any) {
    console.error("Failed to send registration email:", error?.text || error);
    return false;
  }
};
