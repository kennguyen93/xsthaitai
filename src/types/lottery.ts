export type RegionKey = 'MB' | 'MN' | 'MT';

export type MainTab =
  | 'home'
  | 'xsmb'
  | 'xsmn'
  | 'xsmt'
  | 'tinh'
  | 'vietlott'
  | 'do-ve-so'
  | 'thong-ke'
  | 'admin';

export type StatCategoryId =
  | 'loto-gan'
  | 'giai-dac-biet'
  | 'tong-hop'
  | 'dau-duoi'
  | 'tan-suat-xuat-hien'
  | 'tu-00-den-99'
  | 'cap-cung-ve'
  | 'loto-kep'
  | 'tan-suat-loto'
  | 'tan-suat-cap-loto'
  | 'dac-biet-ngay-mai'
  | 'so-mo';

export type DigitDisplayMode = 'full' | '2' | '3';

export interface ProvinceInfo {
  code: string;
  name: string;
  region: RegionKey;
}

export interface XSMBResult {
  date: string; // YYYY-MM-DD
  dayOfWeekLabel: string;
  provinceName: string; // e.g., "Hà Nội", "Nam Định", "Thái Bình"
  provinceCode: string;
  kyHieu: string[]; // e.g., ["12VN", "5VN", "8VN"]
  prizes: {
    db: string[]; // 1x 5 digits
    g1: string[]; // 1x 5 digits
    g2: string[]; // 2x 5 digits
    g3: string[]; // 6x 5 digits
    g4: string[]; // 4x 4 digits
    g5: string[]; // 6x 4 digits
    g6: string[]; // 3x 3 digits
    g7: string[]; // 4x 2 digits
  };
}

export interface ProvinceDrawResult {
  province: ProvinceInfo;
  date: string;
  prizes: {
    g8: string[]; // 1x 2 digits
    g7: string[]; // 1x 3 digits
    g6: string[]; // 3x 4 digits
    g5: string[]; // 1x 4 digits
    g4: string[]; // 7x 5 digits
    g3: string[]; // 2x 5 digits
    g2: string[]; // 1x 5 digits
    g1: string[]; // 1x 5 digits
    db: string[]; // 1x 6 digits
  };
}

export interface VietlottMegaResult {
  period: string;
  date: string;
  numbers: number[]; // 6 numbers from 01..45
  jackpotValue: string;
  winnersJackpot: number;
  winnersFirst: number;
  winnersSecond: number;
  winnersThird: number;
}

export interface VietlottPowerResult {
  period: string;
  date: string;
  numbers: number[]; // 6 numbers from 01..55
  bonusNumber: number; // 1 extra number
  jackpot1Value: string;
  jackpot2Value: string;
  winnersJp1: number;
  winnersJp2: number;
}

export interface VietlottMax3DResult {
  period: string;
  date: string;
  special: string[]; // 2x 3-digit
  first: string[]; // 4x 3-digit
  second: string[]; // 6x 3-digit
  third: string[]; // 8x 3-digit
}

export interface TicketMatchDetail {
  prizeLabel: string;
  matchedNumber: string;
  prizeAmount: string;
  note?: string;
}

export interface LotoStatItem {
  pair: string; // "00".."99"
  count: number;
  daysSinceLast: number;
  maxGap: number;
  lastSeenDate: string;
}

export interface DreamEntry {
  id: number;
  keyword: string;
  numbers: string[];
  category: string;
}
