import prisma from "../../config/prisma";

export class AppSettingService {
    static async getSetting(key: string) {
        return await prisma.appSetting.findUnique({
            where: { key }
        });
    }

    static async setSetting(key: string, value: string) {
        return await prisma.appSetting.upsert({
            where: { key },
            update: { value },
            create: { key, value }
        });
    }

    static async getPrivacyPolicy() {
        const setting = await this.getSetting('PRIVACY_POLICY');
        return setting?.value || "Default Privacy Policy. We value your privacy.";
    }
}
