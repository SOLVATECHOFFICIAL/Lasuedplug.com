import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import {
  SEED_ACCOMMODATIONS,
  SEED_CATEGORIES,
  SEED_PRODUCTS,
  SEED_ROOMMATE_REQUESTS,
  SEED_SERVICES,
} from './homeHelpers';

export interface SeedResult {
  ok: boolean;
  message: string;
}

export async function seedDatabase(): Promise<SeedResult> {
  if (!db) {
    return {
      ok: false,
      message: 'Firebase is not configured. Check .env.local before seeding.',
    };
  }

  const firestore = db;

  try {
    const writes: Promise<void>[] = [];
    const baseMillis = Date.now();

    for (const category of SEED_CATEGORIES) {
      writes.push(
        setDoc(doc(firestore, 'productCategories', category.id), {
          name: category.name,
          slug: category.slug,
          subs: category.subs,
          createdAt: Timestamp.fromMillis(baseMillis),
        })
      );
    }

    SEED_PRODUCTS.forEach((product, index) => {
      const { id, ...data } = product;
      const cleanProduct: Record<string, unknown> = {
        ...data,
        categoryName: data.categoryName || data.categoryId,
        status: data.status || 'active',
        isApproved: Boolean(data.isApproved),
        isActive: Boolean(data.isActive),
        // Stagger timestamps by 1 minute per item so Trending (8) and Infinite Scroll (12+3) paginate deterministically
        createdAt: Timestamp.fromMillis(baseMillis - index * 60_000),
      };
      if (data.priceType === 'contact') {
        delete cleanProduct.price;
      }
      writes.push(setDoc(doc(firestore, 'products', id), cleanProduct));
    });

    SEED_SERVICES.forEach((service, index) => {
      const { id, ...data } = service;
      writes.push(
        setDoc(doc(firestore, 'services', id), {
          ...data,
          createdAt: Timestamp.fromMillis(baseMillis - index * 60_000),
        })
      );
    });

    SEED_ACCOMMODATIONS.forEach((accommodation, index) => {
      const { id, ...data } = accommodation;
      writes.push(
        setDoc(doc(firestore, 'accommodations', id), {
          ...data,
          createdAt: Timestamp.fromMillis(baseMillis - index * 60_000),
        })
      );
    });

    SEED_ROOMMATE_REQUESTS.forEach((request, index) => {
      const { id, ...data } = request;
      writes.push(
        setDoc(doc(firestore, 'roommate_requests', id), {
          ...data,
          createdAt: Timestamp.fromMillis(baseMillis - index * 60_000),
        })
      );
    });

    await Promise.all(writes);

    return {
      ok: true,
      message: `Database seeded with ${SEED_CATEGORIES.length} categories, ${SEED_PRODUCTS.length} products, ${SEED_SERVICES.length} services, ${SEED_ACCOMMODATIONS.length} accommodations, and ${SEED_ROOMMATE_REQUESTS.length} roommate requests.`,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unknown error while seeding Firestore.';
    return {
      ok: false,
      message: `Unable to seed Firestore: ${message}`,
    };
  }
}
