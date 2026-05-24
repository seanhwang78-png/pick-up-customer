import React, { useState, useEffect, useCallback } from "react";

const SHEET_ID = "1i5ssylMyIHv-lMr38y_jk4jP0j--DqI4bG2ge1MgIWQ";

function parseDate(str: string): Date | null {
  if (!str) return null;
  const match = str.match(/(\d+)\/(\d+)/);
  if (!match) return null;
  const now = new Date();
  return new Date(now.getFullYear(), parseInt(match[1]) - 1, parseInt(match[2]));
}

function dDayLabel(deadline: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "오늘 마감";
  if (diff === 1) return "내일 마감";
  return `D-${diff}`;
}

async function loadSheetData() {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=tsv&gid=0&t=${Date.now()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("시트 불러오기 실패");
  const text = await res.text();

  const lines = text.trim().split("\n").map(l =>
    l.split("\t").map(v => v.replace(/^"|"$/g, "").trim())
  );

  const nameRow = lines[1] || [];
  const phoneRow = lines[2] || [];
  const infoRow = lines[0] || [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const products: { 제품명: string; 수령일: string; 판매가: string; row: string[] }[] = [];
  const availableProducts: { 제품명: string; 판매가: string; 수령일: string; 발주마감: Date }[] = [];

  for (let r = 4; r < lines.length; r++) {
    const 제품명 = lines[r]?.[7] || "";
    if (!제품명) continue;

    const 발주마감 = lines[r]?.[3] || "";
    const 예약시작 = lines[r]?.[4] || "";
    const 수령일 = lines[r]?.[5] || "";
    const 판매가 = lines[r]?.[6] || "";

    const 발주마감Date = parseDate(발주마감);
    const 예약시작Date = parseDate(예약시작);

    products.push({ 제품명, 수령일, 판매가, row: lines[r] });

    const 시작OK = !예약시작Date || 예약시작Date <= today;
    const 마감OK = 발주마감Date && 발주마감Date >= today;

    if (시작OK && 마감OK) {
      if (!availableProducts.find(p => p.제품명 === 제품명)) {
        availableProducts.push({ 제품명, 판매가, 수령일, 발주마감: 발주마감Date! });
      }
    }
  }

  availableProducts.sort((a, b) => a.발주마감.getTime() - b.발주마감.getTime());

  const members: { 이름: string; 전화번호뒷자리: string; 추가정보: string; 주문: any[] }[] = [];
  for (let i = 11; i < nameRow.length; i += 2) {
    if (!nameRow[i]) continue;
    const orders: any[] = [];
    for (const p of products) {
      const qty = p.row[i];
      const pickup = p.row[i + 1];
      if (!qty || qty === "0" || qty === "") continue;
      const 수령일Date = parseDate(p.수령일);
      let 상태 = "미수령";
      if (pickup === "O") 상태 = "수령완료";
      else if (수령일Date && 수령일Date > today) 상태 = "미입고";
      orders.push({ 제품명: p.제품명, 수량: qty, 판매가: p.판매가, 수령일: p.수령일, 상태 });
    }
    members.push({
      이름: nameRow[i],
      전화번호뒷자리: phoneRow[i] || "",
      추가정보: infoRow[i] || "",
      주문: orders,
    });
  }

  return { members, availableProducts };
}

export default function App() {
  const [members, setMembers] = useState<any[]>([]);
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css";
    link.rel = "stylesheet";
    document.head.appendChild(link);

    loadSheetData()
      .then(({ members, availableProducts }) => {
        setMembers(members);
        setAvailableProducts(availableProducts);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const search = useCallback(() => {
    if (!query.trim()) return;
    const q = query.trim();
    setResult(members.filter(m => m.이름.includes(q) || m.전화번호뒷자리.includes(q)));
  }, [query, members]);

  const reset = () => { setResult(null); setQuery(""); };

  const font = "'Pretendard', sans-serif";

  const statusConfig: Record<string, { label: string; bg: string; color: string; border: string; dot: string }> = {
    수령완료: { label: "수령완료", bg: "#fef2f2", color: "#dc2626", border: "#fecaca", dot: "#dc2626" },
    미수령:   { label: "수령가능", bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0", dot: "#16a34a" },
    미입고:   { label: "미입고",   bg: "#f8fafc", color: "#94a3b8", border: "#e2e8f0", dot: "#cbd5e1" },
  };

  const urgencyColor = (deadline: Date) => {
    const today = new Date(); today.setHours(0,0,0,0);
    const diff = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return { bg: "#fff1f2", border: "#fda4af", badge: "#e11d48" };
    if (diff === 1) return { bg: "#fff7ed", border: "#fdba74", badge: "#ea580c" };
    return { bg: "#f0fdf4", border: "#86efac", badge: "#16a34a" };
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f8f6f1",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      fontFamily: font,
      padding: "0 16px 80px",
    }}>

      {/* 헤더 */}
      <div style={{ width: "100%", maxWidth: 460, textAlign: "center", padding: "52px 0 28px" }}>
        <div style={{
          display: "inline-block", background: "#fff",
          border: "1.5px solid #e8e2d9", borderRadius: 16,
          padding: "6px 18px", fontSize: 12, color: "#a09080",
          letterSpacing: "0.12em", textTransform: "uppercase" as const,
          marginBottom: 20, fontFamily: font,
        }}>
          공동구매 픽업
        </div>
        <h1 style={{
          fontSize: 34, fontWeight: 700, color: "#1a1209",
          margin: 0, lineHeight: 1.2, letterSpacing: "-0.02em",
          fontFamily: font,
        }}>
          내 물건이<br />도착했나요?
        </h1>
        <p style={{
          color: "#a09080", fontSize: 14, marginTop: 12,
          fontFamily: font, lineHeight: 1.6,
        }}>
          이름 또는 전화번호 뒷 4자리로<br />수령 여부를 확인하세요
        </p>
      </div>

      {/* 로딩 / 에러 */}
      {loading && (
        <div style={{ color: "#a09080", fontSize: 14, fontFamily: font, marginTop: 20 }}>
          잠깐만요, 불러오는 중이에요...
        </div>
      )}
      {error && (
        <div style={{
          width: "100%", maxWidth: 460, background: "#fff5f5",
          border: "1px solid #fecaca", borderRadius: 14, padding: 16,
          textAlign: "center", color: "#dc2626", fontSize: 13, fontFamily: font,
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* 주문 가능 상품 배너 */}
      {!loading && !error && result === null && availableProducts.length > 0 && (
        <div style={{ width: "100%", maxWidth: 460, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{
              background: "#1a1209", color: "#f8f6f1", borderRadius: 100,
              padding: "3px 12px", fontSize: 11, fontWeight: 700,
              fontFamily: font, letterSpacing: "0.06em",
            }}>
              지금 주문 가능
            </span>
            <span style={{ color: "#c4b9a8", fontSize: 12, fontFamily: font }}>
              {availableProducts.length}개 상품
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {availableProducts.map((p, i) => {
              const uc = urgencyColor(p.발주마감);
              return (
                <div key={i} style={{
                  background: uc.bg, border: `1.5px solid ${uc.border}`,
                  borderRadius: 16, padding: "14px 16px",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1209", marginBottom: 4, fontFamily: font }}>
                      {p.제품명}
                    </div>
                    <div style={{ fontSize: 12, color: "#a09080", fontFamily: font }}>
                      {p.판매가}{p.수령일 ? ` · 수령일 ${p.수령일}` : ""}
                    </div>
                  </div>
                  <div style={{
                    background: uc.badge, color: "#fff", borderRadius: 100,
                    padding: "5px 12px", fontSize: 12, fontWeight: 800,
                    fontFamily: font, whiteSpace: "nowrap" as const, marginLeft: 12,
                  }}>
                    {dDayLabel(p.발주마감)}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "24px 0 4px" }}>
            <div style={{ flex: 1, height: 1, background: "#e8e2d9" }} />
            <span style={{ color: "#c4b9a8", fontSize: 12, fontFamily: font }}>픽업 조회</span>
            <div style={{ flex: 1, height: 1, background: "#e8e2d9" }} />
          </div>
        </div>
      )}

      {/* 검색창 */}
      {!loading && !error && result === null && (
        <div style={{ width: "100%", maxWidth: 460 }}>
          <div style={{
            background: "#fff", border: "1.5px solid #e8e2d9",
            borderRadius: 20, padding: 24, boxShadow: "0 2px 20px rgba(0,0,0,0.04)",
          }}>
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && search()}
              placeholder="예) 홍길동 또는 1234"
              style={{
                width: "100%", boxSizing: "border-box" as const,
                border: "none", borderBottom: "2px solid #e8e2d9",
                borderRadius: 0, padding: "14px 4px", fontSize: 22,
                color: "#1a1209", background: "transparent", outline: "none",
                textAlign: "center" as const, fontFamily: font,
              }}
            />
            <button onClick={search} style={{
              width: "100%", marginTop: 20, background: "#1a1209",
              border: "none", borderRadius: 14, padding: "17px",
              color: "#f8f6f1", fontSize: 16, fontWeight: 700,
              cursor: "pointer", fontFamily: font, letterSpacing: "0.04em",
            }}>
              확인하기
            </button>
          </div>
        </div>
      )}

      {/* 검색 결과 */}
      {result !== null && (
        <div style={{ width: "100%", maxWidth: 460 }}>
          {result.length === 0 ? (
            <div style={{
              background: "#fff", border: "1.5px solid #e8e2d9", borderRadius: 20,
              padding: "48px 24px", textAlign: "center", boxShadow: "0 2px 20px rgba(0,0,0,0.04)",
            }}>
              <div style={{ fontSize: 44, marginBottom: 16 }}>🔍</div>
              <p style={{ color: "#1a1209", fontSize: 17, fontWeight: 700, margin: 0, fontFamily: font }}>찾을 수 없어요</p>
              <p style={{ color: "#a09080", fontSize: 13, marginTop: 8, fontFamily: font }}>
                이름이나 전화번호 뒷자리를 다시 확인해 주세요
              </p>
            </div>
          ) : (
            result.map((member, i) => (
              <div key={i} style={{
                background: "#fff", border: "1.5px solid #e8e2d9", borderRadius: 20,
                padding: 24, marginBottom: 14, boxShadow: "0 2px 20px rgba(0,0,0,0.04)",
              }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  paddingBottom: 16, borderBottom: "1.5px solid #f0ebe3", marginBottom: 16,
                }}>
                  <div>
                    <span style={{ fontSize: 24, fontWeight: 700, color: "#1a1209", fontFamily: font }}>{member.이름}</span>
                    <span style={{ fontSize: 13, color: "#c4b9a8", marginLeft: 10, fontFamily: font }}>
                      뒷자리 {member.전화번호뒷자리}
                    </span>
                  </div>
                  {member.추가정보 && (
                    <span style={{
                      fontSize: 11, color: "#a09080", background: "#f5f1eb",
                      borderRadius: 100, padding: "3px 10px", fontFamily: font,
                    }}>
                      {member.추가정보}
                    </span>
                  )}
                </div>
                {member.주문.length === 0 ? (
                  <p style={{ color: "#c4b9a8", fontSize: 14, textAlign: "center", fontFamily: font }}>
                    주문 내역이 없어요
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {member.주문.map((order: any, j: number) => {
                      const cfg = statusConfig[order.상태];
                      return (
                        <div key={j} style={{
                          background: cfg.bg, border: `1.5px solid ${cfg.border}`,
                          borderRadius: 14, padding: "14px 16px",
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1209", marginBottom: 4, fontFamily: font }}>
                              {order.제품명}
                            </div>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                              <span style={{ fontSize: 26, fontWeight: 900, color: "#1a1209", lineHeight: 1, fontFamily: font }}>
                                {order.수량}
                              </span>
                              <span style={{ fontSize: 14, color: "#a09080", fontFamily: font }}>개</span>
                            </div>
                            <div style={{ fontSize: 12, color: "#c4b9a8", marginTop: 4, fontFamily: font }}>
                              {order.판매가} · 수령일 {order.수령일}
                            </div>
                          </div>
                          <div style={{
                            display: "flex", flexDirection: "column", alignItems: "center",
                            gap: 4, marginLeft: 12,
                          }}>
                            <div style={{ width: 10, height: 10, borderRadius: "50%", background: cfg.dot }} />
                            <span style={{
                              fontSize: 12, fontWeight: 700, color: cfg.color,
                              fontFamily: font, whiteSpace: "nowrap" as const,
                            }}>
                              {cfg.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
          <button onClick={reset} style={{
            width: "100%", marginTop: 4, background: "transparent",
            border: "1.5px solid #e8e2d9", borderRadius: 14, padding: "16px",
            color: "#a09080", fontSize: 15, cursor: "pointer", fontFamily: font,
          }}>
            ← 다시 검색하기
          </button>
        </div>
      )}
    </div>
  );
}