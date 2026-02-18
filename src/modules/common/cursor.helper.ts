
export class CursorHelper {
    static encode(data: any): string {
        try {
            return Buffer.from(JSON.stringify(data)).toString('base64');
        } catch (e) {
            return "";
        }
    }

    static decode(cursor: string): any {
        try {
            const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
            return JSON.parse(decoded);
        } catch (e) {
            return null;
        }
    }
}
