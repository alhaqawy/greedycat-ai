import type { TrainingLabel } from "@/lib/storage/TrainingDataset";

export type PatternHistoryItem = {
  id: string;
  result: TrainingLabel;
  createdAt: string;

  /*
   * نفس المعرّف المستخدم في Neon.
   * يسمح لزر "تراجع عن الأخيرة" بحذف نفس السجل السحابي.
   */
  neonResultId?: string;

  /*
   * معرّف جلسة التحليل.
   * كل استئناف بعد توقف يبدأ Session جديدة،
   * مع الاحتفاظ بكل الجلسات السابقة.
   */
  sessionId?: string;
};

const DB_NAME = "greedycat-ai-patterns";
const DB_VERSION = 1;
const STORE_NAME = "results";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: "id",
        });

        store.createIndex("createdAt", "createdAt", {
          unique: false,
        });

        store.createIndex("result", "result", {
          unique: false,
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        request.error ??
          new Error("تعذر فتح قاعدة بيانات النتائج."),
      );
  });
}

export async function addPatternResult(
  result: TrainingLabel,
  neonResultId?: string,
  sessionId?: string,
): Promise<PatternHistoryItem> {
  const db = await openDB();

  const item: PatternHistoryItem = {
    id: `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}`,
    result,
    createdAt: new Date().toISOString(),
    neonResultId,
    sessionId,
  };

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(
      STORE_NAME,
      "readwrite",
    );

    transaction.objectStore(STORE_NAME).add(item);

    transaction.oncomplete = () => resolve();

    transaction.onerror = () =>
      reject(
        transaction.error ??
          new Error("تعذر حفظ النتيجة."),
      );
  });

  db.close();

  return item;
}

export async function getPatternResults(
  limit?: number,
  sessionId?: string,
): Promise<PatternHistoryItem[]> {
  const db = await openDB();

  const items = await new Promise<
    PatternHistoryItem[]
  >((resolve, reject) => {
    const transaction = db.transaction(
      STORE_NAME,
      "readonly",
    );

    const request = transaction
      .objectStore(STORE_NAME)
      .index("createdAt")
      .getAll();

    request.onsuccess = () => {
      resolve(
        (request.result as PatternHistoryItem[]).sort(
          (a, b) =>
            new Date(a.createdAt).getTime() -
            new Date(b.createdAt).getTime(),
        ),
      );
    };

    request.onerror = () =>
      reject(
        request.error ??
          new Error("تعذر قراءة سجل النتائج."),
      );
  });

  db.close();

  const filteredItems = sessionId
    ? items.filter((item) => item.sessionId === sessionId)
    : items;

  if (
    typeof limit === "number" &&
    limit > 0 &&
    filteredItems.length > limit
  ) {
    return filteredItems.slice(-limit);
  }

  return filteredItems;
}

export async function removePatternResultById(
  id: string,
): Promise<void> {
  const db = await openDB();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(
      STORE_NAME,
      "readwrite",
    );

    transaction.objectStore(STORE_NAME).delete(id);

    transaction.oncomplete = () => resolve();

    transaction.onerror = () =>
      reject(
        transaction.error ??
          new Error("تعذر حذف النتيجة."),
      );
  });

  db.close();
}

export async function removeLastPatternResult(): Promise<void> {
  const items = await getPatternResults(1);

  const last = items[0];

  if (!last) {
    return;
  }

  const db = await openDB();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(
      STORE_NAME,
      "readwrite",
    );

    transaction.objectStore(STORE_NAME).delete(last.id);

    transaction.oncomplete = () => resolve();

    transaction.onerror = () =>
      reject(
        transaction.error ??
          new Error("تعذر حذف آخر نتيجة."),
      );
  });

  db.close();
}

export async function clearPatternHistory(): Promise<void> {
  const db = await openDB();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(
      STORE_NAME,
      "readwrite",
    );

    transaction.objectStore(STORE_NAME).clear();

    transaction.oncomplete = () => resolve();

    transaction.onerror = () =>
      reject(
        transaction.error ??
          new Error("تعذر مسح سجل النتائج."),
      );
  });

  db.close();
}

export async function getPatternResultStats(): Promise<
  Record<TrainingLabel, number>
> {
  const items = await getPatternResults();

  const stats: Record<TrainingLabel, number> = {
    corn: 0,
    pepper: 0,
    tomato: 0,
    carrot: 0,
    shrimp: 0,
    fish: 0,
    cow: 0,
    chick: 0,
  };

  for (const item of items) {
    stats[item.result] += 1;
  }

  return stats;
}
