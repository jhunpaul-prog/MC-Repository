import emailjs from '@emailjs/browser';
import axios from 'axios';

export const handleSendReset = async (email: string) => {
  const { data } = await axios.post("http://localhost:4000/generate-reset-link", { email });

  const resetLink = data.resetLink;

  await emailjs.send(
    "service_7v2qm1t",
    "template_le52drr",
    {
      user_email: email,
      user_name: email.split("@")[0],
      reset_link: resetLink,
    },
    "bpnxlLkWVPuyNvk03"
  );
};
