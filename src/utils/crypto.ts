// 配置安全存储工具
// 使用 base64 编码避免 API Key 在 localStorage 中明文暴露
// 注意：这是混淆而非加密，密钥和数据在同一浏览器中，无法抵御高级攻击

const STORAGE_KEY = 'bilingual_reader_config';

/**
 * 编码存储（base64）
 */
function encode(data: string): string {
  try {
    return btoa(encodeURIComponent(data));
  } catch {
    // 如果 btoa 失败（极少数情况），使用 JSON 转义
    return 'raw:' + data;
  }
}

/**
 * 解码读取
 */
function decode(stored: string): string | null {
  try {
    if (stored.startsWith('raw:')) {
      return stored.slice(4);
    }
    return decodeURIComponent(atob(stored));
  } catch {
    return null;
  }
}

/**
 * 保存配置到 localStorage
 */
export async function saveConfigSecure(config: Record<string, unknown>): Promise<void> {
  const json = JSON.stringify(config);
  const encoded = encode(json);
  localStorage.setItem(STORAGE_KEY, encoded);
}

/**
 * 从 localStorage 加载配置
 */
export async function loadConfigSecure<T = Record<string, unknown>>(): Promise<T | null> {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;

  try {
    const json = decode(stored);
    if (!json) return null;
    return JSON.parse(json) as T;
  } catch (error) {
    console.warn('[Storage] 配置解析失败:', error);
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

/**
 * 清除存储的配置
 */
export function clearSecureConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}
