const SESSION_STORAGE_KEY = "greedycat-active-session";
const LAST_ACTIVITY_KEY = "greedycat-last-activity";

/*
 * إذا مرّت هذه المدة بدون إدخال نتيجة،
 * يعتبر النظام أن اللعبة استمرت أثناء التوقف
 * ويبدأ جلسة تحليل جديدة عند الاستئناف.
 */
const SESSION_GAP_MS = 5 * 60 * 1000;

type SessionState = {
  sessionId: string;
  lastActivity: number;
};

function createSessionId(): string {
  return `session-${crypto.randomUUID()}`;
}

function readState(): SessionState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(
      SESSION_STORAGE_KEY,
    );

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);

    if (
      typeof parsed?.sessionId !== "string" ||
      typeof parsed?.lastActivity !== "number"
    ) {
      return null;
    }

    return {
      sessionId: parsed.sessionId,
      lastActivity: parsed.lastActivity,
    };
  } catch {
    return null;
  }
}

function writeState(state: SessionState): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify(state),
  );

  window.localStorage.setItem(
    LAST_ACTIVITY_KEY,
    String(state.lastActivity),
  );
}

/*
 * الحصول على الجلسة الحالية.
 *
 * إذا لم توجد جلسة:
 * إنشاء جلسة جديدة.
 *
 * إذا مرّ وقت التوقف المحدد:
 * إنشاء جلسة جديدة تلقائيًا.
 *
 * إذا كانت الجلسة مستمرة:
 * تحديث وقت النشاط مع الاحتفاظ بنفس sessionId.
 */
export function getActiveSessionId(): string {
  if (typeof window === "undefined") {
    return "server-session";
  }

  const now = Date.now();
  const current = readState();

  if (!current) {
    const sessionId = createSessionId();

    writeState({
      sessionId,
      lastActivity: now,
    });

    return sessionId;
  }

  const inactiveFor =
    now - current.lastActivity;

  if (inactiveFor >= SESSION_GAP_MS) {
    const sessionId = createSessionId();

    writeState({
      sessionId,
      lastActivity: now,
    });

    console.log(
      "🔄 New analysis session after inactivity:",
      {
        previousSessionId: current.sessionId,
        newSessionId: sessionId,
        inactiveMinutes:
          Math.round(
            inactiveFor / 60000,
          ),
      },
    );

    return sessionId;
  }

  writeState({
    sessionId: current.sessionId,
    lastActivity: now,
  });

  return current.sessionId;
}

/*
 * تحديث النشاط بدون إنشاء جلسة جديدة.
 */
export function touchActiveSession(): string {
  if (typeof window === "undefined") {
    return "server-session";
  }

  const current = readState();

  const sessionId =
    current?.sessionId ??
    createSessionId();

  writeState({
    sessionId,
    lastActivity: Date.now(),
  });

  return sessionId;
}

/*
 * بدء جلسة جديدة يدويًا إذا احتجنا ذلك لاحقًا.
 */
export function startNewAnalysisSession(): string {
  if (typeof window === "undefined") {
    return "server-session";
  }

  const sessionId = createSessionId();

  writeState({
    sessionId,
    lastActivity: Date.now(),
  });

  return sessionId;
}
