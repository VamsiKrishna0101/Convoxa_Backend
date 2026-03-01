import { EmailService } from '../services/email.service.js';
import dotenv from 'dotenv';

// Force load env
dotenv.config();

// Direct environment access
async function testBrevo() {
    console.log("📧 Testing Brevo Email Service...");
    console.log('Using API Key:', process.env.BREVO_API_KEY ? 'Present' : 'Missing');

    const TEST_EMAIL = "vklvl0101@gmail.com"; // Self-send test

    console.log(`📤 Attempting to send to: ${TEST_EMAIL}`);

    const result = await EmailService.sendOtp({
        to: TEST_EMAIL,
        otp: "123456",
        name: "Test User"
    });

    if (result) {
        console.log("✅ Email send command executed successfully.");
    } else {
        console.error("❌ Email send command failed.");
    }
}

testBrevo();
