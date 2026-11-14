import type { ProvinceInfo } from '../types/lottery.ts';

export const DAY_NAMES_VI: Record<number, string> = {
  0: 'Chủ Nhật',
  1: 'Thứ Hai',
  2: 'Thứ Ba',
  3: 'Thứ Tư',
  4: 'Thứ Năm',
  5: 'Thứ Sáu',
  6: 'Thứ Bảy',
};

// Official XSMB rotating schedule by day of week (0 = Sunday .. 6 = Saturday)
export const XSMB_SCHEDULE: Record<number, ProvinceInfo> = {
  1: { code: 'XSHN', name: 'Hà Nội', region: 'MB' },
  2: { code: 'XSQN', name: 'Quảng Ninh', region: 'MB' },
  3: { code: 'XSBN', name: 'Bắc Ninh', region: 'MB' },
  4: { code: 'XSHN', name: 'Hà Nội', region: 'MB' },
  5: { code: 'XSHP', name: 'Hải Phòng', region: 'MB' },
  6: { code: 'XSND', name: 'Nam Định', region: 'MB' },
  0: { code: 'XSTB', name: 'Thái Bình', region: 'MB' },
};

// Official XSMN schedule by day of week
export const XSMN_SCHEDULE: Record<number, ProvinceInfo[]> = {
  1: [
    { code: 'XSHCM', name: 'TP.HCM', region: 'MN' },
    { code: 'XSDT', name: 'Đồng Tháp', region: 'MN' },
    { code: 'XSCM', name: 'Cà Mau', region: 'MN' },
  ],
  2: [
    { code: 'XSBT', name: 'Bến Tre', region: 'MN' },
    { code: 'XSVT', name: 'Vũng Tàu', region: 'MN' },
    { code: 'XSBL', name: 'Bạc Liêu', region: 'MN' },
  ],
  3: [
    { code: 'XSDN', name: 'Đồng Nai', region: 'MN' },
    { code: 'XSCT', name: 'Cần Thơ', region: 'MN' },
    { code: 'XSST', name: 'Sóc Trăng', region: 'MN' },
  ],
  4: [
    { code: 'XSTN', name: 'Tây Ninh', region: 'MN' },
    { code: 'XSAG', name: 'An Giang', region: 'MN' },
    { code: 'XSBTH', name: 'Bình Thuận', region: 'MN' },
  ],
  5: [
    { code: 'XSVL', name: 'Vĩnh Long', region: 'MN' },
    { code: 'XSBD', name: 'Bình Dương', region: 'MN' },
    { code: 'XSTV', name: 'Trà Vinh', region: 'MN' },
  ],
  6: [
    { code: 'XSHCM', name: 'TP.HCM', region: 'MN' },
    { code: 'XSLA', name: 'Long An', region: 'MN' },
    { code: 'XSBP', name: 'Bình Phước', region: 'MN' },
    { code: 'XSHG', name: 'Hậu Giang', region: 'MN' },
  ],
  0: [
    { code: 'XSTG', name: 'Tiền Giang', region: 'MN' },
    { code: 'XSKG', name: 'Kiên Giang', region: 'MN' },
    { code: 'XSDL', name: 'Đà Lạt', region: 'MN' },
  ],
};

// Official XSMT schedule by day of week
export const XSMT_SCHEDULE: Record<number, ProvinceInfo[]> = {
  1: [
    { code: 'XSTTH', name: 'Thừa Thiên Huế', region: 'MT' },
    { code: 'XSPY', name: 'Phú Yên', region: 'MT' },
  ],
  2: [
    { code: 'XSDLK', name: 'Đắk Lắk', region: 'MT' },
    { code: 'XSQNM', name: 'Quảng Nam', region: 'MT' },
  ],
  3: [
    { code: 'XSDNG', name: 'Đà Nẵng', region: 'MT' },
    { code: 'XSKH', name: 'Khánh Hòa', region: 'MT' },
  ],
  4: [
    { code: 'XSBDI', name: 'Bình Định', region: 'MT' },
    { code: 'XSQT', name: 'Quảng Trị', region: 'MT' },
    { code: 'XSQB', name: 'Quảng Bình', region: 'MT' },
  ],
  5: [
    { code: 'XSGL', name: 'Gia Lai', region: 'MT' },
    { code: 'XSNT', name: 'Ninh Thuận', region: 'MT' },
  ],
  6: [
    { code: 'XSDNG', name: 'Đà Nẵng', region: 'MT' },
    { code: 'XSQNG', name: 'Quảng Ngãi', region: 'MT' },
    { code: 'XSDNO', name: 'Đắk Nông', region: 'MT' },
  ],
  0: [
    { code: 'XSKT', name: 'Kon Tum', region: 'MT' },
    { code: 'XSKH', name: 'Khánh Hòa', region: 'MT' },
    { code: 'XSTTH', name: 'Thừa Thiên Huế', region: 'MT' },
  ],
};

export const ALL_PROVINCES: ProvinceInfo[] = (() => {
  const map = new Map<string, ProvinceInfo>();
  Object.values(XSMB_SCHEDULE).forEach((p) => map.set(p.code, p));
  Object.values(XSMN_SCHEDULE).flat().forEach((p) => map.set(p.code, p));
  Object.values(XSMT_SCHEDULE).flat().forEach((p) => map.set(p.code, p));
  return Array.from(map.values());
})();

export const XSMB_PRIZE_PAYOUTS = [
  { key: 'db', label: 'Giải Đặc Biệt', digits: 5, amount: '500.000.000đ' },
  { key: 'g1', label: 'Giải Nhất', digits: 5, amount: '10.000.000đ' },
  { key: 'g2', label: 'Giải Nhì', digits: 5, amount: '5.000.000đ' },
  { key: 'g3', label: 'Giải Ba', digits: 5, amount: '1.000.000đ' },
  { key: 'g4', label: 'Giải Tư', digits: 4, amount: '400.000đ' },
  { key: 'g5', label: 'Giải Năm', digits: 4, amount: '200.000đ' },
  { key: 'g6', label: 'Giải Sáu', digits: 3, amount: '100.000đ' },
  { key: 'g7', label: 'Giải Bảy', digits: 2, amount: '40.000đ' },
] as const;

export const XSMN_MT_PRIZE_PAYOUTS = [
  { key: 'db', label: 'Giải Đặc Biệt', digits: 6, amount: '2.000.000.000đ' },
  { key: 'g1', label: 'Giải Nhất', digits: 5, amount: '30.000.000đ' },
  { key: 'g2', label: 'Giải Nhì', digits: 5, amount: '15.000.000đ' },
  { key: 'g3', label: 'Giải Ba', digits: 5, amount: '10.000.000đ' },
  { key: 'g4', label: 'Giải Tư', digits: 5, amount: '3.000.000đ' },
  { key: 'g5', label: 'Giải Năm', digits: 4, amount: '1.000.000đ' },
  { key: 'g6', label: 'Giải Sáu', digits: 4, amount: '400.000đ' },
  { key: 'g7', label: 'Giải Bảy', digits: 3, amount: '200.000đ' },
  { key: 'g8', label: 'Giải Tám', digits: 2, amount: '100.000đ' },
] as const;
