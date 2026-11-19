import hpLaptopImg from '../assets/images/product_hp_laptop_1795124919610.jpg';
import usedTextbookImg from '../assets/images/product_used_textbook_1795124920368.jpg';
import screenRepairImg from '../assets/images/product_screen_repair_1795124920283.jpg';
import powerBankImg from '../assets/images/product_power_bank_1795127980570.jpg';
import campusSneakersImg from '../assets/images/product_campus_sneakers_1795127979631.jpg';
import electricKettleImg from '../assets/images/product_electric_kettle_1795127980017.jpg';
import smallChopsImg from '../assets/images/product_small_chops_1795127980147.jpg';

const LOCAL_SEED_ASSET_MAP: Record<string, string> = {
  '/src/assets/images/product_hp_laptop_1795124919610.jpg': hpLaptopImg,
  '/src/assets/images/product_used_textbook_1795124920368.jpg': usedTextbookImg,
  '/src/assets/images/product_screen_repair_1795124920283.jpg': screenRepairImg,
  '/src/assets/images/product_power_bank_1795127980570.jpg': powerBankImg,
  '/src/assets/images/product_campus_sneakers_1795127979631.jpg': campusSneakersImg,
  '/src/assets/images/product_electric_kettle_1795127980017.jpg': electricKettleImg,
  '/src/assets/images/product_small_chops_1795127980147.jpg': smallChopsImg,
};

export function resolveListingImageUrl(url?: string | null): string | undefined {
  if (!url) {
    return undefined;
  }
  return LOCAL_SEED_ASSET_MAP[url] || url;
}
