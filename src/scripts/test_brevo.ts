
import { EmailService } from '../services/email.service.js';
import dotenv from 'dotenv';
import { env } from '../config/env.js';

// Force load env with override
dotenv.config({ override: true });

async function testEmail() {
    console.log("📧 Testing Brevo Email Service...");
    console.log("🔑 API Key present:", !!env.BREVO_API_KEY);

    // Replace this with a valid email for testing if needed, 
    // but for now let's try to send to a dummy or the user's email if we knew it.
    // I will ask the user to run this and maybe edit it? 
    // Or I can just put a placeholder.
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

testEmail();
