const BAKED_API_KEY = "";
const SYSTEM_PROMPT = "너는 상담실에서 가계도(Genogram)를 기록하는 전문가다.\nMcGoldrick, Gerson, & Petry(2005) 표준기호와 교재 그림 12-1을 따른다.\n\n반드시 현재 FamilyGraph와 동일한 JSON 스키마의 객체만 반환한다.\nSVG, 좌표, React 코드, 마크다운을 출력하지 않는다.\n\n스키마:\n{\n  \"assistantMessage\": \"한국어로 짧게 무엇을 반영했는지\",\n  \"graph\": {\n    \"households\": [{ \"id\": \"string\", \"memberIds\": [\"string\"] }],\n    \"nodes\": [{\n      \"id\": \"string\",\n      \"type\": \"familyMember\",\n      \"data\": {\n        \"displayNumber\": number,\n        \"gender\": \"M\" | \"F\" | \"U\",\n        \"vitalStatus\": \"alive\" | \"deceased\" | \"pregnancy\" | \"miscarriage\" | \"stillbirth\" | \"abortion\",\n        \"isIndexPerson\": boolean,\n        \"birthYear\": number | omit,\n        \"deathYear\": number | omit,\n        \"age\": number | omit,\n        \"occupation\": \"string\" | omit,\n        \"tags\": [\"string\"]\n      }\n    }],\n    \"edges\": [{\n      \"id\": \"string\",\n      \"source\": \"string\",\n      \"target\": \"string\",\n      \"category\": \"structural\" | \"emotional\",\n      \"kind\": \"marriage\" | \"separation\" | \"divorce\" | \"remarriage\" | \"cohabitation\" | \"affair\" | \"sameSexUnion\" | \"parent\" | \"adopted\" | \"foster\" | \"twin\" | \"identicalTwin\" | \"close\" | \"distant\" | \"fused\" | \"conflict\" | \"cutoff\" | \"fusedConflict\" | \"focused\" | \"physicalAbuse\" | \"sexualAbuse\",\n      \"year\": number | omit,\n      \"label\": \"string\" | omit\n    }]\n  }\n}\n\n해석 규칙:\n1. 기존 node/edge/household id는 가능한 유지하고, 새로 생긴 대상만 새 id를 만든다.\n2. 상대 호칭(아버지, 배우자, 형, 아들 등)은 structural 엣지로 정규화한다. 배우자는 marriage(또는 해당 혼인 상태 kind). 부모-자녀는 parent, 입양은 adopted, 위탁은 foster. 호칭 문자열을 edge.kind로 쓰지 않는다.\n3. 혼인/별거/이혼/재혼/동거/혼외/동성결합은 해당 structural kind. 별거는 separation(사선 하나), 이혼은 divorce(사선 둘).\n4. 친밀=close(이중선), 소원=distant, 융합/밀착=fused(삼선), 갈등=conflict, 단절=cutoff, 융합갈등=fusedConflict, 과잉개입=focused, 신체학대=physicalAbuse, 성학대=sexualAbuse.\n5. 사망은 vitalStatus=deceased와 deathYear. 임신/유산/사산/낙태도 해당 vitalStatus.\n6. 내담자, IP, 나 로 지목된 한 명만 isIndexPerson=true. 가계도 그림에는 아버지/어머니 같은 호칭을 쓰지 않고 displayNumber(인물1, 인물2)만 쓴다.\n7. 직업, 학력, 종교, 만성질환, 알코올/흡연, 폭력, 강점은 occupation 또는 tags.\n8. 한 집에 사는 가족(내담자 가구, 동거 가족, 핵가족 경계)은 households에 구성원 id를 넣는다. 그림에는 그 사람들을 감싸는 점선 직사각형으로 표시된다. 사용자가 가구/동거/한집/같이 산다/가족 경계를 말하면 households를 반드시 갱신한다. 말하지 않은 가구는 추측해서 만들지 않는다.\n9. 추측으로 사람을 삭제하지 않는다. 불명확하면 tags에 메모만 남긴다.\n10. 쌍둥이/일란성 쌍둥이는 twin / identicalTwin 엣지로 두 자녀를 연결한다.";
const GEMINI_MODEL = "gemini-3.8-flash";
const MISSING_API_KEY_MESSAGE = "GEMINI_API_KEY가 없습니다. 로컬은 .env.local, Cloudflare는 프로젝트 환경 변수에 넣어 주세요.";
const EMPTY_MESSAGE_ERROR = "메시지를 입력해 주세요.";
const EMPTY_MODEL_RESPONSE_ERROR = "모델 응답이 비었습니다.";
const INVALID_GRAPH_ERROR = "그래프 형식이 올바르지 않습니다.";
const JSON_PARSE_ERROR = "JSON 파싱에 실패했습니다.";

function readApiKey(env) {
  const runtime = typeof env?.GEMINI_API_KEY === "string" ? env.GEMINI_API_KEY.trim() : "";
  if (runtime) return runtime;
  return typeof BAKED_API_KEY === "string" ? BAKED_API_KEY.trim() : "";
}

function jsonError(message, status) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function parseChatModelPayload(text) {
  try {
    const parsed = JSON.parse(text);
    if (!parsed.graph?.nodes || !parsed.graph.edges) {
      return { ok: false, error: INVALID_GRAPH_ERROR, status: 502 };
    }
    return {
      ok: true,
      assistantMessage: parsed.assistantMessage ?? "가계도를 업데이트했습니다.",
      graph: {
        nodes: parsed.graph.nodes,
        edges: parsed.graph.edges,
        households: parsed.graph.households ?? [],
      },
    };
  } catch {
    return { ok: false, error: JSON_PARSE_ERROR, status: 502 };
  }
}

function readModelText(payload) {
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  return text?.trim() ? text : null;
}

function keyStatus(env) {
  const runtime = typeof env?.GEMINI_API_KEY === "string" && Boolean(env.GEMINI_API_KEY.trim());
  const baked = Boolean(BAKED_API_KEY);
  return Response.json({ hasRuntimeKey: runtime, hasBakedKey: baked }, { headers: { "Cache-Control": "no-store" } });
}

async function handleChat(request, apiKey) {
  if (!apiKey) return jsonError(MISSING_API_KEY_MESSAGE, 500);
  const body = await request.json();
  if (!body.message?.trim()) return jsonError(EMPTY_MESSAGE_ERROR, 400);

  const prompt = SYSTEM_PROMPT + "\n\n현재 가계도 JSON:\n" + JSON.stringify(body.graph) + "\n\n사용자 요청:\n" + body.message;
  const geminiResponse = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_MODEL + ":generateContent?key=" + encodeURIComponent(apiKey),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    },
  );
  if (!geminiResponse.ok) return jsonError(EMPTY_MODEL_RESPONSE_ERROR, 502);
  const text = readModelText(await geminiResponse.json());
  if (!text) return jsonError(EMPTY_MODEL_RESPONSE_ERROR, 502);
  const parsed = parseChatModelPayload(text);
  if (!parsed.ok) return jsonError(parsed.error, parsed.status);
  return Response.json({
    assistantMessage: parsed.assistantMessage,
    graph: parsed.graph,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function onRequestGet(context) {
  return keyStatus(context.env);
}

export async function onRequestPost(context) {
  return handleChat(context.request, readApiKey(context.env));
}
