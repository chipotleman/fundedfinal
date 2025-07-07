import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { to, subject, text } = req.body;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.NOTIFY_EMAIL,
      pass: process.env.NOTIFY_PASS,
    },
  });

  try {
    await transporter.sendMail({
      from: process.env.NOTIFY_EMAIL,
      to,
      subject,
      text,
    });
    res.status(200).json({ message: 'Email sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Email failed to send', error: err.toString() });
  }
}
