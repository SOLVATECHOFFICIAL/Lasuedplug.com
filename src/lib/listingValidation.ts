import { AdType, PriceType, ServiceLocation } from '../types';

export const MIN_LISTING_IMAGES = 1;
export const MAX_LISTING_IMAGES = 4;
export const MIN_LISTING_TEXT_LENGTH = 5;
export const MAX_GPS_ACCURACY_METERS = 50;

export const NO_IMAGES_TOAST_MESSAGE = 'Please upload at least 1 image.';
export const WEAK_GPS_TOAST_MESSAGE =
  '⚠️ GPS signal is weak. Please move to an open area and try again.';

export function validateImageCount(count: number): string | null {
  if (!Number.isFinite(count) || count < MIN_LISTING_IMAGES) {
    return NO_IMAGES_TOAST_MESSAGE;
  }
  if (count > MAX_LISTING_IMAGES) {
    return `You can upload up to ${MAX_LISTING_IMAGES} images.`;
  }
  return null;
}

export function validateMinLength(
  value: string,
  fieldLabel: string,
  minLength: number = MIN_LISTING_TEXT_LENGTH
): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length < minLength) {
    return `${fieldLabel} must be at least ${minLength} characters long.`;
  }
  return null;
}

export function isValidGpsCoordinates(
  latitude?: number | null,
  longitude?: number | null
): boolean {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export function isGpsAccuracyAcceptable(accuracy?: number | null): boolean {
  return (
    typeof accuracy === 'number' &&
    Number.isFinite(accuracy) &&
    accuracy >= 0 &&
    accuracy <= MAX_GPS_ACCURACY_METERS
  );
}

export function formatTime24To12Hour(timeValue: string): string {
  const match = /^(\d{2}):(\d{2})$/.exec(timeValue.trim());
  if (!match) return timeValue.trim();

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return timeValue.trim();
  }

  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  const paddedMin = String(minutes).padStart(2, '0');
  return `${hour12}:${paddedMin} ${period}`;
}

export function formatOpeningHoursRange(
  startTime: string,
  endTime: string
): string {
  const cleanStart = startTime.trim();
  const cleanEnd = endTime.trim();
  if (!cleanStart || !cleanEnd) return '';
  return `${formatTime24To12Hour(cleanStart)} - ${formatTime24To12Hour(cleanEnd)}`;
}

export interface MarketplaceCreateValidationInput {
  adType: AdType;
  title: string;
  description: string;
  categoryId: string;
  subcategory: string;
  imagesCount: number;
  quantity?: string;
  requireStockQuantity?: boolean;
  priceType: PriceType;
  priceAmount: string;
  locationType: 'physical' | 'online';
  serviceLocation?: ServiceLocation;
  openingTimeStart?: string;
  openingTimeEnd?: string;
  locationName: string;
  latitude?: number;
  longitude?: number;
  whatsappNumber: string;
}

export interface MarketplaceCreateValidationErrors {
  images?: string;
  title?: string;
  description?: string;
  categoryId?: string;
  subcategory?: string;
  quantity?: string;
  price?: string;
  whatsappNumber?: string;
  openingHours?: string;
  locationName?: string;
  gps?: string;
}

export function validateMarketplaceCreateInput(
  input: MarketplaceCreateValidationInput
): MarketplaceCreateValidationErrors {
  const errors: MarketplaceCreateValidationErrors = {};

  const imageErr = validateImageCount(input.imagesCount);
  if (imageErr) errors.images = imageErr;

  const titleErr = validateMinLength(
    input.title,
    input.adType === 'service' ? 'Service title' : 'Item title'
  );
  if (titleErr) errors.title = titleErr;

  const descErr = validateMinLength(input.description, 'Description');
  if (descErr) errors.description = descErr;

  if (!input.categoryId.trim()) {
    errors.categoryId = 'Please select a category.';
  }
  if (!input.subcategory.trim()) {
    errors.subcategory = 'Please select a subcategory.';
  }

  if (input.adType === 'item' && input.requireStockQuantity !== false) {
    const rawQty = (input.quantity ?? '').trim();
    const numericQty = Number(rawQty);
    if (
      !rawQty ||
      !Number.isFinite(numericQty) ||
      !Number.isInteger(numericQty) ||
      numericQty < 1
    ) {
      errors.quantity = 'Quantity in stock must be at least 1.';
    }
  }

  if (input.priceType !== 'contact') {
    const numericPrice = Number(input.priceAmount);
    if (
      !input.priceAmount.trim() ||
      !Number.isFinite(numericPrice) ||
      numericPrice <= 0
    ) {
      errors.price = 'Please enter a valid price amount in Naira.';
    }
  }

  const digits = input.whatsappNumber.replace(/[^\d]/g, '');
  if (!input.whatsappNumber.trim() || digits.length < 7) {
    errors.whatsappNumber = 'A valid WhatsApp number is required.';
  }

  if (input.locationType === 'physical') {
    if (!input.locationName.trim()) {
      errors.locationName =
        input.adType === 'service'
          ? 'Shop address is required for physical shop services.'
          : 'Physical address / landmark is required.';
    }
    if (!isValidGpsCoordinates(input.latitude, input.longitude)) {
      errors.gps =
        'Please pin your exact GPS location for a physical location.';
    }
    if (input.adType === 'service') {
      const start = (input.openingTimeStart || '').trim();
      const end = (input.openingTimeEnd || '').trim();
      if (!start || !end) {
        errors.openingHours =
          'Please select opening and closing times for your physical shop.';
      } else if (start === end) {
        errors.openingHours = 'Opening and closing times cannot be the same.';
      }
    }
  }

  return errors;
}

export interface AccommodationCreateValidationInput {
  type: string;
  title: string;
  description: string;
  rentPrice: string;
  amenitiesCount: number;
  generalLocation: string;
  exactAddress: string;
  imagesCount: number;
  whatsappDigits: string;
  latitude?: number;
  longitude?: number;
}

export function validateAccommodationCreateInput(
  input: AccommodationCreateValidationInput
): string | null {
  const imageErr = validateImageCount(input.imagesCount);
  if (imageErr) return imageErr;

  if (!input.type.trim()) {
    return 'Please select an accommodation type.';
  }

  const titleErr = validateMinLength(input.title, 'Listing title');
  if (titleErr) return titleErr;

  const descErr = validateMinLength(input.description, 'Description');
  if (descErr) return descErr;

  const parsedRent = Number(input.rentPrice);
  if (!input.rentPrice.trim() || !Number.isFinite(parsedRent) || parsedRent <= 0) {
    return 'Please enter a valid annual rent price in Naira.';
  }

  if (!Number.isFinite(input.amenitiesCount) || input.amenitiesCount < 1) {
    return 'Please select or add at least 1 amenity.';
  }

  if (!input.generalLocation.trim()) {
    return 'Please enter a public general area (e.g., Near LASUED Gate).';
  }

  if (!input.exactAddress.trim()) {
    return 'Please enter the exact address.';
  }

  if (!isValidGpsCoordinates(input.latitude, input.longitude)) {
    return 'Please pin your exact GPS location before submitting.';
  }

  if (input.whatsappDigits.length < 11) {
    return 'Please enter a valid WhatsApp phone number.';
  }

  return null;
}

export interface RoommateCreateValidationInput {
  type: string;
  title: string;
  description: string;
  budget: string;
  generalLocation: string;
  preferences: string;
  imagesCount: number;
  whatsappDigits: string;
  latitude?: number;
  longitude?: number;
}

export function validateRoommateCreateInput(
  input: RoommateCreateValidationInput
): string | null {
  const imageErr = validateImageCount(input.imagesCount);
  if (imageErr) return imageErr;

  if (!input.type.trim()) {
    return 'Please select a roommate request type.';
  }

  const titleErr = validateMinLength(input.title, 'Headline');
  if (titleErr) return titleErr;

  const descErr = validateMinLength(input.description, 'Description');
  if (descErr) return descErr;

  const parsedBudget = Number(input.budget);
  if (
    !input.budget.trim() ||
    !Number.isFinite(parsedBudget) ||
    parsedBudget <= 0
  ) {
    return 'Please enter a valid annual budget share in Naira.';
  }

  if (!input.generalLocation.trim()) {
    return 'Please enter the physical area / location.';
  }

  if (!input.preferences.trim()) {
    return 'Please state your roommate preferences.';
  }

  if (!isValidGpsCoordinates(input.latitude, input.longitude)) {
    return 'Please pin the exact GPS location before submitting.';
  }

  if (input.whatsappDigits.length < 11) {
    return 'Please enter a valid WhatsApp phone number.';
  }

  return null;
}

export interface StoreCreateValidationInput {
  name: string;
  description: string;
  category: string;
  subcategory: string;
  openingTimeStart: string;
  openingTimeEnd: string;
  imagesCount: number;
  whatsappNumber: string;
  locationName: string;
  latitude?: number;
  longitude?: number;
}

export interface StoreCreateValidationErrors {
  images?: string;
  name?: string;
  description?: string;
  category?: string;
  subcategory?: string;
  openingHours?: string;
  whatsappNumber?: string;
  locationName?: string;
  gps?: string;
}

export function validateStoreCreateInput(
  input: StoreCreateValidationInput
): StoreCreateValidationErrors {
  const errors: StoreCreateValidationErrors = {};

  const imageErr = validateImageCount(input.imagesCount);
  if (imageErr) errors.images = imageErr;

  const nameErr = validateMinLength(input.name, 'Store name');
  if (nameErr) errors.name = nameErr;

  const descErr = validateMinLength(input.description, 'Description');
  if (descErr) errors.description = descErr;

  if (!input.category.trim()) {
    errors.category = 'Please choose a primary store category.';
  }

  if (!input.subcategory.trim()) {
    errors.subcategory = 'Please choose a store subcategory.';
  }

  if (!input.openingTimeStart.trim() || !input.openingTimeEnd.trim()) {
    errors.openingHours = 'Please select both opening and closing times.';
  } else if (input.openingTimeStart.trim() === input.openingTimeEnd.trim()) {
    errors.openingHours = 'Opening and closing times cannot be the same.';
  }

  const digits = input.whatsappNumber.replace(/[^\d]/g, '');
  if (!input.whatsappNumber.trim() || digits.length < 7) {
    errors.whatsappNumber = 'A valid WhatsApp number is required.';
  }

  if (!input.locationName.trim()) {
    errors.locationName =
      'Physical store address is required (e.g. Shop 4, LASUED Main Gate).';
  }

  if (!isValidGpsCoordinates(input.latitude, input.longitude)) {
    errors.gps = 'Stores must have a pinned physical GPS location.';
  }

  return errors;
}
