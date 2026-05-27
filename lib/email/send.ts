import nodemailer from 'nodemailer'

const FROM = 'MedFlow AI <medflowai.ke@gmail.com>'
const TO   = 'medflowai.ke@gmail.com'

function createTransport() {
  const pass = process.env.GMAIL_APP_PASSWORD
  if (!pass) throw new Error('GMAIL_APP_PASSWORD env var is not set')
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: 'medflowai.ke@gmail.com', pass },
  })
}

export async function sendEmail(subject: string, html: string) {
  const transporter = createTransport()
  await transporter.sendMail({ from: FROM, to: TO, subject, html })
}
