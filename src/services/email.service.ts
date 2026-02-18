
import axios from 'axios';
// Direct environment access for Cloud Run reliability

interface SendOtpParams {
    to: string;
    otp: string;
    name?: string;
}

export const EmailService = {
    async sendOtp({ to, otp, name = 'User' }: SendOtpParams) {
        if (!process.env.BREVO_API_KEY) {
            console.error('❌ BREVO_API_KEY is missing');
            return false;
        }

        try {
            const response = await axios.post(
                'https://api.brevo.com/v3/smtp/email',
                {
                    sender: {
                        name: 'Convoxa Support',
                        email: 'convoxa.app@gmail.com' // Changed to verified email to ensure delivery
                    },
                    to: [{ email: to, name: name }],
                    subject: 'Your Verification Code - Convoxa',
                    htmlContent: `
                        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                            <h2 style="color: #4F46E5;">Convoxa Verification</h2>
                            <p>Hi ${name},</p>
                            <p>You requested to reset your password. Use the code below to proceed:</p>
                            <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
                                <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #1f2937;">${otp}</span>
                            </div>
                            <p>This code will expire in 10 minutes.</p>
                            <p style="color: #666; font-size: 14px;">If you didn't request this, please ignore this email.</p>
                            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                            <p style="font-size: 12px; color: #999;">Convoxa App Team</p>
                        </div>
                    `
                },
                {
                    headers: {
                        'accept': 'application/json',
                        'api-key': process.env.BREVO_API_KEY,
                        'content-type': 'application/json'
                    }
                }
            );

            console.log(`✅ OTP sent to ${to}: ${response.status}`);
            return true;
        } catch (error: any) {
            console.error('❌ Failed to send email:', error.response?.data || error.message);
            return false;
        }
    }
};
