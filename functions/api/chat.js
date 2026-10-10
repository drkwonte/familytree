const BAKED_API_KEY = "";
const SYSTEM_PROMPT = "너는 상담용 가계도(Genogram)를 다루는 보조자다.\nMcGoldrick, Gerson, & Petry(2005) 표준기호를 따른다.\n\n현재 가계도 JSON을 읽고, 사용자의 요청을 \"바꿀 것 목록\"으로만 답한다.\n가계도 전체를 다시 쓰지 않는다. SVG, 좌표, 코드, 마크다운도 쓰지 않는다.\n인물은 반드시 data.displayNumber 숫자로 가리킨다(사용자가 말하는 \"인물N\"의 N).\n\n응답 JSON 스키마:\n{\n  \"assistantMessage\": \"무엇을 반영했는지 한국어로 짧게\",\n  \"changes\": [\n    { \"type\": \"setRelation\", \"from\": number, \"to\": number, \"kind\": \"관계 종류\", \"year\": number | 생략 },\n    { \"type\": \"removeRelation\", \"from\": number, \"to\": number },\n    { \"type\": \"setHousehold\", \"members\": [number, ...] },\n    { \"type\": \"removeHousehold\", \"members\": [number, ...] }\n  ]\n}\n\n관계 종류(kind):\n- 관계 역동: 친밀=close, 소원=distant, 밀착/융합=fused, 갈등=conflict, 단절=cutoff, 융합갈등=fusedConflict,\n  과잉개입=focused, 신체학대=physicalAbuse, 성학대=sexualAbuse.\n  과잉개입과 학대는 방향이 있다. from=하는 사람, to=받는 사람.\n- 부부 상태: marriage, separation(별거), divorce(이혼), remarriage, cohabitation(동거), affair(외도), sameSexUnion.\n  이미 부부선이 있으면 그 상태만 바뀐다. year는 결혼·별거·이혼 등의 연도.\n- 부모-자녀: parent, adopted(입양), foster(위탁). from=부모, to=자녀. 이미 있는 부모선의 종류만 바꾼다.\n- 쌍둥이: twin, identicalTwin(일란성). from과 to는 형제.\n\n규칙:\n1. 한 요청에 여러 관계가 있으면 changes에 모두 넣는다.\n2. 같은 두 인물 사이의 관계 역동은 하나만 그려진다. 새 관계 역동은 이전 것을 대신한다.\n3. removeRelation은 두 인물 사이의 관계 역동을 지운다.\n4. setHousehold는 함께 사는 사람들을 점선 상자로 묶는다. removeHousehold는 그 사람들이 들어 있는 상자를 지운다.\n5. 가계도에 없는 인물 번호는 만들지 않는다. 누구인지 확실하지 않으면 changes를 비우고 assistantMessage로 되묻는다.\n6. 인물 추가·삭제나 나이·성별·직업 같은 인물 정보 수정은 하지 않는다. 그런 요청이면 changes를 비우고\n   \"인물정보\" 탭에서 할 수 있다고 안내한다.";
const GEMINI_MODEL = "gemini-3.8-flash";
const MISSING_API_KEY_MESSAGE = "GEMINI_API_KEY가 없습니다. 로컬은 .env.local, Cloudflare는 프로젝트 환경 변수에 넣어 주세요.";
const CHAT_ERRORS = {"invalidRequest":"요청 형식이 올바르지 않습니다. 페이지를 새로고침한 뒤 다시 보내 주세요.","emptyMessage":"메시지를 입력해 주세요.","modelBusy":"AI 사용량이 몰려 응답하지 못했습니다. 잠시 후 다시 보내 주세요.","modelTimeout":"AI 응답이 너무 늦어 중단했습니다. 다시 보내 주세요.","modelFailed":"AI 요청에 실패했습니다. 잠시 후 다시 보내 주세요.","emptyModelResponse":"AI 응답이 비어 있습니다. 다시 보내 주세요.","unexpected":"요청을 처리하다 오류가 났습니다. 다시 보내 주세요."};
const GEMINI_TIMEOUT_MS = 45000;
const GEMINI_RETRY_DELAY_MS = 1000;
const GEMINI_RETRY_STATUSES = [429,500,503];
const NO_STORE = { "Cache-Control": "no-store", "x-familytree-api": "1" };

function readApiKey(env) {
  const runtime = typeof env?.GEMINI_API_KEY === "string" ? env.GEMINI_API_KEY.trim() : "";
  if (runtime) return runtime;
  return typeof BAKED_API_KEY === "string" ? BAKED_API_KEY.trim() : "";
}

function jsonError(message, status) {
  return Response.json({ error: message }, { status, headers: NO_STORE });
}

async function readChatRequest(request) {
  try {
    const body = await request.json();
    if (!body || typeof body.message !== "string" || typeof body.graph !== "object" || body.graph === null) return null;
    return { message: body.message, graph: body.graph };
  } catch {
    return null;
  }
}

function readModelText(payload) {
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  return text?.trim() ? text : null;
}

function requestGemini(prompt, apiKey) {
  return fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_MODEL + ":generateContent?key=" + encodeURIComponent(apiKey),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    },
  );
}

async function askGemini(prompt, apiKey) {
  try {
    let response = await requestGemini(prompt, apiKey);
    if (GEMINI_RETRY_STATUSES.includes(response.status)) {
      await new Promise((resolve) => setTimeout(resolve, GEMINI_RETRY_DELAY_MS));
      response = await requestGemini(prompt, apiKey);
    }
    if (GEMINI_RETRY_STATUSES.includes(response.status)) return { error: CHAT_ERRORS.modelBusy, status: 503 };
    if (!response.ok) return { error: CHAT_ERRORS.modelFailed, status: 502 };
    const text = readModelText(await response.json());
    return text ? { text } : { error: CHAT_ERRORS.emptyModelResponse, status: 502 };
  } catch (cause) {
    const timedOut = cause instanceof Error && cause.name === "TimeoutError";
    return timedOut ? { error: CHAT_ERRORS.modelTimeout, status: 504 } : { error: CHAT_ERRORS.modelFailed, status: 502 };
  }
}

async function handleChat(request, apiKey) {
  if (!apiKey) return jsonError(MISSING_API_KEY_MESSAGE, 500);
  const body = await readChatRequest(request);
  if (!body) return jsonError(CHAT_ERRORS.invalidRequest, 400);
  if (!body.message.trim()) return jsonError(CHAT_ERRORS.emptyMessage, 400);
  const prompt = SYSTEM_PROMPT + "\n\n현재 가계도 JSON:\n" + JSON.stringify(body.graph) + "\n\n사용자 요청:\n" + body.message;
  const result = await askGemini(prompt, apiKey);
  if ("error" in result) return jsonError(result.error, result.status);
  return Response.json({ reply: result.text }, { headers: NO_STORE });
}

export async function onRequestPost(context) {
  try {
    return await handleChat(context.request, readApiKey(context.env));
  } catch {
    return jsonError(CHAT_ERRORS.unexpected, 500);
  }
}
