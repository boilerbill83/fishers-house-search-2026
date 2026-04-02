import React, { useState, useMemo } from "react";
import {
  Home, Bed, Bath, Square, Car, X, Calculator, ExternalLink,
  Target, Sliders, Download, RefreshCw, CheckCircle, AlertTriangle,
  HelpCircle, Clock,
} from "lucide-react";
import { ALL_PROPERTIES } from "./propertyData";

const HouseTrackerApp = () => {
  const [houses] = useState(ALL_PROPERTIES);
  const [showScoringPreferences, setShowScoringPreferences] = useState(false);
  const [showFinancials, setShowFinancials] = useState(false);
  const [showSummaryTable, setShowSummaryTable] = useState(false);
  const [showStatusChecker, setShowStatusChecker] = useState(false);

  const [financials, setFinancials] = useState(() => {
    const saved = localStorage.getItem("houseHuntFinancials");
    return saved ? JSON.parse(saved) : {
      homePrice: 500000, houseSellPrice: 118000, closingCostsPercent: 8,
      additionalCash: 0, interestRate: 5.88, loanTerm: 30,
      propertyTax: 5450, homeInsurance: 2400, hoaFees: 0,
    };
  });

  const [scoringWeights, setScoringWeights] = useState(() => {
    const saved = localStorage.getItem("scoringWeights");
    return saved ? JSON.parse(saved) : {
      price: 5, commuteHusband: 7, beds: 7, baths: 3, sqft: 8,
      garage: 7, basement: 8, yearBuilt: 0, daysOnMarket: 2,
      walkScore: 6, bikeScore: 1, hasNeighborhoodPool: 7,
      hoaFees: 1, lotSize: 6, pricePerSqft: 7,
    };
  });

  const [scoringEnabled, setScoringEnabled] = useState(() => {
    const saved = localStorage.getItem("scoringEnabled");
    return saved ? JSON.parse(saved) : {
      price: false, commuteHusband: true, beds: true, baths: true,
      sqft: true, garage: true, basement: true, yearBuilt: true,
      daysOnMarket: true, walkScore: true, bikeScore: true,
      hasNeighborhoodPool: true, hoaFees: false, lotSize: true, pricePerSqft: true,
    };
  });

  const [statusFilter, setStatusFilter] = useState("all");
  const [summarySort, setSummarySort] = useState({ key: "score", direction: "desc" });

  React.useEffect(() => { localStorage.setItem("houseHuntFinancials", JSON.stringify(financials)); }, [financials]);
  React.useEffect(() => { localStorage.setItem("scoringWeights", JSON.stringify(scoringWeights)); }, [scoringWeights]);
  React.useEffect(() => { localStorage.setItem("scoringEnabled", JSON.stringify(scoringEnabled)); }, [scoringEnabled]);

  const calculateScore = (house) => {
    let totalScore = 0;
    let maxPossibleScore = 0;
    const normalize = (value, min, max, inverse = false) => {
      if (max === min) return 100;
      const n = ((value - min) / (max - min)) * 100;
      return inverse ? 100 - n : n;
    };
    const prices   = houses.map((h) => h.price);
    const commutes = houses.map((h) => h.commuteHusband);
    const beds     = houses.map((h) => h.beds);
    const baths    = houses.map((h) => h.baths);
    const sqfts    = houses.map((h) => h.sqft);
    const years    = houses.map((h) => h.yearBuilt);
    const hoas     = houses.map((h) => (h.hoaAnnual || 0) / 12);
    const lots     = houses.map((h) => h.lotSize);
    const ppsqfts  = houses.map((h) => h.pricePerSqft);
    const addScore = (key, value, weight) => {
      if (scoringEnabled[key]) {
        totalScore += value * (weight / 10);
        maxPossibleScore += 100 * (weight / 10);
      }
    };
    if (scoringEnabled.price)              addScore("price",               normalize(house.price,              Math.min(...prices),   Math.max(...prices),   true), scoringWeights.price);
    if (scoringEnabled.commuteHusband)     addScore("commuteHusband",      normalize(house.commuteHusband,     Math.min(...commutes), Math.max(...commutes), true), scoringWeights.commuteHusband);
    if (scoringEnabled.beds && house.beds) addScore("beds",                normalize(house.beds,               Math.min(...beds),     Math.max(...beds)),          scoringWeights.beds);
    if (scoringEnabled.baths && house.baths) addScore("baths",             normalize(house.baths,              Math.min(...baths),    Math.max(...baths)),          scoringWeights.baths);
    if (scoringEnabled.sqft && house.sqft) addScore("sqft",                normalize(house.sqft,               Math.min(...sqfts),    Math.max(...sqfts)),          scoringWeights.sqft);
    if (scoringEnabled.garage && house.garage) addScore("garage",          (house.garage / 3) * 100,                                                               scoringWeights.garage);
    if (scoringEnabled.basement)           addScore("basement",            house.basement === "Finished" ? 100 : house.basement === "Unfinished" ? 50 : 0,         scoringWeights.basement);
    if (scoringEnabled.yearBuilt)          addScore("yearBuilt",           normalize(house.yearBuilt,          Math.min(...years),    Math.max(...years)),          scoringWeights.yearBuilt);
    if (scoringEnabled.walkScore)          addScore("walkScore",           house.walkScore,                                                                         scoringWeights.walkScore);
    if (scoringEnabled.bikeScore)          addScore("bikeScore",           house.bikeScore || 0,                                                                   scoringWeights.bikeScore);
    if (scoringEnabled.hasNeighborhoodPool) addScore("hasNeighborhoodPool", house.hasNeighborhoodPool ? 100 : 0,                                                   scoringWeights.hasNeighborhoodPool);
    if (scoringEnabled.hoaFees)            addScore("hoaFees",             normalize((house.hoaAnnual || 0) / 12, Math.min(...hoas), Math.max(...hoas), true),     scoringWeights.hoaFees);
    if (scoringEnabled.lotSize)            addScore("lotSize",             normalize(house.lotSize,            Math.min(...lots),     Math.max(...lots)),           scoringWeights.lotSize);
    if (scoringEnabled.pricePerSqft)       addScore("pricePerSqft",        normalize(house.pricePerSqft,       Math.min(...ppsqfts),  Math.max(...ppsqfts), true), scoringWeights.pricePerSqft);
    if (scoringEnabled.daysOnMarket) {
      const daysMatch = house.daysOnMarket.match(/(\d+)/);
      const days = daysMatch ? parseInt(daysMatch[1]) : 0;
      addScore("daysOnMarket", Math.min((days / 180) * 100, 100), scoringWeights.daysOnMarket);
    }
    return { rawScore: (totalScore / maxPossibleScore) * 100 };
  };

  const calculateNormalizedScore = (house) => {
    const { rawScore } = calculateScore(house);
    const allRaw = houses.map((h) => calculateScore(h).rawScore);
    return { total: Math.round(rawScore + (100 - Math.max(...allRaw))) };
  };

  const sortedHouses = useMemo(() => {
    let filtered = [...houses];
    if (statusFilter === "active") filtered = filtered.filter((h) => h.status === "Active");
    return filtered.sort((a, b) => {
      const order = { Active: 0, Pending: 1, Sold: 2 };
      const diff = (order[a.status] || 0) - (order[b.status] || 0);
      if (diff !== 0) return diff;
      return calculateNormalizedScore(b).total - calculateNormalizedScore(a).total;
    });
  }, [houses, scoringWeights, scoringEnabled, statusFilter]);

  const summarySortedHouses = useMemo(() => {
    const { key, direction } = summarySort;
    if (!key) return sortedHouses;
    return [...sortedHouses].sort((a, b) => {
      let aVal, bVal;
      if (key === "address")       { aVal = a.address; bVal = b.address; }
      else if (key === "price")    { aVal = a.price; bVal = b.price; }
      else if (key === "status")   { aVal = a.status; bVal = b.status; }
      else if (key === "beds")     { aVal = a.beds; bVal = b.beds; }
      else if (key === "baths")    { aVal = a.baths; bVal = b.baths; }
      else if (key === "sqft")     { aVal = a.sqft; bVal = b.sqft; }
      else if (key === "pricePerSqft") { aVal = Math.round(a.price / a.sqft); bVal = Math.round(b.price / b.sqft); }
      else if (key === "score")    { aVal = calculateNormalizedScore(a).total; bVal = calculateNormalizedScore(b).total; }
      if (typeof aVal === "string") return direction === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return direction === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [sortedHouses, summarySort, scoringWeights, scoringEnabled]);

  const handleSummarySort = (key) => {
    setSummarySort((prev) => prev.key === key
      ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
      : { key, direction: "desc" }
    );
  };

  const stats = useMemo(() => ({
    active:  houses.filter((h) => h.status === "Active").length,
    pending: houses.filter((h) => h.status === "Pending").length,
    sold:    houses.filter((h) => h.status === "Sold").length,
    total:   houses.length,
  }), [houses]);

  // ── STATUS CHECKER ──────────────────────────────────────────────────────────

  const StatusCheckerModal = () => {
    const [results, setResults] = useState([]);
    const [running, setRunning] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [done, setDone] = useState(false);

    const checkAllStatuses = async () => {
      setResults([]);
      setRunning(true);
      setDone(false);

      for (let i = 0; i < houses.length; i++) {
        const house = houses[i];
        setCurrentIndex(i);

        // Add card in "checking" state immediately
        setResults((prev) => [...prev, {
          id: house.id,
          address: house.address,
          recordedStatus: house.status,
          recordedPrice: house.price,
          detectedStatus: null,
          currentPrice: null,
          confidence: null,
          reasoning: null,
          state: "checking",
        }]);

        try {
          // Calls Netlify serverless function — same domain, no CORS issue
          const resp = await fetch("/.netlify/functions/check-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              house: {
                id: house.id,
                address: house.address,
                city: house.city || "Fishers",
                status: house.status,
                price: house.price,
                neighborhood: house.neighborhood,
                url: house.zillowLink,
              },
            }),
          });

          const data = await resp.json();
          if (!resp.ok) throw new Error(data.details || data.error || `HTTP ${resp.status}`);

          const { detectedStatus, currentPrice, confidence, reasoning } = data;
          const statusChanged = detectedStatus !== "Unknown" && detectedStatus !== house.status;
          const priceChanged = currentPrice && currentPrice !== house.price;
          const changed = statusChanged || priceChanged;

          setResults((prev) => prev.map((r) => r.id === house.id
            ? { ...r, detectedStatus, currentPrice, confidence, reasoning, state: changed ? "changed" : "confirmed" }
            : r
          ));
        } catch (err) {
          setResults((prev) => prev.map((r) => r.id === house.id
            ? { ...r, detectedStatus: "Error", confidence: "Low", reasoning: err.message, state: "error" }
            : r
          ));
        }

        await new Promise((res) => setTimeout(res, 15000));
      }

      setCurrentIndex(-1);
      setRunning(false);
      setDone(true);
    };

    const getStateIcon = (state) => {
      if (state === "checking")  return <Clock size={18} className="text-blue-500 animate-spin" />;
      if (state === "confirmed") return <CheckCircle size={18} className="text-green-500" />;
      if (state === "changed")   return <AlertTriangle size={18} className="text-amber-500" />;
      return <HelpCircle size={18} className="text-red-400" />;
    };

    const getStateBg = (state) => {
      if (state === "checking")  return "bg-blue-50 border-blue-200";
      if (state === "confirmed") return "bg-green-50 border-green-200";
      if (state === "changed")   return "bg-amber-50 border-amber-300";
      return "bg-red-50 border-red-200";
    };

    const statusColor = (s) => {
      if (s === "Active")  return "text-green-700 bg-green-100";
      if (s === "Pending") return "text-red-700 bg-red-100";
      if (s === "Sold")    return "text-gray-600 bg-gray-200";
      return "text-gray-500 bg-gray-100";
    };

    const changed   = results.filter((r) => r.state === "changed");
    const confirmed = results.filter((r) => r.state === "confirmed");
    const errors    = results.filter((r) => r.state === "error");

    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

          <div className="p-5 border-b flex justify-between items-center bg-gradient-to-r from-indigo-600 to-blue-600 rounded-t-xl">
            <div className="flex items-center gap-3 text-white">
              <RefreshCw size={22} className={running ? "animate-spin" : ""} />
              <div>
                <h3 className="text-xl font-bold">Status Checker</h3>
                <p className="text-blue-100 text-sm">Verifies each listing against live web data</p>
              </div>
            </div>
            <button onClick={() => setShowStatusChecker(false)} className="text-white hover:text-blue-200">
              <X size={24} />
            </button>
          </div>

          {done && (
            <div className="px-5 py-3 border-b bg-gray-50 flex gap-6 text-sm font-medium">
              <span className="text-green-700">✓ {confirmed.length} confirmed</span>
              <span className="text-amber-600">⚠ {changed.length} status changed</span>
              {errors.length > 0 && <span className="text-red-500">✗ {errors.length} errors</span>}
            </div>
          )}

          {!running && results.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-10 text-center">
              <div className="text-5xl">🔍</div>
              <p className="text-gray-600 max-w-sm">
                Checks all <strong>{houses.length} properties</strong> one by one using live web search to verify current listing status.
              </p>
              <p className="text-gray-400 text-sm">Takes about {Math.ceil(houses.length * 2)}–{houses.length * 3} seconds</p>
              <button
                onClick={checkAllStatuses}
                className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white px-8 py-3 rounded-lg font-semibold shadow-lg flex items-center gap-2"
              >
                <RefreshCw size={18} /> Start Validation
              </button>
            </div>
          )}

          {results.length > 0 && (
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {running && (
                <div className="mb-3">
                  <div className="flex justify-between text-sm text-gray-500 mb-1">
                    <span>Checking {currentIndex + 1} of {houses.length}…</span>
                    <span>{Math.round(((currentIndex + 1) / houses.length) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${((currentIndex + 1) / houses.length) * 100}%` }} />
                  </div>
                </div>
              )}

              {results.map((r) => (
                <div key={r.id} className={`border rounded-lg p-3 flex gap-3 items-start ${getStateBg(r.state)}`}>
                  <div className="mt-0.5 flex-shrink-0">{getStateIcon(r.state)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-800 text-sm">{r.address}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(r.recordedStatus)}`}>
                        Was: {r.recordedStatus}
                      </span>
                      {r.detectedStatus && r.state !== "checking" && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${statusColor(r.detectedStatus)}`}>
                          Now: {r.detectedStatus}
                        </span>
                      )}
                      {r.confidence && r.state !== "checking" && (
                        <span className="text-xs text-gray-400">({r.confidence} confidence)</span>
                      )}
                    </div>
                    {r.state === "checking" && <p className="text-xs text-blue-400 mt-0.5">Searching…</p>}
                    {r.state !== "checking" && r.currentPrice && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">Price: <span className="font-medium text-gray-700">${r.recordedPrice?.toLocaleString()}</span> recorded</span>
                        {r.currentPrice !== r.recordedPrice ? (
                          <span className="text-xs font-bold text-amber-600">→ ${r.currentPrice?.toLocaleString()} now ⚠️</span>
                        ) : (
                          <span className="text-xs text-green-600">✓ price unchanged</span>
                        )}
                      </div>
                    )}
                    {r.reasoning && r.state !== "checking" && (
                      <p className="text-xs text-gray-500 mt-1 leading-snug">
                        {r.reasoning.startsWith("{") ? "API error — try again" : r.reasoning.slice(0, 120)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {done && (
            <div className={`p-4 border-t rounded-b-xl ${changed.length > 0 ? "bg-amber-50" : "bg-green-50"}`}>
              {changed.length === 0 && errors.length === 0 ? (
                <p className="text-sm text-green-700 font-medium">✅ All prices and statuses confirmed — your tracker is up to date!</p>
              ) : (
                <>
                  <p className="text-sm text-amber-800 font-semibold mb-2">
                    ⚠️ {changed.length} propert{changed.length === 1 ? "y needs" : "ies need"} updating in propertyData.js:
                  </p>
                  <ul className="mb-3 space-y-1">
                    {changed.map((r) => (
                      <li key={r.id} className="text-xs text-amber-700">
                        • <strong>{r.address}</strong>
                        {r.recordedStatus !== r.detectedStatus && r.detectedStatus !== "Unknown" && (
                          <span>: status {r.recordedStatus} → <strong>{r.detectedStatus}</strong></span>
                        )}
                        {r.currentPrice && r.currentPrice !== r.recordedPrice && (
                          <span className="ml-1">| price ${r.recordedPrice?.toLocaleString()} → <strong>${r.currentPrice?.toLocaleString()}</strong></span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <div className="border-t border-amber-200 pt-3">
                    <p className="text-xs text-amber-700 font-semibold mb-1">📋 Copy & paste into Claude to update propertyData.js:</p>
                    <pre className="text-xs bg-white border border-amber-200 rounded p-2 whitespace-pre-wrap text-gray-700 font-mono max-h-40 overflow-y-auto">
                      {changed.map(r => {
                        const lines = [`Property: ${r.address} (${r.id})`];
                        if (r.detectedStatus !== "Unknown" && r.detectedStatus !== r.recordedStatus) {
                          lines.push(`  - Change status from "${r.recordedStatus}" to "${r.detectedStatus}"`);
                        }
                        if (r.currentPrice && r.currentPrice !== r.recordedPrice) {
                          lines.push(`  - Change price from ${r.recordedPrice} to ${r.currentPrice}`);
                        }
                        return lines.join('\n');
                      }).join('\n\n')}
                    </pre>
                    <button
                      onClick={() => {
                        const text = changed.map(r => {
                          const lines = [`Property: ${r.address} (${r.id})`];
                          if (r.detectedStatus !== "Unknown" && r.detectedStatus !== r.recordedStatus) {
                            lines.push(`  - Change status from "${r.recordedStatus}" to "${r.detectedStatus}"`);
                          }
                          if (r.currentPrice && r.currentPrice !== r.recordedPrice) {
                            lines.push(`  - Change price from ${r.recordedPrice} to ${r.currentPrice}`);
                          }
                          return lines.join('\n');
                        }).join('\n\n');
                        navigator.clipboard.writeText(text);
                      }}
                      className="mt-2 bg-amber-600 hover:bg-amber-700 text-white text-xs px-3 py-1.5 rounded font-semibold"
                    >
                      📋 Copy to clipboard
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── HOUSE CARD ──────────────────────────────────────────────────────────────

  const HouseCard = ({ house }) => {
    const score = calculateNormalizedScore(house);

    const getBorderColor = () => {
      if (house.status === "Pending" || house.status === "Sold") return "border-gray-300";
      const activeScores = houses.filter((h) => h.status === "Active")
        .map((h) => calculateNormalizedScore(h).total).sort((a, b) => b - a);
      if (activeScores.length === 0) return "border-gray-300";
      const percentile = activeScores.indexOf(score.total) / (activeScores.length - 1);
      if (percentile <= 0.33) return "border-green-500";
      if (percentile <= 0.67) return "border-yellow-500";
      return "border-red-400";
    };

    const getPricePerSqftColor = () => {
      if (!house.price || !house.sqft) return "text-gray-500";
      const sorted = houses.filter((h) => h.price && h.sqft)
        .map((h) => ({ id: h.id, v: Math.round(h.price / h.sqft) }))
        .sort((a, b) => a.v - b.v);
      const percentile = sorted.findIndex((h) => h.id === house.id) / (sorted.length - 1);
      if (percentile <= 0.33) return "text-green-600 font-semibold";
      if (percentile <= 0.66) return "text-yellow-600 font-semibold";
      return "text-red-600 font-semibold";
    };

    const isDimmed = house.status === "Pending" || house.status === "Sold";
    const getStatusBadge = () => {
      if (!house.status || house.status === "Active") return null;
      return {
        Pending: { bg: "bg-red-600", text: "text-white", icon: "⏸️", label: "PENDING" },
        Sold:    { bg: "bg-gray-600", text: "text-white", icon: "🚫", label: "SOLD" },
      }[house.status] || null;
    };
    const statusBadge = getStatusBadge();

    return (
      <div className={`bg-white rounded-lg shadow-md p-3 border-2 ${getBorderColor()} hover:shadow-lg hover:scale-[1.02] transition-all duration-200 ${isDimmed ? "opacity-60" : ""}`}>
        {house.imageUrl ? (
          <div className="mb-3 rounded overflow-hidden bg-gray-100 relative group">
            <img src={house.imageUrl} alt={house.address}
              className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => { e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="160"%3E%3Crect fill="%23e5e7eb" width="400" height="160"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle" fill="%236b7280" font-size="14"%3ENo Image%3C/text%3E%3C/svg%3E'; }} />
            {statusBadge && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20">
                <div className={`${statusBadge.bg} ${statusBadge.text} px-6 py-3 rounded transform -rotate-12 shadow-xl text-xl font-black opacity-95`}>
                  {statusBadge.icon} {statusBadge.label}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mb-3 rounded bg-gray-100 h-40 flex items-center justify-center">
            <div className="text-gray-500 text-sm">No Image</div>
          </div>
        )}

        <div className="flex justify-between items-start mb-2">
          <div className="flex-1 min-w-0">
            <a href={house.zillowLink} target="_blank" rel="noopener noreferrer"
              className="text-base md:text-lg font-bold text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1 group">
              <span className="truncate">{house.address}</span>
              <ExternalLink size={14} className="group-hover:translate-x-1 transition-transform flex-shrink-0" />
            </a>
            <p className="text-gray-600 text-sm md:text-base truncate">{house.neighborhood}</p>
          </div>
          <div className="flex gap-1 flex-col items-end ml-2">
            {statusBadge && (
              <div className={`${statusBadge.bg} ${statusBadge.text} px-2 py-1 rounded text-xs font-bold shadow animate-pulse flex items-center gap-1`}>
                <span>{statusBadge.icon}</span>
                <span className="hidden xl:inline">{statusBadge.label}</span>
              </div>
            )}
            <div className={`px-2 py-1 rounded flex flex-col items-center shadow-sm ${score.total >= 80 ? "bg-green-100" : score.total >= 60 ? "bg-yellow-100" : score.total >= 40 ? "bg-orange-100" : "bg-red-100"}`}>
              <span className={`text-lg md:text-xl font-bold ${score.total >= 80 ? "text-green-800" : score.total >= 60 ? "text-yellow-800" : score.total >= 40 ? "text-orange-800" : "text-red-800"}`}>
                {score.total}
              </span>
            </div>
          </div>
        </div>

        <div className="text-2xl md:text-3xl font-bold text-blue-600 mb-2">
          ${house.price ? Math.round(house.price / 1000) : "?"}K
          {house.price && house.sqft && (
            <span className={`text-sm md:text-base ml-1 ${getPricePerSqftColor()}`}>
              ${Math.round(house.price / house.sqft)}/sqft
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-2 p-2 bg-gray-50 rounded text-sm md:text-base">
          <div className="flex items-center gap-1.5"><Bed className="text-blue-600 flex-shrink-0" size={18} /><span>{house.beds} beds</span></div>
          <div className="flex items-center gap-1.5"><Bath className="text-blue-600 flex-shrink-0" size={18} /><span>{house.baths} baths</span></div>
          <div className="flex items-center gap-1.5"><Square className="text-blue-600 flex-shrink-0" size={18} /><span>{house.sqft ? house.sqft.toLocaleString() : "?"} sqft</span></div>
          <div className="flex items-center gap-1.5"><Car className="text-blue-600 flex-shrink-0" size={18} /><span>{house.garage}-car</span></div>
        </div>

        <div className="space-y-1.5 text-sm md:text-base border-t pt-2">
          <div className="flex justify-between"><span className="text-gray-600">Built:</span><span className="font-medium">{house.yearBuilt}</span></div>
          <div className="flex justify-between"><span className="text-gray-600">Commute:</span><span className="font-medium">{house.commuteHusband}m</span></div>
          <div className="flex justify-between"><span className="text-gray-600">Basement:</span><span className="font-medium">{house.basement || "No"}</span></div>
          <div className="flex justify-between"><span className="text-gray-600">Pool:</span><span className="font-medium">{house.hasNeighborhoodPool ? "✓" : "✗"}</span></div>
        </div>
      </div>
    );
  };

  // ── SCORING PREFERENCES ─────────────────────────────────────────────────────

  const ScoringPreferencesModal = () => {
    const labels = {
      price: "Purchase Price", commuteHusband: "Commute to Downtown", beds: "Bedrooms",
      baths: "Bathrooms", sqft: "Square Footage", garage: "Garage (3-car goal)",
      basement: "Finished Basement", yearBuilt: "Year Built", daysOnMarket: "Days on Market",
      walkScore: "Walk Score", bikeScore: "Bike Score", hasNeighborhoodPool: "Neighborhood Pool",
      hoaFees: "HOA Fees", lotSize: "Lot Size", pricePerSqft: "Price/Sqft",
    };
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Sliders size={24} className="text-blue-600" /> Scoring Preferences
              </h3>
              <button onClick={() => setShowScoringPreferences(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>
            <div className="space-y-4">
              {Object.keys(scoringWeights).map((key) => (
                <div key={key} className="flex items-center gap-4">
                  <select value={scoringEnabled[key] ? "yes" : "no"}
                    onChange={(e) => setScoringEnabled({ ...scoringEnabled, [key]: e.target.value === "yes" })}
                    className="w-20 border rounded px-2 py-1 text-sm">
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-1">{labels[key]}</label>
                    <div className="flex items-center gap-3">
                      <input type="range" min="1" max="10" value={scoringWeights[key]}
                        onChange={(e) => setScoringWeights({ ...scoringWeights, [key]: parseInt(e.target.value) })}
                        disabled={!scoringEnabled[key]}
                        className={`flex-1 ${!scoringEnabled[key] ? "opacity-30" : ""}`} />
                      <span className={`px-2 py-1 rounded text-sm font-bold ${!scoringEnabled[key] ? "bg-gray-100 text-gray-400" : scoringWeights[key] >= 8 ? "bg-red-100 text-red-800" : scoringWeights[key] >= 6 ? "bg-yellow-100 text-yellow-800" : "bg-blue-100 text-blue-800"}`}>
                        {scoringWeights[key]}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setShowScoringPreferences(false)}
              className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg">Apply</button>
          </div>
        </div>
      </div>
    );
  };

  // ── MAIN RENDER ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500 rounded-lg shadow-lg p-8 mb-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">🏡 Stoltenbergs House Hunt</h1>
            <p className="text-lg italic font-light">Where every house is perfect until we see the price.</p>
          </div>
          <Home size={64} className="opacity-50" />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-3 mb-6">
        <div className="flex items-center justify-between gap-6 flex-wrap">
          <div className="flex gap-3">
            <button onClick={() => setShowFinancials(true)} className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg text-sm">
              <Calculator size={16} /> Financials
            </button>
            <button onClick={() => setShowScoringPreferences(true)} className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg text-sm">
              <Target size={16} /> Scoring
            </button>
            <button onClick={() => setShowSummaryTable(true)} className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg text-sm">
              <Download size={16} /> Summary
            </button>
            <button onClick={() => setShowStatusChecker(true)} className="bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg text-sm">
              <RefreshCw size={16} /> Validate Price & Status
            </button>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex gap-3 text-sm border-r pr-4">
              <div className="text-center"><div className="text-xl font-bold text-green-600">{stats.active}</div><div className="text-xs text-gray-600">Active</div></div>
              <div className="text-center"><div className="text-xl font-bold text-red-600">{stats.pending}</div><div className="text-xs text-gray-600">Pending</div></div>
              <div className="text-center"><div className="text-xl font-bold text-gray-500">{stats.sold}</div><div className="text-xs text-gray-600">Sold</div></div>
              <div className="text-center"><div className="text-xl font-bold text-blue-600">{stats.total}</div><div className="text-xs text-gray-600">Total</div></div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStatusFilter("all")} className={`px-3 py-2 rounded-lg font-semibold text-sm transition-all ${statusFilter === "all" ? "bg-blue-600 text-white shadow-lg" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}>Show All</button>
              <button onClick={() => setStatusFilter("active")} className={`px-3 py-2 rounded-lg font-semibold text-sm transition-all ${statusFilter === "active" ? "bg-green-600 text-white shadow-lg" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}>Active Only</button>
            </div>
            <div className="text-sm text-gray-600 border-l pl-4">
              <span className="font-bold">{sortedHouses.length}</span> of <span className="font-bold">{houses.length}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedHouses.map((house) => <HouseCard key={house.id} house={house} />)}
      </div>

      {showScoringPreferences && <ScoringPreferencesModal />}
      {showStatusChecker && <StatusCheckerModal />}

      {showFinancials && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-2xl font-bold">Monthly Payment Calculator</h3>
                <button onClick={() => setShowFinancials(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Home Price</label>
                  <input type="number" value={financials.homePrice} onChange={(e) => setFinancials({ ...financials, homePrice: parseFloat(e.target.value) || 0 })} className="w-full border rounded px-3 py-2" />
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-3">Down Payment</h4>
                  <div className="mb-3 bg-gray-100 p-3 rounded">
                    <div className="text-2xl font-bold">$115,000</div>
                    <p className="text-xs text-gray-600">Amount owed on current house</p>
                  </div>
                  <div className="mb-3">
                    <label className="block text-sm font-medium mb-1">Expected Sale Price</label>
                    <input type="number" value={financials.houseSellPrice} onChange={(e) => setFinancials({ ...financials, houseSellPrice: parseFloat(e.target.value) || 0 })} className="w-full border rounded px-3 py-2" />
                    <p className="text-sm text-gray-600 mt-1">Net: ${(financials.houseSellPrice - 115000).toLocaleString()}</p>
                  </div>
                  <div className="mb-3">
                    <label className="block text-sm font-medium mb-1">Closing Costs (%)</label>
                    <input type="number" step="0.5" value={financials.closingCostsPercent} onChange={(e) => setFinancials({ ...financials, closingCostsPercent: parseFloat(e.target.value) || 0 })} className="w-full border rounded px-3 py-2" />
                  </div>
                  <div className="mb-3">
                    <label className="block text-sm font-medium mb-1">Extra Cash</label>
                    <input type="number" value={financials.additionalCash} onChange={(e) => setFinancials({ ...financials, additionalCash: parseFloat(e.target.value) || 0 })} className="w-full border rounded px-3 py-2" />
                  </div>
                  <div className="pt-3 border-t">
                    <div className="flex justify-between font-semibold">
                      <span>Total Down:</span>
                      <span>${(() => { const net = financials.houseSellPrice - 115000; const closing = (financials.homePrice * financials.closingCostsPercent) / 100; return (net - closing + financials.additionalCash).toLocaleString(); })()}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Interest Rate (%)</label>
                  <input type="number" step="0.01" value={financials.interestRate} onChange={(e) => setFinancials({ ...financials, interestRate: parseFloat(e.target.value) || 0 })} className="w-full border rounded px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Loan Term</label>
                  <select value={financials.loanTerm} onChange={(e) => setFinancials({ ...financials, loanTerm: parseInt(e.target.value) })} className="w-full border rounded px-3 py-2">
                    <option value={15}>15 years</option>
                    <option value={30}>30 years</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Annual Property Tax</label>
                  <input type="number" value={financials.propertyTax} onChange={(e) => setFinancials({ ...financials, propertyTax: parseFloat(e.target.value) || 0 })} className="w-full border rounded px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Annual Insurance</label>
                  <input type="number" value={financials.homeInsurance} onChange={(e) => setFinancials({ ...financials, homeInsurance: parseFloat(e.target.value) || 0 })} className="w-full border rounded px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Monthly HOA</label>
                  <input type="number" value={financials.hoaFees} onChange={(e) => setFinancials({ ...financials, hoaFees: parseFloat(e.target.value) || 0 })} className="w-full border rounded px-3 py-2" />
                </div>
              </div>
              <div className="mt-6 p-4 bg-green-50 rounded-lg">
                <h4 className="font-bold text-lg mb-4">Monthly Payment</h4>
                {(() => {
                  const net = financials.houseSellPrice - 115000;
                  const closing = (financials.homePrice * financials.closingCostsPercent) / 100;
                  const down = net - closing + financials.additionalCash;
                  const loan = financials.homePrice - down;
                  const rate = financials.interestRate / 100 / 12;
                  const n = financials.loanTerm * 12;
                  const pi = (loan * (rate * Math.pow(1 + rate, n))) / (Math.pow(1 + rate, n) - 1);
                  const total = pi + financials.propertyTax / 12 + financials.homeInsurance / 12 + financials.hoaFees;
                  return <div className="text-2xl font-bold text-green-700">${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/month</div>;
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {showSummaryTable && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b flex justify-between items-start">
              <h3 className="text-2xl font-bold">Property Summary</h3>
              <button onClick={() => setShowSummaryTable(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    {[
                      { key: "address",      label: "Address", align: "text-left" },
                      { key: "price",        label: "Price",   align: "text-left" },
                      { key: "status",       label: "Status",  align: "text-left" },
                      { key: "beds",         label: "Beds",    align: "text-center" },
                      { key: "baths",        label: "Baths",   align: "text-center" },
                      { key: "sqft",         label: "Sqft",    align: "text-center" },
                      { key: "pricePerSqft", label: "$/Sqft",  align: "text-center" },
                      { key: "score",        label: "Score",   align: "text-center" },
                    ].map(({ key, label, align }) => (
                      <th key={key} onClick={() => handleSummarySort(key)}
                        className={`border px-4 py-2 ${align} cursor-pointer select-none hover:bg-gray-200 whitespace-nowrap`}>
                        {label}{" "}
                        {summarySort.key === key
                          ? summarySort.direction === "asc" ? "▲" : "▼"
                          : <span className="text-gray-300">▼</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summarySortedHouses.map((house, i) => {
                    const score = calculateNormalizedScore(house).total;
                    return (
                      <tr key={house.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="border px-4 py-2">
                          <a href={house.zillowLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{house.address}</a>
                          <div className="text-sm text-gray-600">{house.neighborhood}</div>
                        </td>
                        <td className="border px-4 py-2">${house.price?.toLocaleString()}</td>
                        <td className="border px-4 py-2">
                          <span className={`font-semibold ${house.status === "Pending" ? "text-red-600" : house.status === "Sold" ? "text-gray-500" : "text-green-600"}`}>
                            {house.status || "N/A"}
                          </span>
                        </td>
                        <td className="border px-4 py-2 text-center">{house.beds}</td>
                        <td className="border px-4 py-2 text-center">{house.baths}</td>
                        <td className="border px-4 py-2 text-center">{house.sqft?.toLocaleString()}</td>
                        <td className="border px-4 py-2 text-center">${Math.round(house.price / house.sqft)}</td>
                        <td className="border px-4 py-2 text-center">
                          <span className={`px-3 py-1 rounded-full font-bold text-sm ${score >= 80 ? "bg-green-100 text-green-800" : score >= 60 ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"}`}>
                            {score}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HouseTrackerApp;
