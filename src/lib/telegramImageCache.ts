// Telegram Image Cache Utility
export interface TelegramCachedImage {
  id: string;
  url: string;
  telegram_file_id: string;
  telegram_file_path?: string;
  timestamp: number;
  type: 'poster' | 'backdrop' | 'scene';
}

class TelegramImageCacheDB {
  private botToken: string;
  private chatId: string;
  private cache = new Map<string, TelegramCachedImage>();

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    this.chatId = process.env.TELEGRAM_CHAT_ID || '';
    
    if (!this.botToken || !this.chatId) {
      console.warn('Telegram Bot Token or Chat ID not configured');
    }
  }

  async get(id: string, url: string): Promise<TelegramCachedImage | null> {
    const key = `${id}_${url}`;
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
      return cached;
    }
    
    return null;
  }

  async set(image: TelegramCachedImage): Promise<void> {
    const key = `${image.id}_${image.url}`;
    this.cache.set(key, image);
  }

  async uploadToTelegram(imageData: Uint8Array, filename: string, originalUrl?: string): Promise<{ file_id: string; file_path?: string }> {
    if (!this.botToken || !this.chatId) {
      throw new Error('Telegram Bot not configured');
    }

    // Sử dụng URL gốc nếu có, nếu không thì tạo temp URL
    let photoUrl = originalUrl;
    
    if (!photoUrl) {
      // Tạo temp URL bằng cách upload lên imgur hoặc service tương tự
      // Hoặc có thể sử dụng base64 data URL cho ảnh nhỏ
      if (imageData.length < 100000) { // Chỉ dùng data URL cho ảnh < 100KB
        // Web API base64 encoding (Edge-compatible, no Node.js Buffer)
        let binary = '';
        for (let i = 0; i < imageData.length; i++) {
          binary += String.fromCharCode(imageData[i]);
        }
        const base64 = btoa(binary);
        photoUrl = `data:image/jpeg;base64,${base64}`;
      } else {
        // Fallback: sử dụng placeholder URL
        photoUrl = 'https://via.placeholder.com/500x750.jpg?text=Image+Too+Large';
      }
    }
    
    console.log('Uploading to Telegram using URL method...');
    
    const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendPhoto`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: this.chatId,
        photo: photoUrl,
        caption: `Cache: ${filename}`
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('URL upload failed:', errorText);
      throw new Error(`URL upload failed: ${errorText}`);
    }

    const result = await response.json();
    
    if (!result.ok) {
      throw new Error(`Telegram API error: ${result.description}`);
    }

    const photo = result.result.photo[result.result.photo.length - 1];
    
    return {
      file_id: photo.file_id,
      file_path: photo.file_path
    };
  }

  async getFromTelegram(file_id: string): Promise<string> {
    if (!this.botToken) {
      throw new Error('Telegram Bot not configured');
    }

    const response = await fetch(`https://api.telegram.org/bot${this.botToken}/getFile?file_id=${file_id}`);
    
    if (!response.ok) {
      throw new Error(`Telegram API error: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (!result.ok) {
      throw new Error(`Telegram API error: ${result.description}`);
    }

    const filePath = result.result.file_path;
    const fileUrl = `https://api.telegram.org/file/bot${this.botToken}/${filePath}`;
    
    return fileUrl;
  }

  async delete(id: string, url: string): Promise<void> {
    const key = `${id}_${url}`;
    const cached = this.cache.get(key);
    
    if (cached && cached.telegram_file_id) {
      // Có thể xóa message trên Telegram nếu cần
      // await this.deleteFromTelegram(cached.telegram_file_id);
    }
    
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  getSize(): number {
    return this.cache.size;
  }
}

export const telegramImageCacheDB = new TelegramImageCacheDB();

// Utility functions
export async function cacheImageToTelegram(id: string, url: string, type: 'poster' | 'backdrop' | 'scene'): Promise<string> {
  try {
    // Kiểm tra cache trước
    const cached = await telegramImageCacheDB.get(id, url);
    if (cached) {
      // Lấy từ Telegram
      const telegramUrl = await telegramImageCacheDB.getFromTelegram(cached.telegram_file_id);
      return telegramUrl;
    }

    // Fetch từ URL
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const imageData = new Uint8Array(arrayBuffer);

    // Upload lên Telegram
    const filename = `${id}_${type}_${Date.now()}.jpg`;
    const telegramResult = await telegramImageCacheDB.uploadToTelegram(imageData, filename, url);

    // Lưu vào cache
    await telegramImageCacheDB.set({
      id,
      url,
      telegram_file_id: telegramResult.file_id,
      telegram_file_path: telegramResult.file_path,
      timestamp: Date.now(),
      type
    });

    // Trả về Telegram URL
    const telegramUrl = await telegramImageCacheDB.getFromTelegram(telegramResult.file_id);
    return telegramUrl;
  } catch (error) {
    console.error('Error caching image to Telegram:', error);
    throw error;
  }
}

export async function getCachedImageFromTelegram(id: string, url: string): Promise<string | null> {
  try {
    const cached = await telegramImageCacheDB.get(id, url);
    if (!cached) return null;

    // Lấy từ Telegram
    const telegramUrl = await telegramImageCacheDB.getFromTelegram(cached.telegram_file_id);
    return telegramUrl;
  } catch (error) {
    console.error('Error getting cached image from Telegram:', error);
    return null;
  }
}
