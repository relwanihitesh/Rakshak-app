// ── AI Priority Score Engine ──
const getAIPriorityScore = (condition) => {
  const text = condition.toLowerCase();

  const CRITICAL = ['accident','trauma','unconscious','not breathing','cardiac arrest','seizure','stroke','bleeding heavily','gunshot','drowning'];
  const SEVERE   = ['heart attack','cardiac','chest pain','difficulty breathing','severe burn','fracture','head injury','paralysis','poisoning'];
  const MODERATE = ['fracture','burn','moderate pain','vomiting blood','high fever','allergic reaction','broken bone','sprain'];
  const LOW      = ['fever','cold','headache','minor cut','nausea','dizziness','minor injury','stomach pain','cough'];

  let score = 10;
  let level = 'LOW';

  if (CRITICAL.some(k => text.includes(k))) { score = Math.floor(Math.random() * 11) + 90; level = 'CRITICAL'; }
  else if (SEVERE.some(k => text.includes(k))) { score = Math.floor(Math.random() * 20) + 70; level = 'SEVERE'; }
  else if (MODERATE.some(k => text.includes(k))) { score = Math.floor(Math.random() * 30) + 40; level = 'MODERATE'; }
  else if (LOW.some(k => text.includes(k))) { score = Math.floor(Math.random() * 30) + 10; level = 'LOW'; }
  else { score = Math.floor(Math.random() * 40) + 20; level = 'LOW'; }

  return { score, level };
};

// ── Haversine Distance Formula ──
const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // km
};

// ── Bed Availability Checker ──
const getRequiredBedType = (condition) => {
  const text = condition.toLowerCase();
  if (['accident','trauma','gunshot','fracture','bleeding'].some(k => text.includes(k))) return 'trauma';
  if (['heart attack','cardiac','cardiac arrest','stroke','chest pain'].some(k => text.includes(k))) return 'icu';
  return 'general';
};

// ── Composite Score Engine ──
// CS = (w1 * P) + (w2 * D) + (w3 * A)
// w1=0.5 (priority), w2=0.3 (distance), w3=0.2 (availability)
const computeCompositeScore = (priorityScore, distanceKm, bedsAvailable) => {
  const w1 = 0.5, w2 = 0.3, w3 = 0.2;
  const P = priorityScore;                         // 0-100
  const D = distanceKm > 0 ? (1 / distanceKm) * 100 : 100; // inverse distance scaled
  const A = bedsAvailable ? 100 : 0;               // 0 or 100
  return parseFloat(((w1 * P) + (w2 * D) + (w3 * A)).toFixed(2));
};

// ── Rank Hospitals ──
const rankHospitals = (hospitals, patientLat, patientLon, condition, priorityScore) => {
  const bedType = getRequiredBedType(condition);
  const THRESHOLD_KM = 30;

  const ranked = hospitals
    .map(hospital => {
      const distance = haversineDistance(patientLat, patientLon, hospital.location.lat, hospital.location.lon);
      const bedsAvailable = hospital.beds[bedType] > 0;
      const cs = computeCompositeScore(priorityScore, distance, bedsAvailable);
      return {
        hospital:       hospital._id,
        hospitalData:   hospital,
        distance:       parseFloat(distance.toFixed(2)),
        bedsAvailable,
        bedType,
        compositeScore: cs
      };
    })
    .filter(h => h.distance <= THRESHOLD_KM)
    .sort((a, b) => b.compositeScore - a.compositeScore);

  return ranked;
};

module.exports = { getAIPriorityScore, haversineDistance, getRequiredBedType, computeCompositeScore, rankHospitals };
