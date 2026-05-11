import { useState, useEffect, useCallback, useMemo, useRef } from "react";

const SECTOR_MAP = [
  { id: "decentralized-finance-defi", name: "DeFi", icon: "🏦", color: "#00D4AA" },
  { id: "layer-1", name: "Layer 1", icon: "⛓️", color: "#FF6B35" },
  { id: "layer-2", name: "Layer 2", icon: "🔗", color: "#7B61FF" },
  { id: "artificial-intelligence", name: "AI", icon: "🤖", color: "#00B4D8" },
  { id: "gaming", name: "GameFi", icon: "🎮", color: "#FF006E" },
  { id: "meme-token", name: "Meme", icon: "🐸", color: "#FFD60A" },
  { id: "real-world-assets-rwa", name: "RWA", icon: "🏢", color: "#06D6A0" },
  { id: "infrastructure", name: "Infrastructure", icon: "🛠️", color: "#E85D75" },
  { id: "decentralized-exchange", name: "DEX", icon: "🔄", color: "#8338EC" },
  { id: "lending-borrowing", name: "借貸協議", icon: "💰", color: "#FB5607" },
  { id: "liquid-staking-tokens", name: "Liquid Staking", icon: "💎", color: "#3A86FF" },
  { id: "stablecoins", name: "Stablecoins", icon: "🪙", color: "#80ED99" },
  { id: "ethereum-ecosystem", name: "Ethereum", icon: "Ⓔ", color: "#627EEA" },
  { id: "solana-ecosystem", name: "Solana", icon: "◎", color: "#9945FF" },
  { id: "yield-farming", name: "Yield Farming", icon: "🌾", color: "#F4A261" },
  { id: "zero-knowledge-zk", name: "零知識證明", icon: "🔐", color: "#06FFA5" },
  { id: "privacy-coins", name: "隱私幣", icon: "👤", color: "#FF1744" },
  { id: "oracle", name: "Oracle", icon: "🔮", color: "#FFB81C" },
];

const SECTOR_IDS = new Set(SECTOR_MAP.map(s => s.id));

const formatNum = (v, prefix = "$") => {
  if (v == null || isNaN(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1e12) return prefix + (v / 1e12).toFixed(2) + "T";
  if (abs >= 1e9) return prefix + (v / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return prefix + (v / 1e6).toFixed(1) + "M";
  if (abs >= 1e3) return prefix + (v / 1e3).toFixed(1) + "K";
  return prefix + v.toFixed(0);
};

const formatPct = (v) => {
  if (v == null || isNaN(v)) return "—";
  return (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
};

function computeFlows(categories) {
  const valid = categories.filter(c => c.market_cap && c.volume_24h && c.market_cap_change_24h != null);
  const flows = [];
  for (let i = 0; i < valid.length; i++) {
    for (let j = 0; j < valid.length; j++) {
      if (i === j) continue;
      const from = valid[i];
      const to = valid[j];
      if (from.market_cap_change_24h < 0 && to.market_cap_change_24h > 0) {
        const outflow = Math.abs(from.market_cap_change_24h);
        const inflow = to.market_cap_change_24h;
        const totalInflow = valid.filter(c => c.market_cap_change_24h > 0).reduce((s, c) => s + c.market_cap_change_24h, 0);
        if (totalInflow > 0) {
          const amount = outflow * (inflow / totalInflow);
          if (amount > 1e6) {
            flows.push({ from: from.id, to: to.id, amount });
          }
        }
      }
    }
  }
  return flows.sort((a, b) => b.amount - a.amount).slice(0, 15);
}

// Robust JSON extractor — handles markdown fences, surrounding prose, etc.
function extractJSON(text) {
  // Strip markdown code fences
  let s = text.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
  
  // Try parsing the whole thing first
  try { return JSON.parse(s); } catch {}
  
  // Try to find a JSON object {...}
  let depth = 0, start = -1;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "{") { if (depth === 0) start = i; depth++; }
    else if (s[i] === "}") { depth--; if (depth === 0 && start !== -1) {
      try { return JSON.parse(s.slice(start, i + 1)); } catch { start = -1; }
    }}
  }
  
  // Try to find a JSON array [...]
  depth = 0; start = -1;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "[") { if (depth === 0) start = i; depth++; }
    else if (s[i] === "]") { depth--; if (depth === 0 && start !== -1) {
      try { return JSON.parse(s.slice(start, i + 1)); } catch { start = -1; }
    }}
  }
  
  throw new Error("No valid JSON found in response");
}

// Call Anthropic API and extract all text blocks
async function fetchCryptoDataViaAPI() {
  try {
    // 1. 取得 CoinGecko 所有分類數據
    const response = await fetch('https://api.coingecko.com/api/v3/coins/categories');
    
    if (!response.ok) {
      throw new Error(`CoinGecko API 請求失敗: ${response.status}`);
    }
    
    const allCategories = await response.json();
    
    // 2. 取得你在 SECTOR_MAP 中定義的 ID 清單
    const targetIds = SECTOR_MAP.map(s => s.id);
    
    // 3. 核心修正：將 API 原始數據轉化為 UI 需要的格式
    const filteredData = allCategories
      .filter(cat => targetIds.includes(cat.id))
      .map(cat => {
        // CoinGecko API 說明：
        // market_cap: 目前總市值 (Number)
        // market_cap_change_24h: 24小時內的漲跌「百分比」(例如 1.2 表示 1.2%)
        // volume_24h: 24小時成交量 (Number)
        
        const mCap = Number(cat.market_cap) || 0;
        const changePct = Number(cat.market_cap_change_24h) || 0;
        const vol24h = Number(cat.volume_24h) || 0;

        // 重要計算：UI 需要的是「市值變動的具體金額」來算資金流向
        // 公式：市值 * (漲跌百分比 / 100)
        const changeAmount = mCap * (changePct / 100);

        return {
          id: cat.id,
          name: cat.name,
          market_cap: mCap,
          volume_24h: vol24h,
          // 這是給 formatPct 顯示「+1.20%」用的
          market_cap_change_percentage_24h: changePct,
          // 這是給 computeFlows 計算資金流向與顯示「最大流入金額」用的
          market_cap_change_24h: changeAmount
        };
      });

    // 4. 確保 SECTOR_MAP 中的 12 個項目都會出現在畫面上（即使 API 沒資料也給 0）
    return SECTOR_MAP.map(sector => {
      const found = filteredData.find(d => d.id === sector.id);
      return found || {
        id: sector.id,
        name: sector.name,
        market_cap: 0,
        market_cap_change_24h: 0,
        market_cap_change_percentage_24h: 0,
        volume_24h: 0
      };
    });

  } catch (error) {
    console.error("資料抓取發生錯誤:", error);
    // 發生錯誤時回傳空數據結構，防止前端渲染崩潰
    return SECTOR_MAP.map(s => ({ 
      id: s.id, 
      name: s.name, 
      market_cap: 0, 
      market_cap_change_24h: 0, 
      market_cap_change_percentage_24h: 0, 
      volume_24h: 0 
    }));
  }
}
// 2. 修正後的代幣清單抓取 (不再依賴 callClaudeAPI)
async function fetchTopCoinsViaAPI(categoryId, categoryName) {
  try {
    // 直接從 CoinGecko 抓取該分類前 5 名
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&category=${categoryId}&order=market_cap_desc&per_page=5&page=1&sparkline=false`
    );

    if (!response.ok) throw new Error(`無法取得 ${categoryName} 代幣`);

    const data = await response.json();
    return data.map(coin => ({
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      current_price: coin.current_price,
      price_change_percentage_24h: coin.price_change_percentage_24h,
      market_cap: coin.market_cap,
      image: coin.image // 保留圖標
    }));
  } catch (error) {
    console.error("Fetch coins error:", error);
    return [];
  }
}

const Sparkline = ({ data, color, width = 80, height = 28 }) => {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) =>
    `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`
  ).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const FlowArrow = ({ flow, sectors, maxAmount }) => {
  const fromS = sectors.find(s => s.id === flow.from);
  const toS = sectors.find(s => s.id === flow.to);
  if (!fromS || !toS) return null;
  const thickness = Math.max(2, (flow.amount / maxAmount) * 6);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
      background: `linear-gradient(90deg, ${fromS.color}12, ${toS.color}12)`,
      borderRadius: 10, border: "1px solid #1a1a2e",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 70 }}>
        <span style={{ fontSize: 15 }}>{fromS.icon}</span>
        <span style={{ fontSize: 10, color: "#999", fontWeight: 600 }}>{fromS.name}</span>
      </div>
      <div style={{ flex: 1, height: thickness + 8, display: "flex", alignItems: "center" }}>
        <div style={{
          height: thickness, width: "100%", borderRadius: thickness,
          background: `linear-gradient(90deg, ${fromS.color}, ${toS.color})`,
          position: "relative",
        }}>
          <div style={{
            position: "absolute", right: -2, top: "50%", transform: "translateY(-50%)",
            width: 0, height: 0, borderLeft: `8px solid ${toS.color}`,
            borderTop: "5px solid transparent", borderBottom: "5px solid transparent",
          }} />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 70, justifyContent: "flex-end" }}>
        <span style={{ fontSize: 15 }}>{toS.icon}</span>
        <span style={{ fontSize: 10, color: "#999", fontWeight: 600 }}>{toS.name}</span>
      </div>
      <span style={{
        fontSize: 11, fontWeight: 700, color: "#E0E0E0",
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        minWidth: 65, textAlign: "right",
      }}>
        {formatNum(flow.amount)}
      </span>
    </div>
  );
};

export default function CryptoFundFlow() {
  const [categories, setCategories] = useState([]);
  const [topCoins, setTopCoins] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [selectedSector, setSelectedSector] = useState(null);
  const [loadingCoins, setLoadingCoins] = useState(false);
  const [loadProgress, setLoadProgress] = useState("");
  const [showGuide, setShowGuide] = useState(false);

  const enrichedCategories = useMemo(() => {
    return categories.map(c => {
      const sector = SECTOR_MAP.find(s => s.id === c.id);
      return {
        ...c,
        icon: sector?.icon || "📦",
        color: sector?.color || "#666",
        sectorName: sector?.name || c.name,
        market_cap_change_24h: c.market_cap_change_24h || 0,
      };
    });
  }, [categories]);

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      setError(null);
      if (isRefresh) {
        setRefreshing(true);
        setLoadProgress("正在透過 API 取得板塊數據...");
      } else {
        setLoadProgress("正在透過 API 取得板塊數據...");
      }
      const data = await fetchCryptoDataViaAPI();
      setCategories(data);
      setLastUpdate(new Date());
      setLoading(false);
    } catch (e) {
      setError(e.message);
      setLoading(false);
    } finally {
      setRefreshing(false);
      setLoadProgress("");
    }
  }, []);

  const handleFetchCoins = useCallback(async (categoryId) => {
    if (topCoins[categoryId]) return;
    try {
      setLoadingCoins(true);
      const cat = SECTOR_MAP.find(s => s.id === categoryId);
      const data = await fetchTopCoinsViaAPI(categoryId, cat?.name || categoryId);
      setTopCoins(prev => ({ ...prev, [categoryId]: data }));
    } catch (e) {
      console.error("Failed to fetch coins:", e);
    } finally {
      setLoadingCoins(false);
    }
  }, [topCoins]);

  useEffect(() => { fetchData(false); }, [fetchData]);

  useEffect(() => {
    if (selectedSector && !topCoins[selectedSector]) {
      handleFetchCoins(selectedSector);
    }
  }, [selectedSector, topCoins, handleFetchCoins]);

  const flows = useMemo(() => computeFlows(enrichedCategories), [enrichedCategories]);
  const maxFlow = useMemo(() => Math.max(...flows.map(f => f.amount), 1), [flows]);
  const totalMarketCap = useMemo(() => enrichedCategories.reduce((s, c) => s + (c.market_cap || 0), 0), [enrichedCategories]);

  const sortedByNet = useMemo(() =>
    [...enrichedCategories].sort((a, b) => (b.market_cap_change_24h || 0) - (a.market_cap_change_24h || 0)),
    [enrichedCategories]
  );

  const topInflow = sortedByNet[0];
  const topOutflow = sortedByNet[sortedByNet.length - 1];

  const filteredFlows = selectedSector
    ? flows.filter(f => f.from === selectedSector || f.to === selectedSector)
    : flows;

  const selectedCoinsData = selectedSector ? topCoins[selectedSector] : null;

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", background: "#0A0A0F", color: "#E0E0E0",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;500;700&family=JetBrains+Mono:wght@400;600;700&display=swap');
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        `}</style>
        <div style={{
          width: 44, height: 44, border: "3px solid #1a1a2e",
          borderTop: "3px solid #00D4AA", borderRadius: "50%",
          animation: "spin 1s linear infinite", marginBottom: 20,
        }} />
        <div style={{ fontSize: 14, color: "#888", marginBottom: 8 }}>正在載入真實市場數據</div>
        <div style={{ fontSize: 11, color: "#444", animation: "pulse 2s infinite" }}>
          {loadProgress || "連接 CoinGecko API..."}
        </div>
        <div style={{ fontSize: 10, color: "#333", marginTop: 16 }}>
          首次載入可能需要 10-20 秒
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#0A0A0F",
      color: "#E0E0E0", fontFamily: "'DM Sans', 'Manrope', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,500;0,9..40,700;1,9..40,400&family=JetBrains+Mono:wght@400;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Header */}
      <div style={{
        padding: "22px 24px 18px", borderBottom: "1px solid #1a1a2e",
        background: "linear-gradient(180deg, #0e0e18 0%, #0A0A0F 100%)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 24 }}>💠</span>
              <h1 style={{
                fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em",
                background: "linear-gradient(135deg, #00D4AA, #7B61FF)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>Crypto Fund Flow</h1>
            </div>
            <p style={{ fontSize: 13, color: "#555", letterSpacing: "0.03em" }}>
              板塊資金流動追蹤 · CoinGecko 即時數據
            </p>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setShowGuide(!showGuide)} style={{
              fontSize: 12, color: showGuide ? "#7B61FF" : "#666",
              background: showGuide ? "#7B61FF18" : "#111",
              border: showGuide ? "1px solid #7B61FF44" : "1px solid #222",
              padding: "6px 12px", borderRadius: 8,
              cursor: "pointer", fontWeight: 600,
              transition: "all 0.2s",
            }}>📖 指南</button>
            <button onClick={() => fetchData(true)} disabled={refreshing} style={{
              fontSize: 12, color: refreshing ? "#555" : "#00D4AA",
              background: "#00D4AA11", border: "1px solid #00D4AA33",
              padding: "6px 14px", borderRadius: 8,
              cursor: refreshing ? "not-allowed" : "pointer", fontWeight: 600,
              opacity: refreshing ? 0.5 : 1, display: "flex", alignItems: "center", gap: 6,
            }}>
              {refreshing ? (
                <>
                  <div style={{
                    width: 12, height: 12, border: "2px solid #00D4AA33",
                    borderTop: "2px solid #00D4AA", borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }} />
                  刷新中...
                </>
              ) : "🔄 刷新"}
            </button>
          </div>
        </div>

        {/* Collapsible Guide */}
        {showGuide && (
          <div style={{
            padding: 16, background: "#111118", borderRadius: 12, border: "1px solid #1f1f35",
            marginBottom: 14, animation: "slideUp 0.3s ease",
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#ccc", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              📖 閱讀指南
            </div>

            <div style={{ fontSize: 13, color: "#888", lineHeight: 1.8 }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ color: "#00D4AA", fontWeight: 700, marginBottom: 4 }}>🔹 板塊總覽卡片</div>
                顯示 12 個主要板塊的市值（MC）、24h 交易量（Vol）和漲跌幅。
                <span style={{ color: "#00D4AA" }}>綠色</span> 表示市值上升（資金流入），
                <span style={{ color: "#FF4D6A" }}>紅色</span> 表示市值下降（資金流出）。
                點擊任一卡片可展開該板塊的 TOP 5 代幣詳情。
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ color: "#7B61FF", fontWeight: 700, marginBottom: 4 }}>🔹 淨資金流向圖</div>
                雙向柱狀圖展示各板塊的 24h 淨資金變化。中線左側為流出，右側為流入。
                柱體長度代表相對強度，可快速判斷資金輪動方向。
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ color: "#FF6B35", fontWeight: 700, marginBottom: 4 }}>🔹 板塊間資金流動</div>
                以漸層箭頭呈現推測的資金流向：從市值下降的板塊流向市值上升的板塊。
                箭頭粗細代表流動金額大小。點擊板塊卡片可篩選相關流動。
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ color: "#FFD60A", fontWeight: 700, marginBottom: 4 }}>🔹 數據來源與限制</div>
                數據來自 CoinGecko API 的板塊分類市場數據。資金流動為根據 24h 市值增減
                推算，並非實際的鏈上轉帳記錄。數據僅供參考，不構成投資建議。
              </div>

              <div>
                <div style={{ color: "#3A86FF", fontWeight: 700, marginBottom: 4 }}>🔹 操作方式</div>
                點擊「🔄 刷新」手動更新數據。點擊板塊卡片展開代幣詳情或篩選流動圖。
                再次點擊同一卡片可取消選擇。
              </div>
            </div>

            <button onClick={() => setShowGuide(false)} style={{
              marginTop: 14, fontSize: 12, color: "#555", background: "#0a0a12",
              border: "1px solid #222", padding: "6px 16px", borderRadius: 8,
              cursor: "pointer", width: "100%", fontWeight: 600,
            }}>收起指南</button>
          </div>
        )}

        {error && !refreshing && (
          <div style={{
            padding: "10px 14px", background: "#FF4D6A11", border: "1px solid #FF4D6A33",
            borderRadius: 8, fontSize: 13, color: "#FF4D6A", marginBottom: 10,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)} style={{
              background: "none", border: "none", color: "#FF4D6A88",
              cursor: "pointer", fontSize: 16, padding: "0 0 0 8px",
            }}>✕</button>
          </div>
        )}

        {refreshing && (
          <div style={{
            padding: "8px 14px", background: "#00D4AA11", border: "1px solid #00D4AA22",
            borderRadius: 8, fontSize: 13, color: "#00D4AA", marginBottom: 10,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <div style={{
              width: 14, height: 14, border: "2px solid #00D4AA33",
              borderTop: "2px solid #00D4AA", borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }} />
            {loadProgress || "正在刷新..."}
          </div>
        )}

        {lastUpdate && !refreshing && (
          <div style={{ fontSize: 11, color: "#444", display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00D4AA", animation: "pulse 2s infinite" }} />
            最後更新：{lastUpdate.toLocaleTimeString("zh-TW")}
          </div>
        )}
      </div>

      {/* Summary Strip */}
      {enrichedCategories.length > 0 && (
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1,
          background: "#1a1a2e", borderBottom: "1px solid #1a1a2e",
        }}>
          <div style={{ background: "#0d0d15", padding: "12px 16px" }}>
            <div style={{ fontSize: 9, color: "#555", fontWeight: 600, letterSpacing: "0.1em", marginBottom: 4 }}>板塊總市值</div>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "#FFF" }}>
              {formatNum(totalMarketCap)}
            </div>
          </div>
          <div style={{ background: "#0d0d15", padding: "12px 16px" }}>
            <div style={{ fontSize: 9, color: "#555", fontWeight: 600, letterSpacing: "0.1em", marginBottom: 4 }}>最大流入</div>
            {topInflow && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 14 }}>{topInflow.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#00D4AA", fontFamily: "'JetBrains Mono', monospace" }}>
                  +{formatNum(Math.abs(topInflow.market_cap_change_24h))}
                </span>
              </div>
            )}
          </div>
          <div style={{ background: "#0d0d15", padding: "12px 16px" }}>
            <div style={{ fontSize: 9, color: "#555", fontWeight: 600, letterSpacing: "0.1em", marginBottom: 4 }}>最大流出</div>
            {topOutflow && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 14 }}>{topOutflow.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#FF4D6A", fontFamily: "'JetBrains Mono', monospace" }}>
                  -{formatNum(Math.abs(topOutflow.market_cap_change_24h))}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sector Cards */}
      <div style={{ padding: "16px 16px 8px" }}>
        <div style={{ fontSize: 10, color: "#444", fontWeight: 600, letterSpacing: "0.12em", marginBottom: 10 }}>
          板塊總覽 — 點擊查看 TOP 5 代幣
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
          {enrichedCategories.map((cat, i) => {
            const net = cat.market_cap_change_24h || 0;
            const isSelected = selectedSector === cat.id;
            return (
              <div key={cat.id}
                onClick={() => setSelectedSector(isSelected ? null : cat.id)}
                style={{
                  padding: "10px 8px", borderRadius: 10, cursor: "pointer",
                  background: isSelected ? `linear-gradient(135deg, ${cat.color}22, ${cat.color}08)` : "#0f0f1a",
                  border: isSelected ? `1px solid ${cat.color}55` : "1px solid #1a1a2e",
                  transition: "all 0.3s ease",
                  animation: `slideUp 0.4s ease ${i * 40}ms both`,
                }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 16 }}>{cat.icon}</span>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: "2px 5px", borderRadius: 4,
                    background: net >= 0 ? "#00D4AA18" : "#FF4D6A18",
                    color: net >= 0 ? "#00D4AA" : "#FF4D6A",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    {formatPct(cat.market_cap_change_percentage_24h)}
                  </span>
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#ddd", marginBottom: 2 }}>{cat.sectorName}</div>
                <div style={{ fontSize: 9, color: "#555" }}>MC {formatNum(cat.market_cap)}</div>
                <div style={{ fontSize: 9, color: "#555", marginTop: 1 }}>Vol {formatNum(cat.volume_24h)}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Sector Top Coins */}
      {selectedSector && selectedCoinsData && (
        <div style={{ padding: "8px 16px 12px", animation: "slideUp 0.3s ease" }}>
          <div style={{ fontSize: 10, color: "#444", fontWeight: 600, letterSpacing: "0.12em", marginBottom: 8 }}>
            {enrichedCategories.find(c => c.id === selectedSector)?.icon}{" "}
            {enrichedCategories.find(c => c.id === selectedSector)?.sectorName} — TOP 5 代幣
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {selectedCoinsData.map((coin, i) => (
              <div key={coin.id || i} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                background: "#0f0f1a", borderRadius: 8, border: "1px solid #1a1a2e",
              }}>
                <span style={{ fontSize: 10, color: "#444", fontWeight: 600, width: 14 }}>{i + 1}</span>
                {coin.image && (
                  <img src={coin.image} alt="" style={{ width: 20, height: 20, borderRadius: "50%" }}
                    onError={e => { e.target.style.display = "none"; }} />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#ddd" }}>{coin.symbol?.toUpperCase()}</div>
                  <div style={{ fontSize: 9, color: "#555" }}>{coin.name}</div>
                </div>
                <div style={{ textAlign: "right", minWidth: 65 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#ccc", fontFamily: "'JetBrains Mono', monospace" }}>
                    {formatNum(coin.current_price)}
                  </div>
                  <div style={{
                    fontSize: 10, fontWeight: 600,
                    color: (coin.price_change_percentage_24h || 0) >= 0 ? "#00D4AA" : "#FF4D6A",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    {formatPct(coin.price_change_percentage_24h)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {selectedSector && !selectedCoinsData && (
        <div style={{ padding: "16px", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <div style={{
            width: 14, height: 14, border: "2px solid #333",
            borderTop: "2px solid #00D4AA", borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }} />
          <span style={{ fontSize: 12, color: "#555" }}>載入代幣數據中（約 10 秒）...</span>
        </div>
      )}

      {/* Net Flow Bar */}
      <div style={{ padding: "12px 16px" }}>
        <div style={{ fontSize: 10, color: "#444", fontWeight: 600, letterSpacing: "0.12em", marginBottom: 10 }}>
          24H 淨資金流向（基於市值變化）
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {sortedByNet.map(cat => {
            const net = cat.market_cap_change_24h || 0;
            const maxAbs = Math.max(...enrichedCategories.map(c => Math.abs(c.market_cap_change_24h || 0)), 1);
            const pct = (Math.abs(net) / maxAbs) * 100;
            const isPositive = net >= 0;
            return (
              <div key={cat.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, width: 22, textAlign: "center" }}>{cat.icon}</span>
                <span style={{ fontSize: 10, color: "#777", width: 52, fontWeight: 600 }}>{cat.sectorName}</span>
                <div style={{ flex: 1, height: 16, position: "relative", display: "flex", alignItems: "center" }}>
                  <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "#222" }} />
                  {isPositive ? (
                    <div style={{
                      position: "absolute", left: "50%", height: 12, borderRadius: "0 4px 4px 0",
                      width: `${pct / 2}%`, background: `linear-gradient(90deg, ${cat.color}88, ${cat.color})`,
                      transition: "width 0.8s ease",
                    }} />
                  ) : (
                    <div style={{
                      position: "absolute", right: "50%", height: 12, borderRadius: "4px 0 0 4px",
                      width: `${pct / 2}%`, background: `linear-gradient(270deg, #FF4D6A88, #FF4D6A)`,
                      transition: "width 0.8s ease",
                    }} />
                  )}
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, width: 70, textAlign: "right",
                  color: isPositive ? "#00D4AA" : "#FF4D6A",
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {isPositive ? "+" : "-"}{formatNum(Math.abs(net))}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Flow List */}
      {flows.length > 0 && (
        <div style={{ padding: "12px 16px 24px" }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10,
          }}>
            <div style={{ fontSize: 10, color: "#444", fontWeight: 600, letterSpacing: "0.12em" }}>
              {selectedSector
                ? `${enrichedCategories.find(c => c.id === selectedSector)?.icon} ${enrichedCategories.find(c => c.id === selectedSector)?.sectorName} 相關流動`
                : "推測板塊間資金流動"}
            </div>
            {selectedSector && (
              <button onClick={() => setSelectedSector(null)} style={{
                fontSize: 10, color: "#666", background: "#151520", border: "1px solid #222",
                padding: "3px 10px", borderRadius: 12, cursor: "pointer",
              }}>清除篩選</button>
            )}
          </div>
          <div style={{ fontSize: 9, color: "#333", marginBottom: 8, lineHeight: 1.5 }}>
            💡 流動方向根據板塊 24h 市值增減推算：市值下降的板塊 → 市值上升的板塊
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {filteredFlows.map((flow, i) => (
              <FlowArrow key={`${flow.from}-${flow.to}-${i}`} flow={flow} sectors={enrichedCategories} maxAmount={maxFlow} />
            ))}
            {filteredFlows.length === 0 && (
              <div style={{ fontSize: 12, color: "#444", textAlign: "center", padding: 20 }}>
                此篩選無明顯流動
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{
        padding: "16px", borderTop: "1px solid #1a1a2e",
        display: "flex", flexDirection: "column", gap: 4,
      }}>
        <div style={{ fontSize: 9, color: "#333", display: "flex", justifyContent: "space-between" }}>
          <span>數據來源：CoinGecko API via Anthropic</span>
          <span>{enrichedCategories.length} 個板塊</span>
        </div>
        <div style={{ fontSize: 8, color: "#282828", lineHeight: 1.5 }}>
          資金流動為根據市值變化推算，非實際鏈上轉帳數據。僅供參考，不構成投資建議。
        </div>
      </div>
    </div>
  );
}
