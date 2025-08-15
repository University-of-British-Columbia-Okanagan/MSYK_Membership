import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import Mailgun from "mailgun.js";
import formData from "form-data";

dotenv.config();

const mailgun = new Mailgun(formData);
const mg = mailgun.client({
  username: "api",
  key: process.env.MAILGUN_API_KEY as string
});

async function sendPasswordResetEmail(
  userEmail: string,
  resetLink: string,
) {
  const emailData = {
    from: `Makerspace YK <info@makerspaceyk.com>`,
    to: userEmail,
    subject: "Password Reset Request",
    text: `Please use the following link to reset your password. The following link is valid for next 1 hour.\n${resetLink}`,
  };

  try {
    await mg.messages.create("makerspaceyk.com", emailData);
  } catch (error) {
    throw new Error("Failed to send confirmation email.");
  }
}

function generateResetToken(email: string): string {
  return jwt.sign({ email }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
}

export async function sendResetEmail(email: string) {
  const token = generateResetToken(email);
  const resetLink = `${process.env.BASE_URL}/passwordReset?token=${token}`;
  await sendPasswordResetEmail(email, resetLink);
}