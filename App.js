import React, { useState, useMemo } from "react";
import {
  Home, Bed, Bath, Square, Car, X, Calculator, ExternalLink,
  Target, Sliders, Download, MapPin, Heart,
} from "lucide-react";
import { ALL_PROPERTIES } from "./propertyData";

// ── HELPERS ───────────────────────────────────────────────────────────────────

const normalize = (value, min, max, inverse = false) => {
  if (max === min) return 100;
  const n = ((value - min) / (max - min)) * 100;
  return inverse ? 100 - n : n;
};

const computeBounds = (houses) => ({
  prices:   { min: Math.min(...houses.map(h => h.price)),                  max: Math.max(...houses.map(h => h.price)) },
  commutes: { min: Math.min(...houses.map(h => h.commuteHusband)),         max: Math.max(...houses.map(h => h.commuteHusband)) },
  beds:     { min: Math.min(...houses.map(h => h.beds)),                   max: Math.max(...houses.map(h => h.beds)) },
  baths:    { min: Math.min(...houses.map(h => h.baths)),                  max: Math.max(...houses.map(h => h.baths)) },
  sqfts:    { min: Math.min(...houses.map(h => h.sqft)),                   max: Math.max(...houses.map(h => h.sqft)) },
  years:    { min: Math.min(...houses.map(h => h.yearBuilt)),              max: Math.max(...houses.map(h => h.yearBuilt)) },
  hoas:     { min: Math.min(...houses.map(h => (h.hoaAnnual || 0) / 12)), max: Math.max(...houses.map(h => (h.hoaAnnual || 0) / 12)) },
  lots:     { min: Math.min(...houses.map(h => h.lotSize)),                max: Math.max(...houses.map(h => h.lotSize)) },
  ppsqfts:  { min: Math.min(...houses.map(h => h.pricePerSqft)),           max: Math.max(...houses.map(h => h.pricePerSqft)) },
});

// ── SCORING ───────────────────────────────────────────────────────────────────

const calculateScore = (house, bounds, scoringWeights, scoringEnabled) => {
  let totalScore = 0;
  let maxPossibleScore = 0;

  const addScore = (key, value, weight) => {
    if (scoringEnabled[key]) {
      totalScore += value * (weight / 10);
      maxPossibleScore += 100 * (weight / 10);
    }
  };

  if (scoringEnabled.price)
    addScore("price", normalize(house.price, bounds.prices.min, bounds.prices.max, true), scoringWeights.price);
  if (scoringEnabled.commuteHusband)
    addScore("commuteHusband", normalize(house.commuteHusband, bounds.commutes.min, bounds.commutes.max, true), scoringWeights.commuteHusband);
  if (scoringEnabled.beds && house.beds)
    addScore("beds", normalize(house.beds, bounds.beds.min, bounds.beds.max), scoringWeights.beds);
  if (scoringEnabled.baths && house.baths)
    addScore("baths", normalize(house.baths, bounds.baths.min, bounds.baths.max), scoringWeights.baths);
  if (scoringEnabled.sqft && house.sqft)
    addScore("sqft", normalize(house.sqft, bounds.sqfts.min, bounds.sqfts.max), scoringWeights.sqft);
  if (scoringEnabled.garage && house.garage)
    addScore("garage", (house.garage / 3) * 100, scoringWeights.garage);
  if (scoringEnabled.basement)
    addScore("basement", house.basement === "Finished" ? 100 : house.basement === "Unfinished" ? 50 : 0, scoringWeights.basement);
  if (scoringEnabled.yearBuilt)
    addScore("yearBuilt", normalize(house.yearBuilt, bounds.years.min, bounds.years.max), scoringWeights.yearBuilt);
  if (scoringEnabled.walkScore)
    addScore("walkScore", house.walkScore, scoringWeights.walkScore);
  if (scoringEnabled.bikeScore)
    addScore("bikeScore", house.bikeScore || 0, scoringWeights.bikeScore);
  if (scoringEnabled.hasNeighborhoodPool)
    addScore("hasNeighborhoodPool", house.hasNeighborhoodPool ? 100 : 0, scoringWeights.hasNeighborhoodPool);
  if (scoringEnabled.hoaFees)
    addScore("hoaFees", normalize((house.hoaAnnual || 0) / 12, bounds.hoas.min, bounds.hoas.max, true), scoringWeights.hoaFees);
  if (scoringEnabled.lotSize)
    addScore("lotSize", normalize(house.lotSize, bounds.lots.min, bounds.lots.max), scoringWeights.lotSize);
  if (scoringEnabled.pricePerSqft)
    addScore("pricePerSqft", normalize(house.pricePerSqft, bounds.ppsqfts.min, bounds.ppsqfts.max, true), scoringWeights.pricePerSqft);
  if (scoringEnabled.daysOnMarket) {
    const daysMatch = house.daysOnMarket.match(/(\d+)/);
    const days = daysMatch ? parseInt(daysMatch[1]) : 0;
    addScore("daysOnMarket", Math.max(100 - (days / 180) * 100, 0), scoringWeights.daysOnMarket);
  }

  return { rawScore: maxPossibleScore === 0 ? 0 : (totalScore / maxPossibleScore) * 100 };
};

const calculateNormalizedScore = (house, houses, bounds, scoringWeights, scoringEnabled) => {
  const { rawScore } = calculateScore(house, bounds, scoringWeights, scoringEnabled);
  const allRaw = houses.map(h => calculateScore(h, bounds, scoringWeights, scoringEnabled).rawScore);
  return { total: Math.round(rawScore + (100 - Math.max(...allRaw))) };
};

// ── HOUSE CARD ────────────────────────────────────────────────────────────────

const HouseCard = ({ house, houses, bounds, scoringWeights, scoringEnabled }) => {
  const score = calculateNormalizedScore(house, houses, bounds, scoringWeights, scoringEnabled);

  const getBorderColor = () => {
    if (house.favorite === true) return "border-pink-500";
    if (house.status === "Pending" || house.status === "Sold") return "border-gray-300";
    const activeScores = houses
      .filter(h => h.status === "Active")
      .map(h => calculateNormalizedScore(h, houses, bounds, scoringWeights, scoringEnabled).total)
      .sort((a, b) => b - a);
    if (activeScores.length === 0) return "border-gray-300";
    const percentile = activeScores.indexOf(score.total) / (activeScores.length - 1);
    if (percentile <= 0.33) return "border-green-500";
    if (percentile <= 0.67) return "border-yellow-500";
    return "border-red-400";
  };

  const getPricePerSqftColor = () => {
    if (!house.price || !house.sqft) return "text-gray-500";
    const sorted = houses
      .filter(h => h.price && h.sqft)
      .map(h => ({ id: h.id, v: Math.round(h.price / h.sqft) }))
      .sort((a, b) => a.v - b.v);
    const percentile = sorted.findIndex(h => h.id === house.id) / (sorted.length - 1);
    if (percentile <= 0.33) return "text-green-600 font-semibold";
    if (percentile <= 0.66) return "text-yellow-600 font-semibold";
    return "text-red-600 font-semibold";
  };

  const isDimmed = house.status === "Pending" || house.status === "Sold";

  const getStatusBadge = () => {
    if (!house.status || house.status === "Active") return null;
    return {
      Pending: { bg: "bg-red-600",  text: "text-white", icon: "⏸️", label: "PENDING" },
      Sold:    { bg: "bg-gray-600", text: "text-white", icon: "🚫", label: "SOLD" },
    }[house.status] || null;
  };
  const statusBadge = getStatusBadge();

  return (
    <div className={`bg-white rounded-lg shadow-md p-3 border-2 ${getBorderColor()} hover:shadow-lg hover:scale-[1.02] transition-all duration-200 ${isDimmed ? "opacity-60" : ""} ${house.favorite === true ? "ring-2 ring-pink-300 ring-offset-1" : ""}`}>
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
          {house.favorite === true && (
            <div className="absolute top-2 right-2 p-1.5 rounded-full bg-white bg-opacity-90 shadow-md z-10">
              <Heart size={18} className="fill-red-500 text-red-500" />
            </div>
          )}
        </div>
      ) : (
        <div className="mb-3 rounded bg-gray-100 h-40 flex items-center justify-center relative">
          <div className="text-gray-500 text-sm">No Image</div>
          {house.favorite === true && (
            <div className="absolute top-2 right-2 p-1.5 rounded-full bg-white shadow-md z-10">
              <Heart size={18} className="fill-red-500 text-red-500" />
            </div>
          )}
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
        <div className="flex items-center gap-1.5"><Bed    className="text-blue-600 flex-shrink-0" size={18} /><span>{house.beds} beds</span></div>
        <div className="flex items-center gap-1.5"><Bath   className="text-blue-600 flex-shrink-0" size={18} /><span>{house.baths} baths</span></div>
        <div className="flex items-center gap-1.5"><Square className="text-blue-600 flex-shrink-0" size={18} /><span>{house.sqft ? house.sqft.toLocaleString() : "?"} sqft</span></div>
        <div className="flex items-center gap-1.5"><Car    className="text-blue-600 flex-shrink-0" size={18} /><span>{house.garage}-car</span></div>
      </div>

      <div className="space-y-1.5 text-sm md:text-base border-t pt-2">
        <div className="flex justify-between"><span className="text-gray-600">Built:</span><span className="font-medium">{house.yearBuilt}</span></div>
        <div className="flex justify-between"><span className="text-gray-600">Commute:</span><span className="font-medium">{house.commuteHusband}m</span></div>
        <div className="flex justify-between"><span className="text-gray-600">Basement:</span><span className="font-medium">{house.basement || "No"}</span></div>
        <div className="flex justify-between"><span className="text-gray-600">Pool:</span><span className="font-medium">{house.hasNeighborhoodPool ? "✓" : "✗"}</span></div>
        {house.neighborhoodSummary && (
          <div className="pt-1 border-t border-gray-100">
            <span className="text-gray-500 text-xs font-medium uppercase tracking-wide">Area</span>
            <p className="text-xs text-gray-500 italic mt-0.5 line-clamp-3">{house.neighborhoodSummary}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ── SCORING PREFERENCES MODAL ─────────────────────────────────────────────────

const ScoringPreferencesModal = ({ scoringWeights, setScoringWeights, scoringEnabled, setScoringEnabled, onClose }) => {
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
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
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
          <button onClick={onClose} className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg">Apply</button>
        </div>
      </div>
    </div>
  );
};

// ── MAIN APP ──────────────────────────────────────────────────────────────────

const HouseTrackerApp = () => {
  const [houses] = useState(ALL_PROPERTIES);
  const [showScoringPreferences, setShowScoringPreferences] = useState(false);
  const [showFinancials, setShowFinancials]                 = useState(false);
  const [showSummaryTable, setShowSummaryTable]             = useState(false);
  const [selectedHouseId, setSelectedHouseId]               = useState(
    () => ALL_PROPERTIES.find(h => h.favorite === true)?.id || ""
  );

  const [financials, setFinancials] = useState(() => {
    const saved = localStorage.getItem("houseHuntFinancials");
    if (saved) return JSON.parse(saved);
    const fav = ALL_PROPERTIES.find(h => h.favorite === true);
    return {
      homePrice:      fav ? fav.price : 650000,
      houseSellPrice: 405000,
      additionalCash: 50000,
      interestRate:   6.75,
      loanTerm:       30,
      homeInsurance:  2400,
      hoaFees:        fav ? Math.round((fav.hoaAnnual || 0) / 12) : 0,
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

  const [statusFilter, setStatusFilter]               = useState("all");
  const [summaryStatusFilter, setSummaryStatusFilter] = useState("Active");
  const [summarySort, setSummarySort]                 = useState({ key: "score", direction: "desc" });

  React.useEffect(() => { localStorage.setItem("houseHuntFinancials", JSON.stringify(financials)); }, [financials]);
  React.useEffect(() => { localStorage.setItem("scoringWeights",      JSON.stringify(scoringWeights)); }, [scoringWeights]);
  React.useEffect(() => { localStorage.setItem("scoringEnabled",      JSON.stringify(scoringEnabled)); }, [scoringEnabled]);

  const bounds   = useMemo(() => computeBounds(houses), [houses]);
  const getScore = (house) => calculateNormalizedScore(house, houses, bounds, scoringWeights, scoringEnabled);

  const stats = useMemo(() => ({
    active:    houses.filter(h => h.status === "Active").length,
    pending:   houses.filter(h => h.status === "Pending").length,
    sold:      houses.filter(h => h.status === "Sold").length,
    total:     houses.length,
    favorites: houses.filter(h => h.favorite === true).length,
  }), [houses]);

  const sortedHouses = useMemo(() => {
    let filtered = [...houses];
    if (statusFilter === "active")    filtered = filtered.filter(h => h.status === "Active");
    if (statusFilter === "favorites") filtered = filtered.filter(h => h.favorite === true);
    filtered.sort((a, b) => {
      const statusOrder = { Active: 0, Pending: 1, Sold: 2 };
      const tierDiff = (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
      if (tierDiff !== 0) return tierDiff;
      return getScore(b).total - getScore(a).total;
    });
    return filtered;
  }, [houses, scoringWeights, scoringEnabled, statusFilter, bounds]);

  const summarySortedHouses = useMemo(() => {
    const { key, direction } = summarySort;
    if (!key) return sortedHouses;
    return [...sortedHouses].sort((a, b) => {
      let aVal, bVal;
      if      (key === "address")      { aVal = a.address; bVal = b.address; }
      else if (key === "price")        { aVal = a.price;   bVal = b.price; }
      else if (key === "status")       { aVal = a.status;  bVal = b.status; }
      else if (key === "beds")         { aVal = a.beds;    bVal = b.beds; }
      else if (key === "baths")        { aVal = a.baths;   bVal = b.baths; }
      else if (key === "sqft")         { aVal = a.sqft;    bVal = b.sqft; }
      else if (key === "pricePerSqft") { aVal = Math.round(a.price / a.sqft); bVal = Math.round(b.price / b.sqft); }
      else if (key === "score")        { aVal = getScore(a).total; bVal = getScore(b).total; }
      if (typeof aVal === "string") return direction === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return direction === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [sortedHouses, summarySort, scoringWeights, scoringEnabled, bounds]);

  const handleSummarySort = (key) => {
    setSummarySort(prev =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "desc" }
    );
  };

  const calcMonthlyPayment = (overrideRate = null) => {
    const down    = ((financials.houseSellPrice - 113000) * 0.92) + financials.additionalCash;
    const loan    = financials.homePrice - down;
    const rate    = (overrideRate !== null ? overrideRate : financials.interestRate) / 100 / 12;
    const n       = financials.loanTerm * 12;
    const pi      = rate > 0 ? (loan * (rate * Math.pow(1 + rate, n))) / (Math.pow(1 + rate, n) - 1) : loan / n;
    const propTax = (financials.homePrice * 0.01085) / 12;
    return pi + propTax + financials.homeInsurance / 12 + financials.hoaFees;
  };

  // ── RENDER ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 p-6">

      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500 rounded-lg shadow-lg p-8 mb-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">🏡 Stoltenbergs House Hunt</h1>
            <p className="text-lg italic font-light">Where every house is perfect until we see the price.</p>
          </div>
          <Home size={64} className="opacity-50" />
        </div>
      </div>

      {/* ── TOOLBAR ── */}
      <div className="bg-white rounded-lg shadow-md p-3 mb-6">
        <div className="flex flex-wrap items-center gap-2">

          {/* Action buttons */}
          <button onClick={() => setShowFinancials(true)}
            className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg text-sm">
            <Calculator size={16} /> Financials
          </button>
          <button onClick={() => setShowScoringPreferences(true)}
            className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg text-sm">
            <Target size={16} /> Scoring
          </button>
          <button onClick={() => setShowSummaryTable(true)}
            className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg text-sm">
            <Download size={16} /> Summary
          </button>
          <button onClick={() => window.open('/fishers-house-search-2026/map/', '_blank')}
            className="bg-gradient-to-r from-teal-500 to-green-500 hover:from-teal-600 hover:to-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg text-sm">
            <MapPin size={16} /> Map View
          </button>

          <div className="hidden sm:block w-px h-8 bg-gray-200 mx-1" />

          {/* Status filters */}
          <button onClick={() => setStatusFilter("all")}
            className={`px-3 py-2 rounded-lg font-semibold text-sm transition-all ${statusFilter === "all" ? "bg-blue-600 text-white shadow-lg" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}>
            Show All
          </button>
          <button onClick={() => setStatusFilter("active")}
            className={`px-3 py-2 rounded-lg font-semibold text-sm transition-all ${statusFilter === "active" ? "bg-green-600 text-white shadow-lg" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}>
            Active Only
          </button>
          <button onClick={() => setStatusFilter("favorites")}
            className={`px-3 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-1 ${statusFilter === "favorites" ? "bg-pink-500 text-white shadow-lg" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}>
            <Heart size={14} className={statusFilter === "favorites" ? "fill-white" : "fill-pink-500 text-pink-500"} />
            Saved
          </button>

          <div className="hidden sm:block w-px h-8 bg-gray-200 mx-1" />

          {/* Stats */}
          <div className="flex gap-3 text-sm">
            <div className="text-center"><div className="text-xl font-bold text-green-600">{stats.active}</div><div className="text-xs text-gray-600">Active</div></div>
            <div className="text-center"><div className="text-xl font-bold text-red-600">{stats.pending}</div><div className="text-xs text-gray-600">Pending</div></div>
            <div className="text-center"><div className="text-xl font-bold text-gray-500">{stats.sold}</div><div className="text-xs text-gray-600">Sold</div></div>
            <div className="text-center"><div className="text-xl font-bold text-blue-600">{stats.total}</div><div className="text-xs text-gray-600">Total</div></div>
            <div className="text-center"><div className="text-xl font-bold text-pink-500">{stats.favorites}</div><div className="text-xs text-gray-600">Saved</div></div>
          </div>

          {/* Showing count */}
          <div className="text-sm text-gray-600 ml-auto">
            <span className="font-bold">{sortedHouses.length}</span> of <span className="font-bold">{houses.length}</span>
          </div>
        </div>
      </div>

      {/* ── CARD GRID ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedHouses.map(house => (
          <HouseCard
            key={house.id}
            house={house}
            houses={houses}
            bounds={bounds}
            scoringWeights={scoringWeights}
            scoringEnabled={scoringEnabled}
          />
        ))}
      </div>

      {/* ── MODALS ── */}

      {showScoringPreferences && (
        <ScoringPreferencesModal
          scoringWeights={scoringWeights}
          setScoringWeights={setScoringWeights}
          scoringEnabled={scoringEnabled}
          setScoringEnabled={setScoringEnabled}
          onClose={() => setShowScoringPreferences(false)}
        />
      )}

      {showFinancials && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-2xl font-bold">Monthly Payment Calculator</h3>
                <button onClick={() => setShowFinancials(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
              </div>
              <div className="space-y-4">

                {/* Property Selector */}
                <div>
                  <label className="block text-sm font-medium mb-1">Select Property</label>
                  <select
                    value={selectedHouseId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedHouseId(id);
                      if (id) {
                        const h = houses.find(x => x.id === id);
                        if (h) setFinancials(f => ({ ...f, homePrice: h.price, hoaFees: Math.round((h.hoaAnnual || 0) / 12) }));
                      }
                    }}
                    className="w-full border rounded px-3 py-2 bg-white"
                  >
                    <option value="">— enter manually —</option>
                    {[...houses].sort((a, b) => a.address.localeCompare(b.address)).map(h => (
                      <option key={h.id} value={h.id}>
                        {h.address} — ${Math.round(h.price / 1000)}K{h.status !== "Active" ? ` (${h.status})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Home Price */}
                <div>
                  <label className="block text-sm font-medium mb-1">Home Price</label>
                  <input type="number" value={financials.homePrice}
                    onChange={(e) => { setSelectedHouseId(""); setFinancials({ ...financials, homePrice: parseFloat(e.target.value) || 0 }); }}
                    className="w-full border rounded px-3 py-2" />
                </div>

                {/* Down Payment */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-3">Down Payment</h4>
                  <div className="mb-3 bg-gray-100 p-3 rounded">
                    <div className="text-2xl font-bold">$113,000</div>
                    <p className="text-xs text-gray-600">Amount owed on current house</p>
                  </div>
                  <div className="mb-3">
                    <label className="block text-sm font-medium mb-1">Expected Sale Price</label>
                    <input type="number" value={financials.houseSellPrice}
                      onChange={(e) => setFinancials({ ...financials, houseSellPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full border rounded px-3 py-2" />
                    <p className="text-sm text-gray-600 mt-1">
                      Net proceeds: ${Math.round((financials.houseSellPrice - 113000) * 0.92).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-400">= (sale price − amount owed) × 92%</p>
                  </div>
                  <div className="mb-3">
                    <label className="block text-sm font-medium mb-1">Extra Cash</label>
                    <input type="number" value={financials.additionalCash}
                      onChange={(e) => setFinancials({ ...financials, additionalCash: parseFloat(e.target.value) || 0 })}
                      className="w-full border rounded px-3 py-2" />
                  </div>
                  <div className="pt-3 border-t space-y-2">
                    <div className="flex justify-between font-semibold">
                      <span>Total Down:</span>
                      <span>${Math.round(((financials.houseSellPrice - 113000) * 0.92) + financials.additionalCash).toLocaleString()}</span>
                    </div>
                    {(() => {
                      const buyerClosing = Math.round(financials.homePrice * 0.025);
                      const totalDown    = Math.round(((financials.houseSellPrice - 113000) * 0.92) + financials.additionalCash);
                      return (
                        <>
                          <div className="flex justify-between text-sm text-gray-600">
                            <span>Buyer Closing Costs (est.):</span>
                            <span>${buyerClosing.toLocaleString()} <span className="text-xs text-gray-400">(2.5% of price)</span></span>
                          </div>
                          <div className="flex justify-between font-semibold text-blue-700 border-t pt-2">
                            <span>Cash Needed at Closing:</span>
                            <span>${(totalDown + buyerClosing).toLocaleString()}</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Interest Rate */}
                <div>
                  <label className="block text-sm font-medium mb-1">Interest Rate (%)</label>
                  <input type="number" step="0.01" value={financials.interestRate}
                    onChange={(e) => setFinancials({ ...financials, interestRate: parseFloat(e.target.value) || 0 })}
                    className="w-full border rounded px-3 py-2" />
                </div>

                {/* Loan Term */}
                <div>
                  <label className="block text-sm font-medium mb-1">Loan Term</label>
                  <select value={financials.loanTerm}
                    onChange={(e) => setFinancials({ ...financials, loanTerm: parseInt(e.target.value) })}
                    className="w-full border rounded px-3 py-2">
                    <option value={15}>15 years</option>
                    <option value={30}>30 years</option>
                  </select>
                </div>

                {/* Est. Property Tax (read-only) */}
                <div>
                  <label className="block text-sm font-medium mb-1">Est. Property Tax (1.085%)</label>
                  <div className="bg-gray-50 border rounded px-3 py-2 text-gray-600 flex justify-between">
                    <span>${Math.round(financials.homePrice * 0.01085).toLocaleString()} / year</span>
                    <span className="text-gray-400">${Math.round(financials.homePrice * 0.01085 / 12).toLocaleString()} / mo</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Based on Fishers effective rate (Hamilton County, 2025)</p>
                </div>

                {/* Annual Insurance */}
                <div>
                  <label className="block text-sm font-medium mb-1">Annual Insurance</label>
                  <input type="number" value={financials.homeInsurance}
                    onChange={(e) => setFinancials({ ...financials, homeInsurance: parseFloat(e.target.value) || 0 })}
                    className="w-full border rounded px-3 py-2" />
                </div>

                {/* Monthly HOA */}
                <div>
                  <label className="block text-sm font-medium mb-1">Monthly HOA</label>
                  <input type="number" value={financials.hoaFees}
                    onChange={(e) => setFinancials({ ...financials, hoaFees: parseFloat(e.target.value) || 0 })}
                    className="w-full border rounded px-3 py-2" />
                </div>

              </div>

              {/* Monthly Payment Result */}
              <div className="mt-6 p-4 bg-green-50 rounded-lg">
                <h4 className="font-bold text-lg mb-1">Monthly Payment</h4>
                <div className="text-3xl font-bold text-green-700">
                  ${calcMonthlyPayment().toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/month
                </div>
              </div>

              {/* Rate Sensitivity */}
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-bold text-base mb-0.5">Rate Sensitivity</h4>
                <p className="text-xs text-gray-500 mb-3">Monthly payment at different interest rates</p>
                <div className="grid grid-cols-5 gap-2">
                  {[-1, -0.5, 0, 0.5, 1].map((delta) => {
                    const adjRate   = Math.max(financials.interestRate + delta, 0.01);
                    const total     = calcMonthlyPayment(adjRate);
                    const isCurrent = delta === 0;
                    return (
                      <div key={delta}
                        className={`rounded-lg p-2 text-center border-2 ${isCurrent ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-200 text-gray-700"}`}>
                        <div className={`text-xs font-semibold mb-1 ${isCurrent ? "text-blue-100" : "text-gray-500"}`}>
                          {adjRate.toFixed(2)}%
                        </div>
                        <div className={`text-sm font-bold ${isCurrent ? "text-white" : "text-gray-800"}`}>
                          ${Math.round(total).toLocaleString()}
                        </div>
                        {delta !== 0 && (
                          <div className={`text-xs mt-0.5 ${delta > 0 ? "text-red-500" : "text-green-600"}`}>
                            {delta > 0 ? "+" : ""}{delta.toFixed(1)}%
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {showSummaryTable && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-2xl font-bold">Property Summary</h3>
              <div className="flex items-center gap-3">
                <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                  {["All", "Active", "Pending", "Sold"].map(s => (
                    <button key={s} onClick={() => setSummaryStatusFilter(s === "All" ? "all" : s)}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${summaryStatusFilter === (s === "All" ? "all" : s) ? "bg-white shadow text-blue-600 font-semibold" : "text-gray-500 hover:text-gray-700"}`}>
                      {s}
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowSummaryTable(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
              </div>
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
                  {summarySortedHouses
                    .filter(h => summaryStatusFilter === "all" || h.status === summaryStatusFilter)
                    .map((house, i) => {
                      const score = getScore(house).total;
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
