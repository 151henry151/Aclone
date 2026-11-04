// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';

/** Bounds and labels are shared by validation and the editor; defaults live in settings.json. */
export const flightRuleFields = {
  flightStrictLanding: { label: 'Strict landing contacts (legacy limits)' },
  flightLandingSink: { label: 'Maximum landing sink (m/s)', min: 1, max: 20 },
  flightLandingBank: { label: 'Maximum landing bank (degrees)', min: 1, max: 60 },
  flightLandingPitchMin: { label: 'Minimum landing pitch (degrees)', min: -45, max: 0 },
  flightLandingPitchMax: { label: 'Maximum landing pitch (degrees)', min: 1, max: 45 },
  flightLandingSlip: { label: 'Maximum landing slip (degrees)', min: 1, max: 90 },
  flightLandingSpeed: { label: 'Maximum landing speed (m/s)', min: 10, max: 80 },
  flightAirbrake: { label: 'Enable airborne B brake' },
  flightAirbrakeDrag: { label: 'Airbrake drag coefficient', min: 0, max: 0.5 },
  flightApproachSpeed: { label: 'Approach speed (m/s)', min: 20, max: 40 },
  flightKeyboardAuthority: { label: 'Keyboard and touch stick authority', min: 0.1, max: 1 },
  flightStability: { label: 'Released stick stability (0 = off)', min: 0, max: 4 },
  flightThrottleRate: { label: 'Throttle change per second', min: 0.05, max: 1 },
  flightWheelBrake: { label: 'Wheel brake deceleration (m/s²)', min: 1, max: 15 },
  flightWheelbase: { label: 'Ground slope sampling wheelbase (m)', min: 0.5, max: 20 },
  flightWingHalfSpan: { label: 'Ground wing sampling half-span (m)', min: 1, max: 20 },
  flightWingClearance: { label: 'Ground wing terrain clearance (m)', min: 0.1, max: 10 },
  flightGroundWingSpeed: { label: 'Ground wing strike minimum speed (m/s)', min: 0, max: 40 },
  flightGroundDrop: { label: 'Abrupt ground drop before wheels unstick (m)', min: 0.01, max: 2 },
  runwayLength: { label: 'Public runway target length (m)', min: 220, max: 800 },
  runwayWidth: { label: 'Public runway width (m)', min: 18, max: 60 },
  runwayShoulder: { label: 'Runway shoulder blend (m)', min: 3, max: 40 },
  runwayClearance: { label: 'Level clearance beyond runway paint (m)', min: 4, max: 30 },
  runwayMaxGrade: { label: 'Maximum public runway grading relief (m)', min: 0, max: 5 },
} as const;
export type FlightRuleKey = keyof typeof flightRuleFields;
export type FlightRules = Pick<typeof defaults, FlightRuleKey>;
export function flightRules(settings: Partial<FlightRules> = {}): FlightRules {
  return Object.fromEntries(
    Object.keys(flightRuleFields).map((key) => [
      key,
      settings[key as FlightRuleKey] ?? defaults[key as FlightRuleKey],
    ]),
  ) as FlightRules;
}
/** Strict is a selectable contact preset, independent of stability and braking. */
export const strictLanding = {
  sink: 3.5,
  bank: (12 * Math.PI) / 180,
  pitchMin: -0.1,
  pitchMax: (20 * Math.PI) / 180,
  slip: 0.35,
  speed: 36,
};
export function landingLimits(settings?: Partial<FlightRules>) {
  const r = flightRules(settings);
  return r.flightStrictLanding
    ? strictLanding
    : {
        sink: r.flightLandingSink,
        bank: (r.flightLandingBank * Math.PI) / 180,
        pitchMin: (r.flightLandingPitchMin * Math.PI) / 180,
        pitchMax: (r.flightLandingPitchMax * Math.PI) / 180,
        slip: (r.flightLandingSlip * Math.PI) / 180,
        speed: r.flightLandingSpeed,
      };
}
