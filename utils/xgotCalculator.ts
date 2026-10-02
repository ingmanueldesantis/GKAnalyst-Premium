import { SoccerEvent, ShotXgotInput, XgotCalculationResult, SessionXgotSummary, Language } from '../types';

/**
 * Opta & StatsBomb Expected Goals on Target (xGOT / Post-Shot xG) Engine
 * Standard pitch specifications:
 * Width: 68m (-34m to +34m relative to center)
 * Half-Pitch Length: 52.5m (0m at goal line to 52.5m at midfield)
 * Goal Dimensions: 7.32m width x 2.44m height
 */

export function pitchCoordsToMeters(pitchX: number, pitchY: number): { xMeters: number; yMeters: number; distance: number; angleDegrees: number } {
  // pitchX: 0 = left touchline, 50 = central axis, 100 = right touchline
  const xMeters = ((pitchX - 50) / 50) * 34;
  // pitchY: 0 = goal line, 100 = midfield line (52.5m)
  const yMeters = Math.max(0.5, (pitchY / 100) * 52.5);

  const distance = Math.sqrt(xMeters * xMeters + yMeters * yMeters);

  // Angle subtended by the two goal posts (-3.66m and +3.66m at y=0)
  const leftPostX = -3.66;
  const rightPostX = 3.66;

  const v1x = leftPostX - xMeters;
  const v1y = 0 - yMeters;
  const v2x = rightPostX - xMeters;
  const v2y = 0 - yMeters;

  const dot = v1x * v2x + v1y * v2y;
  const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
  const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);

  const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  const angleRad = Math.acos(cosAngle);
  const angleDegrees = (angleRad * 180) / Math.PI;

  return {
    xMeters: Number(xMeters.toFixed(1)),
    yMeters: Number(yMeters.toFixed(1)),
    distance: Number(distance.toFixed(1)),
    angleDegrees: Number(angleDegrees.toFixed(1)),
  };
}

export function getPitchZoneName(xMeters: number, yMeters: number, lang: Language = 'it'): string {
  const isIt = lang === 'it';
  const isEs = lang === 'es';

  // 6-yard box (Area piccola): y <= 5.5m and |x| <= 9.16m
  if (yMeters <= 5.5 && Math.abs(xMeters) <= 9.16) {
    if (isIt) return 'Area Piccola (5m)';
    if (isEs) return 'Área Pequeña (5m)';
    return '6-Yard Box';
  }

  // Penalty spot (Dischetto): y between 9.5 and 12.5 and |x| <= 2
  if (yMeters >= 9.5 && yMeters <= 12.5 && Math.abs(xMeters) <= 2.2) {
    if (isIt) return 'Dischetto del Rigore (11m)';
    if (isEs) return 'Punto de Penalti (11m)';
    return 'Penalty Spot (11m)';
  }

  // Penalty area (Area di rigore): y <= 16.5m and |x| <= 20.16m
  if (yMeters <= 16.5 && Math.abs(xMeters) <= 20.16) {
    if (Math.abs(xMeters) <= 7.0) {
      if (isIt) return 'Area di Rigore Centrale';
      if (isEs) return 'Área de Penalti Central';
      return 'Central Penalty Area';
    }
    if (xMeters < 0) {
      if (isIt) return 'Area di Rigore Sx';
      if (isEs) return 'Área de Penalti Izq';
      return 'Penalty Area Left';
    }
    if (isIt) return 'Area di Rigore Dx';
    if (isEs) return 'Área de Penalti Der';
    return 'Penalty Area Right';
  }

  // D-box / Penalty arc: y between 16.5 and 21.5, |x| <= 9
  if (yMeters <= 21.5 && Math.abs(xMeters) <= 9.0) {
    if (isIt) return 'Lunetta dell\'Area (18-21m)';
    if (isEs) return 'Medialuna del Área (18-21m)';
    return 'Penalty Arc / D-Box';
  }

  // Outside box
  if (yMeters <= 26.0) {
    if (Math.abs(xMeters) <= 12.0) {
      if (isIt) return 'Fuori Area Centrale (20-25m)';
      if (isEs) return 'Fuera del Área Central (20-25m)';
      return 'Central Outside Box (20-25m)';
    }
    if (xMeters < 0) {
      if (isIt) return 'Tre-Quarti Sinistra';
      if (isEs) return 'Tres Cuartos Izquierda';
      return 'Left Flank / Half-space';
    }
    if (isIt) return 'Tre-Quarti Destra';
    if (isEs) return 'Tres Cuartos Derecha';
    return 'Right Flank / Half-space';
  }

  // Long distance
  if (isIt) return `Distanza Lunga (${yMeters.toFixed(0)}m)`;
  if (isEs) return `Larga Distancia (${yMeters.toFixed(0)}m)`;
  return `Long Range (${yMeters.toFixed(0)}m)`;
}

/**
 * Calculates Opta Analyst-calibrated xG (Pre-shot) and xGOT (Expected Goals on Target Conceded)
 * Incorporating shot distance, shooting angle, action type, body part (foot vs header),
 * goalmouth end-location, and deflection dynamics.
 */
export function calculateXgot(input: ShotXgotInput, lang: Language = 'it'): XgotCalculationResult {
  const { distance, angleDegrees, xMeters, yMeters } = pitchCoordsToMeters(input.pitchX, input.pitchY);
  const zoneName = getPitchZoneName(xMeters, yMeters, lang);
  const isHeader = input.bodyPart === 'header';
  const isPower = input.power === 'power';
  const isIt = lang === 'it';
  const isEs = lang === 'es';

  // 1. OPTA PRE-SHOT xG MODEL (Baseline chance quality prior to ball strike)
  let preShotXg = 0;

  if (input.situation === 'penalty') {
    preShotXg = 0.785; // Opta standard penalty benchmark (~78.5%)
  } else {
    // Angular component in radians
    const angleRad = (angleDegrees * Math.PI) / 180;
    // Logistic curve: steep decay with distance, positive expansion with angle
    const logit = -1.18 - 0.098 * distance + 1.88 * Math.sin(angleRad) - 0.0015 * (distance * distance);
    let rawProb = 1 / (1 + Math.exp(-logit));

    // Body Part Modifier (Opta data: headers convert at roughly 52-58% of equivalent foot strikes)
    if (isHeader) {
      rawProb *= 0.54;
    }

    // Action Type / Phase of Play Modifier
    if (input.situation === 'free_kick') {
      rawProb *= 0.72; // Defensive wall obstacle
    } else if (input.situation === 'fast_break') {
      rawProb = rawProb + 0.25 * (1 - rawProb); // 1v1 / fast transition against isolated keeper
    }

    // Pressure modifier
    if (input.pressure === 'open') {
      rawProb *= 1.14;
    } else if (input.pressure === 'obstructed') {
      rawProb *= 0.80;
    }

    preShotXg = Math.max(0.01, Math.min(0.96, rawProb));
  }

  // 2. OPTA POST-SHOT xGOT (Expected Goals on Target Conceded)
  // Opta Analyst Axiom: Shots off-target or hitting the woodwork without going in have xGOT = 0.00
  const isOffTarget = input.outcome === 'Out' || input.outcome === 'Post';

  if (isOffTarget) {
    let explanation = '';
    if (input.outcome === 'Out') {
      explanation = isIt
        ? 'Tiro fuori dallo specchio della porta. Secondo il modello Opta Analyst, xGOT = 0.00.'
        : isEs
        ? 'Tiro fuera de la portería. Según el modelo Opta Analyst, xGOT = 0.00.'
        : 'Shot off target. Under Opta Analyst data provider standards, xGOT = 0.00.';
    } else {
      explanation = isIt
        ? 'Tiro sul palo/traversa. Secondo il modello Opta Analyst, la palla non entra nello specchio: xGOT = 0.00.'
        : isEs
        ? 'Tiro al poste. Según el modelo Opta Analyst, no va a puerta: xGOT = 0.00.'
        : 'Shot hit the woodwork. Under Opta Analyst standards, xGOT is 0.00.';
    }

    return {
      distanceMeters: distance,
      angleDegrees,
      zoneName,
      xG: Number(preShotXg.toFixed(2)),
      xGOT: 0,
      targetDifficulty: 'Off-Target',
      differential: Number((-preShotXg).toFixed(2)),
      explanation,
      optaBreakdown: {
        flightTimeSeconds: Number((distance / (isHeader ? 12.5 : isPower ? 29.5 : 25.0)).toFixed(2)),
        distanceFactor: 0,
        angleFactor: 0,
        actionType: input.situation,
        actionMultiplier: 0,
        bodyPart: input.bodyPart,
        bodyPartMultiplier: 0,
        placementScore: 0,
        isDeflected: input.isDeflected,
        deflectionBonus: 0,
      },
    };
  }

  // 3. GOALMOUTH PLACEMENT COORDINATES (Target End-Location in Goal Frame)
  // Coordinate bounds in SoccerGoal.tsx:
  // Left post: ~9.7%, Right post: ~90.3%
  // Crossbar: ~19.3%, Goal line: ~73.3%
  const goalLeft = 9.7;
  const goalRight = 90.3;
  const goalTop = 19.3;
  const goalBottom = 73.3;

  // Normalized horizontally (0 = left post, 0.5 = center, 1 = right post)
  const normX = Math.max(0, Math.min(1, (input.goalX - goalLeft) / (goalRight - goalLeft)));
  // Normalized vertically (0 = crossbar top, 1 = ground line)
  const normY = Math.max(0, Math.min(1, (input.goalY - goalTop) / (goalBottom - goalTop)));

  // Horizontal distance from center (0 = central, 1 = post)
  const lateralOffset = Math.abs(normX - 0.5) * 2;
  // Height from ground (0 = ground, 1 = top crossbar)
  const heightFromGround = 1 - normY;

  // Baseline placement difficulty factor inside goal
  // Proximity to lateral posts forces full diving extensions (7.32m width)
  const lateralFactor = Math.pow(lateralOffset, 1.35);
  // Height factor: balls near crossbar or ground corners require maximum agility
  const upperFactor = Math.pow(heightFromGround, 1.2);

  // Combined goal target score
  let placementScore = 0.18 + 0.54 * lateralFactor + 0.20 * upperFactor;

  // Upper corners ("incrocio dei pali / sette") synergy bonus
  if (lateralOffset > 0.65 && heightFromGround > 0.65) {
    placementScore += 0.14;
  }
  // Bottom corners ("a fil di palo") diving difficulty
  if (lateralOffset > 0.75 && heightFromGround < 0.30) {
    placementScore += 0.08;
  }
  // Upper central under crossbar
  if (lateralOffset < 0.30 && heightFromGround > 0.70) {
    placementScore += 0.06;
  }

  // 4. DISTANCE DYNAMICS & GOALKEEPER FLIGHT REACTION (Opta Analyst Velocity Model)
  // Ball velocity: Header (~12.5 m/s, ~45 km/h) vs Foot placed (~25 m/s, ~90 km/h) vs Foot power (~29.5 m/s, ~106 km/h)
  const ballSpeedMps = isHeader ? 12.5 : isPower ? 29.5 : 25.0;
  const flightTimeSeconds = Number((distance / ballSpeedMps).toFixed(2));

  // Opta distance decay curve:
  // At close range (d <= 5.5m), flight time < 0.25s (less than human visual reaction time ~0.22s).
  // At medium range (11m - 16m), flight time is 0.44s - 0.65s (keeper has time to dive for corners).
  // At long range (> 25m), flight time > 1.0s (keeper has time to step, set, and extend).
  let distanceFactor = 1.0;
  if (distance <= 5.5) {
    distanceFactor = 1.35; // Point-blank 6-yard box
  } else if (distance <= 11) {
    distanceFactor = 1.15 - ((distance - 5.5) / 5.5) * 0.15; // 1.15 down to 1.00
  } else if (distance <= 20) {
    distanceFactor = 1.00 - ((distance - 11) / 9) * 0.28; // 1.00 down to 0.72
  } else if (distance <= 30) {
    distanceFactor = 0.72 - ((distance - 20) / 10) * 0.32; // 0.72 down to 0.40
  } else {
    distanceFactor = Math.max(0.18, 0.40 - ((distance - 30) / 15) * 0.22); // Long range (>30m)
  }

  // 5. SHOT ANGLE FACTOR (Opta Analyst Angle Subtended Model)
  // Central shots (angleDegrees >= 25°) allow the shooter to target either post equally,
  // forcing the goalkeeper to defend the entire 7.32m goalmouth.
  // Tight/acute angle shots (< 25°, e.g. from the flanks) allow the goalkeeper to cover the near post,
  // substantially reducing the unblocked goal area.
  let angleFactor = 1.0;
  if (angleDegrees < 28) {
    angleFactor = Math.max(0.68, 0.68 + 0.32 * (angleDegrees / 28));
  } else {
    angleFactor = Math.min(1.08, 1.0 + 0.08 * Math.min(1, (angleDegrees - 28) / 30));
  }

  // 6. BODY PART DYNAMICS (Piede vs Testa - Opta Analyst Body Part Benchmark)
  // Headers travel at approximately half the speed of foot strikes (~45 km/h vs ~90-105 km/h).
  // Outside the 6-yard box, the increased flight duration gives the goalkeeper significantly
  // more reaction time to track and save the ball.
  // In the 6-yard box (<= 5.5m), headers remain extremely lethal due to downward turf bounce.
  let bodyPartMultiplier = 1.0;
  if (isHeader) {
    if (distance <= 5.5) {
      bodyPartMultiplier = 0.92;
    } else if (distance <= 12) {
      bodyPartMultiplier = 0.70;
    } else {
      bodyPartMultiplier = Math.max(0.48, 0.70 - ((distance - 12) / 10) * 0.22);
    }
  } else {
    bodyPartMultiplier = 1.0; // Foot strike
  }

  // 7. ACTION TYPE / GAME SITUATION (Opta Analyst Situation Calibration)
  let actionMultiplier = 1.0;
  if (input.situation === 'penalty') {
    // 11m unobstructed penalty
    actionMultiplier = lateralOffset > 0.5 ? 1.25 : 0.88;
  } else if (input.situation === 'fast_break') {
    // 1v1 / fast transition against isolated keeper: +20% conversion advantage
    actionMultiplier = 1.20;
  } else if (input.situation === 'free_kick') {
    // Direct free kick over wall: high corners lethal, goalkeeper-side defended
    actionMultiplier = (lateralOffset > 0.6 && heightFromGround > 0.6) ? 1.10 : 0.82;
  } else {
    // Open play
    actionMultiplier = 1.0;
  }

  // 8. COMBINED OPTA ANALYST SYNTHESIS
  let calculatedXgot = placementScore * distanceFactor * angleFactor * bodyPartMultiplier * actionMultiplier;

  // Shot power adjustment (booted power strikes)
  if (isPower && !isHeader) {
    calculatedXgot *= 1.10;
  }

  // Obstructed / screened sightline adjustment
  if (input.pressure === 'obstructed') {
    calculatedXgot = calculatedXgot + 0.12 * (1 - calculatedXgot);
  }

  // Deflection dynamics (Opta Analyst: deflections severely disorient GK position)
  let deflectionBonus = 0;
  if (input.isDeflected) {
    deflectionBonus = 0.32 * (1 - calculatedXgot);
    calculatedXgot = calculatedXgot + deflectionBonus;
  }

  // Penalty kick specific calibration floor
  if (input.situation === 'penalty') {
    if (lateralOffset > 0.6) {
      calculatedXgot = Math.max(0.88, calculatedXgot);
    } else if (lateralOffset < 0.25 && heightFromGround < 0.40) {
      calculatedXgot = Math.max(0.45, Math.min(0.58, calculatedXgot));
    }
  }

  // Absolute floor for point-blank shots on target (<= 5.5m)
  if (distance <= 5.5) {
    calculatedXgot = Math.max(0.68, calculatedXgot);
  }

  // High pre-shot chance floor (e.g. tap-in on target stays high xGOT)
  if (preShotXg > 0.65) {
    calculatedXgot = Math.max(calculatedXgot, preShotXg * 0.90);
  }

  // Final clamp to realistic probabilities [0.02, 0.99]
  calculatedXgot = Math.max(0.02, Math.min(0.99, calculatedXgot));

  // Determine difficulty level
  let targetDifficulty: XgotCalculationResult['targetDifficulty'] = 'Medium';
  if (calculatedXgot >= 0.75) targetDifficulty = 'Extreme';
  else if (calculatedXgot >= 0.45) targetDifficulty = 'High';
  else if (calculatedXgot >= 0.22) targetDifficulty = 'Medium';
  else targetDifficulty = 'Low';

  const diff = Number((calculatedXgot - preShotXg).toFixed(2));

  // Explanatory note grounded in Opta Analyst methodology
  const actionLabel = input.situation === 'penalty'
    ? isIt ? 'Rigore (11m)' : 'Penalty'
    : input.situation === 'fast_break'
    ? isIt ? 'Contropiede 1v1' : 'Fast Break'
    : input.situation === 'free_kick'
    ? isIt ? 'Punizione' : 'Free Kick'
    : isIt ? 'Azione Aperta' : 'Open Play';

  const bodyPartLabel = isHeader
    ? isIt ? 'Colpo di Testa (volo ~45 km/h)' : 'Header (~45 km/h)'
    : isIt ? 'Piede (volo ~90-105 km/h)' : 'Foot (~90-105 km/h)';

  let explanation = '';
  if (isIt) {
    explanation = `Modello Opta Analyst: calcolato con distanza ${distance}m, angolo ${angleDegrees}°, ${actionLabel} e ${bodyPartLabel}${input.isDeflected ? ' [Tiro Deviato]' : ''}. Difficoltà ${targetDifficulty === 'Extreme' ? 'estrema' : targetDifficulty === 'High' ? 'alta' : targetDifficulty === 'Medium' ? 'media' : 'bassa'} (${(calculatedXgot * 100).toFixed(0)}% xGOT).`;
  } else if (isEs) {
    explanation = `Modelo Opta Analyst: distancia ${distance}m, ángulo ${angleDegrees}°, ${actionLabel}, ${bodyPartLabel}${input.isDeflected ? ' [Desviado]' : ''}. Dificultad ${targetDifficulty} (${(calculatedXgot * 100).toFixed(0)}% xGOT).`;
  } else {
    explanation = `Opta Analyst Model: distance ${distance}m, angle ${angleDegrees}°, ${actionLabel}, ${bodyPartLabel}${input.isDeflected ? ' [Deflected]' : ''}. Difficulty ${targetDifficulty} (${(calculatedXgot * 100).toFixed(0)}% xGOT).`;
  }

  return {
    distanceMeters: distance,
    angleDegrees,
    zoneName,
    xG: Number(preShotXg.toFixed(2)),
    xGOT: Number(calculatedXgot.toFixed(2)),
    targetDifficulty,
    differential: diff,
    explanation,
    optaBreakdown: {
      flightTimeSeconds,
      distanceFactor: Number(distanceFactor.toFixed(2)),
      angleFactor: Number(angleFactor.toFixed(2)),
      actionType: input.situation,
      actionMultiplier: Number(actionMultiplier.toFixed(2)),
      bodyPart: input.bodyPart,
      bodyPartMultiplier: Number(bodyPartMultiplier.toFixed(2)),
      placementScore: Number(placementScore.toFixed(2)),
      isDeflected: input.isDeflected,
      deflectionBonus: Number(deflectionBonus.toFixed(2)),
    },
  };
}

/**
 * Computes Session Aggregate xGOT metrics for the goalkeeper
 */
export function calculateSessionXgotSummary(events: SoccerEvent[]): SessionXgotSummary {
  const saveEvents = events.filter((e) => e.mode === 'Saves');
  const shots = saveEvents.filter((e) => e.type === 'Shot' || e.type === 'Free Kick' || e.type === 'Penalty' || e.type === 'Rush out');

  let totalShots = shots.length;
  let shotsOnTarget = 0;
  let goalsConceded = 0;
  let savesOnTarget = 0;
  let totalXGConceded = 0;
  let totalXgotConceded = 0;

  for (const shot of shots) {
    // If xG or xGOT was saved on the event, use it; otherwise compute from coordinates
    let shotXg = shot.xG;
    let shotXgot = shot.xGOT;

    if (shotXgot === undefined || shotXg === undefined) {
      const defaultPitchX = shot.pitchX !== undefined ? shot.pitchX : 50;
      const defaultPitchY = shot.pitchY !== undefined ? shot.pitchY : 32; // ~17m default if not set
      const result = calculateXgot({
        pitchX: defaultPitchX,
        pitchY: defaultPitchY,
        goalX: shot.x >= 0 ? shot.x : 50,
        goalY: shot.y >= 0 ? shot.y : 60,
        bodyPart: shot.shotBodyPart || 'foot',
        situation: shot.shotSituation || (shot.type === 'Penalty' ? 'penalty' : shot.type === 'Free Kick' ? 'free_kick' : 'open_play'),
        pressure: shot.shotPressure || 'open',
        power: shot.shotPower || (shot.type === 'Free Kick' || shot.shotSituation === 'free_kick' ? 'placed' : 'power'),
        isDeflected: shot.isDeflected || shot.outcome === 'Deflected',
        outcome: shot.outcome,
        type: shot.type,
      });
      shotXg = result.xG;
      shotXgot = result.xGOT;
    }

    totalXGConceded += shotXg;

    const isOnTarget = shot.outcome === 'Goal' || shot.outcome === 'Saved' || shot.outcome === 'Blocked' || shot.outcome === 'Deflected';
    if (isOnTarget) {
      shotsOnTarget++;
      totalXgotConceded += shotXgot;
      if (shot.outcome === 'Goal') {
        goalsConceded++;
      } else {
        savesOnTarget++;
      }
    }
  }

  // Goals Prevented = xGOT Conceded - Actual Goals Conceded
  const goalsPrevented = totalXgotConceded - goalsConceded;
  const avgXgotPerShotOnTarget = shotsOnTarget > 0 ? totalXgotConceded / shotsOnTarget : 0;

  let performanceRating: SessionXgotSummary['performanceRating'] = 'average';
  if (goalsPrevented >= 1.0) {
    performanceRating = 'exceptional';
  } else if (goalsPrevented >= 0.2) {
    performanceRating = 'good';
  } else if (goalsPrevented <= -0.8) {
    performanceRating = 'below_average';
  } else {
    performanceRating = 'average';
  }

  return {
    totalShots,
    shotsOnTarget,
    goalsConceded,
    savesOnTarget,
    totalXGConceded: Number(totalXGConceded.toFixed(2)),
    totalXgConceded: Number(totalXGConceded.toFixed(2)),
    totalXgotConceded: Number(totalXgotConceded.toFixed(2)),
    goalsPrevented: Number(goalsPrevented.toFixed(2)),
    avgXgotPerShotOnTarget: Number(avgXgotPerShotOnTarget.toFixed(2)),
    performanceRating,
  };
}
